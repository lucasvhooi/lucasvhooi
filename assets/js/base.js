(function () {
  // Load Iconify web component for icon rendering
  if (!customElements.get('iconify-icon')) {
    const s = document.createElement('script');
    s.src = 'https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js';
    document.head.appendChild(s);
  }

  // ── Lenis smooth scroll ────────────────────────────────────────────────────
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ls = document.createElement('script');
    ls.src = 'https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.min.js';
    ls.onload = function () {
      const MODAL_SEL = '.inv-overlay, .modal-overlay, .char-modal-overlay, .give-panel, .ai-drop, .shop-modal-overlay';
      const lenis = new window.Lenis({
        lerp: 0.085,
        smoothWheel: true,
        touchMultiplier: 1.6,
        wheelMultiplier: 1.0,
        // Don't intercept wheel events inside modals/overlays — let them scroll natively
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

  const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();

  // Wrap nav logo in a link back to campaign selector
  const navLogo = document.querySelector('nav .nav-logo');
  if (navLogo && navLogo.parentElement.tagName !== 'A') {
    const a = document.createElement('a');
    a.href = 'campaigns.html';
    a.style.cssText = 'display:flex;align-items:center;flex-shrink:0';
    navLogo.parentNode.insertBefore(a, navLogo);
    a.appendChild(navLogo);
  }

  // Highlight the current page's nav link
  const links   = document.querySelectorAll("nav a");
  const current = window.location.pathname.split("/").pop();
  links.forEach(a => {
    const href = a.getAttribute("href") || "";
    if (href === current || href.endsWith("/" + current)) {
      a.classList.add("active");
    }
  });

  // Show DM-only nav items for admins (hidden by default in CSS)
  if (isAdmin) {
    document.querySelectorAll("nav li.nav-dm-only").forEach(li => {
      li.style.display = "block";
    });
  }

  // Nav order: players see Inventory first; DMs see Missions first (already first in HTML)
  if (!isAdmin) {
    const navUl = document.querySelector("nav ul");
    const invLi = navUl && Array.from(navUl.querySelectorAll("a"))
      .find(a => a.getAttribute("href") === "inventory.html")?.closest("li");
    if (invLi) navUl.insertBefore(invLi, navUl.firstChild);
  }

  // Show logged-in user + logout in nav (right side)
  try {
    const s = JSON.parse(localStorage.getItem("playerSession"));
    const navUl = document.querySelector("nav ul");
    if (s && navUl) {
      const li = document.createElement("li");
      li.style.marginLeft = "auto";
      li.innerHTML =
        '<span style="display:flex;align-items:center;gap:6px;padding:6px 10px">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + (s.color || '#c8a45c') + ';flex-shrink:0"></span>' +
          '<a href="account.html" data-username class="nav-username-link">' + s.username + '</a>' +
          '<button onclick="window.location.href=\'logout.html\'" ' +
            'style="background:none;border:1px solid #3a2510;border-radius:5px;color:#555;font-size:11px;padding:2px 8px;cursor:pointer;margin-left:2px">Logout</button>' +
        '</span>';
      navUl.appendChild(li);
    } else if (!s && navUl) {
      const li = document.createElement("li");
      li.style.marginLeft = "auto";
      li.innerHTML = '<a href="login.html" style="font-size:13px;color:#888">Login</a>';
      navUl.appendChild(li);
    }
  } catch(e) { /* ignore */ }

  // ── Hamburger menu ────────────────────────────────────────────────────────
  const nav = document.querySelector("nav");
  if (nav) {
    const burger = document.createElement("button");
    burger.className = "nav-hamburger";
    burger.setAttribute("aria-label", "Toggle navigation");
    burger.innerHTML = "<span></span><span></span><span></span>";
    nav.appendChild(burger);

    const backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);

    function openNav() {
      nav.classList.add("nav-open");
      backdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeNav() {
      nav.classList.remove("nav-open");
      backdrop.classList.remove("open");
      document.body.style.overflow = "";
    }

    burger.addEventListener("click", e => {
      e.stopPropagation();
      nav.classList.contains("nav-open") ? closeNav() : openNav();
    });

    nav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => closeNav());
    });

    backdrop.addEventListener("click", () => closeNav());
  }

  // ── Page exit transition ──────────────────────────────────────────────────
  (function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll("nav a").forEach(a => {
      a.addEventListener("click", function (e) {
        const href = this.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
        if (href.startsWith("http") && !href.includes(window.location.host)) return;
        e.preventDefault();
        const target = href;
        document.body.animate(
          [{ opacity: 1, transform: "translateY(0)" },
           { opacity: 0, transform: "translateY(-6px)" }],
          { duration: 180, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" }
        ).finished
          .then(() => { window.location.href = target; })
          .catch(() => { window.location.href = target; });
      });
    });
  })();

  // ── Motion / scroll-reveal + card shimmer system ───────────────────────────
  (function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const EXPO  = "cubic-bezier(0.16, 1, 0.3, 1)";
    const QUART = "cubic-bezier(0.25, 1, 0.5, 1)";

    const CARD_SEL = [
      ".inv-card", ".lore-card", ".item-card", ".quest-card",
      ".npc-card", ".building-card", ".lib-card", ".room-card",
      ".tavern-table-card", ".tavern-staff-card", ".inv-lore-card"
    ].join(",");

    const PANEL_SEL = ".dm-section, .qm-details-card";

    // ── Scroll reveal animations ──────────────────────────────────────────
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

    // ── Nav drawer link stagger ──────────────────────────────────────────
    const navEl = document.querySelector("nav");
    if (navEl) {
      new MutationObserver(muts => {
        muts.forEach(m => {
          if (m.attributeName === "class" && navEl.classList.contains("nav-open")) {
            navEl.querySelectorAll("ul > li").forEach((li, i) => {
              li.animate(
                [{ opacity: 0, transform: "translateX(16px)" },
                 { opacity: 1, transform: "translateX(0)" }],
                { duration: 260, delay: 50 + i * 32, easing: EXPO, fill: "backwards" }
              );
            });
          }
        });
      }).observe(navEl, { attributes: true });
    }

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
