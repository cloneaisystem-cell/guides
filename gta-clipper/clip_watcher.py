"""clip_watcher.py - clip a Twitch stream LIVE while you sleep.

What it does (all free tools):
  1. streamlink records the stream from the moment it goes live (recordings/<channel>-<time>.ts)
  2. Twitch chat is read anonymously (IRC as "justinfan", no account, no token)
  3. every 10 seconds it counts chat messages and marks a spike when chat explodes
  4. ffmpeg cuts 30 seconds around each spike into a vertical 9:16 clip
  5. faster-whisper writes the captions (an .srt next to each clip, burned in if --burn)

Usage:
  python clip_watcher.py <channel> [--window 30] [--burn] [--min 25] [--sigma 2.5]
Needs: Python 3.10+, ffmpeg on PATH, pip install streamlink faster-whisper
Stop it with Ctrl+C. Only clip streams you have permission to use; platforms set their own rules for re-uploads.
"""
import argparse, collections, datetime as dt, os, random, socket, statistics, subprocess, sys, threading, time

p = argparse.ArgumentParser()
p.add_argument("channel")
p.add_argument("--window", type=int, default=30, help="clip length in seconds")
p.add_argument("--bucket", type=int, default=10, help="seconds per chat count")
p.add_argument("--sigma", type=float, default=2.5, help="spike = this many std devs above the recent average")
p.add_argument("--min", type=int, default=25, help="minimum messages in a bucket to count as a spike")
p.add_argument("--burn", action="store_true", help="burn captions into the clip")
p.add_argument("--quality", default="720p60,720p,best", help="streamlink quality list, first available wins")
a = p.parse_args()
CH = a.channel.lower().lstrip("#")
os.makedirs("recordings", exist_ok=True); os.makedirs("clips", exist_ok=True)


def log(*m): print(dt.datetime.now().strftime("%H:%M:%S"), *m, flush=True)


# 1. wait for the stream, then record it --------------------------------------
def wait_and_record():
    while True:
        r = subprocess.run(["streamlink", "--json", f"https://twitch.tv/{CH}"], capture_output=True, text=True)
        if '"streams"' in r.stdout and '"error"' not in r.stdout:
            break
        log("offline, checking again in 30 s"); time.sleep(30)
    path = os.path.join("recordings", f"{CH}-{dt.datetime.now():%Y%m%d-%H%M%S}.ts")
    log("LIVE, recording to", path)
    proc = subprocess.Popen(["streamlink", "--twitch-disable-ads", f"https://twitch.tv/{CH}", a.quality, "-o", path],
                            stdout=subprocess.DEVNULL, stderr=open(path + ".log", "w"))
    return path, time.time(), proc


# 2. read chat anonymously ------------------------------------------------------
counts = collections.Counter()  # bucket index -> messages


def chat_reader(t0):
    while True:
        try:
            s = socket.create_connection(("irc.chat.twitch.tv", 6667), timeout=300)
            s.sendall(f"NICK justinfan{random.randint(10000, 99999)}\r\nJOIN #{CH}\r\n".encode())
            log("chat connected (anonymous)")
            buf = ""
            while True:
                data = s.recv(4096).decode(errors="ignore")
                if not data: break
                buf += data
                *lines, buf = buf.split("\r\n")
                for line in lines:
                    if line.startswith("PING"): s.sendall(b"PONG :tmi.twitch.tv\r\n")
                    elif " PRIVMSG " in line: counts[int((time.time() - t0) // a.bucket)] += 1
        except OSError as e:
            log("chat reconnect:", e); time.sleep(5)


# 3-5. spot spikes, cut, caption ----------------------------------------------
_model = None


def captions(clip):
    global _model
    from faster_whisper import WhisperModel
    if _model is None: _model = WhisperModel("small", device="cpu", compute_type="int8")
    import numpy as np  # decode with ffmpeg (avoids PyAV version problems)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", clip, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = _model.transcribe(np.frombuffer(raw, np.float32), vad_filter=True)
    srt = clip[:-4] + ".srt"
    def ts(x): return f"{int(x//3600):02d}:{int(x%3600//60):02d}:{int(x%60):02d},{int(x*1000%1000):03d}"
    with open(srt, "w", encoding="utf-8") as f:
        for i, sg in enumerate(segs, 1): f.write(f"{i}\n{ts(sg.start)} --> {ts(sg.end)}\n{sg.text.strip()}\n\n")
    return srt


def cut(rec, at, n):
    start = max(0, at - a.window / 2)
    out = os.path.join("clips", f"{CH}-{n:03d}-{int(at)}s.mp4")
    vf = "crop=ih*9/16:ih,scale=1080:1920"  # centre crop to vertical
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.1f}", "-i", rec, "-t", str(a.window), "-vf", vf,
                    "-c:v", "libx264", "-crf", "20", "-c:a", "aac", out], check=True)
    srt = captions(out)
    if a.burn:
        burned = out[:-4] + "-captions.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.basename(out), "-vf",
                        f"subtitles={os.path.basename(srt)}:force_style='Fontsize=14,Bold=1,Alignment=2,MarginV=60'",
                        "-c:a", "copy", os.path.basename(burned)], check=True, cwd=os.path.dirname(out))
    log(f"CLIP {n}: {out}")


def main():
    rec, t0, proc = wait_and_record()
    threading.Thread(target=chat_reader, args=(t0,), daemon=True).start()
    n, last_clip, history = 0, -999, []
    try:
        while proc.poll() is None:
            time.sleep(a.bucket)
            b = int((time.time() - t0) // a.bucket) - 1          # last finished bucket
            c = counts.get(b, 0); history.append(c)
            recent = history[-30:-1]                               # last ~5 minutes
            if len(recent) >= 6:
                mu, sd = statistics.mean(recent), statistics.pstdev(recent) or 1
                at = (b + 0.5) * a.bucket
                if c >= a.min and c > mu + a.sigma * sd and at - last_clip > a.window:
                    log(f"spike: {c} msgs in {a.bucket}s (avg {mu:.1f})")
                    time.sleep(a.window / 2 + 5)                   # let the recording catch up
                    n += 1; last_clip = at
                    threading.Thread(target=cut, args=(rec, at, n), daemon=True).start()
        log("recording stopped (stream ended or streamlink error, see", rec + ".log):", rec)
    except KeyboardInterrupt:
        proc.terminate(); log("stopped; clips are in ./clips")


if __name__ == "__main__":
    main()
