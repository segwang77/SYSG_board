import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";

  const originalText = loginBtn.textContent;
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

  try {
    await signInWithEmailAndPassword(auth, loginEmailInput.value, loginPasswordInput.value);
    window.location.href = "index.html";
  } catch (e) {
    loginError.textContent = e.message;
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
  }
});