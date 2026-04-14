// Theme toggle (standalone — no app.js on this page)
const toggle = document.getElementById("theme-toggle");
const saved = localStorage.getItem("codeprobe_theme");
if (saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches))
  document.documentElement.setAttribute("data-theme", "dark");
toggle?.addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  localStorage.setItem("codeprobe_theme", dark ? "light" : "dark");
});
