import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const homeGuest = document.getElementById("homeGuest");
const homeUser = document.getElementById("homeUser");
const homeName = document.getElementById("homeName");
const homeEmail = document.getElementById("homeEmail");

onAuthStateChanged(auth, (user) => {
  if (user) {
    homeGuest.classList.add("d-none");
    homeUser.classList.remove("d-none");
    homeName.textContent = user.displayName || "닉네임을 설정해주세요";
    homeEmail.textContent = user.email;
  } else {
    homeGuest.classList.remove("d-none");
    homeUser.classList.add("d-none");
  }
});