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
    # gta: 3D hero + reel switcher live in gta/scene.js; PRICE swaps the price line in the community block
    "gta": dict(
        CAMPAIGN="gta",
        H2="Next week the trend is gone. <em>The method stays.</em>",
        P="The GTA 6 wave ends and a new one starts. What carries over is spotting a trend early, keeping one face across every shot and cutting on the beat. I build that in my community and share what works there. Claude Code runs my content every day, even the DM that sent you here. Under a minute:",
        SPECIAL_LI="<li><b>START HERE:</b> the first steps, so you know what to do in your first hour.</li><li><b>Go Viral:</b> 8 short lessons and cheat sheets for Reels and TikTok, so you pick the next trend on purpose.</li>",
        PRICE="Start with a free trial. Then $9/month until the group reaches 150 members; after that it goes up to $27/month.",
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
