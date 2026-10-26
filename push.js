// 모든 페이지가 공통으로 불러오는 푸시 알림 설정 모듈
import { app, auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// ⚠️ Firebase 콘솔 > 프로젝트 설정 > Cloud Messaging 탭 > 웹 구성 > "키 쌍 생성"에서 발급받은 값으로 교체하세요
const VAPID_KEY = "BADXTxIArM9_Epk2F61OvHhK8mQZ0UU1Qx1fN_JChMOQTR8s0TSDeR9TU23koLi5e9K97vpQ5rWr9e6cSLtx60k";

async function setupPush(user) {
  if (!user) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  const supported = await isSupported().catch(() => false);
  if (!supported) return; // 이 브라우저는 웹 푸시를 지원하지 않음 (일부 구형 브라우저 등)

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      // 이 계정으로 여러 기기에서 로그인할 수 있으므로 토큰을 배열로 누적 저장
      await setDoc(doc(db, "users", user.uid), { fcmTokens: arrayUnion(token) }, { merge: true });
    }

    // 탭이 열려있는 상태(포그라운드)에서 수신되는 알림도 표시
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || "My Community";
      const body = payload.notification?.body || "";
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "favicon-default.svg" });
      }
    });
  } catch (e) {
    console.warn("[push.js] 푸시 알림 설정 실패:", e);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) setupPush(user);
});