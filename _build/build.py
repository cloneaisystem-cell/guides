"""Build the public guides: python _build/build.py  (then git push = live).

Every page = _build/pages/<slug>.html + the shared community section (_build/community.html)
filled with that page's bridge from PAGES below. New guide: copy pages/anidoodle.html,
add an entry here, write a NEW bridge (rule: never reuse one; log it in skool-breakdowns/SKOOL-BRIDGES.md).
"""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "_build")

HEAD = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Instrument+Serif:ital@1&family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../shared/guide.css">
<script src="../shared/copy.js" defer></script>
<script src="../shared/motion.js" defer></script>"""

STICKY = """<div class="sticky"><span>AI Virality Creators · 125+ creators</span><a href="https://www.skool.com/cloneai-the-ecosystem-4958/about?utm_source=instagram&amp;utm_medium=guide&amp;utm_campaign={{CAMPAIGN}}&amp;utm_content=sticky">Join the community &rarr;</a></div>"""

PAGES = {
    "anidoodle": dict(
        CAMPAIGN="potato",
        H2="You have the drawings. Here's the <em>system</em> around them.",
        P="anidoodle gives you the pictures, the motion and a score. A reel people watch to the end also needs a story with a turn, voices and a sound on every hit. I don't build that part by hand anymore: Claude Code runs my content every day, from the morning idea list to the edit, the posting and the DMs. Even the DM that sent you here went out by itself. Here it is running:",
        SPECIAL_LI="<li><b>The Early Potato breakdown:</b> the script that turned a plugin demo into a roast, the two free voices I ran on my own computer, and where every sound sits.</li>",
    ),
    "skills": dict(
        CAMPAIGN="skills",
        H2="Now make them work <em>for you</em>.",
        P="On their own, the 5 skills wait for you to type. This is the system I run on top of them every day: it brings me ideas and script drafts each morning, edits in plain English, schedules the posts and answers the DMs. Even the DM that sent you here went out by itself. You never write code, and I approve every step:",
        SPECIAL_LI="<li><b>Master Claude Code:</b> real builds with every file included, starting with the Night Shift experiment.</li>",
    ),
}

community = io.open(os.path.join(B, "community.html"), encoding="utf-8").read()
for slug, v in PAGES.items():
    src = io.open(os.path.join(B, "pages", slug + ".html"), encoding="utf-8").read()
    block = community
    for k, val in v.items():
        block = block.replace("{{" + k + "}}", val)
    out = (src.replace("{{HEAD}}", HEAD).replace("{{COMMUNITY}}", block)
              .replace("{{STICKY}}", STICKY.replace("{{CAMPAIGN}}", v["CAMPAIGN"])))
    assert "{{" not in out, (slug, out[out.index("{{"):out.index("{{") + 40])
    os.makedirs(os.path.join(ROOT, slug), exist_ok=True)
    io.open(os.path.join(ROOT, slug, "index.html"), "w", encoding="utf-8", newline="\n").write(out)
    print("built", slug)
