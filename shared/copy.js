// Copy buttons + the sticky join bar
document.querySelectorAll("[data-copy]").forEach(function (b) {
  b.addEventListener("click", function () {
    var el = document.getElementById(b.dataset.copy), t = el.innerText;
    var done = function () { var o = b.textContent; b.textContent = "Copied ✓"; setTimeout(function () { b.textContent = o; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done);
    else { var r = document.createRange(); r.selectNode(el); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); done(); }
  });
});
(function () {
  var bar = document.querySelector(".sticky"), sys = document.querySelector(".system");
  if (!bar || !sys || !("IntersectionObserver" in window)) return;
  var seen = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting || e.boundingClientRect.top < 0) seen = true; });
    bar.classList.toggle("on", seen && !document.querySelector(".join").matches(":hover"));
  }).observe(sys);
  var join = document.querySelector(".join");
  new IntersectionObserver(function (es) { es.forEach(function (e) { if (seen) bar.classList.toggle("on", !e.isIntersecting); }); }).observe(join);
})();
