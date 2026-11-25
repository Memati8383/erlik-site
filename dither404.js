/* 404 rakamı — Bayer (sıralı) dithering ile piksellenmiş.
   Fikir: 21st.dev "Dithered 404" (jay sharma / 23rd.dev, MIT): imleç rakamı
   dağıtır, sonra rakam yeniden basılır. Bu sitede ateş yok; mürekkep var:
   imlecin altındaki noktalar kâğıda kül gibi süzülür, imleç çekilince
   rakam yerine oturur. Bağımlılık yok, harici istek yok. */

(function () {
  "use strict";

  var canvas = document.querySelector(".p404-dither");
  if (!canvas || !canvas.getContext) return;

  var host = canvas.parentElement;
  var fallback = host && host.querySelector(".p404-fallback");
  if (!host || !fallback) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var GLYPHS = "404";
  var CELL = 4; // css px, tek dither hücresi
  var BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ];
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cells = [];
  var cols = 0;
  var rows = 0;
  var cssW = 0;
  var cssH = 0;
  var ink = "#161a17";
  var pointer = { x: -1e5, y: -1e5, on: false };
  var raf = 0;
  var lastAt = 0;
  var heatMax = 0;

  /* --ink token'ını tuvale uygun bir renge çevir; geçersizse eskisi kalır */
  function readInk() {
    var probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;left:-9999px;top:0;color:var(--ink)";
    document.body.appendChild(probe);
    var value = getComputedStyle(probe).color;
    document.body.removeChild(probe);

    ctx.fillStyle = ink;
    ctx.fillStyle = value;
    ink = ctx.fillStyle;
  }

  function build() {
    cssW = Math.round(host.clientWidth);
    cssH = Math.round(host.clientHeight);
    if (cssW < 40 || cssH < 40) return false;

    var style = getComputedStyle(fallback);
    var family = style.fontFamily || "sans-serif";
    var probe = document.createElement("canvas").getContext("2d");
    if (!probe) return false;

    function metrics(size) {
      probe.font = "600 " + size + "px " + family;
      try { probe.letterSpacing = "-0.05em"; } catch (err) {}
      var m = probe.measureText(GLYPHS);
      return {
        ink: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        left: m.actualBoundingBoxLeft,
        ascent: m.actualBoundingBoxAscent,
        descent: m.actualBoundingBoxDescent
      };
    }

    if (!metrics(100).ink) return false;

    /* Rakamı önce güvenli boyda (yüksekliğin yarısı, her zaman sığar) çiz,
       gerçek mürekkep sınırlarını ölç, sonra tuvale tam oturacak boyda
       yeniden çiz. Harf metriklerine güvenmiyoruz: letter-spacing ve
       font farkları taşmaya yol açıyordu. */
    var mask = document.createElement("canvas");
    mask.width = cssW;
    mask.height = cssH;
    var mctx = mask.getContext("2d", { willReadFrequently: true });

    function drawGlyphs(size, cx, cy) {
      var met = metrics(size);
      mctx.clearRect(0, 0, cssW, cssH);
      mctx.font = "600 " + size + "px " + family;
      try { mctx.letterSpacing = "-0.05em"; } catch (err) {}
      mctx.textAlign = "left";
      mctx.textBaseline = "alphabetic";
      mctx.fillStyle = "#000";
      mctx.fillText(
        GLYPHS,
        cx - met.ink / 2 + met.left,
        cy + (met.ascent - met.descent) / 2
      );
      return met;
    }

    function inkBox() {
      var px = mctx.getImageData(0, 0, cssW, cssH).data;
      var x0 = cssW, y0 = cssH, x1 = -1, y1 = -1;
      for (var yy = 0; yy < cssH; yy++) {
        for (var xx = 0; xx < cssW; xx++) {
          if (px[(yy * cssW + xx) * 4 + 3] < 12) continue;
          if (xx < x0) x0 = xx;
          if (xx > x1) x1 = xx;
          if (yy < y0) y0 = yy;
          if (yy > y1) y1 = yy;
        }
      }
      if (x1 < 0) return null;
      return {
        x: x0, y: y0,
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
        cx: (x0 + x1 + 1) / 2,
        cy: (y0 + y1 + 1) / 2
      };
    }

    var probeSize = cssH * 0.5;
    drawGlyphs(probeSize, cssW / 2, cssH / 2);
    var box = inkBox();
    if (!box) return false;

    var scale = Math.min((cssW * 0.92) / box.w, (cssH * 0.88) / box.h);
    var size = probeSize * scale;
    drawGlyphs(size, cssW / 2, cssH / 2);

    /* ölçüyle gerçek mürekkep arasındaki kaymayı tek geçişte düzelt */
    var fitted = inkBox();
    if (!fitted) return false;
    drawGlyphs(size, cssW - fitted.cx, cssH - fitted.cy);

    cols = Math.max(1, Math.round(cssW / CELL));
    rows = Math.max(1, Math.round(cssH / CELL));

    var grid = document.createElement("canvas");
    grid.width = cols;
    grid.height = rows;
    var gctx = grid.getContext("2d", { willReadFrequently: true });
    if (!gctx) return false;
    gctx.drawImage(mask, 0, 0, cols, rows);
    var data = gctx.getImageData(0, 0, cols, rows).data;

    cells = [];
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var alpha = data[(row * cols + col) * 4 + 3] / 255;
        if (alpha < 0.04) continue;

        cells.push({
          x: col * CELL,
          y: row * CELL,
          /* altta yoğun, üstte seyrek: klasik 1-bit baskı geçişi.
             Taban yüksek tutuldu ki rakam okunsun, dither yalnız
             kenarlarda ve üst yarıda kendini göstersin. */
          cov: alpha * (0.72 + 0.28 * (row / rows)),
          thr: (BAYER[(row & 7) * 8 + (col & 7)] + 0.5) / 64,
          heat: 0
        });
      }
    }

    if (!cells.length) return false;

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    readInk();
    return true;
  }

  function draw() {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = ink;

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var heat = cell.heat;
      var value = cell.cov * (1 - heat * 0.95);

      if (value > cell.thr) {
        ctx.globalAlpha = 1 - heat * 0.45;
        ctx.fillRect(cell.x, cell.y, CELL - 1, CELL - 1);
      } else if (heat > 0.08) {
        /* dağılan piksel: kâğıda doğru süzülen kül */
        ctx.globalAlpha = heat * 0.32;
        ctx.fillRect(cell.x, cell.y - (reduce ? 0 : heat * 18), CELL - 2, CELL - 2);
      }
    }

    ctx.globalAlpha = 1;
  }

  function step(dt) {
    var radius = 130;
    var r2 = radius * radius;
    var max = 0;

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var target = 0;

      if (pointer.on) {
        var dx = cell.x + CELL / 2 - pointer.x;
        var dy = cell.y + CELL / 2 - pointer.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          var k = 1 - Math.sqrt(d2) / radius;
          target = k * k;
        }
      }

      var ease = target > cell.heat ? 0.3 : 0.06;
      cell.heat += (target - cell.heat) * Math.min(1, ease * dt);
      if (cell.heat > max) max = cell.heat;
    }

    heatMax = max;
  }

  function loop(now) {
    raf = 0;

    var dt = lastAt ? Math.min(3, (now - lastAt) / 16.7) : 1;
    lastAt = now;

    step(dt);
    draw();

    if (heatMax > 0.015) raf = window.requestAnimationFrame(loop);
  }

  function kick() {
    if (!raf) raf = window.requestAnimationFrame(loop);
  }

  function start() {
    if (!build()) return;
    host.classList.add("is-dither");

    /* ilk kare senkron: arka planda açılan sekmede de rakam hemen basılı */
    for (var i = 0; i < cells.length; i++) cells[i].heat = 0;
    heatMax = 0;
    lastAt = 0;
    draw();
  }

  host.addEventListener("pointermove", function (event) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.on = true;
    kick();
  });

  host.addEventListener("pointerleave", function () {
    pointer.on = false;
    kick();
  });

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(start, 180);
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      readInk();
      draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  start();

  /* fontlar geç yüklenirse ölçüyü bir kez daha al (açılış taraması bozulmadan) */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      start();
    });
  }
})();
