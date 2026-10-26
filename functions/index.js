const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ---- 특정 유저(uid)의 모든 기기(FCM 토큰)로 알림 전송 ----
async function sendToUser(uid, title, body, url) {
  if (!uid) return;

  const userSnap = await db.collection("users").doc(uid).get();
  const tokens = userSnap.data()?.fcmTokens || [];
  if (tokens.length === 0) return;

  try {
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { url: url || "board.html" }
    });

    // 더 이상 유효하지 않은(삭제/만료된) 토큰은 정리
    const invalidTokens = [];
    res.responses.forEach((r, i) => {
      if (!r.success) invalidTokens.push(tokens[i]);
    });
    if (invalidTokens.length > 0) {
      const remaining = tokens.filter((t) => !invalidTokens.includes(t));
      await db.collection("users").doc(uid).update({ fcmTokens: remaining });
    }
  } catch (e) {
    console.error(`[알림 전송 실패] uid=${uid}:`, e);
  }
}

// ---- 새 게시글이 등록되면: 작성자 본인을 제외한 전체 회원에게 알림 ----
exports.notifyOnNewPost = onDocumentCreated("posts/{postId}", async (event) => {
  const post = event.data.data();
  const usersSnap = await db.collection("users").get();

  const preview = (post.text || "").slice(0, 40);
  const title = "새 게시글이 올라왔어요";
  const body = `${post.authorName || "회원"}: ${preview}`;

  const jobs = [];
  usersSnap.forEach((docSnap) => {
    if (docSnap.id === post.authorUid) return; // 본인 제외
    jobs.push(sendToUser(docSnap.id, title, body, "board.html"));
  });

  await Promise.all(jobs);
});

// ---- 새 답변이 달리면: 전체공개는 게시글 작성자에게, 1:1은 그 상대방에게만 ----
exports.notifyOnNewComment = onDocumentCreated(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const comment = event.data.data();
    const postId = event.params.postId;

    const postSnap = await db.collection("posts").doc(postId).get();
    if (!postSnap.exists) return;
    const post = postSnap.data();

    const preview = (comment.text || "").slice(0, 40);

    if (comment.visibility === "public") {
      // 전체공개 답변: 게시글 작성자에게 (본인 글에 본인이 단 답변이면 스킵)
      if (comment.authorUid !== post.authorUid) {
        await sendToUser(
          post.authorUid,
          "새 답변이 달렸어요",
          `${comment.authorName || "회원"}: ${preview}`,
          "board.html"
        );
      }
    } else {
      // 1:1 답변: 상대방에게만
      const recipientUid =
        comment.authorUid === post.authorUid ? comment.threadWith : post.authorUid;

      if (recipientUid && recipientUid !== comment.authorUid) {
        await sendToUser(
          recipientUid,
          "새 1:1 답변이 왔어요",
          `${comment.authorName || "회원"}: ${preview}`,
          "board.html"
        );
      }
    }
  }
);