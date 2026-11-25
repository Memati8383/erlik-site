/* ERLIK sitesi — mermaid, içindekiler vurgusu, ekran görüntüsü büyütme, mobil menü */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- mermaid (tembel yükleme) ---------- */
  /* 3.4 MB'lık mermaid paketi ilk boyamayı geciktirmesin: yalnızca ilk
     diyagram görüş alanına yaklaşınca indirilip çalıştırılır. */
  var mermaidStarted = false;

  function mermaidFallback() {
    document.querySelectorAll(".mermaid").forEach(function (el) {
      el.style.fontFamily = "var(--mono)";
      el.style.fontSize = "12px";
      el.style.whiteSpace = "pre";
      el.style.justifyContent = "flex-start";
    });
  }

  /* diyagram paleti temaya bağlı: kâğıt ve mürekkep ters çevrilir */
  var MERMAID_THEMES = {
    light: {
      background: "#f2f4ee",
      primaryColor: "#f2f4ee",
      primaryTextColor: "#161a17",
      primaryBorderColor: "#6f7a70",
      secondaryColor: "#dfe2da",
      tertiaryColor: "#e9ebe5",
      lineColor: "#47514a",
      textColor: "#161a17",
      mainBkg: "#f2f4ee",
      nodeBorder: "#6f7a70",
      clusterBkg: "#e9ebe5",
      clusterBorder: "#a9b2a6",
      titleColor: "#161a17",
      edgeLabelBackground: "#e9ebe5",
      actorBkg: "#f2f4ee",
      actorBorder: "#6f7a70",
      actorTextColor: "#161a17",
      signalColor: "#47514a",
      signalTextColor: "#161a17",
      labelBoxBkgColor: "#f2f4ee",
      labelBoxBorderColor: "#6f7a70",
      loopTextColor: "#161a17",
      noteBkgColor: "#f4eeda",
      noteBorderColor: "#7a5200",
      noteTextColor: "#2a2413",
      fontSize: "14px"
    },
    dark: {
      background: "#1a1e1a",
      primaryColor: "#1a1e1a",
      primaryTextColor: "#e7eae2",
      primaryBorderColor: "#5b6559",
      secondaryColor: "#22261f",
      tertiaryColor: "#141715",
      lineColor: "#8b958a",
      textColor: "#e7eae2",
      mainBkg: "#1a1e1a",
      nodeBorder: "#5b6559",
      clusterBkg: "#141715",
      clusterBorder: "#3c443b",
      titleColor: "#e7eae2",
      edgeLabelBackground: "#141715",
      actorBkg: "#1a1e1a",
      actorBorder: "#5b6559",
      actorTextColor: "#e7eae2",
      signalColor: "#8b958a",
      signalTextColor: "#e7eae2",
      labelBoxBkgColor: "#1a1e1a",
      labelBoxBorderColor: "#5b6559",
      loopTextColor: "#e7eae2",
      noteBkgColor: "#2a2413",
      noteBorderColor: "#8a6420",
      noteTextColor: "#efe6cf",
      fontSize: "14px"
    }
  };

  function currentPalette() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function mermaidPalette() {
    return MERMAID_THEMES[currentPalette()];
  }

  function markPalette(list, key) {
    var palette = key || currentPalette();
    Array.prototype.forEach.call(list, function (el) {
      el.setAttribute("data-palette", palette);
    });
  }

  function initMermaid() {
    if (mermaidStarted || !window.mermaid) return;
    mermaidStarted = true;

    /* tema değişince yeniden çizebilmek için kaynağı sakla */
    document.querySelectorAll(".mermaid").forEach(function (el) {
      if (!el.getAttribute("data-graph")) el.setAttribute("data-graph", el.textContent);
    });

    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
      themeVariables: mermaidPalette(),
      flowchart: { curve: "basis", padding: 14, useMaxWidth: true },
      sequence: { useMaxWidth: true, mirrorActors: false, wrap: true },
      securityLevel: "strict"
    });

    /* Yazı tipi yüklenmeden çizersek düğüm genişlikleri yanlış hesaplanıp
       etiketler kırpılıyor; önce fontların hazır olmasını bekle. */
    var fontsReady = document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve();

    fontsReady
      .then(function () {
        return mermaid.run({ querySelector: ".mermaid" });
      })
      .then(function () {
        markPalette(document.querySelectorAll(".mermaid"));
        /* Diyagramlar yüksekliği değiştirdiği için çapa hedefi kaymış olabilir. */
        scheduleHashCorrection();
        syncScrollableRegions();
      })
      .catch(function (err) {
        console.error("mermaid:", err);
        mermaidFallback();
      });
  }

  function loadMermaid() {
    if (window.mermaid) return initMermaid();

    var script = document.createElement("script");
    script.src = "assets/vendor/mermaid.min.js";
    script.async = true;
    script.onload = initMermaid;
    script.onerror = mermaidFallback;
    document.head.appendChild(script);
  }

  /* tema değişti: diyagramlar eski paletle kaldı. Altı diyagramı birden yeniden
     çizmek bu belgede ana iş parçacığını yüzlerce milisaniye tuttuğu için tema
     geçişi takılıyordu. Artık yalnızca görüş alanına yakın olanlar hemen, kalanlar
     görünür hâle geldikçe çizilir. */

  var mermaidPainting = false;
  var mermaidScrollQueued = 0;

  function diagramsNeedingPaint() {
    var palette = currentPalette();
    return Array.prototype.filter.call(document.querySelectorAll(".mermaid"), function (el) {
      return el.getAttribute("data-palette") !== palette;
    });
  }

  function nearViewport(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > -400 && r.top < window.innerHeight + 400;
  }

  function paintDiagrams(list) {
    if (!window.mermaid || !list.length || mermaidPainting) return;

    /* çizim sürerken tema değişirse işaret yanlış paleti göstermesin */
    var palette = currentPalette();
    mermaidPainting = true;

    list.forEach(function (el) {
      var source = el.getAttribute("data-graph");
      if (!source) return;
      el.classList.add("mermaid-repaint");
      el.removeAttribute("data-processed");
      el.textContent = source;
    });

    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
      themeVariables: MERMAID_THEMES[palette]
    });

    mermaid
      .run({ querySelector: ".mermaid-repaint" })
      .then(function () {
        markPalette(list, palette);
        syncScrollableRegions();
      })
      .catch(function (err) {
        console.error("mermaid:", err);
        mermaidFallback();
      })
      .then(function () {
        list.forEach(function (el) { el.classList.remove("mermaid-repaint"); });
        mermaidPainting = false;
      });
  }

  function repaintVisibleDiagrams() {
    if (!mermaidStarted || !window.mermaid || mermaidPainting) return;
    var near = diagramsNeedingPaint().filter(nearViewport);
    if (near.length) paintDiagrams(near);
  }

  document.addEventListener("themechange", function () {
    /* önce temanın boyanmasını bekle, sonra elden geldiğince az diyagram çiz */
    window.requestAnimationFrame(function () {
      window.setTimeout(repaintVisibleDiagrams, 0);
    });
  });

  window.addEventListener(
    "scroll",
    function () {
      if (!mermaidStarted || !window.mermaid || mermaidScrollQueued) return;
      mermaidScrollQueued = window.requestAnimationFrame(function () {
        mermaidScrollQueued = 0;
        repaintVisibleDiagrams();
      });
    },
    { passive: true }
  );

  var diagrams = document.querySelectorAll(".diagram");

  if (diagrams.length && "IntersectionObserver" in window) {
    var diagramObserver = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          diagramObserver.disconnect();
          loadMermaid();
        }
      },
      { rootMargin: "300px 0px" }
    );

    diagrams.forEach(function (el) { diagramObserver.observe(el); });
  } else if (diagrams.length) {
    loadMermaid();
  }

  /* ---------- içindekiler: aktif başlık ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  var targets = tocLinks
    .map(function (a) {
      var id = (a.getAttribute("href") || "").slice(1);
      var el = id ? document.getElementById(id) : null;
      return el ? { link: a, el: el } : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && targets.length) {
    var visible = new Set();

    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        });

        var best = null;
        targets.forEach(function (t) {
          if (!visible.has(t.el.id)) return;
          if (!best || t.el.offsetTop < best.el.offsetTop) best = t;
        });

        if (best) {
          tocLinks.forEach(function (a) {
            a.classList.remove("active");
            a.removeAttribute("aria-current");
          });
          best.link.classList.add("active");
          best.link.setAttribute("aria-current", "location");
        }
      },
      { rootMargin: "-84px 0px -70% 0px", threshold: 0 }
    );

    targets.forEach(function (t) { obs.observe(t.el); });
  }

  /* ---------- mobil menü ---------- */
  var mobileNav = document.querySelector(".mobile-nav");

  if (mobileNav) {
    mobileNav.querySelectorAll(".menu a").forEach(function (a) {
      a.addEventListener("click", function () { mobileNav.open = false; });
    });

    document.addEventListener("click", function (e) {
      if (mobileNav.open && !mobileNav.contains(e.target)) mobileNav.open = false;
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.open) {
        mobileNav.open = false;
        var summary = mobileNav.querySelector("summary");
        if (summary) summary.focus();
      }
    });
  }

  /* ---------- okuma ilerlemesi + yukarı çık ---------- */
  var progress = document.querySelector(".scroll-progress span");
  var toTop = document.querySelector(".to-top");
  var ticking = false;

  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var y = window.scrollY || doc.scrollTop || 0;

    if (progress) {
      var ratio = max > 0 ? y / max : 0;
      progress.style.transform = "scaleX(" + Math.min(1, Math.max(0, ratio)) + ")";
    }

    if (toTop) {
      var show = y > 720;
      if (toTop.hidden === show) toTop.hidden = !show;
    }

    ticking = false;
  }

  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- ekran görüntüsü büyütme ---------- */
  var box = document.getElementById("lightbox");
  var boxImg = box ? box.querySelector("img") : null;
  var closeBtn = box ? box.querySelector(".lightbox-close") : null;
  var lastTrigger = null;
  var inertTargets = [];

  /* Diyalog açıkken arka planı odak ve ekran okuyucu sırasından çıkar. */
  function setBackgroundInert(on) {
    if (on) {
      inertTargets = Array.prototype.filter.call(document.body.children, function (el) {
        return el !== box && el.tagName !== "SCRIPT";
      });

      inertTargets.forEach(function (el) {
        el.inert = true;
        el.setAttribute("aria-hidden", "true");
      });
      return;
    }

    inertTargets.forEach(function (el) {
      el.inert = false;
      el.removeAttribute("aria-hidden");
    });
    inertTargets = [];
  }

  function open(trigger) {
    if (!box || !boxImg) return;
    lastTrigger = trigger;
    boxImg.src = trigger.currentSrc || trigger.src;
    boxImg.alt = trigger.alt || "";
    box.hidden = false;
    box.classList.add("on");
    document.body.classList.add("lb-open");
    if (closeBtn) closeBtn.focus();
    setBackgroundInert(true);
  }

  function close() {
    if (!box || !box.classList.contains("on")) return;
    box.classList.remove("on");
    box.hidden = true;
    boxImg.removeAttribute("src");
    document.body.classList.remove("lb-open");
    setBackgroundInert(false);
    if (lastTrigger) lastTrigger.focus();
  }

  document.querySelectorAll("figure.shot img").forEach(function (img) {
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", "Ekran görüntüsünü büyüt: " + (img.alt || ""));

    img.addEventListener("click", function () { open(img); });
    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(img);
      }
    });
  });

  if (box) {
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target === boxImg) close();
    });

    if (closeBtn) closeBtn.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("on")) return;

      if (e.key === "Escape") {
        close();
        return;
      }

      /* odak tuzağı: Tab yalnız diyalog içinde dolaşsın */
      if (e.key === "Tab" && closeBtn) {
        e.preventDefault();
        closeBtn.focus();
      }
    });
  }

  /* ---------- büyüteç ---------- */
  /* 21st.dev'deki Lens bileşeninden uyarlandı (Manu Arora / Aceternity UI, MIT).
     Plakanın üzerinde gezen cam, altındaki pikselleri 2 katına büyütür; ışaretçi
     plakadan çıkınca veya sayfa kaydırılınca kaybolur. Yalnızca fareli cihazlarda. */

  var LENS_SIZE = 168;
  var LENS_ZOOM = 1.7;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  function setupLens(img) {
    var fig = img.parentElement;
    if (!fig || fig.querySelector(".lens")) return;

    var lens = document.createElement("span");
    var inner = null;

    lens.className = "lens";
    lens.setAttribute("aria-hidden", "true");
    fig.appendChild(lens);

    function hide() {
      lens.classList.remove("on");
    }

    function place(e) {
      var r = img.getBoundingClientRect();
      if (!r.width) return;

      var x = e.clientX - r.left;
      var y = e.clientY - r.top;

      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        hide();
        return;
      }

      if (!inner) {
        inner = img.cloneNode(false);
        inner.removeAttribute("loading");
        inner.removeAttribute("fetchpriority");
        inner.removeAttribute("tabindex");
        inner.removeAttribute("role");
        inner.removeAttribute("aria-label");
        inner.alt = "";
        lens.appendChild(inner);
      }

      var fr = fig.getBoundingClientRect();

      /* cam, plaka koordinatlarında imlecin tam üstünde durur */
      lens.style.left = (r.left - fr.left + x - LENS_SIZE / 2) + "px";
      lens.style.top = (r.top - fr.top + y - LENS_SIZE / 2) + "px";

      /* kopya, imlecin altındaki piksel camın ortasında kalacak şekilde büyür */
      inner.style.width = r.width + "px";
      inner.style.height = r.height + "px";
      inner.style.left = -(x - LENS_SIZE / 2) + "px";
      inner.style.top = -(y - LENS_SIZE / 2) + "px";
      inner.style.transformOrigin = x + "px " + y + "px";
      inner.style.transform = "scale(" + LENS_ZOOM + ")";

      lens.classList.add("on");
    }

    fig.addEventListener("pointerenter", place);
    fig.addEventListener("pointermove", place);
    fig.addEventListener("pointerleave", hide);
    window.addEventListener("scroll", hide, { passive: true });
  }

  if (finePointer.matches) {
    document.querySelectorAll("figure.shot img, figure.hero-shot img").forEach(setupLens);
  }

  /* ---------- SSS: açılma / kapanma animasyonu ---------- */
  /* <details> yüksekliği kendi kendine canlandırmıyor: açarken yanıtın ölçülen
     yüksekliğine geçilir, kapatırken önce sabitlenip sıfıra çekilir. Hareket
     azaltma tercihinde tarayıcının kendi (anlık) davranışı bırakılır. */

  var FAQ_MS = 260;

  document.querySelectorAll(".faq-item").forEach(function (item) {
    var summary = item.querySelector("summary");
    var reply = item.querySelector(".faq-reply");
    if (!summary || !reply || reduceMotion) return;

    var busy = false;

    function settle(open) {
      item.classList.remove("is-animating");
      reply.style.height = "";
      reply.style.overflow = "";
      item.open = open;
      busy = false;
    }

    function expand() {
      busy = true;
      item.classList.add("is-animating");
      item.open = true;
      reply.style.overflow = "hidden";
      reply.style.height = "0px";

      var target = reply.scrollHeight;
      requestAnimationFrame(function () {
        reply.style.height = target + "px";
      });

      window.setTimeout(function () {
        if (busy) settle(true);
      }, FAQ_MS + 120);
    }

    function collapse() {
      busy = true;
      item.classList.add("is-animating");
      reply.style.overflow = "hidden";
      reply.style.height = reply.scrollHeight + "px";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          reply.style.height = "0px";
        });
      });

      window.setTimeout(function () {
        if (busy) settle(false);
      }, FAQ_MS + 120);
    }

    summary.addEventListener("click", function (e) {
      e.preventDefault();
      if (busy) return;
      if (item.open) collapse();
      else expand();
    });
  });

  /* ---------- dış bağlantılar ---------- */
  document.querySelectorAll('a[href^="http"]').forEach(function (a) {
    if (a.hostname && a.hostname !== location.hostname) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });

  /* ---------- yatay kaydırılabilir bölgeler ---------- */
  /* Diyagram/tablo/kod blokları yatay taşarsa klavyeyle de kaydırılabilmeli. */
  var scrollables = document.querySelectorAll(".diagram, .table-wrap, pre");

  function syncScrollableRegions() {
    scrollables.forEach(function (el) {
      var scrollable = el.scrollWidth > el.clientWidth + 2;

      if (scrollable) {
        if (el.tabIndex !== 0) el.tabIndex = 0;
        el.setAttribute("role", "group");
        if (!el.getAttribute("aria-label")) {
          var cap = el.querySelector("figcaption");
          el.setAttribute(
            "aria-label",
            cap ? cap.textContent.trim() : "Yatay kaydırılabilir içerik"
          );
        }
      } else if (el.getAttribute("role") === "group") {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      }
    });
  }

  syncScrollableRegions();

  var scrollResizeTick = false;
  window.addEventListener("resize", function () {
    if (scrollResizeTick) return;
    scrollResizeTick = true;
    requestAnimationFrame(function () {
      scrollResizeTick = false;
      syncScrollableRegions();
    });
  }, { passive: true });

  /* ---------- doğrudan gelen çapa bağlantısı ---------- */
  /* Tarayıcı hash'e yazı tipleri yüklenmeden atlar; metin yeniden akınca
     hedef kayar. Fontlar hazır olunca konumu bir kez düzelt. */
  function correctHashPosition() {
    if (!location.hash) return;
    var target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }

  /* Yumuşak kaydırma sürerken mermaid yüksekliği değişirse hedef kayar;
     kaydırma bittikten sonra konumu bir kez düzelt. */
  var hashCorrectionTimer = 0;

  function scheduleHashCorrection() {
    if (!location.hash) return;
    clearTimeout(hashCorrectionTimer);
    hashCorrectionTimer = setTimeout(function () {
      var target = document.getElementById(location.hash.slice(1));
      if (!target) return;
      var offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      if (Math.abs(target.getBoundingClientRect().top - offset) > 2) {
        correctHashPosition();
      }
    }, 900);
  }

  if (location.hash) {
    var fontsDone = document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve();

    fontsDone.then(function () {
      requestAnimationFrame(correctHashPosition);
    });

    window.addEventListener("load", function () {
      requestAnimationFrame(correctHashPosition);
    });
  }

  window.addEventListener("hashchange", scheduleHashCorrection);

  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (link && link.getAttribute("href").length > 1) scheduleHashCorrection();
  });

  /* ---------- yarım ton imza: ERLİK ----------
     Fikir 21st.dev'deki "Halftone Wordmark Footer" (Kedhareswer Naidu, MIT):
     kelime yarım ton noktalarla basılır, noktalar imlecin çevresinden yay gibi
     açılır, hareket ettikçe rengi ısınır, tıklayınca içinden bir halka geçer.
     Burada kâğıt/mürekkep diline çevrildi ve ERLİK'e özel iki davranış eklendi:
       · Kelime sayfaya girdiğinde soldan sağa “basılır”; İ'nin noktası mühür
         mavisinde kalır ve en son, küçük bir baskı sıçramasıyla yerleşir.
       · Mürekkep, imlecin geçtiği noktalarda mühür mürekkebine döner. */

  function setupHalftoneWordmark() {
    var sign = document.querySelector(".colophon-sign");
    var text = sign && sign.querySelector(".colophon-mark");
    var canvas = sign && sign.querySelector(".colophon-canvas");
    if (!sign || !text || !canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var WORD = "ERLİK";
    var TAU = Math.PI * 2;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var dots = [];
    var cssW = 0;
    var cssH = 0;
    var pitch = 8;
    var baseR = 4;
    var ink = [22, 26, 23];
    var stamp = [29, 63, 174];
    var pointer = { x: 0, y: 0, on: false };
    var ring = null;
    var frame = 0;
    var introAt = 0;
    var introDone = true;
    var lastAt = 0;
    var revealed = false;

    function readColor(token, fallback) {
      var value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      var match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
      if (!match) return fallback.slice();
      var hex = match[1];
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }

    function rgb(color) {
      return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
    }

    function mix(from, to, t) {
      return (
        "rgb(" +
        Math.round(from[0] + (to[0] - from[0]) * t) + "," +
        Math.round(from[1] + (to[1] - from[1]) * t) + "," +
        Math.round(from[2] + (to[2] - from[2]) * t) + ")"
      );
    }

    var probe = document.createElement("canvas").getContext("2d");

    function metrics(size, family) {
      probe.font = "600 " + size + "px " + family;
      try { probe.letterSpacing = "-0.045em"; } catch (err) {}
      var m = probe.measureText(WORD);
      return {
        ink: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        left: m.actualBoundingBoxLeft,
        ascent: m.actualBoundingBoxAscent,
        descent: m.actualBoundingBoxDescent
      };
    }

    /* yazının kutusunu örnekleyip nokta ızgarasına çevirir */
    function build() {
      var style = getComputedStyle(text);
      var width = Math.round(sign.clientWidth);
      var height = Math.round(sign.clientHeight);
      if (!width || !height || !probe) return false;

      var family = style.fontFamily;
      var ref = metrics(100, family);
      if (!ref.ink) return false;

      /* sütunun %93'ü: kenarda kalan noktalara savrulma payı bırakır */
      var size = (width * 0.93) / (ref.ink / 100);
      var met = metrics(size, family);
      if (!met.ink) return false;

      cssW = width;
      cssH = height;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var mask = document.createElement("canvas");
      mask.width = cssW;
      mask.height = cssH;
      var mctx = mask.getContext("2d");
      var x0 = (cssW - met.ink) / 2 + met.left;
      var baseline = (cssH - (met.ascent + met.descent)) / 2 + met.ascent;

      mctx.font = "600 " + size + "px " + family;
      try { mctx.letterSpacing = "-0.045em"; } catch (err) {}
      mctx.textBaseline = "alphabetic";
      mctx.fillStyle = "#000";
      mctx.fillText(WORD, x0, baseline);

      pitch = Math.max(5, size / 14.5);
      baseR = pitch * 0.48;

      /* İ'nin noktası: "ERL" sonrası x aralığı, mürekkebin en üst bandı */
      var inkTop = baseline - met.ascent;
      var sealBand = inkTop + (met.ascent + met.descent) * 0.16;
      var sealFrom = x0 + mctx.measureText("ERL").width;
      var sealTo = x0 + mctx.measureText("ERLİ").width;

      /* maskeyi ızgara çözünürlüğüne indir: her hücrenin ortalama kapsamı
         nokta yarıçapına dönüşür (tek piksel örneklemek kenarları
         tırtıklı ve gürültülü bırakıyordu) */
      var cols = Math.max(1, Math.round(cssW / pitch));
      var rows = Math.max(1, Math.round(cssH / pitch));
      var cellW = cssW / cols;
      var cellH = cssH / rows;

      var grid = document.createElement("canvas");
      grid.width = cols;
      grid.height = rows;
      var gctx = grid.getContext("2d");
      gctx.imageSmoothingEnabled = true;
      gctx.drawImage(mask, 0, 0, cols, rows);
      var pixels = gctx.getImageData(0, 0, cols, rows).data;

      dots = [];
      var sealCells = [];
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var alpha = pixels[(row * cols + col) * 4 + 3];
          if (alpha < 12) continue;
          var x = (col + 0.5) * cellW;
          var y = (row + 0.5) * cellH;
          if (x > sealFrom && x < sealTo && y < sealBand) {
            sealCells.push({ x: x, y: y });
            continue;
          }
          dots.push({
            x: x,
            y: y,
            r: baseR * Math.sqrt(alpha / 255),
            ox: 0,
            oy: 0,
            vx: 0,
            vy: 0,
            warm: 0,
            seal: false,
            delay: (x / cssW) * 380 + ((x * 7 + y * 13) % 80)
          });
        }
      }

      /* İ'nin noktası: hücreler tek bir mühür noktasında toplanır */
      if (sealCells.length) {
        var sx = 0;
        var sy = 0;
        for (var s = 0; s < sealCells.length; s++) {
          sx += sealCells[s].x;
          sy += sealCells[s].y;
        }
        var sealX = sx / sealCells.length;
        var sealY = sy / sealCells.length;
        dots.push({
          x: sealX,
          y: sealY,
          r: baseR * 1.25,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
          warm: 1,
          seal: true,
          delay: (sealX / cssW) * 380 + 300
        });
      }

      return dots.length > 0;
    }

    /* basım: her nokta kendi gecikmesiyle büyür; İ noktası sıçrayarak oturur */
    function grow(dot, now) {
      if (introDone) return 1;
      var p = (now - introAt - dot.delay) / 520;
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      if (dot.seal) {
        var s = 1.9;
        p -= 1;
        return 1 + (s + 1) * p * p * p + s * p * p;
      }
      return 1 - Math.pow(1 - p, 3);
    }

    function step(now) {
      var dt = lastAt ? Math.min(2.4, (now - lastAt) / 16.7) : 1;
      lastAt = now;

      var reach = pitch * 5.2;
      var reach2 = reach * reach;
      var ringR = ring ? (now - ring.at) * 0.5 : -999;

      if (ring && now - ring.at > 2200) ring = null;

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var ax = 0;
        var ay = 0;

        if (pointer.on) {
          var dx = dot.x + dot.ox - pointer.x;
          var dy = dot.y + dot.oy - pointer.y;
          var dist2 = dx * dx + dy * dy;
          if (dist2 < reach2 && dist2 > 0.5) {
            var dist = Math.sqrt(dist2);
            var force = (1 - dist / reach) * 2.8;
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
        }

        if (ring) {
          var rx = dot.x + dot.ox - ring.x;
          var ry = dot.y + dot.oy - ring.y;
          var rd = Math.sqrt(rx * rx + ry * ry) || 1;
          var band = Math.exp(-Math.pow((rd - ringR) / 30, 2)) * 3.6;
          ax += (rx / rd) * band;
          ay += (ry / rd) * band;
        }

        dot.vx = (dot.vx + ax * dt - dot.ox * 0.13 * dt) * 0.9;
        dot.vy = (dot.vy + ay * dt - dot.oy * 0.13 * dt) * 0.9;
        dot.ox += dot.vx * dt;
        dot.oy += dot.vy * dt;

        var heat = Math.min(1, (Math.abs(dot.ox) + Math.abs(dot.oy)) / 24);
        dot.warm += ((dot.seal ? 1 : heat) - dot.warm) * 0.18;
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, cssW, cssH);

      var body = new Path2D();
      var seals = new Path2D();
      var warm = [];

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var scale = grow(dot, now);
        if (scale <= 0.02) continue;
        var r = dot.r * scale;
        if (r < 0.35) continue;
        var cx = dot.x + dot.ox;
        var cy = dot.y + dot.oy;

        if (dot.seal) {
          seals.moveTo(cx + r, cy);
          seals.arc(cx, cy, r, 0, TAU);
          continue;
        }
        if (dot.warm > 0.05) {
          warm.push(cx, cy, r, dot.warm);
          continue;
        }
        body.moveTo(cx + r, cy);
        body.arc(cx, cy, r, 0, TAU);
      }

      ctx.fillStyle = rgb(ink);
      ctx.fill(body);

      for (var j = 0; j < warm.length; j += 4) {
        ctx.fillStyle = mix(ink, stamp, warm[j + 3]);
        ctx.beginPath();
        ctx.arc(warm[j], warm[j + 1], warm[j + 2], 0, TAU);
        ctx.fill();
      }

      ctx.fillStyle = rgb(stamp);
      ctx.fill(seals);
    }

    function busy() {
      if (!introDone) return true;
      if (pointer.on || ring) return true;
      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        if (Math.abs(dot.ox) + Math.abs(dot.oy) + Math.abs(dot.vx) + Math.abs(dot.vy) > 0.2) {
          return true;
        }
      }
      return false;
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(loop);
    }

    function loop(now) {
      frame = 0;
      if (!introDone && now - introAt > 1400) introDone = true;
      step(now);
      draw(now);
      if (busy()) {
        schedule();
      } else {
        lastAt = 0;
      }
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      sign.classList.add("is-halftone");
      if (reduceMotion) {
        introDone = true;
        draw(0);
        return;
      }
      introAt = performance.now();
      introDone = false;
      lastAt = 0;
      schedule();
    }

    function onPointerMove(event) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.on = true;
      schedule();
    }

    function onPointerLeave() {
      pointer.on = false;
      schedule();
    }

    function onPointerDown(event) {
      var rect = canvas.getBoundingClientRect();
      ring = { x: event.clientX - rect.left, y: event.clientY - rect.top, at: performance.now() };
      schedule();
    }

    var fontsDone = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

    fontsDone.then(function () {
      if (!build()) return;
      ink = readColor("--ink", ink);
      stamp = readColor("--stamp", stamp);

      if (reduceMotion) {
        reveal();
        return;
      }

      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (!entries[i].isIntersecting) continue;
            io.disconnect();
            reveal();
            return;
          }
        }, { threshold: 0.35 });
        io.observe(sign);
      } else {
        reveal();
      }

      canvas.addEventListener("pointermove", onPointerMove, { passive: true });
      canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
      canvas.addEventListener("pointerdown", onPointerDown, { passive: true });

      document.addEventListener("themechange", function () {
        ink = readColor("--ink", ink);
        stamp = readColor("--stamp", stamp);
        if (revealed) schedule();
      });

      if ("ResizeObserver" in window) {
        var resizeTimer = 0;
        new ResizeObserver(function () {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(function () {
            if (!build()) return;
            if (!revealed) return;
            introDone = true;
            draw(performance.now());
          }, 160);
        }).observe(sign);
      }
    });
  }

  setupHalftoneWordmark();

  /* ---------- canlı noktalı kâğıt ----------
     Arka plan düz durmasın: sayfanın noktalı kâğıdı artık canvas'ta. Fikir
     21st.dev'deki "Particles BG" ve "ASMR background" bileşenlerinden: imleç
     arka planla etkileşir. Burada parçacık, birleştirme çizgisi ve parıltı yok;
     imleç noktaları yay gibi yana itiyor, tıklama içlerinden bir halka
     geçiriyor, hepsi sonra yerine oturuyor. Dokunmatikte parmakla da çalışır. */

  function setupDotPaper() {
    var canvas = document.querySelector(".page-dots");
    var layer = canvas && canvas.parentElement;
    if (!canvas || !layer || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var TAU = Math.PI * 2;
    var STEP = 26;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var w = 0;
    var h = 0;
    var dots = [];
    var pointer = { x: -9999, y: -9999, on: false };
    var ring = null;
    var ink = [22, 26, 23];
    var frame = 0;
    var lastAt = 0;
    var energy = 0;

    function readInk() {
      var value = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
      var match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
      if (!match) return ink.slice();
      var hex = match[1];
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }

    function build() {
      w = layer.clientWidth || window.innerWidth;
      h = layer.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      var row = 0;
      for (var y = 13; y < h + STEP; y += STEP, row++) {
        var col = 0;
        for (var x = 13; x < w + STEP; x += STEP, col++) {
          var major = col % 5 === 0 && row % 5 === 0;
          dots.push({
            x: x,
            y: y,
            r: major ? 1.95 : 1.28,
            major: major,
            ox: 0,
            oy: 0,
            vx: 0,
            vy: 0
          });
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      var minor = new Path2D();
      var major = new Path2D();
      /* imlecin çevresindeki noktalar büyür ve koyulaşır: tek tek çizilir */
      var hot = [];
      var reach = 180;
      var reach2 = reach * reach;

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var cx = dot.x + dot.ox;
        var cy = dot.y + dot.oy;
        var near = 0;

        if (pointer.on) {
          var pdx = cx - pointer.x;
          var pdy = cy - pointer.y;
          var pd2 = pdx * pdx + pdy * pdy;
          if (pd2 < reach2) near = 1 - Math.sqrt(pd2) / reach;
        }

        if (near > 0.06) {
          hot.push(cx, cy, dot.r * (1 + near * 1.6), near);
          continue;
        }

        var path = dot.major ? major : minor;
        path.moveTo(cx + dot.r, cy);
        path.arc(cx, cy, dot.r, 0, TAU);
      }

      var base = ink[0] + "," + ink[1] + "," + ink[2];
      ctx.fillStyle = "rgba(" + base + ",0.26)";
      ctx.fill(minor);
      ctx.fillStyle = "rgba(" + base + ",0.4)";
      ctx.fill(major);

      for (var j = 0; j < hot.length; j += 4) {
        ctx.fillStyle = "rgba(" + base + "," + (0.28 + hot[j + 3] * 0.34).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(hot[j], hot[j + 1], hot[j + 2], 0, TAU);
        ctx.fill();
      }
    }

    function step(now) {
      var dt = lastAt ? Math.min(2.4, (now - lastAt) / 16.7) : 1;
      lastAt = now;

      var reach = 180;
      var reach2 = reach * reach;
      var ringR = ring ? (now - ring.at) * 0.5 : -999;

      if (ring && now - ring.at > 1500) ring = null;

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var ax = 0;
        var ay = 0;

        if (pointer.on) {
          var dx = dot.x + dot.ox - pointer.x;
          var dy = dot.y + dot.oy - pointer.y;
          var dist2 = dx * dx + dy * dy;
          if (dist2 < reach2 && dist2 > 0.5) {
            var dist = Math.sqrt(dist2);
            var force = (1 - dist / reach) * 3.8;
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
        }

        if (ring) {
          var rx = dot.x + dot.ox - ring.x;
          var ry = dot.y + dot.oy - ring.y;
          var rd = Math.sqrt(rx * rx + ry * ry) || 1;
          var band = Math.exp(-Math.pow((rd - ringR) / 34, 2)) * 5.5;
          ax += (rx / rd) * band;
          ay += (ry / rd) * band;
        }

        dot.vx = (dot.vx + ax * dt - dot.ox * 0.12 * dt) * 0.9;
        dot.vy = (dot.vy + ay * dt - dot.oy * 0.12 * dt) * 0.9;
        dot.ox += dot.vx * dt;
        dot.oy += dot.vy * dt;
      }

      /* dengeye ulaşınca döngü dursun: imleç kıpırdamadıkça kare harcamayalım */
      energy = 0;
      for (var k = 0; k < dots.length; k++) {
        var speed = Math.abs(dots[k].vx) + Math.abs(dots[k].vy);
        if (speed > energy) energy = speed;
      }
    }

    function busy() {
      return Boolean(ring) || energy > 0.06;
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(loop);
    }

    function loop(now) {
      frame = 0;
      step(now);
      draw();
      if (busy()) {
        schedule();
      } else {
        lastAt = 0;
      }
    }

    function onPointerMove(event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.on = true;
      schedule();
    }

    function onPointerLeave() {
      pointer.on = false;
      schedule();
    }

    function onPointerDown(event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.on = true;
      ring = { x: event.clientX, y: event.clientY, at: performance.now() };
      schedule();
    }

    build();
    ink = readInk();
    draw();
    layer.classList.add("is-live");

    if (reduceMotion) return;

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("blur", onPointerLeave);

    document.addEventListener("themechange", function () {
      ink = readInk();
      draw();
    });

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        build();
        draw();
      }, 180);
    });
  }

  setupDotPaper();

  /* ---------- modül kartlarında imleç lambası ----------
     21st.dev "Feature Section with hover effects" (Manu Arora, MIT) fikri:
     kart imlece tepki verir. Burada yalnızca kartın içindeki ışığın konumu
     yazılıyor; boyama tamamen CSS'te (radial-gradient + --mx/--my). */

  function setupModuleLamps() {
    var grid = document.querySelector(".modules");
    if (!grid) return;

    grid.addEventListener(
      "pointermove",
      function (event) {
        var card = event.target.closest ? event.target.closest(".module") : null;
        if (!card) return;
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", Math.round(event.clientX - rect.left) + "px");
        card.style.setProperty("--my", Math.round(event.clientY - rect.top) + "px");
      },
      { passive: true }
    );
  }

  setupModuleLamps();

  /* ---------- terminal plakalarında kopyalama ---------- */

  function setupTerminalCopy() {
    var timers = new WeakMap();

    function flash(button) {
      window.clearTimeout(timers.get(button));
      button.textContent = "Kopyalandı";
      button.classList.add("is-done");
      timers.set(
        button,
        window.setTimeout(function () {
          button.textContent = "Kopyala";
          button.classList.remove("is-done");
        }, 1400)
      );
    }

    function legacyCopy(text) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-2000px";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(area);
      return ok;
    }

    document.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest(".term-copy") : null;
      if (!button) return;

      var term = button.closest(".term");
      var body = term && term.querySelector(".term-body");
      if (!body) return;

      var text = body.textContent.replace(/\s+$/, "");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { flash(button); },
          function () { if (legacyCopy(text)) flash(button); }
        );
        return;
      }

      if (legacyCopy(text)) flash(button);
    });
  }

  setupTerminalCopy();
})();
