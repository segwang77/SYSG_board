// 모든 페이지가 공통으로 불러오는 네비게이션 바 로직
// - 로그인 상태에 따라 authArea 내용을 바꿔줌
// - 현재 페이지에 해당하는 메뉴를 활성화 표시
// - 로그인이 필요한 페이지(board, profile)에 비로그인 접근 시 login.html로 이동
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const currentPage = document.body.dataset.page; // 각 html의 <body data-page="..."> 값
const protectedPages = ["board", "profile"];

const authArea = document.getElementById("authArea");

// 현재 페이지 메뉴 강조
document.querySelectorAll(".nav-link-custom").forEach((el) => {
  if (el.dataset.page === currentPage) {
    el.classList.add("active");
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    authArea.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          ${user.displayName || user.email}
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="profile.html">내 정보</a></li>
          <li><hr class="dropdown-divider" /></li>
          <li><button class="dropdown-item" id="logoutBtn" type="button">로그아웃</button></li>
        </ul>
      </div>
    `;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  } else {
    authArea.innerHTML = `
      <a href="login.html" class="btn btn-outline-primary btn-sm">로그인</a>
      <a href="signup.html" class="btn btn-primary btn-sm">회원가입</a>
    `;

    if (protectedPages.includes(currentPage)) {
      window.location.href = "login.html";
    }
  }
});