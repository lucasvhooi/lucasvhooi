// Highlight the current page's nav link
(function () {
  const links = document.querySelectorAll("nav a");
  const current = window.location.pathname.split("/").pop();
  links.forEach(a => {
    if (a.getAttribute("href") === current || a.getAttribute("href").endsWith("/" + current)) {
      a.classList.add("active");
    }
  });
})();
