// 앱(탭)이 닫혀있어도 백그라운드에서 푸시 알림을 받아 표시하는 서비스 워커
// 파일명은 반드시 firebase-messaging-sw.js 로 유지해야 합니다 (Firebase SDK가 이 이름을 찾음)
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// ⚠️ firebase-config.js와 동일한 값으로 맞춰주세요
firebase.initializeApp({
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
});

const messaging = firebase.messaging();

// 백그라운드(앱이 안 켜져있을 때) 메시지 수신 시 알림 표시
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "SYSG";
  const body = payload.notification?.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "./img/logo/favicon.svg",
    badge: "./img/logo/favicon.svg",
    data: payload.data || {}
  });
});

// 알림 클릭 시 사이트로 이동
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "index.html";
  event.waitUntil(clients.openWindow(url));
});