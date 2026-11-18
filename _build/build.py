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
    "unslop": dict(
        CAMPAIGN="unslop",
        H2="Your page looks designed now. Next, bring people <em>to it</em>.",
        P="A page that no longer looks AI-made still needs visitors, and they come from a reel that gets watched to the end. I don't build mine by hand anymore: Claude Code runs my content every day, from the morning idea list to the edit, the posting and the DMs. Even the DM that sent you here went out by itself. Under a minute:",
        SPECIAL_LI="<li><b>Go Viral:</b> 8 short lessons and cheat sheets for the Reel or TikTok that sends people to your page.</li><li><b>Master Claude Code:</b> the same Claude Code you just used, with real builds and every file included.</li>",
    ),
    "pinocchio": dict(
        CAMPAIGN="pinocchio",
        H2="You made one Pinocchio. Next, make the <em>series</em>.",
        P="One character reel gets you a visit. A series gives people a reason to come back: the same face, a new crime each time, and a plan for which reel to repeat. I don't run that by hand anymore: Claude Code handles my content every day, from the morning idea list to the edit, the posting and the DMs. Even the DM that sent you here went out by itself. Under a minute:",
        SPECIAL_LI="<li><b>Go Viral:</b> 8 short lessons and cheat sheets for Reels and TikTok, so the next episode is planned instead of guessed.</li><li><b>Master Claude Code:</b> real builds with every file included. Claude writes the code, you say what you want and approve each step.</li>",
    ),
    # community block + sticky are hand-written inside the page (own Skool link, no shared video)
    "claude-instagram": dict(CAMPAIGN="claude-instagram"),
    "lilred": dict(
        CAMPAIGN="lilred",
        H2="The same reel can get 2,000 views <em>or 2 million</em>.",
        P="The story stays the same. The hook, the cover and the caption are what change, and the creators in this niche post several versions of one reel to find the winner. Planning that by hand every week is a lot, so I don't: Claude Code runs my content every day, from the morning idea list to the edit, the posting and the DMs. Even the DM that sent you here went out by itself. Under a minute:",
        SPECIAL_LI="<li><b>The LIL RED breakdown:</b> all 9 video prompts, the 7 start frames, the edit timeline and what every clip cost.</li><li><b>Go Viral:</b> 8 short lessons and cheat sheets for Reels and TikTok.</li>",
    ),
    "robie": dict(
        CAMPAIGN="robie",
        H2="Eight prompts are the easy part. <em>The cut is what makes it work.</em>",
        P="Anyone can paste the same eight prompts. What made this reel hold was what came after: where each shot was cut, which sound sits on which hit, and what I left out of the edit. I write all of that down for every reel. Claude Code runs the rest of my content every day, even the DM that sent you here. Under a minute:",
        SPECIAL_LI="<li><b>The ROBIE HOODIE breakdown:</b> all 8 video prompts, the start frames, what every clip cost, and the edit and sound-effect recipe.</li><li><b>Go Viral:</b> 8 short lessons and cheat sheets for Reels and TikTok.</li>",
    ),
    # gta: 3D hero + reel switcher live in gta/scene.js; PRICE swaps the price line in the community block
    "gta": dict(
        CAMPAIGN="gta",
        H2="Next week the trend is gone. <em>The method stays.</em>",
        P="The GTA 6 wave ends and a new one starts. What carries over is spotting a trend early, keeping one face across every shot and cutting on the beat. I build that in my community and share what works there. Claude Code runs my content every day, even the DM that sent you here. Under a minute:",
        SPECIAL_LI="<li><b>START HERE:</b> the first steps, so you know what to do in your first hour.</li><li><b>Go Viral:</b> 8 short lessons and cheat sheets for Reels and TikTok, so you pick the next trend on purpose.</li>",
        PRICE="Start with a free trial. Then $9/month until the group reaches 150 members; after that it goes up to $27/month.",
    ),
    "ai-video": dict(
        CAMPAIGN="ai-video",
        H2="Seven moves get you to good. <em>Ten reels get you to viral.</em>",
        P="Knowing the checklist is the start. What makes you better fast is posting, seeing where people stop watching and fixing one move at a time. Inside my community I take apart every reel I post, with the prompts, the edit and what each shot cost, and I reply to yours. Claude Code runs the rest of my content every day. Under a minute:",
        SPECIAL_LI="<li><b>Every reel I post, taken apart:</b> the character sheets, every video prompt, the cut and the credits, so you see the 7 moves on real reels.</li><li><b>Go Viral:</b> 8 short lessons and cheat sheets for Reels and TikTok.</li>",
        PRICE="$9/month until the group reaches 150 members, then $27/month. The price you join at stays yours.",
    ),
    "ig-agent": dict(
        CAMPAIGN="ig-agent",
        H2="The skill writes the reel. <em>Someone still has to make it.</em>",
        P="A script from /ig-reel is the start. Turning it into a reel people watch to the end takes the edit, the hook frame and a cover, and that's what I post every week in my community, with every prompt. Claude Code runs the rest of my content, even the DM that sent you here. Under a minute:",
        SPECIAL_LI="<li><b>Go Viral:</b> 8 short lessons and cheat sheets on hooks, retention and covers, the part the scripts can't do for you.</li><li><b>Every reel I post, taken apart:</b> prompts, edit and what each shot cost.</li>",
        PRICE="$9/month until the group reaches 150 members, then $27/month. The price you join at stays yours.",
    ),
    "edit-pipeline": dict(
        CAMPAIGN="edit-pipeline",
        H2="The pipeline edits the video. <em>The hook decides if anyone sees it.</em>",
        P="Claude can cut, caption and animate anything you feed it. What makes people stop scrolling is the first two seconds, and that's what I break down in my community on every reel I post, with the prompts and the edit. Claude Code runs the rest of my content, even the DM that sent you here. Under a minute:",
        SPECIAL_LI="<li><b>Master Claude Code:</b> real builds with every file included, the same setup you just installed.</li><li><b>Go Viral:</b> 8 short lessons on hooks and retention.</li>",
        PRICE="$9/month until the group reaches 150 members, then $27/month. The price you join at stays yours.",
    ),
    "gta-clipper": dict(
        CAMPAIGN="gta-clipper",
        H2="Fifty clips by morning. <em>Now pick the three that blow up.</em>",
        P="The script finds the loud moments. Picking the ones worth posting, writing the hook line and cutting them so people watch to the end is the part that grows a page, and that's what I share in my community. Claude Code runs the rest of my content, even the DM that sent you here. Under a minute:",
        SPECIAL_LI="<li><b>Go Viral:</b> 8 short lessons on hooks, captions and retention for short clips.</li><li><b>Master Claude Code:</b> real builds with every file, like this clipper.</li>",
        PRICE="$9/month until the group reaches 150 members, then $27/month. The price you join at stays yours.",
    ),

}

# the price sentence inside community.html; a page entry with PRICE replaces it (optional key)
COMMUNITY_PRICE = "Try it free for 7 days. Then $9/month or $67/year, and the price you join at stays yours. It goes up as the group grows."

community = io.open(os.path.join(B, "community.html"), encoding="utf-8").read()
for slug, v in PAGES.items():
    src = io.open(os.path.join(B, "pages", slug + ".html"), encoding="utf-8").read()
    block = community if slug != "claude-instagram" else ""
    if "PRICE" in v:
        assert COMMUNITY_PRICE in block, slug
        block = block.replace(COMMUNITY_PRICE, v["PRICE"])
    for k, val in v.items():
        block = block.replace("{{" + k + "}}", val)
    out = (src.replace("{{HEAD}}", HEAD).replace("{{COMMUNITY}}", block)
              .replace("{{STICKY}}", STICKY.replace("{{CAMPAIGN}}", v["CAMPAIGN"])))
    assert "{{" not in out, (slug, out[out.index("{{"):out.index("{{") + 40])
    os.makedirs(os.path.join(ROOT, slug), exist_ok=True)
    io.open(os.path.join(ROOT, slug, "index.html"), "w", encoding="utf-8", newline="\n").write(out)
    print("built", slug)
