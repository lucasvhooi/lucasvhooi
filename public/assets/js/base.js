(function () {
  // ── Lenis smooth scroll ────────────────────────────────────────────────────
  // App-shell pages scroll via .page-content — skip Lenis there to avoid height conflict
  const hasAppShell = !!document.querySelector('.page-content');
  if (!hasAppShell &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !document.body.classList.contains('map-page') &&
      !document.body.classList.contains('combat-page')) {
    const ls = document.createElement('script');
    ls.src = 'https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.min.js';
    ls.onload = function () {
      const MODAL_SEL = '.inv-overlay, .modal-overlay, .char-modal-overlay, .give-panel, .ai-drop, .shop-modal-overlay';
      const lenis = new window.Lenis({
        lerp: 0.085,
        smoothWheel: true,
        touchMultiplier: 1.6,
        wheelMultiplier: 1.0,
        prevent: function (node) {
          return !!node.closest(MODAL_SEL);
        },
      });
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
      window.__lenis = lenis;
    };
    document.head.appendChild(ls);
  }

  // ── Motion / scroll-reveal + card shimmer system ───────────────────────────
  (function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const EXPO  = "cubic-bezier(0.16, 1, 0.3, 1)";

    const CARD_SEL = [
      ".inv-card", ".lore-card", ".item-card", ".quest-card",
      ".npc-card", ".building-card", ".lib-card", ".room-card",
      ".tavern-table-card", ".tavern-staff-card", ".inv-lore-card"
    ].join(",");

    const PANEL_SEL = ".dm-section, .qm-details-card";

    function revealCard(el) {
      const delay = +(el.dataset.md || 0);
      const anim = el.animate(
        [{ opacity: 0, transform: "translateY(18px) scale(0.95)" },
         { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: 380, delay, easing: EXPO, fill: "both" }
      );
      anim.finished.then(() => { el.style.opacity = ""; }).catch(() => {});
    }

    function revealPanel(el) {
      const anim = el.animate(
        [{ opacity: 0, transform: "translateY(22px)" },
         { opacity: 1, transform: "translateY(0)" }],
        { duration: 460, easing: EXPO, fill: "both" }
      );
      anim.finished.then(() => { el.style.opacity = ""; }).catch(() => {});
    }

    function setupCard(el, delay) {
      el.style.opacity = "0";
      el.dataset.md = delay || 0;
      cardObs.observe(el);
    }

    function setupPanel(el) {
      el.style.opacity = "0";
      panelObs.observe(el);
    }

    const cardObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        revealCard(e.target);
        cardObs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px 80px 0px", threshold: 0 });

    const panelObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        revealPanel(e.target);
        panelObs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px 80px 0px", threshold: 0 });

    document.querySelectorAll(CARD_SEL).forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const delay = rect.top < window.innerHeight ? Math.min(i * 28, 220) : 0;
      setupCard(el, delay);
    });
    document.querySelectorAll(PANEL_SEL).forEach(el => setupPanel(el));

    new MutationObserver(muts => {
      const batch = [];
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(CARD_SEL)) batch.push(n);
          if (n.querySelectorAll) {
            n.querySelectorAll(CARD_SEL).forEach(el => batch.push(el));
            n.querySelectorAll(PANEL_SEL).forEach(el => setupPanel(el));
          }
        });
      });
      if (!batch.length) return;
      batch.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        const delay = inView && batch.length > 2 ? Math.min(i * 28, 220) : 0;
        setupCard(el, delay);
      });
    }).observe(document.body, { childList: true, subtree: true });

    // ── Card shimmer (fine pointer / desktop only) ────────────────────────
    if (!window.matchMedia("(pointer: coarse)").matches) {
      const SHIMMER_SEL = ".inv-card, .item-card, .char-card";

      function bindShimmer(el) {
        if (el._shimmerBound) return;
        el._shimmerBound = true;
        el.classList.add("motion-shimmer");
        el.addEventListener("mousemove", e => {
          const r = el.getBoundingClientRect();
          el.style.setProperty("--shine-x", ((e.clientX - r.left) / r.width * 100) + "%");
          el.style.setProperty("--shine-y", ((e.clientY - r.top) / r.height * 100) + "%");
        });
      }

      document.querySelectorAll(SHIMMER_SEL).forEach(bindShimmer);

      new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(SHIMMER_SEL)) bindShimmer(n);
          n.querySelectorAll && n.querySelectorAll(SHIMMER_SEL).forEach(bindShimmer);
        }));
      }).observe(document.body, { childList: true, subtree: true });
    }
  })();
})();
