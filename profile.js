import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- 탭 전환 ----
const tabButtons = document.querySelectorAll("#profileTabs [data-tab]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    tabPanels.forEach((panel) => {
      panel.classList.toggle("d-none", panel.dataset.tabPanel !== btn.dataset.tab);
    });
  });
});

// ---- 기본 정보 (닉네임) ----
const emailDisplay = document.getElementById("emailDisplay");
const displayNameInput = document.getElementById("displayNameInput");
const checkNicknameBtn = document.getElementById("checkNicknameBtn");
const nicknameCheckMsg = document.getElementById("nicknameCheckMsg");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileMsg = document.getElementById("profileMsg");

// 닉네임이 마지막으로 "사용 가능" 확인된 값 (이 값과 다르면 저장 전 재확인 필요)
let checkedNickname = null;

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  emailDisplay.value = user.email;
  displayNameInput.value = user.displayName || "";
  // 지금 쓰고 있는 내 닉네임은 이미 확인된 것으로 간주
  checkedNickname = user.displayName || "";
});

// 닉네임을 수정하면 다시 중복 확인을 받아야 함
displayNameInput.addEventListener("input", () => {
  nicknameCheckMsg.textContent = "";
  nicknameCheckMsg.className = "small mb-3";
});

checkNicknameBtn.addEventListener("click", async () => {
  const name = displayNameInput.value.trim();
  nicknameCheckMsg.className = "small mb-3";

  if (!name) {
    nicknameCheckMsg.textContent = "닉네임을 입력해주세요.";
    nicknameCheckMsg.classList.add("text-danger");
    return;
  }

  const user = auth.currentUser;

  // 지금 내가 쓰고 있는 닉네임 그대로면 바로 통과
  if (name === user.displayName) {
    checkedNickname = name;
    nicknameCheckMsg.textContent = "현재 사용 중인 닉네임입니다.";
    nicknameCheckMsg.classList.add("text-success");
    return;
  }

  nicknameCheckMsg.textContent = "확인 중...";

  try {
    const q = query(collection(db, "users"), where("displayName", "==", name));
    const snapshot = await getDocs(q);

    // 본인 문서를 제외하고 같은 닉네임을 쓰는 사람이 있는지 확인
    const isDuplicate = snapshot.docs.some((d) => d.id !== user.uid);

    if (isDuplicate) {
      checkedNickname = null;
      nicknameCheckMsg.textContent = "이미 사용 중인 닉네임입니다.";
      nicknameCheckMsg.classList.add("text-danger");
    } else {
      checkedNickname = name;
      nicknameCheckMsg.textContent = "사용 가능한 닉네임입니다.";
      nicknameCheckMsg.classList.add("text-success");
    }
  } catch (e) {
    nicknameCheckMsg.textContent = "확인 중 오류가 발생했습니다: " + e.message;
    nicknameCheckMsg.classList.add("text-danger");
  }
});

saveProfileBtn.addEventListener("click", async () => {
  profileMsg.textContent = "";
  profileMsg.className = "small mt-2 mb-0";
  const user = auth.currentUser;
  if (!user) return;

  const name = displayNameInput.value.trim();

  if (name !== checkedNickname) {
    profileMsg.textContent = "닉네임 중복 확인을 먼저 해주세요.";
    profileMsg.classList.add("text-danger");
    return;
  }

  try {
    await updateProfile(user, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email,
        displayName: name
      },
      { merge: true }
    );

    profileMsg.textContent = "저장되었습니다.";
    profileMsg.classList.add("text-success");
  } catch (e) {
    profileMsg.textContent = "오류: " + e.message;
    profileMsg.classList.add("text-danger");
  }
});

// ---- 비밀번호 변경 ----
const currentPasswordInput = document.getElementById("currentPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const passwordMsg = document.getElementById("passwordMsg");

changePasswordBtn.addEventListener("click", async () => {
  passwordMsg.textContent = "";
  passwordMsg.className = "small mt-2 mb-0";

  const user = auth.currentUser;
  if (!user) return;

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    passwordMsg.textContent = "모든 항목을 입력해주세요.";
    passwordMsg.classList.add("text-danger");
    return;
  }
  if (newPassword.length < 6) {
    passwordMsg.textContent = "새 비밀번호는 6자 이상이어야 합니다.";
    passwordMsg.classList.add("text-danger");
    return;
  }
  if (newPassword !== confirmPassword) {
    passwordMsg.textContent = "새 비밀번호가 일치하지 않습니다.";
    passwordMsg.classList.add("text-danger");
    return;
  }

  try {
    // 비밀번호 변경 전, 현재 비밀번호로 재인증 (Firebase 보안 정책상 필수)
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    await updatePassword(user, newPassword);

    passwordMsg.textContent = "비밀번호가 변경되었습니다.";
    passwordMsg.classList.add("text-success");
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
  } catch (e) {
    passwordMsg.textContent =
      e.code === "auth/invalid-credential" || e.code === "auth/wrong-password"
        ? "현재 비밀번호가 일치하지 않습니다."
        : "오류: " + e.message;
    passwordMsg.classList.add("text-danger");
  }
});