document.addEventListener("DOMContentLoaded", () => {
  const adminButton = document.getElementById("admin-login");
  const playerButton = document.getElementById("player-login");
  const passwordInput = document.getElementById("admin-password");
  const errorMessage = document.getElementById("error-message");
  const ADMIN_PASSWORD = "DnD!"; // Change as desired

  adminButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (passwordInput.value === ADMIN_PASSWORD) {
      localStorage.setItem("isAdmin", "true");
      window.location.href = "homepage.html";
    } else {
      errorMessage.textContent = "Incorrect admin password.";
    }
  });

  playerButton.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.setItem("isAdmin", "false");
    window.location.href = "homepage.html";
  });
});
