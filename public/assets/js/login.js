async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const adminButton = document.getElementById("admin-login");
  const playerButton = document.getElementById("player-login");
  const passwordInput = document.getElementById("admin-password");
  const errorMessage = document.getElementById("error-message");

  let storedHash = null;
  try {
    const response = await fetch("assets/data/config.json");
    const config = await response.json();
    storedHash = config.passwordHash;
  } catch {
    errorMessage.textContent = "Could not load config. Run setup.html first.";
  }

  adminButton.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!storedHash || storedHash === "REPLACE_WITH_YOUR_HASH") {
      errorMessage.textContent = "No password set. Open setup.html to create one.";
      return;
    }
    const inputHash = await sha256(passwordInput.value);
    if (inputHash === storedHash) {
      localStorage.setItem("isAdmin", "true");
      window.location.href = "pages/inventory.html";
    } else {
      errorMessage.textContent = "Incorrect admin password.";
    }
  });

  playerButton.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.setItem("isAdmin", "false");
    window.location.href = "pages/inventory.html";
  });
});
