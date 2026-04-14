(function () {
  const isAdmin = localStorage.getItem("isAdmin") === "true";

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
})();
