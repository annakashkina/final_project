(function () {
  const uid = localStorage.getItem("codeprobe_uid") || "";
  const token = localStorage.getItem("codeprobe_token") || "";

  document.getElementById("uid").value = uid;
  document.getElementById("token").value = token;
  document.getElementById("pair").value = uid && token ? uid + ":" + token : "";

  const missing = [];
  if (!uid) missing.push("UID not set");
  if (!token) missing.push("Token not set");
  if (missing.length) {
    const el = document.getElementById("missing");
    el.textContent = missing.join(" · ") + " — open codeprobe at least once with saving enabled to generate these.";
    el.style.display = "block";
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const input = btn.previousElementSibling;
      input.select();
      document.execCommand("copy");
    }
    const original = btn.textContent;
    btn.textContent = "Copied";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1200);
  }

  document.querySelectorAll("button[data-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input.value) return;
      copyText(input.value, btn);
    });
  });
})();
