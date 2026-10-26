// 모든 페이지가 공통으로 불러오는 다크모드 + 테마 스타일 토글 로직
const root = document.documentElement;
const toggleBtn = document.getElementById("themeToggleBtn");
const styleToggleBtn = document.getElementById("themeStyleToggleBtn");
const faviconLink = document.getElementById("faviconLink");

function updateIcon() {
  toggleBtn.textContent = root.classList.contains("dark-mode") ? "☀️" : "🌙";
}

function updateStyleIcon() {
  const isKitty = root.classList.contains("theme-kitty");
  styleToggleBtn.textContent = isKitty ? "🎀" : "🍎";
  styleToggleBtn.title = isKitty
    ? "헬로키티 테마 적용 중 (클릭하면 기본 테마로)"
    : "기본 테마 적용 중 (클릭하면 헬로키티 테마로)";
  if (faviconLink) {
    faviconLink.href = isKitty ? "./img/logo/favicon.svg" : "./img/logo/favicon.png";
  }
}

updateIcon();
updateStyleIcon();

toggleBtn.addEventListener("click", () => {
  root.classList.toggle("dark-mode");
  localStorage.setItem("theme", root.classList.contains("dark-mode") ? "dark" : "light");
  updateIcon();
});

styleToggleBtn.addEventListener("click", () => {
  root.classList.toggle("theme-kitty");
  localStorage.setItem("themeStyle", root.classList.contains("theme-kitty") ? "kitty" : "default");
  updateStyleIcon();
});