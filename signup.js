import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const signupEmailInput = document.getElementById("signupEmailInput");
const signupPasswordInput = document.getElementById("signupPasswordInput");
const signupNameInput = document.getElementById("signupNameInput");
const signupPhoneInput = document.getElementById("signupPhoneInput");
const signupBtn = document.getElementById("signupBtn");
const signupError = document.getElementById("signupError");

signupBtn.addEventListener("click", async () => {
  signupError.textContent = "";

  const email = signupEmailInput.value;
  const password = signupPasswordInput.value;
  const name = signupNameInput.value.trim();
  const phone = signupPhoneInput.value.trim();
  const gender = document.querySelector("input[name='gender']:checked")?.value || "선택 안함";

  if (!email || !password) {
    signupError.textContent = "이메일과 비밀번호를 입력해주세요.";
    return;
  }
  if (!name) {
    signupError.textContent = "이름을 입력해주세요.";
    return;
  }

  const fields = [signupEmailInput, signupPasswordInput, signupNameInput, signupPhoneInput];
  const genderRadios = document.querySelectorAll("input[name='gender']");

  // 입력란 글자 지우고 비활성화, 버튼은 "로딩중..." 표시로 전환
  fields.forEach((el) => {
    el.value = "";
    el.disabled = true;
  });
  genderRadios.forEach((el) => (el.disabled = true));

  const originalText = signupBtn.textContent;
  signupBtn.disabled = true;
  signupBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>`;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // 인증 프로필에 이름을 닉네임 기본값으로 반영
    await updateProfile(cred.user, { displayName: name });

    try {
      // users 컬렉션에 상세 정보 저장 (여기서 실패해도 계정 생성 자체는 이미 완료된 상태)
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        name,
        gender,
        phone,
        displayName: name,
        createdAt: serverTimestamp()
      });
    } catch (firestoreError) {
      console.error("[signup.js] Firestore 프로필 저장 실패 (계정 생성은 완료됨):", firestoreError);
    }

    window.location.href = "index.html";
  } catch (e) {
    console.error("[signup.js] 회원가입 실패:", e);
    signupError.textContent = e.message || "알 수 없는 오류가 발생했습니다. 개발자도구(F12) 콘솔을 확인해주세요.";

    // 실패 시 입력란/버튼 복원
    fields.forEach((el) => (el.disabled = false));
    genderRadios.forEach((el) => (el.disabled = false));
    signupBtn.disabled = false;
    signupBtn.textContent = originalText;
  }
});