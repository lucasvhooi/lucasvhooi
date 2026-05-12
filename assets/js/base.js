(function () {
  // Load Iconify web component for icon rendering
  if (!customElements.get('iconify-icon')) {
    const s = document.createElement('script');
    s.src = 'https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js';
    document.head.appendChild(s);
  }

  const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();

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
          '<a href="inventory.html" style="font-size:13px;padding:0;color:#c9a87a;text-decoration:none">' + s.username + '</a>' +
          '<button onclick="(function(){localStorage.removeItem(\'playerSession\');localStorage.removeItem(\'isAdmin\');window.location.href=\'login.html\';})()" ' +
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

    // Backdrop element (sits behind the drawer)
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

    // Close when clicking a nav link
    nav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => closeNav());
    });

    // Close when clicking the backdrop
    backdrop.addEventListener("click", () => closeNav());
  }

  // ── Motion / scroll-reveal system ─────────────────────────────────────────
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

    function revealCard(el) {
      const delay = +(el.dataset.md || 0);
      const anim = el.animate(
        [{ opacity: 0, transform: "translateY(8px) scale(0.97)" },
         { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: 340, delay, easing: EXPO, fill: "both" }
      );
      anim.finished.then(() => { el.style.opacity = ""; }).catch(() => {});
    }

    function revealPanel(el) {
      const anim = el.animate(
        [{ opacity: 0, transform: "translateY(14px)" },
         { opacity: 1, transform: "translateY(0)" }],
        { duration: 420, easing: EXPO, fill: "both" }
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
      const delay = rect.top < window.innerHeight ? Math.min(i * 25, 180) : 0;
      setupCard(el, delay);
    });
    document.querySelectorAll(PANEL_SEL).forEach(el => setupPanel(el));

    // Watch for Firebase-populated grids (cards added after initial render)
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
        const delay = inView && batch.length > 2 ? Math.min(i * 25, 180) : 0;
        setupCard(el, delay);
      });
    }).observe(document.body, { childList: true, subtree: true });

    // Nav drawer link stagger on mobile open
    const navEl = document.querySelector("nav");
    if (navEl) {
      new MutationObserver(muts => {
        muts.forEach(m => {
          if (m.attributeName === "class" && navEl.classList.contains("nav-open")) {
            navEl.querySelectorAll("ul > li").forEach((li, i) => {
              li.animate(
                [{ opacity: 0, transform: "translateX(10px)" },
                 { opacity: 1, transform: "translateX(0)" }],
                { duration: 220, delay: 40 + i * 28, easing: QUART, fill: "backwards" }
              );
            });
          }
        });
      }).observe(navEl, { attributes: true });
    }
  })();
})();
