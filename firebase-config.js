// 모든 페이지가 공통으로 불러오는 Firebase 초기화 파일
// ⚠️ 아래 값을 Firebase 콘솔 > 프로젝트 설정 > 내 앱 에서 발급받은 값으로 교체하세요
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

export const app = initializeApp(firebaseConfig);

// ⚠️ 설정값을 실제 값으로 바꾸지 않으면 로그인/가입이 조용히 실패(무한 로딩처럼 보임)합니다.
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error(
    "[firebase.js] firebaseConfig 값이 아직 예시 값(YOUR_API_KEY 등)입니다. " +
      "Firebase 콘솔 > 프로젝트 설정 > 내 앱 에서 발급받은 실제 값으로 교체해주세요."
  );
}

export const auth = getAuth(app);
export const db = getFirestore(app);