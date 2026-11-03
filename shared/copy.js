// Copy buttons
document.querySelectorAll("[data-copy]").forEach(function (b) {
  b.addEventListener("click", function () {
    var el = document.getElementById(b.dataset.copy), t = el.innerText;
    var done = function () {
      var o = b.textContent;
      b.textContent = "Copied ✓";
      setTimeout(function () { b.textContent = o; }, 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done);
    else {
      var r = document.createRange(); r.selectNode(el);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      document.execCommand("copy"); done();
    }
  });
});
