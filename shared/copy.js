  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = document.getElementById(b.dataset.copy).innerText;
      var done = function () { var o = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = o; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done);
      else { var r = document.createRange(); r.selectNode(document.getElementById(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); done(); }
    });
  });
