// "Safelight" motion: a warm darkroom light travels with the reader.
// Cards and the cover tilt in 3D as they cross the screen and catch the light;
// the step wire fills as you read. Content is visible without this script.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  if (!reduce) root.classList.add("motion");

  // videos: show the hook thumbnail clean (no control bar over it) behind one big play button
  [].slice.call(document.querySelectorAll("video.vid")).forEach(function (v) {
    var w = document.createElement("div");
    w.className = "vwrap " + (v.classList.contains("wide") ? "wide" : "tall");
    v.parentNode.insertBefore(w, v); w.appendChild(v);
    v.removeAttribute("controls");
    var b = document.createElement("button");
    b.className = "playbtn"; b.type = "button"; b.setAttribute("aria-label", "Play the video");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
    w.appendChild(b);
    b.addEventListener("click", function () { v.controls = true; w.classList.add("playing"); v.play(); });
  });

  var tilts = [].slice.call(document.querySelectorAll(".hero, ol.steps > li, .benefit, .join, .faq details, .vwrap, pre"));
  var visible = new Set();
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.isIntersecting ? visible.add(e.target) : visible.delete(e.target); });
    ask();
  }, { rootMargin: "80px 0px" });
  tilts.forEach(function (el) { el.classList.add("lit"); io.observe(el); });

  var steps = document.querySelector("ol.steps");
  var sys = document.querySelector(".system");
  var join = document.querySelector(".join");
  var bar = document.querySelector(".sticky");
  var queued = false;
  function ask() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  function frame() {
    queued = false;
    var vh = window.innerHeight, sy = window.scrollY, max = document.documentElement.scrollHeight - vh;
    root.style.setProperty("--scroll", (max > 0 ? sy / max : 0).toFixed(4));

    // every lit element: v = -1 (entering at the bottom) .. 0 (centre) .. 1 (leaving at the top)
    visible.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var v = ((vh / 2) - (r.top + r.height / 2)) / (vh / 2 + r.height / 2);
      v = Math.max(-1, Math.min(1, v));
      el.style.setProperty("--v", v.toFixed(3));
    });

    if (steps) {
      var r = steps.getBoundingClientRect();
      var p = (vh * 0.6 - r.top) / r.height;
      steps.style.setProperty("--fill", Math.max(0, Math.min(1, p)).toFixed(3));
    }
    if (sys) {
      var s = sys.getBoundingClientRect();
      // the light "turns on" while the community section is on screen
      var on = Math.max(0, Math.min(1, (vh - s.top) / (vh * 0.6))) * (s.bottom > vh * 0.2 ? 1 : 0.4);
      root.style.setProperty("--safelight", on.toFixed(3));
      if (bar) {
        var btnOnScreen = [].some.call(document.querySelectorAll(".bigbtn"), function (b) { var r = b.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
        bar.classList.toggle("on", s.top < vh * 0.5 && !btnOnScreen);
      }
    }
  }
  window.addEventListener("scroll", ask, { passive: true });
  window.addEventListener("resize", ask);
  frame();

  // one sheen across the join card when it first comes into view
  if (join && !reduce) {
    new IntersectionObserver(function (es, obs) {
      es.forEach(function (e) { if (e.isIntersecting) { join.classList.add("shine"); obs.disconnect(); } });
    }, { threshold: 0.45 }).observe(join);
  }

  // desktop: the cover and cards also lean toward the pointer
  if (!reduce && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    tilts.forEach(function (el) {
      el.addEventListener("pointermove", function (ev) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--px", (((ev.clientX - r.left) / r.width) - 0.5).toFixed(3));
        el.style.setProperty("--py", (((ev.clientY - r.top) / r.height) - 0.5).toFixed(3));
      });
      el.addEventListener("pointerleave", function () { el.style.setProperty("--px", 0); el.style.setProperty("--py", 0); });
    });
  }
})();
