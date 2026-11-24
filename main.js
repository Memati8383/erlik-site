/* ERLIK sitesi — mermaid, içindekiler vurgusu, ekran görüntüsü büyütme, mobil menü */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- mermaid ---------- */
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      themeVariables: {
        background: "#08090e",
        primaryColor: "#141621",
        primaryTextColor: "#e9ebf3",
        primaryBorderColor: "#3a3d52",
        secondaryColor: "#11131c",
        tertiaryColor: "#0c0e15",
        lineColor: "#8d93a5",
        textColor: "#c9cddd",
        mainBkg: "#141621",
        nodeBorder: "#3a3d52",
        clusterBkg: "#0c0e15",
        clusterBorder: "#2a2c3d",
        titleColor: "#e9ebf3",
        edgeLabelBackground: "#0b0d13",
        actorBkg: "#141621",
        actorBorder: "#3a3d52",
        actorTextColor: "#e9ebf3",
        signalColor: "#a3a9bb",
        signalTextColor: "#c9cddd",
        labelBoxBkgColor: "#141621",
        labelBoxBorderColor: "#3a3d52",
        loopTextColor: "#c9cddd",
        noteBkgColor: "#1a1830",
        noteBorderColor: "#4b3fa0",
        noteTextColor: "#ded9ff",
        fontSize: "14px"
      },
      flowchart: { curve: "basis", padding: 14, useMaxWidth: true },
      sequence: { useMaxWidth: true, mirrorActors: false, wrap: true },
      securityLevel: "loose"
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
      .catch(function (err) {
        console.error("mermaid:", err);
        document.querySelectorAll(".mermaid").forEach(function (el) {
          el.style.fontFamily = "var(--mono)";
          el.style.fontSize = "12px";
          el.style.whiteSpace = "pre";
          el.style.justifyContent = "flex-start";
        });
      });
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

  /* ---------- dış bağlantılar ---------- */
  document.querySelectorAll('a[href^="http"]').forEach(function (a) {
    if (a.hostname && a.hostname !== location.hostname) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });

  /* ---------- bağlantı geçmişi ile gelen çapaya kaydırma ---------- */
  if (!reduceMotion && location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) {
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
})();
