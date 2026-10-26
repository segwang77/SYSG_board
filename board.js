import { auth, db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const postInput = document.getElementById("postInput");
const postBtn = document.getElementById("postBtn");
const postList = document.getElementById("postList");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");
const paginationControls = document.getElementById("paginationControls");

const POSTS_PER_PAGE = 4;
let allPosts = [];
let currentPage = 1;

// postId -> 해당 게시글 답변(댓글) 실시간 리스너 해제 함수
let commentBadgeListeners = {};

// ---- 글 등록 ----
postBtn.addEventListener("click", async () => {
  const text = postInput.value.trim();
  const user = auth.currentUser;
  if (!text || !user) return;

  await addDoc(collection(db, "posts"), {
    text,
    authorUid: user.uid,
    authorEmail: user.email,
    authorName: user.displayName || user.email,
    createdAt: serverTimestamp(),
    updatedAt: null,
    likedBy: []
  });

  postInput.value = "";
});

// ---- 글 목록 실시간 구독 ----
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  allPosts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));

  const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  renderCurrentPage();
});

// ---- 현재 페이지에 해당하는 글만 화면에 그리기 ----
function renderCurrentPage() {
  const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
  const start = (currentPage - 1) * POSTS_PER_PAGE;
  const pagePosts = allPosts.slice(start, start + POSTS_PER_PAGE);

  // 이전 페이지에서 걸어둔 답변 알림 리스너 정리 (메모리 누수 방지)
  Object.values(commentBadgeListeners).forEach((unsub) => unsub());
  commentBadgeListeners = {};

  postList.innerHTML = "";
  pagePosts.forEach((p) => postList.appendChild(renderPost(p.id, p.data)));

  // 글이 한 페이지 분량 이하면 화살표 자체를 숨김
  paginationControls.style.display = totalPages <= 1 ? "none" : "flex";
  pageIndicator.textContent = `${currentPage} / ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderCurrentPage();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
  if (currentPage < totalPages) {
    currentPage++;
    renderCurrentPage();
  }
});

// ---- 게시글 카드 렌더링 (수정/삭제 버튼은 작성자 본인에게만) ----
function renderPost(id, data) {
  const isOwner = auth.currentUser && auth.currentUser.uid === data.authorUid;
  const time = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "방금";
  const likedBy = data.likedBy || [];
  const isLiked = auth.currentUser && likedBy.includes(auth.currentUser.uid);

  const card = document.createElement("div");
  card.className = "note-card";
  card.innerHTML = `
    <span class="pin"></span>
    <div class="post-header">
      <div>
        <div class="fw-semibold note-author">${escapeHtml(data.authorName || data.authorEmail)}</div>
        <div class="post-meta">${time}${data.updatedAt ? " (수정됨)" : ""}</div>
      </div>
    </div>
    <div class="post-text" id="text-${id}">${escapeHtml(data.text)}</div>
    <div class="post-footer">
      <button class="btn-like ${isLiked ? "liked" : ""} likeBtn" type="button" aria-pressed="${isLiked}">
        <span class="like-icon">${isLiked ? "♥" : "♡"}</span>
        <span class="like-count">${likedBy.length}</span>
      </button>
      <button class="btn-like replyBtn" type="button">
        <span class="like-icon">💬</span>
        <span>답변</span>
        <span class="reply-count"></span>
        <span class="reply-dot d-none" id="reply-dot-${id}"></span>
      </button>
    </div>
    ${
      isOwner
        ? `<div class="post-actions">
             <button class="btn btn-note-outline btn-sm editBtn">수정</button>
             <button class="btn btn-note-outline btn-sm deleteBtn">삭제</button>
           </div>`
        : ""
    }
  `;

  card.querySelector(".likeBtn").addEventListener("click", async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const postRef = doc(db, "posts", id);

    if (isLiked) {
      await updateDoc(postRef, { likedBy: arrayRemove(uid) });
    } else {
      await updateDoc(postRef, { likedBy: arrayUnion(uid) });
    }
  });

  card.querySelector(".replyBtn").addEventListener("click", () => {
    openReplyModal(id, data);
  });

  attachReplyBadge(card, id, data.authorUid);

  if (isOwner) {
    card.querySelector(".deleteBtn").addEventListener("click", async () => {
      if (confirm("이 글을 삭제하시겠습니까? 달려있는 답변도 함께 삭제됩니다.")) {
        // Firestore는 부모 문서를 지워도 하위 컬렉션(답변)을 자동으로 지우지 않으므로,
        // 답변들을 먼저 모두 지운 뒤 게시글 자체를 삭제
        const commentsSnap = await getDocs(collection(db, "posts", id, "comments"));
        await Promise.all(commentsSnap.docs.map((d) => deleteDoc(d.ref)));

        await deleteDoc(doc(db, "posts", id));
      }
    });

    card.querySelector(".editBtn").addEventListener("click", () => {
      const textEl = card.querySelector(`#text-${id}`);
      const currentText = data.text;

      textEl.innerHTML = `
        <textarea class="form-control mb-2 editTextarea">${currentText}</textarea>
        <button class="btn btn-primary btn-sm saveEditBtn">저장</button>
        <button class="btn btn-secondary btn-sm cancelEditBtn">취소</button>
      `;

      textEl.querySelector(".cancelEditBtn").addEventListener("click", () => {
        textEl.textContent = currentText;
      });

      textEl.querySelector(".saveEditBtn").addEventListener("click", async () => {
        const newText = textEl.querySelector(".editTextarea").value.trim();
        if (!newText) return;
        await updateDoc(doc(db, "posts", id), {
          text: newText,
          updatedAt: serverTimestamp()
        });
      });
    });
  }

  return card;
}

// ---- 게시글 카드에 답변 개수/신규 알림 표시 ----
function attachReplyBadge(card, postId, postAuthorUid) {
  const unsub = subscribeToVisibleComments(postId, postAuthorUid, (comments) => {
    const countEl = card.querySelector(".reply-count");
    const dotEl = card.querySelector(".reply-dot");
    if (!countEl || !dotEl) return; // 카드가 이미 다른 페이지로 교체된 경우

    countEl.textContent = comments.length > 0 ? comments.length : "";

    const lastSeen = Number(localStorage.getItem(`replySeen:${postId}`) || 0);
    const hasNew = comments.some((c) => c.createdAt && c.createdAt.toMillis() > lastSeen);
    dotEl.classList.toggle("d-none", !hasNew);
  });

  commentBadgeListeners[postId] = unsub;
}

// ---- 간단한 XSS 방지 ----
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- 날짜를 "YY/MM/DD HH:MM" 형식으로 포맷 ----
function formatDateTime(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yy}/${mm}/${dd} ${hh}:${min}`;
}

// =========================================================
// 내가 "실제로 읽을 권한이 있는" 답변만 구독 (Firestore 규칙과 맞춘 쿼리)
// - 공개(public) 답변: 누구나
// - 1:1(private) 답변: 게시글 작성자는 전부, 그 외에는 본인이 당사자(threadWith)인 것만
// 규칙상 권한 없는 문서가 하나라도 섞인 통짜 쿼리는 전체가 거부되므로 반드시 나눠서 조회해야 함
// =========================================================
function subscribeToVisibleComments(postId, postAuthorUid, onChange) {
  const currentUid = auth.currentUser?.uid;
  const commentsRef = collection(db, "posts", postId, "comments");

  let publicComments = [];
  let privateComments = [];
  const unsubs = [];

  function emit() {
    const merged = [...publicComments, ...privateComments].sort((a, b) => {
      const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return at - bt;
    });
    onChange(merged);
  }

  unsubs.push(
    onSnapshot(query(commentsRef, where("visibility", "==", "public")), (snap) => {
      publicComments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    })
  );

  if (currentUid) {
    const isAuthorViewer = currentUid === postAuthorUid;
    const privateQuery = isAuthorViewer
      ? query(commentsRef, where("visibility", "==", "private"))
      : query(commentsRef, where("visibility", "==", "private"), where("threadWith", "==", currentUid));

    unsubs.push(
      onSnapshot(privateQuery, (snap) => {
        privateComments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emit();
      })
    );
  }

  return () => unsubs.forEach((u) => u());
}


// =========================================================
// 답변(댓글) 채팅 모달
// - 전체공개(public): 누구나 볼 수 있음
// - 1:1 대화(private): 작성자 본인 + 글쓴이만 볼 수 있음
// =========================================================
const replyModalEl = document.getElementById("replyModal");
const replyModal = new bootstrap.Modal(replyModalEl);
const chatBody = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const threadSelectWrap = document.getElementById("threadSelectWrap");
const threadSearchInput = document.getElementById("threadSearchInput");
const threadOptionsList = document.getElementById("threadOptionsList");
const selectedThreadLabel = document.getElementById("selectedThreadLabel");
const visPublicRadio = document.getElementById("visPublic");
const visPrivateRadio = document.getElementById("visPrivate");

let selectedThreadUid = null;
let selectedThreadName = "";

let currentReplyPostId = null;
let currentReplyPostAuthorUid = null;
let currentComments = [];
let unsubscribeComments = null;

function openReplyModal(postId, postData) {
  currentReplyPostId = postId;
  currentReplyPostAuthorUid = postData.authorUid;

  // 매번 열 때는 전체공개로 초기화
  document.getElementById("visPublic").checked = true;
  threadSelectWrap.classList.add("d-none");
  selectedThreadUid = null;
  selectedThreadName = "";
  threadSearchInput.value = "";
  chatInput.value = "";
  chatBody.innerHTML = `<p class="text-muted small text-center mb-0">불러오는 중...</p>`;

  if (unsubscribeComments) unsubscribeComments();

  unsubscribeComments = subscribeToVisibleComments(postId, postData.authorUid, (comments) => {
    renderChat(comments);
  });

  // 답변을 확인했으므로 "읽음" 시점 기록 + 카드의 알림 점 즉시 숨김
  localStorage.setItem(`replySeen:${postId}`, String(Date.now()));
  document.getElementById(`reply-dot-${postId}`)?.classList.add("d-none");

  replyModal.show();
}

// 모달이 닫힐 때 리스너 정리
replyModalEl.addEventListener("hidden.bs.modal", () => {
  if (unsubscribeComments) {
    unsubscribeComments();
    unsubscribeComments = null;
  }
  currentReplyPostId = null;
  currentReplyPostAuthorUid = null;
});

// 게시자가 1:1로 답장할 때 고를 수 있는 상대 목록 구성
// (지금까지 이 게시글에 1:1로 말을 건 사람들의 uid -> 이름)
function getThreadParticipants() {
  const participants = new Map();
  currentComments.forEach((c) => {
    if (c.visibility === "private" && c.threadWith && c.authorUid === c.threadWith) {
      participants.set(c.threadWith, c.authorName || "익명");
    }
  });
  return participants;
}

function populateThreadSelect() {
  const participants = getThreadParticipants(); // uid -> name
  const keyword = threadSearchInput.value.trim().toLowerCase();

  const entries = [...participants.entries()].filter(([, name]) =>
    name.toLowerCase().includes(keyword)
  );

  // 상대가 정확히 한 명뿐이고 아직 아무도 선택 안 했다면 편의상 자동 선택
  if (participants.size === 1 && !selectedThreadUid) {
    const [onlyUid, onlyName] = [...participants.entries()][0];
    selectedThreadUid = onlyUid;
    selectedThreadName = onlyName;
  }

  if (participants.size === 0) {
    threadOptionsList.innerHTML = `<div class="thread-option-empty">아직 1:1로 말을 건 사람이 없습니다</div>`;
  } else if (entries.length === 0) {
    threadOptionsList.innerHTML = `<div class="thread-option-empty">검색 결과가 없습니다</div>`;
  } else {
    threadOptionsList.innerHTML = entries
      .map(
        ([uid, name]) => `
          <button type="button" class="thread-option ${uid === selectedThreadUid ? "selected" : ""}" data-uid="${uid}" data-name="${escapeHtml(name)}">
            ${escapeHtml(name)}
          </button>
        `
      )
      .join("");
  }

  updateSelectedThreadLabel();
}

function updateSelectedThreadLabel() {
  selectedThreadLabel.textContent = selectedThreadUid
    ? `선택됨: ${selectedThreadName}님과의 1:1 대화`
    : "1:1로 답장할 상대를 선택해주세요.";
}

// "1:1 대화"를 고를 때, 게시자라면 상대를 고를 검색 리스트를 보여줌
function updateThreadSelectVisibility() {
  const isAuthorViewer = auth.currentUser?.uid === currentReplyPostAuthorUid;
  const showDropdown = visPrivateRadio.checked && isAuthorViewer;
  threadSelectWrap.classList.toggle("d-none", !showDropdown);
  if (showDropdown) populateThreadSelect();
  renderVisibleChat();
}

visPublicRadio.addEventListener("change", updateThreadSelectVisibility);
visPrivateRadio.addEventListener("change", updateThreadSelectVisibility);

threadOptionsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".thread-option");
  if (!btn) return;

  selectedThreadUid = btn.dataset.uid;
  selectedThreadName = btn.dataset.name;

  threadOptionsList.querySelectorAll(".thread-option").forEach((el) => {
    el.classList.toggle("selected", el === btn);
  });
  updateSelectedThreadLabel();
  renderVisibleChat(); // 상대를 바꾸면 채팅창도 그 사람과의 대화로 즉시 전환
});

threadSearchInput.addEventListener("input", () => {
  populateThreadSelect();
});

// 지금 라디오/선택 상태에 따라 "실제로 화면에 보여줄" 답변만 골라냄
// - 전체공개 선택: 공개 답변만
// - 1:1 선택 + 게시자: 지금 고른 상대(selectedThreadUid)와의 대화만
// - 1:1 선택 + 그 외: 본인과 게시자 사이의 대화만 (어차피 본인 몫만 받아오므로 전부)
function getVisibleComments() {
  const currentUid = auth.currentUser?.uid;
  const isPrivateView = visPrivateRadio.checked;

  if (!isPrivateView) {
    return currentComments.filter((c) => c.visibility === "public");
  }

  const isAuthorViewer = currentUid === currentReplyPostAuthorUid;
  if (isAuthorViewer) {
    if (!selectedThreadUid) return [];
    return currentComments.filter(
      (c) => c.visibility === "private" && c.threadWith === selectedThreadUid
    );
  }
  return currentComments.filter((c) => c.visibility === "private");
}

// 지금 보고 있는 대화가 무엇인지 모달 제목에 표시
function updateModalTitle() {
  const titleEl = document.getElementById("replyModalTitle");
  const currentUid = auth.currentUser?.uid;
  const isPrivateView = visPrivateRadio.checked;

  if (!isPrivateView) {
    titleEl.textContent = "답변 · 전체공개";
    return;
  }

  const isAuthorViewer = currentUid === currentReplyPostAuthorUid;
  if (isAuthorViewer) {
    titleEl.textContent = selectedThreadUid
      ? `${selectedThreadName}님과의 1:1 대화`
      : "1:1 대화 · 상대를 선택하세요";
  } else {
    titleEl.textContent = "게시자와의 1:1 대화";
  }
}

// subscribeToVisibleComments가 애초에 "내가 읽을 권한이 있는 답변"만 가져오므로,
// 여기서는 라디오/선택 상태에 맞게 그중 보여줄 것만 다시 걸러서 그림
function renderChat(comments) {
  currentComments = comments;
  renderVisibleChat();
}

function renderVisibleChat() {
  const currentUid = auth.currentUser?.uid;
  const comments = getVisibleComments();

  updateModalTitle();

  if (comments.length === 0) {
    const isAuthorViewer = currentUid === currentReplyPostAuthorUid;
    if (visPrivateRadio.checked && isAuthorViewer && !selectedThreadUid) {
      chatBody.innerHTML = `<p class="text-muted small text-center mb-0">위에서 대화 상대를 선택해주세요.</p>`;
    } else {
      chatBody.innerHTML = `<p class="text-muted small text-center mb-0">아직 답변이 없습니다.</p>`;
    }
  } else {
    chatBody.innerHTML = comments
      .map((c) => {
        const isAuthorMsg = c.authorUid === currentReplyPostAuthorUid;
        const isMine = c.authorUid === currentUid;
        const time = c.createdAt?.toDate ? formatDateTime(c.createdAt.toDate()) : "";
        const authorBadge = isAuthorMsg ? `<span class="chat-author-badge">게시자</span>` : "";
        const editedBadge = c.updatedAt ? `<span class="chat-edited">(수정됨)</span>` : "";

        // 게시자 답변은 항상 왼쪽, 그 외(질문자 등)는 오른쪽
        return `
          <div class="chat-bubble-row ${isAuthorMsg ? "theirs" : "mine"}">
            <div class="chat-bubble">
              <div class="chat-bubble-meta">${escapeHtml(c.authorName || "익명")} ${authorBadge}</div>
              <div class="chat-bubble-text" data-original="${escapeHtml(c.text)}">${escapeHtml(c.text)}</div>
              <div class="chat-bubble-time">${time} ${editedBadge}</div>
              ${
                isMine
                  ? `<div class="chat-bubble-actions">
                       <button class="chat-edit-btn" data-id="${c.id}">수정</button>
                       <button class="chat-delete-btn" data-id="${c.id}">삭제</button>
                     </div>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // 대화 중 새로운 1:1 상대가 생겼을 수 있으니 검색 리스트 최신화
  if (!threadSelectWrap.classList.contains("d-none")) populateThreadSelect();
}

// ---- 답변 수정/삭제 (이벤트 위임: chatBody 내용이 매번 새로 그려지므로) ----
chatBody.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".chat-delete-btn");
  const editBtn = e.target.closest(".chat-edit-btn");
  const saveBtn = e.target.closest(".chat-edit-save-btn");
  const cancelBtn = e.target.closest(".chat-edit-cancel-btn");

  if (deleteBtn) {
    const commentId = deleteBtn.dataset.id;
    if (confirm("이 답변을 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "posts", currentReplyPostId, "comments", commentId));
    }
    return;
  }

  if (editBtn) {
    const bubble = editBtn.closest(".chat-bubble");
    const textEl = bubble.querySelector(".chat-bubble-text");
    const currentText = textEl.dataset.original;

    textEl.innerHTML = `
      <textarea class="form-control form-control-sm chat-edit-textarea mb-1">${currentText}</textarea>
      <div class="d-flex gap-1">
        <button class="btn btn-primary btn-sm chat-edit-save-btn" data-id="${editBtn.dataset.id}">저장</button>
        <button class="btn btn-secondary btn-sm chat-edit-cancel-btn">취소</button>
      </div>
    `;
    return;
  }

  if (saveBtn) {
    const bubble = saveBtn.closest(".chat-bubble");
    const textarea = bubble.querySelector(".chat-edit-textarea");
    const newText = textarea.value.trim();
    if (!newText) return;

    await updateDoc(doc(db, "posts", currentReplyPostId, "comments", saveBtn.dataset.id), {
      text: newText,
      updatedAt: serverTimestamp()
    });
    return;
  }

  if (cancelBtn) {
    // 다음 실시간 갱신 시 원래 내용으로 자동 복원되므로 별도 처리 불필요
    const bubble = cancelBtn.closest(".chat-bubble");
    const textEl = bubble.querySelector(".chat-bubble-text");
    textEl.textContent = textEl.dataset.original;
  }
});

async function sendReply() {
  const text = chatInput.value.trim();
  const user = auth.currentUser;
  if (!text || !user || !currentReplyPostId) return;

  const visibility = document.querySelector("input[name='replyVisibility']:checked").value;
  const isAuthorViewer = user.uid === currentReplyPostAuthorUid;

  let threadWith = null;
  if (visibility === "private") {
    if (isAuthorViewer) {
      // 게시자는 반드시 대상을 선택해야 함
      threadWith = selectedThreadUid;
      if (!threadWith) {
        alert("1:1로 답장할 상대를 선택해주세요.");
        return;
      }
    } else {
      // 게시자가 아닌 사람이 1:1을 선택하면, 본인 uid가 곧 스레드 식별자
      threadWith = user.uid;
    }
  }

  await addDoc(collection(db, "posts", currentReplyPostId, "comments"), {
    text,
    authorUid: user.uid,
    authorName: user.displayName || user.email,
    visibility,
    threadWith,
    createdAt: serverTimestamp()
  });

  chatInput.value = "";
}

chatSendBtn.addEventListener("click", sendReply);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendReply();
  }
});