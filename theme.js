/* Tema: açık (kâğıt) / koyu (mürekkep).
   head'de senkron çalışır; sayfa boyanmadan önce doğru tema uygulanır, böylece
   koyu temada açık bir kare görünmez. Seçim localStorage'da tutulur, seçim yoksa
   işletim sistemi tercihi izlenir. */

(function () {
  "use strict";

  var KEY = "erlik-theme";
  var root = document.documentElement;
  var system = window.matchMedia("(prefers-color-scheme: dark)");

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function apply(theme, persist) {
    var themeColor = theme === "dark" ? "#141715" : "#e9ebe5";
    var meta = document.querySelector('meta[name="theme-color"]');

    /* tema değişimi tek karede olsun: geçişler bu sırada kapatılır */
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", themeColor);

    if (persist) {
      try {
        localStorage.setItem(KEY, theme);
      } catch (e) {}
    }

    /* zorunlu yeniden düzen (void offsetWidth) kaldırıldı: 30 bin pikselik
       belgede senkron yerleşim hesaplamak geçişi kilitliyordu. Sınıf ve tema
       aynı görevde yazıldığı için tarayıcı stilleri zaten bir kez hesaplıyor. */
    var clearSwitching = function () {
      root.classList.remove("theme-switching");
    };

    /* kare gelmeyen sekmelerde (arka plan) sınıf asılı kalmasın */
    window.requestAnimationFrame(clearSwitching);
    window.setTimeout(clearSwitching, 150);

    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  var initial = stored();
  if (initial !== "dark" && initial !== "light") {
    initial = system.matches ? "dark" : "light";
  }
  apply(initial, false);

  /* seçim yoksa sistem tercihi değişince takip et */
  var onSystemChange = function (e) {
    if (!stored()) apply(e.matches ? "dark" : "light", false);
  };
  if (system.addEventListener) system.addEventListener("change", onSystemChange);
  else if (system.addListener) system.addListener(onSystemChange);

  function wire() {
    var sw = document.querySelector(".theme-switch");
    var box = document.querySelector(".theme-switch__checkbox");
    if (!box) return;

    function sync() {
      var dark = root.getAttribute("data-theme") === "dark";
      if (box.checked !== dark) box.checked = dark;
      if (sw) sw.setAttribute("data-state", dark ? "dark" : "light");
    }

    /* ilk eşitleme animasyonsuz: sayfa açılırken top kendiliğinden kaymasın */
    if (sw) {
      sw.classList.add("theme-switch--noanim");
      sync();
      var clearNoAnim = function () {
        sw.classList.remove("theme-switch--noanim");
      };
      window.requestAnimationFrame(clearNoAnim);
      window.setTimeout(clearNoAnim, 150);
    } else {
      sync();
    }

    box.addEventListener("change", function () {
      apply(box.checked ? "dark" : "light", true);
    });

    document.addEventListener("themechange", sync);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
