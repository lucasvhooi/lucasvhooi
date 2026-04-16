(function () {
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
})();
