let currentUser = null;
let currentVideoId = null;
let currentVideoData = null;
let currentSection = "homeSection";
let lastHomeVideos = [];
let lastSearchTerm = "";
let currentTheme = localStorage.getItem("navistream-theme") || "dark";

const API_URL = "https://your-render-backend-url.onrender.com/api";
const ui = {};

class Auth {
  constructor() {
    this.token = localStorage.getItem("token");
    this.user = JSON.parse(localStorage.getItem("user"));
  }

  async register(username, email, password) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Registration failed");
    }
    this.setAuth(data);
    return data;
  }

  async login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Login failed");
    }
    this.setAuth(data);
    return data;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  setAuth(data) {
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  }

  getAuthHeader() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
}

const auth = new Auth();

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  hydrateIcons();
  decorateCategoryPills();
  applyTheme(currentTheme);
  checkAuth();
  setupEventListeners();

  const apiWorking = await testAPIConnectivity();
  if (!apiWorking) {
    showToast("Cannot connect to server. Please check if the backend is running.", "error");
    return;
  }

  await loadHomeVideos();
});

function cacheDom() {
  ui.searchInput = document.getElementById("searchInput");
  ui.sortSelect = document.getElementById("sortSelect");
  ui.categoryFilter = document.getElementById("categoryFilter");
  ui.loginButton = document.getElementById("loginButton");
  ui.userProfileSection = document.getElementById("userProfileSection");
  ui.userAvatar = document.getElementById("userAvatar");
  ui.userMenu = document.getElementById("userMenu");
  ui.sidebar = document.getElementById("sidebar");
  ui.appMain = document.getElementById("appMain");
  ui.topbar = document.getElementById("topbar");
  ui.toastStack = document.getElementById("toastStack");
  ui.uploadModal = document.getElementById("uploadModal");
  ui.uploadStatus = document.getElementById("uploadStatus");
  ui.uploadSubmitBtn = document.getElementById("uploadSubmitBtn");
  ui.fileInput = document.getElementById("fileInput");
  ui.videoTitle = document.getElementById("videoTitle");
  ui.uploadDropzone = document.getElementById("uploadDropzone");
  ui.descriptionToggleBtn = document.getElementById("descriptionToggleBtn");
  ui.videoDescriptionText = document.getElementById("videoDescriptionText");
  ui.dislikeButton = document.getElementById("dislikeButton");
  ui.commentInput = document.getElementById("commentInput");
  ui.commentUserAvatar = document.getElementById("commentUserAvatar");
}

function setupEventListeners() {
  let searchTimeout;
  ui.searchInput?.addEventListener("input", (event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchVideos(event.target.value.trim());
    }, 300);
  });

  ui.sortSelect?.addEventListener("change", () => {
    if (currentSection === "homeSection") loadHomeVideos();
  });

  ui.categoryFilter?.addEventListener("change", () => {
    syncCategoryPills(ui.categoryFilter.value);
    if (currentSection === "homeSection") loadHomeVideos();
  });

  document.getElementById("uploadForm")?.addEventListener("submit", handleUploadSubmit);
  ui.fileInput?.addEventListener("change", handleFileSelect);
  ui.videoTitle?.addEventListener("input", updateUploadSubmitState);

  ui.uploadDropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    ui.uploadDropzone.classList.add("is-dragging");
  });
  ui.uploadDropzone?.addEventListener("dragleave", () => {
    ui.uploadDropzone.classList.remove("is-dragging");
  });
  ui.uploadDropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    ui.uploadDropzone.classList.remove("is-dragging");
    if (event.dataTransfer?.files?.length) {
      ui.fileInput.files = event.dataTransfer.files;
      handleFileSelect({ target: ui.fileInput });
    }
  });

  document.getElementById("commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = ui.commentInput?.value.trim();
    if (!currentUser) return showToast("Please login to comment.", "error");
    if (!text) return showToast("Please enter a comment.", "error");
    await addComment(currentVideoId, text);
  });

  ui.descriptionToggleBtn?.addEventListener("click", toggleDescription);
  ui.dislikeButton?.addEventListener("click", () => {
    ui.dislikeButton.classList.toggle("is-active");
    showToast("Dislike saved for this session.", "info");
  });

  document.querySelectorAll(".category-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const value = pill.dataset.value || "";
      ui.categoryFilter.value = value;
      syncCategoryPills(value);
      if (currentSection !== "homeSection") showSection("homeSection");
      else loadHomeVideos();
    });
  });

  window.addEventListener("scroll", () => {
    ui.topbar?.classList.toggle("is-scrolled", window.scrollY > 20);
  });

  document.addEventListener("click", (event) => {
    if (ui.userMenu && ui.userProfileSection && !ui.userProfileSection.contains(event.target)) {
      ui.userMenu.classList.add("hidden");
    }
  });

  document.querySelectorAll(".modal-shell, .player-shell").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target !== modal) return;
      if (modal.id === "authModal") hideAuthModal();
      if (modal.id === "uploadModal") hideUploadModal();
      if (modal.id === "videoPlayerModal") hideVideoPlayer();
    });
  });

  setupAuthModal();
}

function decorateCategoryPills() {
  document.querySelectorAll(".category-pill").forEach((pill) => {
    const icon = pill.dataset.icon;
    const label = pill.textContent.trim();
    pill.innerHTML = `${iconMarkup(icon)}<span class="pill-label">${label}</span>`;
  });
}

function setupAuthModal() {
  const authTabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      authTabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      loginForm.classList.toggle("hidden", tabName !== "login");
      registerForm.classList.toggle("hidden", tabName !== "register");
    });
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Logging in...";
    try {
      await auth.login(
        document.getElementById("loginEmail").value.trim(),
        document.getElementById("loginPassword").value,
      );
      currentUser = auth.user;
      updateUIForLoggedInUser();
      hideAuthModal();
      showToast("Logged in successfully.", "success");
      await loadHomeVideos();
    } catch (error) {
      showFormError(loginForm, error.message || "Login failed.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = registerForm.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Registering...";
    try {
      await auth.register(
        document.getElementById("registerUsername").value.trim(),
        document.getElementById("registerEmail").value.trim(),
        document.getElementById("registerPassword").value,
      );
      currentUser = auth.user;
      updateUIForLoggedInUser();
      hideAuthModal();
      showToast("Welcome to NaviStream.", "success");
      await loadHomeVideos();
    } catch (error) {
      showFormError(registerForm, error.message || "Registration failed.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

function checkAuth() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  if (token && user) {
    currentUser = user;
    updateUIForLoggedInUser();
  } else {
    updateUIForLoggedOutUser();
  }
}

function updateUIForLoggedInUser() {
  ui.loginButton?.classList.add("hidden");
  ui.userProfileSection?.classList.remove("hidden");
  if (ui.userAvatar) {
    ui.userAvatar.src = avatarUrl(currentUser?.username || "Guest");
  }
  if (ui.commentUserAvatar) {
    ui.commentUserAvatar.src = avatarUrl(currentUser?.username || "User");
  }
}

function updateUIForLoggedOutUser() {
  ui.loginButton?.classList.remove("hidden");
  ui.userProfileSection?.classList.add("hidden");
}

function showSection(sectionId) {
  currentSection = sectionId;
  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.toggle("hidden", section.id !== sectionId);
  });
  updateSidebarActiveState(sectionId);
  if (window.innerWidth <= 768) {
    ui.sidebar?.classList.remove("mobile-open");
  }

  switch (sectionId) {
    case "homeSection":
      loadHomeVideos();
      break;
    case "myVideosSection":
      loadMyVideos();
      break;
    case "trendingSection":
      loadTrendingVideos();
      break;
    case "likedSection":
      loadLikedVideos();
      break;
    case "playlistsSection":
      loadPlaylists();
      break;
    case "watchLaterSection":
      loadWatchLater();
      break;
    case "profileSection":
      loadUserProfile();
      break;
    default:
      break;
  }
}

function updateSidebarActiveState(activeSectionId) {
  document.querySelectorAll(".sidebar-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.section === activeSectionId);
  });
}

function showUploadModal() {
  if (!currentUser) return showToast("Please login to upload videos.", "error");
  ui.uploadModal?.classList.remove("hidden");
  document.getElementById("uploadForm")?.reset();
  if (ui.uploadStatus) ui.uploadStatus.innerHTML = "";
  updateUploadSubmitState();
}

function hideUploadModal() {
  ui.uploadModal?.classList.add("hidden");
  document.getElementById("uploadForm")?.reset();
  if (ui.uploadStatus) ui.uploadStatus.innerHTML = "";
  updateUploadSubmitState();
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) {
    updateUploadSubmitState();
    return;
  }
  if (!file.type.startsWith("video/")) {
    showToast("Please select a valid video file.", "error");
    event.target.value = "";
    updateUploadSubmitState();
    return;
  }
  renderSelectedFile(file);
  updateUploadSubmitState();
}

function updateUploadSubmitState() {
  const hasTitle = Boolean(ui.videoTitle?.value.trim());
  const hasFile = Boolean(ui.fileInput?.files?.length);
  if (ui.uploadSubmitBtn) {
    ui.uploadSubmitBtn.disabled = !(hasTitle && hasFile);
  }
}

function renderSelectedFile(file) {
  if (!ui.uploadStatus) return;
  ui.uploadStatus.innerHTML = `
    <div class="file-chip-row">
      <span class="file-chip">${escapeHtml(file.name)}</span>
      <span class="file-chip">${formatFileSize(file.size)}</span>
      <span class="file-chip">${escapeHtml(file.type || "video")}</span>
    </div>
  `;
}

async function handleUploadSubmit(event) {
  event.preventDefault();
  if (!currentUser) return showToast("Please login to upload videos.", "error");

  const title = document.getElementById("videoTitle").value.trim();
  const description = document.getElementById("videoDescription").value.trim();
  const category = document.getElementById("videoCategory").value;
  const tags = document.getElementById("videoTags").value.trim();
  const file = ui.fileInput?.files?.[0];

  if (!title) return showToast("Title is required.", "error");
  if (!file) return showToast("Please choose a video file.", "error");

  ui.uploadSubmitBtn.disabled = true;
  ui.uploadSubmitBtn.textContent = "Uploading...";
  renderUploadProgress();

  try {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description || "No description provided");
    formData.append("category", category || "other");
    if (tags) formData.append("tags", tags);

    await uploadWithProgress(formData);
    showToast("Video uploaded successfully.", "success");
    hideUploadModal();
    await loadHomeVideos();
    if (currentUser) await loadMyVideos();
  } catch (error) {
    showToast(error.message || "Upload failed.", "error");
  } finally {
    ui.uploadSubmitBtn.disabled = false;
    ui.uploadSubmitBtn.textContent = "Upload Video";
    updateUploadSubmitState();
  }
}

function renderUploadProgress() {
  if (!ui.uploadStatus) return;
  ui.uploadStatus.innerHTML = `
    <div class="upload-progress">
      <div class="file-chip-row">
        <span class="file-chip">Uploading</span>
        <span class="file-chip" id="uploadPercent">0%</span>
      </div>
      <div class="upload-progress__bar">
        <div class="upload-progress__fill" id="uploadProgress"></div>
      </div>
      <p id="uploadProgressText" class="video-card__stats">Preparing upload...</p>
    </div>
  `;
}

function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      const progressBar = document.getElementById("uploadProgress");
      const progressText = document.getElementById("uploadProgressText");
      const progressPercent = document.getElementById("uploadPercent");
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressPercent) progressPercent.textContent = `${percent}%`;
      if (progressText) {
        progressText.textContent = `Uploaded ${formatFileSize(event.loaded)} of ${formatFileSize(event.total)}`;
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const payload = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
        else reject(new Error(payload.error || payload.details || "Upload failed"));
      } catch (error) {
        reject(new Error("Invalid response from server"));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out")));
    xhr.timeout = 300000;
    xhr.open("POST", `${API_URL}/videos/upload`);
    if (localStorage.getItem("token")) {
      xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("token")}`);
    }
    xhr.send(formData);
  });
}

async function loadHomeVideos() {
  renderGridState("homeSection", renderSkeleton(8));
  try {
    const url = new URL(`${API_URL}/videos`);
    if (ui.sortSelect?.value) url.searchParams.append("sort", ui.sortSelect.value);
    if (ui.categoryFilter?.value) url.searchParams.append("category", ui.categoryFilter.value);
    const videos = await apiCall(url.toString());
    lastHomeVideos = videos;
    displayVideos(videos, "homeSection");
  } catch (error) {
    showToast(error.message, "error");
    renderEmptyState("homeSection", "Unable to load videos right now.");
  }
}

async function loadMyVideos() {
  if (!currentUser) return showToast("Please login to view your videos.", "error");
  renderGridState("myVideosSection", renderSkeleton(6));
  try {
    const response = await fetch(`${API_URL}/videos/my-videos`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const videos = await response.json();
    if (!response.ok) throw new Error(videos.error || "Failed to load videos");
    displayVideos(videos, "myVideosSection");
  } catch (error) {
    showToast(error.message, "error");
    renderEmptyState("myVideosSection", "Your uploads will appear here.");
  }
}

async function loadTrendingVideos() {
  renderGridState("trendingSection", renderSkeleton(6));
  try {
    const response = await fetch(`${API_URL}/videos/trending`);
    const videos = await response.json();
    if (!response.ok) throw new Error(videos.error || "Failed to load trending videos");
    displayVideos(videos, "trendingSection");
  } catch (error) {
    showToast(error.message, "error");
    renderEmptyState("trendingSection", "Trending videos are unavailable.");
  }
}

async function loadLikedVideos() {
  if (!currentUser) return showToast("Please login to view liked videos.", "error");
  renderGridState("likedSection", renderSkeleton(6));
  try {
    const response = await fetch(`${API_URL}/videos/liked`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const videos = await response.json();
    if (!response.ok) throw new Error(videos.error || "Failed to load liked videos");
    displayVideos(videos, "likedSection");
  } catch (error) {
    showToast(error.message, "error");
    renderEmptyState("likedSection", "Videos you like will appear here.");
  }
}

async function searchVideos(query) {
  lastSearchTerm = query;
  if (!query) return loadHomeVideos();
  showSection("homeSection");
  renderGridState("homeSection", renderSkeleton(8));
  try {
    const url = new URL(`${API_URL}/videos/search`);
    url.searchParams.append("q", query);
    const response = await fetch(url);
    const videos = await response.json();
    if (!response.ok) throw new Error(videos.error || "Search failed");
    displayVideos(videos, "homeSection");
  } catch (error) {
    showToast(error.message, "error");
    renderEmptyState("homeSection", `No results for "${escapeHtml(query)}".`);
  }
}

function displayVideos(videos, sectionId) {
  const section = document.getElementById(sectionId);
  const grid = section?.querySelector(".video-grid");
  if (!grid) return;
  if (!Array.isArray(videos) || videos.length === 0) {
    grid.innerHTML = `<div class="empty-state">No videos found.</div>`;
    return;
  }
  grid.innerHTML = "";
  videos.forEach((video) => grid.appendChild(createVideoCard(video)));
  hydrateIcons(grid);
}

function createVideoCard(video) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.dataset.videoId = video._id;

  const username = video.userId?.username || "Unknown User";
  const thumbnail = video.thumbnail || "https://via.placeholder.com/640x360?text=No+Thumbnail";
  const likes = Array.isArray(video.likes) ? video.likes.length : 0;
  const isLiked = currentUser && Array.isArray(video.likes)
    ? video.likes.some((id) => id.toString() === currentUser._id || id === currentUser._id)
    : false;
  const isOwner = currentUser && (video.userId?._id === currentUser._id || video.userId === currentUser._id);

  card.innerHTML = `
    <div class="video-card__thumb">
      <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(video.title || "Untitled Video")}" />
      <div class="video-card__overlay">
        <span class="video-card__play">${iconMarkup("play-solid")}</span>
      </div>
      <span class="video-duration">${formatDuration(video.duration)}</span>
    </div>
    <div class="video-card__body">
      <img class="channel-avatar" src="${avatarUrl(username)}" alt="${escapeHtml(username)}" />
      <div>
        <h3 class="video-card__title">${escapeHtml(video.title || "Untitled Video")}</h3>
        <p class="video-card__meta">${escapeHtml(username)}</p>
        <p class="video-card__stats">${formatViews(video.views || 0)} views · ${formatDate(video.createdAt)}</p>
        <div class="video-card__actions">
          <button class="video-card__mini ${isLiked ? "is-liked" : ""}" type="button">
            ${iconMarkup("heart")}
            <span class="like-count">${likes}</span>
          </button>
          ${isOwner ? `<button class="video-card__mini" type="button" data-delete="true">${iconMarkup("trash")}<span>Delete</span></button>` : ""}
        </div>
      </div>
    </div>
  `;

  card.addEventListener("click", () => showVideoPlayer(video));
  const likeButton = card.querySelector(".video-card__mini");
  likeButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    likeVideoCard(video._id, likeButton);
  });

  const deleteButton = card.querySelector('[data-delete="true"]');
  deleteButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteVideoCard(video._id, deleteButton);
  });

  return card;
}

function showVideoPlayer(video) {
  currentVideoId = video._id;
  currentVideoData = JSON.parse(JSON.stringify(video));
  const modal = document.getElementById("videoPlayerModal");
  const player = document.getElementById("mainVideoPlayer");
  const loading = document.getElementById("videoLoadingIndicator");
  const likeButton = modal.querySelector(".like-button");
  const likeCountNode = likeButton?.querySelector(".like-count");
  const deleteBtn = document.getElementById("deleteVideoBtn");

  modal.classList.remove("hidden");
  loading?.classList.remove("hidden");
  player.src = video.url;
  modal.querySelector(".video-title").textContent = video.title || "Untitled Video";
  modal.querySelector(".view-count").textContent = formatViews(video.views || 0);
  modal.querySelector(".upload-date").textContent = formatDate(video.createdAt);
  if (likeCountNode) likeCountNode.textContent = Array.isArray(video.likes) ? video.likes.length : 0;
  ui.videoDescriptionText.textContent = video.description || "No description provided.";
  ui.videoDescriptionText.classList.add("collapsed");
  ui.descriptionToggleBtn.textContent = "Show more";

  const isLiked = currentUser && Array.isArray(video.likes)
    ? video.likes.some((id) => id.toString() === currentUser._id || id === currentUser._id)
    : false;
  likeButton?.classList.toggle("is-liked", Boolean(isLiked));
  likeButton?.querySelector(".nav-icon")?.replaceWith(createIconNode("thumbs-up"));

  const isOwner = currentUser && (video.userId?._id === currentUser._id || video.userId === currentUser._id);
  deleteBtn?.classList.toggle("hidden", !isOwner);
  if (ui.commentUserAvatar) {
    ui.commentUserAvatar.src = avatarUrl(currentUser?.username || "User");
  }

  player.onloadeddata = () => loading?.classList.add("hidden");
  player.onerror = () => {
    loading?.classList.add("hidden");
    showToast("Error loading video. Please try again.", "error");
  };
  player.oncanplaythrough = () => incrementViewCount(video._id);
  player.play().catch(() => {});

  loadComments(video._id);
  renderRelatedVideos(video._id);
}

function hideVideoPlayer() {
  const modal = document.getElementById("videoPlayerModal");
  const player = document.getElementById("mainVideoPlayer");
  const loading = document.getElementById("videoLoadingIndicator");
  player.pause();
  player.src = "";
  loading?.classList.add("hidden");
  modal.classList.add("hidden");
  currentVideoId = null;
  currentVideoData = null;
}

async function renderRelatedVideos(excludeId) {
  const container = document.getElementById("relatedVideosList");
  if (!container) return;
  container.innerHTML = renderCompactSkeleton(5);
  hydrateIcons(container);

  const source = lastHomeVideos.length ? lastHomeVideos : await apiCall(`${API_URL}/videos`);
  const related = source.filter((video) => video._id !== excludeId).slice(0, 6);
  container.innerHTML = related.length
    ? related.map((video) => `
        <article class="related-card" data-video-id="${video._id}">
          <div class="related-card__thumb">
            <img src="${escapeHtml(video.thumbnail || "https://via.placeholder.com/640x360?text=No+Thumbnail")}" alt="${escapeHtml(video.title || "Untitled Video")}" />
            <span class="video-duration">${formatDuration(video.duration)}</span>
          </div>
          <div>
            <h4 class="related-card__title">${escapeHtml(video.title || "Untitled Video")}</h4>
            <p class="video-card__meta">${escapeHtml(video.userId?.username || "Unknown User")}</p>
            <p class="video-card__stats">${formatViews(video.views || 0)} views</p>
          </div>
        </article>
      `).join("")
    : `<div class="empty-state">No related videos yet.</div>`;

  container.querySelectorAll(".related-card").forEach((card) => {
    card.addEventListener("click", () => {
      const nextVideo = related.find((item) => item._id === card.dataset.videoId);
      if (nextVideo) showVideoPlayer(nextVideo);
    });
  });
}

async function likeVideoCard(videoId, button) {
  if (!currentUser) return showToast("Please login to like videos.", "error");
  const countNode = button.querySelector(".like-count");
  const originalCount = parseInt(countNode.textContent, 10) || 0;
  const wasLiked = button.classList.contains("is-liked");
  button.classList.toggle("is-liked", !wasLiked);
  countNode.textContent = String(wasLiked ? Math.max(0, originalCount - 1) : originalCount + 1);
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to like video");
    button.classList.toggle("is-liked", Boolean(data.isLiked));
    countNode.textContent = String(data.likes);
  } catch (error) {
    button.classList.toggle("is-liked", wasLiked);
    countNode.textContent = String(originalCount);
    showToast(error.message, "error");
  }
}

async function likeVideo() {
  if (!currentUser) return showToast("Please login to like videos.", "error");
  if (!currentVideoId) return;
  const button = document.querySelector(".like-button");
  const countNode = button?.querySelector(".like-count");
  const originalCount = parseInt(countNode?.textContent || "0", 10);
  const wasLiked = button.classList.contains("is-liked");
  button.classList.toggle("is-liked", !wasLiked);
  countNode.textContent = String(wasLiked ? Math.max(0, originalCount - 1) : originalCount + 1);
  try {
    const response = await fetch(`${API_URL}/videos/${currentVideoId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to like video");
    button.classList.toggle("is-liked", Boolean(data.isLiked));
    countNode.textContent = String(data.likes);
  } catch (error) {
    button.classList.toggle("is-liked", wasLiked);
    countNode.textContent = String(originalCount);
    showToast(error.message, "error");
  }
}

async function deleteVideoCard(videoId) {
  if (!currentUser) return showToast("Please login to delete videos.", "error");
  if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to delete video");
    showToast("Video deleted successfully.", "success");
    if (currentVideoId === videoId) hideVideoPlayer();
    await loadHomeVideos();
    if (currentUser) await loadMyVideos();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteVideo(videoId) {
  if (!currentUser) return showToast("Please login to delete videos.", "error");
  if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to delete video");
    showToast("Video deleted successfully.", "success");
    if (currentVideoId === videoId) hideVideoPlayer();
    await loadHomeVideos();
    if (currentUser) await loadMyVideos();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function incrementViewCount(videoId) {
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) return;
    document.querySelector(".view-count").textContent = formatViews(data.views);
  } catch (error) {
    console.warn("View count update failed:", error);
  }
}

function showAuthModal() {
  document.getElementById("authModal")?.classList.remove("hidden");
}

function hideAuthModal() {
  document.getElementById("authModal")?.classList.add("hidden");
  document.querySelectorAll("#authModal .error-message").forEach((node) => node.remove());
}

function handleLogout() {
  auth.logout();
  currentUser = null;
  updateUIForLoggedOutUser();
  showToast("Logged out successfully.", "success");
  loadHomeVideos();
}

function toggleUserMenu() {
  ui.userMenu?.classList.toggle("hidden");
}

function toggleTheme() {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  currentTheme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("navistream-theme", theme);
  const themeNode = document.querySelector('[data-icon="theme"]');
  if (themeNode) themeNode.outerHTML = iconMarkup(theme === "dark" ? "moon" : "sun", "theme");
  hydrateIcons();
}

function toggleSidebar() {
  if (window.innerWidth <= 768) {
    ui.sidebar?.classList.toggle("mobile-open");
    return;
  }
  ui.sidebar?.classList.toggle("collapsed");
  ui.appMain?.classList.toggle("sidebar-collapsed");
}

function toggleDescription() {
  if (!ui.videoDescriptionText) return;
  const collapsed = ui.videoDescriptionText.classList.toggle("collapsed");
  ui.descriptionToggleBtn.textContent = collapsed ? "Show more" : "Show less";
}

function toggleFullscreen() {
  const modal = document.getElementById("videoPlayerModal");
  if (!document.fullscreenElement) modal.requestFullscreen?.();
  else document.exitFullscreen?.();
}

async function shareVideo() {
  const url = document.getElementById("mainVideoPlayer")?.src || window.location.href;
  const title = document.querySelector(".video-title")?.textContent || "Check out this video";
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      console.warn(error);
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied to clipboard.", "success");
  } catch (error) {
    showToast("Unable to copy video link.", "error");
  }
}

async function loadPlaylists() {
  const container = document.getElementById("playlistsGrid");
  if (!currentUser) return showToast("Please login to view playlists.", "error");
  container.innerHTML = renderSkeleton(3, true);
  try {
    const response = await fetch(`${API_URL}/playlists`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const playlists = await response.json();
    if (!response.ok) throw new Error(playlists.error || "Failed to load playlists");
    displayPlaylists(playlists);
  } catch (error) {
    showToast(error.message, "error");
    container.innerHTML = `<div class="playlist-empty">No playlists available right now.</div>`;
  }
}

function displayPlaylists(playlists) {
  const container = document.getElementById("playlistsGrid");
  if (!container) return;
  if (!playlists.length) {
    container.innerHTML = `<div class="playlist-empty">No playlists yet. Create your first playlist.</div>`;
    return;
  }
  container.innerHTML = playlists.map((playlist) => `
    <article class="playlist-card">
      <p class="eyebrow">Playlist</p>
      <h3>${escapeHtml(playlist.name)}</h3>
      <p class="video-card__meta">${escapeHtml(playlist.description || "No description")}</p>
      <p class="video-card__stats">${playlist.videos.length} videos · ${formatDate(playlist.createdAt)}</p>
    </article>
  `).join("");
}

async function loadWatchLater() {
  if (!currentUser) return showToast("Please login to view watch later.", "error");
  renderGridState("watchLaterSection", renderSkeleton(6));
  try {
    const response = await fetch(`${API_URL}/watch-later`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const videos = await response.json();
    if (!response.ok) throw new Error(videos.error || "Failed to load watch later");
    displayVideos(videos, "watchLaterSection");
  } catch (error) {
    showToast(error.message, "error");
    renderEmptyState("watchLaterSection", "Your saved videos will appear here.");
  }
}

async function loadUserProfile() {
  if (!currentUser) return showToast("Please login to view your channel.", "error");
  renderGridState("profileSection", renderSkeleton(6));
  try {
    const response = await fetch(`${API_URL}/users/${currentUser._id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load profile");
    displayUserProfile(data.user, data.videos);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function displayUserProfile(user, videos) {
  document.getElementById("profilePicture").src = user.profilePicture || avatarUrl(user.username);
  document.getElementById("profileUsername").textContent = user.username;
  document.getElementById("profileBio").textContent = user.bio || "Creator channel";
  document.getElementById("videoCount").textContent = videos.length;
  document.getElementById("subscriberCount").textContent = user.subscribers || 0;
  displayVideos(videos, "profileSection");
}

async function addToWatchLater(videoId) {
  if (!currentUser) return showToast("Please login to save videos.", "error");
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}/watch-later`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to save video");
    showToast("Saved to Watch Later.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function showCreatePlaylistModal() {
  const name = prompt("Enter playlist name:");
  if (name?.trim()) createPlaylist(name.trim());
}

async function createPlaylist(name, description = "") {
  try {
    const response = await fetch(`${API_URL}/playlists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ name, description, isPublic: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to create playlist");
    showToast("Playlist created successfully.", "success");
    loadPlaylists();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function showAddToPlaylistModal(videoId) {
  const playlistName = prompt("Enter playlist name to add this video to:");
  if (playlistName?.trim()) addVideoToPlaylist(videoId, playlistName.trim());
}

async function addVideoToPlaylist(videoId, playlistName) {
  try {
    const response = await fetch(`${API_URL}/playlists`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const playlists = await response.json();
    if (!response.ok) throw new Error(playlists.error || "Failed to get playlists");
    const playlist = playlists.find((item) => item.name.toLowerCase() === playlistName.toLowerCase());
    if (!playlist) throw new Error("Playlist not found");

    const addResponse = await fetch(`${API_URL}/playlists/${playlist._id}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ videoId }),
    });
    const data = await addResponse.json();
    if (!addResponse.ok) throw new Error(data.error || "Failed to add video to playlist");
    showToast("Video added to playlist.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadComments(videoId) {
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}`);
    const video = await response.json();
    if (!response.ok) throw new Error("Failed to load comments");
    displayComments(video.comments || []);
  } catch (error) {
    document.getElementById("commentsList").innerHTML = `<div class="empty-state">Comments are unavailable.</div>`;
  }
}

function displayComments(comments) {
  const container = document.getElementById("commentsList");
  if (!container) return;
  if (!comments.length) {
    container.innerHTML = `<div class="empty-state">No comments yet. Be the first to comment.</div>`;
    return;
  }
  container.innerHTML = comments.map((comment) => `
    <article class="comment-card">
      <img src="${comment.userId.profilePicture || avatarUrl(comment.userId.username)}" alt="${escapeHtml(comment.userId.username)}" />
      <div>
        <p><strong>${escapeHtml(comment.userId.username)}</strong> <span class="video-card__stats">${formatDate(comment.createdAt)}</span></p>
        <p>${escapeHtml(comment.text)}</p>
        ${currentUser && (comment.userId._id === currentUser._id || comment.userId === currentUser._id)
          ? `<button type="button" class="text-button" onclick="deleteComment('${comment._id}')">Delete</button>`
          : ""}
      </div>
    </article>
  `).join("");
}

async function addComment(videoId, text) {
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to add comment");
    ui.commentInput.value = "";
    await loadComments(videoId);
    showToast("Comment added.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteComment(commentId) {
  if (!confirm("Are you sure you want to delete this comment?")) return;
  try {
    const response = await fetch(`${API_URL}/videos/${currentVideoId}/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to delete comment");
    await loadComments(currentVideoId);
    showToast("Comment deleted.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function apiCall(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function testAPIConnectivity() {
  try {
    const response = await fetch(`${API_URL}/videos`);
    return (response.headers.get("content-type") || "").includes("application/json");
  } catch (error) {
    return false;
  }
}

function renderGridState(sectionId, markup) {
  const section = document.getElementById(sectionId);
  const grid = section?.querySelector(".video-grid");
  if (grid) grid.innerHTML = markup;
}

function renderEmptyState(sectionId, message) {
  renderGridState(sectionId, `<div class="empty-state">${message}</div>`);
}

function renderSkeleton(count = 6, cardsOnly = false) {
  return Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-block skeleton-thumb"></div>
      <div class="skeleton-row">
        <div class="skeleton-block skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton-block skeleton-line"></div>
          <div class="skeleton-block skeleton-line short"></div>
          ${cardsOnly ? "" : `<div class="skeleton-block skeleton-line short"></div>`}
        </div>
      </div>
    </div>
  `).join("");
}

function renderCompactSkeleton(count = 4) {
  return Array.from({ length: count }).map(() => `
    <div class="related-card">
      <div class="skeleton-block skeleton-thumb"></div>
      <div class="skeleton-lines">
        <div class="skeleton-block skeleton-line"></div>
        <div class="skeleton-block skeleton-line short"></div>
      </div>
    </div>
  `).join("");
}

function showToast(message, type = "info") {
  if (!ui.toastStack) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  ui.toastStack.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showError(message) {
  showToast(message, "error");
}

function showSuccess(message) {
  showToast(message, "success");
}

function showFormError(form, message) {
  form.querySelectorAll(".error-message").forEach((node) => node.remove());
  const error = document.createElement("div");
  error.className = "error-message";
  error.style.color = "#ff7b7b";
  error.textContent = message;
  form.appendChild(error);
}

function syncCategoryPills(value) {
  document.querySelectorAll(".category-pill").forEach((pill) => {
    pill.classList.toggle("is-active", (pill.dataset.value || "") === value);
  });
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatViews(views) {
  if (!views) return "0";
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return String(views);
}

function formatDate(date) {
  if (!date) return "Just now";
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  if (months > 0) return `${months}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** index).toFixed(2))} ${units[index]}`;
}

function avatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff4444&color=fff`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = rawIconSvg(node.dataset.icon);
  });
}

function createIconNode(name) {
  const wrapper = document.createElement("span");
  wrapper.className = "nav-icon";
  wrapper.innerHTML = rawIconSvg(name);
  return wrapper;
}

function iconMarkup(name, dataIcon = "") {
  const attr = dataIcon ? ` data-icon="${dataIcon}"` : "";
  return `<span class="nav-icon"${attr}>${rawIconSvg(name)}</span>`;
}

function rawIconSvg(name) {
  const icons = {
    menu: `<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>`,
    search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m20 20-3.5-3.5"></path></svg>`,
    bell: `<svg viewBox="0 0 24 24"><path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V11a5 5 0 1 1 10 0v3.2a2 2 0 0 0 .6 1.4L19 17h-4"></path><path d="M10 20a2 2 0 0 0 4 0"></path></svg>`,
    theme: document.body?.dataset.theme === "dark"
      ? `<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path></svg>`
      : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>`,
    upload: `<svg viewBox="0 0 24 24"><path d="M12 16V5"></path><path d="m7 10 5-5 5 5"></path><path d="M20 16.5v1.5A2 2 0 0 1 18 20H6a2 2 0 0 1-2-2v-1.5"></path></svg>`,
    home: `<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"></path><path d="M9 21V12h6v9"></path></svg>`,
    trending: `<svg viewBox="0 0 24 24"><path d="m3 17 6-6 4 4 7-8"></path><path d="M14 7h6v6"></path></svg>`,
    subscriptions: `<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"></path><path d="m10 10 5 2-5 2z"></path></svg>`,
    clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v5l3 2"></path></svg>`,
    heart: `<svg viewBox="0 0 24 24"><path d="m12 20-1.4-1.3C5.4 14 2 10.9 2 7.1 2 4 4.4 2 7.3 2c1.7 0 3.3.8 4.3 2.1C12.7 2.8 14.3 2 16 2 18.9 2 21.3 4 21.3 7.1c0 3.8-3.4 6.9-8.6 11.6z"></path></svg>`,
    history: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg>`,
    user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M5 20a7 7 0 0 1 14 0"></path></svg>`,
    gamepad: `<svg viewBox="0 0 24 24"><path d="M6 10h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.1 2.1L14 15H10l-2.9 3.1A3 3 0 0 1 2 16v-2a4 4 0 0 1 4-4Z"></path><path d="M8 13h2M9 12v2M16.5 12.5h.01M18.5 14.5h.01"></path></svg>`,
    music: `<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"></path><circle cx="7" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle></svg>`,
    book: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path></svg>`,
    sparkles: `<svg viewBox="0 0 24 24"><path d="m12 3 1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9L12 3Z"></path><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"></path><path d="m5 14 .9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14Z"></path></svg>`,
    sports: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z"></path><path d="M3 12h18"></path></svg>`,
    layers: `<svg viewBox="0 0 24 24"><path d="m12 3 9 4.5-9 4.5-9-4.5Z"></path><path d="m3 12 9 4.5 9-4.5"></path><path d="m3 16.5 9 4.5 9-4.5"></path></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.4-8A6 6 0 0 1 18 8a4 4 0 1 1 .5 8H7Z"></path><path d="m12 12 3 3"></path><path d="m12 12-3 3"></path><path d="M12 8v7"></path></svg>`,
    "arrow-left": `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"></path></svg>`,
    expand: `<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"></path></svg>`,
    "thumbs-up": `<svg viewBox="0 0 24 24"><path d="M7 10v10"></path><path d="M14 4 9 10v10h8a2 2 0 0 0 2-1.6l1-6A2 2 0 0 0 18 10h-5l1-6Z"></path><path d="M3 10h4v10H3z"></path></svg>`,
    "thumbs-down": `<svg viewBox="0 0 24 24"><path d="M7 14V4"></path><path d="m14 20-5-6V4h8a2 2 0 0 1 2 1.6l1 6A2 2 0 0 1 18 14h-5l1 6Z"></path><path d="M3 4h4v10H3z"></path></svg>`,
    share: `<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 13.5 6.8 4"></path><path d="m15.4 6.5-6.8 4"></path></svg>`,
    bookmark: `<svg viewBox="0 0 24 24"><path d="M6 4h12v16l-6-4-6 4Z"></path></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path></svg>`,
    grid: `<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"></path></svg>`,
    "play-solid": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 6.5v11l9-5.5-9-5.5Z"></path></svg>`,
    sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>`,
    moon: `<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path></svg>`,
  };
  return icons[name] || icons.layers;
}

window.showSection = showSection;
window.showUploadModal = showUploadModal;
window.hideUploadModal = hideUploadModal;
window.showAuthModal = showAuthModal;
window.hideAuthModal = hideAuthModal;
window.handleLogout = handleLogout;
window.toggleUserMenu = toggleUserMenu;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.likeVideo = likeVideo;
window.deleteVideo = deleteVideo;
window.likeVideoCard = likeVideoCard;
window.deleteVideoCard = deleteVideoCard;
window.toggleFullscreen = toggleFullscreen;
window.shareVideo = shareVideo;
window.addToWatchLater = addToWatchLater;
window.showAddToPlaylistModal = showAddToPlaylistModal;
window.showCreatePlaylistModal = showCreatePlaylistModal;
window.showEditProfileModal = () => showToast("Profile editing is not available yet.", "info");
window.addComment = addComment;
window.deleteComment = deleteComment;
