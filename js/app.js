// Global variables
let currentUser = null;
let currentVideoId = null;

// API configuration
const API_URL = 'http://localhost:3001/api';

// Auth class
class Auth {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user'));
  }

  async register(username, email, password) {
    try {
      console.log('Attempting registration with:', { 
        username, 
        email, 
        password: password ? '[HIDDEN]' : 'undefined' 
      });
      
      if (!username || !email || !password) {
        throw new Error('All fields are required');
      }

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      console.log('Register response status:', response.status);
      console.log('Register response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Register response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Check for success field in response
      if (!data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      if (!data.token || !data.user) {
        throw new Error('Invalid response from server');
      }

      this.setAuth(data);
      console.log('Registration successful, auth set:', { 
        hasToken: !!this.token, 
        hasUser: !!this.user,
        user: this.user 
      });
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(email, password) {
    try {
      console.log('Attempting login with:', { email, password: password ? '[HIDDEN]' : 'undefined' });
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check for success field in response
      if (!data.success) {
        throw new Error(data.error || 'Login failed');
      }

      if (!data.token || !data.user) {
        throw new Error('Invalid response from server');
      }

      this.setAuth(data);
      console.log('Login successful, auth set:', { 
        hasToken: !!this.token, 
        hasUser: !!this.user,
        user: this.user 
      });
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  setAuth(data) {
    console.log('Setting auth data:', { 
      hasToken: !!data.token, 
      hasUser: !!data.user,
      user: data.user 
    });
    
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    console.log('Auth data set successfully');
  }

  isAuthenticated() {
    return !!this.token;
  }

  getAuthHeader() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
}

// Video service class
class VideoService {
  async uploadVideo(formData) {
    try {
      console.log('VideoService.uploadVideo called');
      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }

      const headers = auth.getAuthHeader();
      console.log('Auth headers:', headers);

      const response = await fetch(`${API_URL}/videos/upload`, {
        method: 'POST',
        headers: {
          ...headers
          // Don't set Content-Type for FormData, let browser set it with boundary
        },
        body: formData
      });

      console.log('Upload response status:', response.status);
      console.log('Upload response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Upload response data:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('VideoService upload error:', error);
      throw error;
    }
  }

  async searchVideos(query) {
    try {
      const response = await fetch(`${API_URL}/videos/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (error) {
      throw error;
    }
  }
}

// Initialize auth and video service
const auth = new Auth();
const videoService = new VideoService();

// DOM Elements
let searchInput, sortSelect, categoryFilter, loginButton, userProfileSection, userAvatar, userMenu;

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initializing NaviStream...');
  
  // Initialize DOM elements
  searchInput = document.getElementById('searchInput');
  sortSelect = document.getElementById('sortSelect');
  categoryFilter = document.getElementById('categoryFilter');
  loginButton = document.getElementById('loginButton');
  userProfileSection = document.getElementById('userProfileSection');
  userAvatar = document.getElementById('userAvatar');
  userMenu = document.getElementById('userMenu');
  
  console.log('🔍 DOM elements initialized:', {
    searchInput: !!searchInput,
    sortSelect: !!sortSelect,
    categoryFilter: !!categoryFilter,
    loginButton: !!loginButton,
    userProfileSection: !!userProfileSection,
    userAvatar: !!userAvatar,
    userMenu: !!userMenu
  });
  
  // Test API connectivity first
  const apiWorking = await testAPIConnectivity();
  if (!apiWorking) {
    console.error('❌ API connectivity test failed - check server status');
    showError('Cannot connect to server. Please check if the server is running.');
    return;
  }
  
  // Check authentication status
  checkAuth();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load initial content
  loadHomeVideos();
  
  console.log('✅ NaviStream initialized successfully');
});

function checkAuth() {
  console.log('🔐 Checking authentication...');
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  console.log('Auth check:', { hasToken: !!token, hasUser: !!user });
  
  if (token && user) {
    currentUser = user;
    updateUIForLoggedInUser();
  } else {
    updateUIForLoggedOutUser();
  }
}

function updateUIForLoggedInUser() {
  console.log('👤 Updating UI for logged in user:', currentUser);
  if (loginButton) loginButton.classList.add('hidden');
  if (userProfileSection) userProfileSection.classList.remove('hidden');
  if (userAvatar) userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.username || 'Guest')}&background=6B4EFF&color=fff`;
}

function updateUIForLoggedOutUser() {
  console.log('👤 Updating UI for logged out user');
  if (loginButton) loginButton.classList.remove('hidden');
  if (userProfileSection) userProfileSection.classList.add('hidden');
}

function setupEventListeners() {
  console.log('🎧 Setting up event listeners...');
  
  try {
    // Search functionality
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          searchVideos(e.target.value);
        }, 300);
      });
      console.log('✅ Search input listener added');
    }

    // Sort and filter
    if (sortSelect) {
      sortSelect.addEventListener('change', loadHomeVideos);
      console.log('✅ Sort select listener added');
    }
    
    if (categoryFilter) {
      categoryFilter.addEventListener('change', loadHomeVideos);
      console.log('✅ Category filter listener added');
    }

    // Upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
      uploadForm.addEventListener('submit', handleUploadSubmit);
      console.log('✅ Upload form listener added');
    }

    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelect);
      console.log('✅ File input listener added');
    }

    // Comment form
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const commentInput = document.getElementById('commentInput');
        const text = commentInput.value.trim();
        
        if (!text) {
          showError('Please enter a comment');
          return;
        }
        
        if (!currentUser) {
          showError('Please login to comment');
          return;
        }
        
        addComment(currentVideoId, text);
      });
      console.log('✅ Comment form listener added');
    }

    // Auth modal
    setupAuthModal();
    console.log('✅ Auth modal setup complete');
    
  } catch (error) {
    console.error('❌ Error setting up event listeners:', error);
  }
}

function setupAuthModal() {
  console.log('🔐 Setting up auth modal...');
  
  try {
    const authModal = document.getElementById('authModal');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    console.log('🔍 Auth modal elements:', {
      authModal: !!authModal,
      authTabs: authTabs.length,
      loginForm: !!loginForm,
      registerForm: !!registerForm
    });

    if (!authModal) {
      console.error('❌ Auth modal not found!');
      return;
    }

    if (!loginForm) {
      console.error('❌ Login form not found!');
      return;
    }

    // Tab switching
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        if (tabName === 'login') {
          loginForm.classList.remove('hidden');
          registerForm.classList.add('hidden');
        } else {
          loginForm.classList.add('hidden');
          registerForm.classList.remove('hidden');
        }
      });
    });

    // Login form
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('📝 Login form submitted');
      
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      console.log('📋 Form values:', { 
        email: email || 'empty', 
        password: password ? '[HIDDEN]' : 'empty',
        emailLength: email?.length,
        passwordLength: password?.length
      });

      // Clear previous error messages
      const errorElements = loginForm.querySelectorAll('.error-message');
      errorElements.forEach(el => el.remove());

      // Validate inputs
      if (!email || !email.trim()) {
        showFormError(loginForm, 'Email is required');
        return;
      }

      if (!password || !password.trim()) {
        showFormError(loginForm, 'Password is required');
        return;
      }

      // Show loading state
      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';
      }

      try {
        console.log('🔐 Calling auth.login...');
        const result = await auth.login(email.trim(), password);
        console.log('✅ Login result:', result);
        
        // Update current user
        currentUser = auth.user;
        console.log('👤 Current user set:', currentUser);
        
        // Update UI immediately
        updateUIForLoggedInUser();
        
        // Hide modal and show success
        hideAuthModal();
        showSuccess('Logged in successfully!');
        
        // Reload videos to show user-specific content
        loadHomeVideos();
        
        // Force a small delay to ensure UI updates are visible
        setTimeout(() => {
          console.log('🎉 Login flow completed successfully');
        }, 100);
        
      } catch (error) {
        console.error('❌ Login form error:', error);
        showFormError(loginForm, error.message || 'Login failed. Please try again.');
      } finally {
        // Restore button state
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText || 'Login';
        }
      }
    });
    console.log('✅ Login form listener added');

    // Register form
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('📝 Register form submitted');
        
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        console.log('📋 Register form values:', { 
          username: username || 'empty', 
          email: email || 'empty', 
          password: password ? '[HIDDEN]' : 'empty'
        });

        // Clear previous error messages
        const errorElements = registerForm.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());

        // Validate inputs
        if (!username || !username.trim()) {
          showFormError(registerForm, 'Username is required');
          return;
        }

        if (!email || !email.trim()) {
          showFormError(registerForm, 'Email is required');
          return;
        }

        if (!password || !password.trim()) {
          showFormError(registerForm, 'Password is required');
          return;
        }

        if (password.length < 6) {
          showFormError(registerForm, 'Password must be at least 6 characters');
          return;
        }

        // Show loading state
        const submitButton = registerForm.querySelector('button[type="submit"]');
        const originalText = submitButton?.textContent;
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Registering...';
        }

        try {
          console.log('🔐 Calling auth.register...');
          const result = await auth.register(username.trim(), email.trim(), password);
          console.log('✅ Register result:', result);
          
          // Update current user
          currentUser = auth.user;
          console.log('👤 Current user set:', currentUser);
          
          // Update UI immediately
          updateUIForLoggedInUser();
          
          // Hide modal and show success
          hideAuthModal();
          showSuccess('Registration successful! Welcome to NaviStream!');
          
          // Reload videos to show user-specific content
          loadHomeVideos();
          
        } catch (error) {
          console.error('❌ Register form error:', error);
          showFormError(registerForm, error.message || 'Registration failed. Please try again.');
        } finally {
          // Restore button state
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText || 'Register';
          }
        }
      });
      console.log('✅ Register form listener added');
    }
    
    // Close modal when clicking outside
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          console.log('🖱️ Clicked outside modal, hiding...');
          hideAuthModal();
        }
      });
      console.log('✅ Click outside modal handler added');
    }
    
  } catch (error) {
    console.error('❌ Error setting up auth modal:', error);
  }
}

// Section navigation
function showSection(sectionId) {
  console.log('Showing section:', sectionId);
  
  // Hide all sections first
  const sections = [
    'homeSection',
    'myVideosSection', 
    'trendingSection',
    'likedSection',
    'playlistsSection',
    'watchLaterSection',
    'profileSection',
    'searchSection'
  ];
  
  sections.forEach(section => {
    const element = document.getElementById(section);
    if (element) {
      element.classList.add('hidden');
    }
  });
  
  // Show the selected section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove('hidden');
    console.log('✓ Section shown:', sectionId);
    
    // Load content based on section
    switch(sectionId) {
      case 'homeSection':
        loadHomeVideos();
        break;
      case 'myVideosSection':
        loadMyVideos();
        break;
      case 'trendingSection':
        loadTrendingVideos();
        break;
      case 'likedSection':
        loadLikedVideos();
        break;
      case 'playlistsSection':
        loadPlaylists();
        break;
      case 'watchLaterSection':
        loadWatchLater();
        break;
      case 'profileSection':
        loadUserProfile();
        break;
      case 'searchSection':
        // Search section is handled by search input
        break;
    }
  } else {
    console.error('❌ Section not found:', sectionId);
  }
  
  // Update active state in sidebar
  updateSidebarActiveState(sectionId);
}

function updateSidebarActiveState(activeSectionId) {
  // Remove active class from all sidebar items
  const sidebarItems = document.querySelectorAll('.sidebar a');
  sidebarItems.forEach(item => {
    item.classList.remove('bg-primary', 'text-white');
    item.classList.add('text-gray-700', 'dark:text-gray-300');
  });
  
  // Add active class to current section
  const activeItem = document.querySelector(`[onclick="showSection('${activeSectionId}')"]`);
  if (activeItem) {
    activeItem.classList.remove('text-gray-700', 'dark:text-gray-300');
    activeItem.classList.add('bg-primary', 'text-white');
  }
}

// Upload functionality
function showUploadModal() {
  console.log('📤 Showing upload modal');
  
  if (!currentUser) {
    showError('Please login to upload videos');
    return;
  }
  
  const modal = document.getElementById('uploadModal');
  const submitBtn = document.getElementById('uploadSubmitBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Reset form and button state
    const form = document.getElementById('uploadForm');
    if (form) form.reset();
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Upload Video';
    }
    
    if (uploadStatus) {
      uploadStatus.innerHTML = '';
    }
    
    console.log('✅ Upload modal shown');
  } else {
    console.error('❌ Upload modal not found');
  }
}

function hideUploadModal() {
  console.log('Hiding upload modal');
  const modal = document.getElementById('uploadModal');
  const form = document.getElementById('uploadForm');
  const status = document.getElementById('uploadStatus');
  
  if (modal) modal.classList.add('hidden');
  if (form) form.reset();
  if (status) status.innerHTML = '';
  
  console.log('✓ Upload modal hidden and form reset');
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type.startsWith('video/')) {
      const status = document.getElementById('uploadStatus');
      const submitBtn = document.getElementById('uploadSubmitBtn');
      
      if (status) {
        status.innerHTML = `
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <i class="fas fa-check-circle text-blue-500"></i>
              <span class="text-sm font-medium text-blue-700 dark:text-blue-300">File Selected</span>
            </div>
            <p class="text-sm text-blue-600 dark:text-blue-400 mt-1">
              ${file.name} (${formatFileSize(file.size)})
            </p>
          </div>
        `;
      }
      
      // Enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    } else {
      showError('Please select a valid video file.');
      const submitBtn = document.getElementById('uploadSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
      }
    }
  }
}

async function handleUploadSubmit(e) {
  e.preventDefault();
  console.log('Upload form submitted');
  
  if (!currentUser) {
    showError('Please login to upload videos');
    return;
  }

  const title = document.getElementById('videoTitle').value;
  const description = document.getElementById('videoDescription').value;
  const category = document.getElementById('videoCategory').value;
  const fileInput = document.getElementById('fileInput');

  console.log('Upload form values:', {
    title: title || 'empty',
    description: description || 'empty',
    category: category || 'empty',
    hasFile: fileInput?.files?.length > 0
  });

  if (!title || !title.trim()) {
    showError('Please enter a video title');
    return;
  }

  if (!fileInput || !fileInput.files.length) {
    showError('Please select a video file');
    return;
  }

  const file = fileInput.files[0];
  console.log('Selected file:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified
  });

  if (!file.type.startsWith('video/')) {
    showError('Please select a valid video file');
    return;
  }

  // Show loading state
  const submitButton = document.getElementById('uploadSubmitBtn');
  const originalText = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';
  }

  const uploadStatus = document.getElementById('uploadStatus');
  if (uploadStatus) {
    uploadStatus.innerHTML = `
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Uploading...</span>
          <span class="text-sm text-blue-600 dark:text-blue-400" id="uploadPercent">0%</span>
        </div>
        <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
          <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: 0%" id="uploadProgress"></div>
        </div>
        <p class="text-sm text-blue-600 dark:text-blue-400 mt-2" id="uploadProgressText">Preparing upload...</p>
      </div>
    `;
  }

  try {
    console.log('Creating FormData for upload...');
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title.trim());
    formData.append('description', (description || 'No description provided').trim());
    formData.append('category', category || 'other');

    // Use XMLHttpRequest for progress tracking
    const result = await uploadWithProgress(formData);
    console.log('Upload result:', result);
    
    if (uploadStatus) {
      uploadStatus.innerHTML = `
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div class="flex items-center space-x-2">
            <i class="fas fa-check-circle text-green-500"></i>
            <span class="text-sm font-medium text-green-700 dark:text-green-300">Upload Successful!</span>
          </div>
          <p class="text-sm text-green-600 dark:text-green-400 mt-1">Your video has been uploaded successfully.</p>
        </div>
      `;
    }
    
    // Clear the form
    const form = document.getElementById('uploadForm');
    if (form) form.reset();
    
    // Hide the modal after a short delay
    setTimeout(() => {
      hideUploadModal();
    }, 2000);
    
    // Show success message
    showSuccess('Video uploaded successfully!');
    
    // Refresh all video sections to show the new video
    console.log('Refreshing video sections after upload...');
    
    // Force refresh home videos
    await loadHomeVideos();
    
    // If user is logged in, also refresh their videos
    if (currentUser) {
      console.log('User is logged in, refreshing my videos...');
      await loadMyVideos();
    }
    
    console.log('✓ Video sections refreshed after upload');
  } catch (error) {
    console.error('Upload error:', error);
    if (uploadStatus) {
      uploadStatus.innerHTML = `
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div class="flex items-center space-x-2">
            <i class="fas fa-exclamation-circle text-red-500"></i>
            <span class="text-sm font-medium text-red-700 dark:text-red-300">Upload Failed</span>
          </div>
          <p class="text-sm text-red-600 dark:text-red-400 mt-1">${error.message}</p>
        </div>
      `;
    }
    showError(error.message || 'Upload failed. Please try again.');
  } finally {
    // Restore button state
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'Upload Video';
    }
  }
}

// Function to upload with progress tracking
function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Progress tracking
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        const progressBar = document.getElementById('uploadProgress');
        const progressText = document.getElementById('uploadProgressText');
        const progressPercent = document.getElementById('uploadPercent');
        
        if (progressBar) {
          progressBar.style.width = percentComplete + '%';
        }
        if (progressPercent) {
          progressPercent.textContent = percentComplete + '%';
        }
        if (progressText) {
          progressText.textContent = `Uploaded ${formatFileSize(e.loaded)} of ${formatFileSize(e.total)}`;
        }
      }
    });
    
    // Upload complete
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || error.details || 'Upload failed'));
        } catch (error) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });
    
    // Upload error
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    // Upload timeout
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out'));
    });
    
    // Set timeout and open request
    xhr.timeout = 300000; // 5 minutes
    xhr.open('POST', `${API_URL}/videos/upload`);
    
    // Add auth header
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    // Send the request
    xhr.send(formData);
  });
}

// Video loading functions
async function loadHomeVideos() {
  try {
    console.log('Loading home videos');
    const sortBy = sortSelect?.value;
    const category = categoryFilter?.value;
    
    const url = new URL(`${API_URL}/videos`);
    if (sortBy) url.searchParams.append('sort', sortBy);
    if (category) url.searchParams.append('category', category);

    console.log('Fetching videos from:', url.toString());
    
    const videos = await apiCall(url.toString());
    console.log(`Loaded ${videos.length} home videos`);
    displayVideos(videos, 'homeSection');
  } catch (error) {
    console.error('Error loading home videos:', error);
    showError(error.message);
  }
}

async function loadMyVideos() {
  try {
    console.log('Loading my videos');
    if (!currentUser) {
      showError('Please login to view your videos');
      return;
    }

    const response = await fetch(`${API_URL}/videos/my-videos`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('My videos response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load videos');
    }
    
    const videos = await response.json();
    console.log(`Loaded ${videos.length} my videos`);
    displayVideos(videos, 'myVideosSection');
  } catch (error) {
    console.error('Error loading my videos:', error);
    showError(error.message);
  }
}

async function loadTrendingVideos() {
  try {
    console.log('Loading trending videos');
    const response = await fetch(`${API_URL}/videos/trending`);
    console.log('Trending videos response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load trending videos');
    }
    
    const videos = await response.json();
    console.log(`Loaded ${videos.length} trending videos`);
    displayVideos(videos, 'trendingSection');
  } catch (error) {
    console.error('Error loading trending videos:', error);
    showError(error.message);
  }
}

async function loadLikedVideos() {
  try {
    console.log('Loading liked videos');
    if (!currentUser) {
      showError('Please login to view liked videos');
      return;
    }

    const response = await fetch(`${API_URL}/videos/liked`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('Liked videos response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load liked videos');
    }
    
    const videos = await response.json();
    console.log(`Loaded ${videos.length} liked videos`);
    displayVideos(videos, 'likedSection');
  } catch (error) {
    console.error('Error loading liked videos:', error);
    showError(error.message);
  }
}

async function searchVideos(query) {
  try {
    console.log('Searching videos:', query);
    const url = new URL(`${API_URL}/videos/search`);
    if (query) url.searchParams.append('q', query);

    console.log('Fetching search results from:', url.toString());
    const response = await fetch(url);
    console.log('Search response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Search failed');
    }
    
    const videos = await response.json();
    console.log(`Found ${videos.length} videos`);
    displayVideos(videos, 'homeSection');
  } catch (error) {
    console.error('Search error:', error);
    showError(error.message);
  }
}

// Display videos
function displayVideos(videos, sectionId) {
  console.log(`Displaying ${videos.length} videos in ${sectionId}`);
  const section = document.getElementById(sectionId);
  if (!section) {
    console.error(`Section ${sectionId} not found`);
    return;
  }

  const videoGrid = section.querySelector('.video-grid');
  if (!videoGrid) {
    console.error(`Video grid not found in ${sectionId}`);
    return;
  }

  // Clear existing content
  videoGrid.innerHTML = '';
  console.log(`✓ Cleared video grid in ${sectionId}`);

  if (videos.length === 0) {
    videoGrid.innerHTML = '<p class="text-center text-gray-500 py-8">No videos found</p>';
    console.log(`✓ Displayed "No videos found" message in ${sectionId}`);
    return;
  }

  // Create and append video cards
  videos.forEach((video, index) => {
    console.log(`Creating video card ${index + 1}/${videos.length}:`, video.title);
    const videoCard = createVideoCard(video);
    videoGrid.appendChild(videoCard);
  });

  console.log(`✓ Successfully displayed ${videos.length} videos in ${sectionId}`);
}

// Create video card
function createVideoCard(video) {
  console.log('Creating video card:', video);
  
  if (!video || !video._id) {
    console.error('Invalid video data:', video);
    return document.createElement('div'); // Return empty div for invalid data
  }
  
  const card = document.createElement('div');
  card.className = 'video-card bg-white dark:bg-dark-card rounded-xl shadow-lg overflow-hidden animate-fadeIn hover:shadow-xl transition-all duration-300';
  card.dataset.videoId = video._id;
  
  const username = video.userId?.username || 'Unknown User';
  const thumbnail = video.thumbnail || 'https://via.placeholder.com/400x225?text=No+Thumbnail';
  const title = video.title || 'Untitled Video';
  const views = video.views || 0;
  const likes = video.likes ? video.likes.length : 0;
  const createdAt = video.createdAt || new Date();
  
  // Check if current user liked this video
  const isLiked = currentUser && video.likes && video.likes.some(likeId => 
    likeId.toString() === currentUser._id || likeId === currentUser._id
  );
  
  // Check if current user owns this video
  const isOwner = currentUser && (video.userId?._id === currentUser._id || video.userId === currentUser._id);
  
  card.innerHTML = `
    <div class="video-thumbnail relative group cursor-pointer">
      <img src="${thumbnail}" alt="${title}" class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105">
      <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
        <div class="play-button opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <i class="fas fa-play text-white text-4xl"></i>
        </div>
      </div>
      <span class="video-duration absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
        ${formatDuration(video.duration)}
      </span>
    </div>
    <div class="p-4">
      <div class="flex space-x-3">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6B4EFF&color=fff" 
             alt="${username}" 
             class="channel-avatar w-10 h-10 rounded-full flex-shrink-0">
        <div class="flex-1 min-w-0">
          <h3 class="font-medium line-clamp-2 text-gray-900 dark:text-white mb-1">${title}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">${username}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            ${formatViews(views)} views • ${formatDate(createdAt)}
          </p>
          
          <!-- Action buttons -->
          <div class="flex items-center space-x-4">
            <button onclick="event.stopPropagation(); likeVideoCard('${video._id}', this)" 
                    class="like-card-btn flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors ${isLiked ? 'text-red-500' : ''}">
              <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
              <span class="like-count">${likes}</span>
            </button>
            
            ${isOwner ? `
              <button onclick="event.stopPropagation(); deleteVideoCard('${video._id}', this)" 
                      class="delete-card-btn flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors">
                <i class="fas fa-trash"></i>
                <span>Delete</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Add click event to play video
  card.addEventListener('click', () => {
    console.log('Video card clicked:', video.title);
    showVideoPlayer(video);
  });
  
  console.log(`✓ Video card created for: ${title}`);
  return card;
}

// Video player functionality
function showVideoPlayer(video) {
  console.log('Showing video player:', video);
  const modal = document.getElementById('videoPlayerModal');
  const player = document.getElementById('mainVideoPlayer');
  const loadingIndicator = document.getElementById('videoLoadingIndicator');
  const title = modal?.querySelector('.video-title');
  const description = modal?.querySelector('.video-description');
  const likeCount = modal?.querySelector('.like-count');
  const viewCount = modal?.querySelector('.view-count');
  const uploadDate = modal?.querySelector('.upload-date');
  const likeButton = modal?.querySelector('.like-button i');
  const deleteBtn = modal?.querySelector('#deleteVideoBtn');
  const commentUserAvatar = modal?.querySelector('#commentUserAvatar');

  if (!modal || !player || !title || !description || !likeCount || !viewCount || !uploadDate) {
    console.error('Missing video player elements');
    showError('Error loading video player');
    return;
  }

  currentVideoId = video._id;
  
  // Show modal and loading state
  modal.classList.remove('hidden');
  if (loadingIndicator) loadingIndicator.classList.remove('hidden');
  player.classList.add('loading');
  
  // Preload video for better performance
  player.preload = 'metadata';
  player.src = video.url;
  
  // Update video info
  title.textContent = video.title;
  description.textContent = video.description;
  likeCount.textContent = video.likes ? video.likes.length : 0;
  viewCount.textContent = video.views || 0;
  uploadDate.textContent = formatDate(video.createdAt);

  // Update comment user avatar
  if (commentUserAvatar && currentUser) {
    commentUserAvatar.src = currentUser.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username)}&background=6B4EFF&color=fff`;
  }

  // Set like button state
  if (likeButton && currentUser) {
    const isLiked = video.likes && video.likes.some(likeId => likeId.toString() === currentUser._id);
    if (isLiked) {
      likeButton.className = 'fas fa-heart text-red-500';
      likeButton.parentElement.classList.add('text-red-500');
    } else {
      likeButton.className = 'far fa-heart';
      likeButton.parentElement.classList.remove('text-red-500');
    }
  }

  // Show delete button if user owns the video
  if (deleteBtn && currentUser && video.userId) {
    const isOwner = video.userId._id === currentUser._id || video.userId === currentUser._id;
    if (isOwner) {
      deleteBtn.classList.remove('hidden');
    } else {
      deleteBtn.classList.add('hidden');
    }
  }

  // Setup enhanced video player controls
  setTimeout(() => {
    setupVideoPlayer();
  }, 100);
  
  // Load comments
  loadComments(video._id);
  
  // Handle video loading events
  player.addEventListener('loadeddata', () => {
    console.log('Video data loaded');
    player.classList.remove('loading');
    player.classList.add('ready');
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
  });
  
  player.addEventListener('canplay', () => {
    console.log('Video can start playing');
    // Auto-play with user interaction
    player.play().catch(error => {
      console.log('Auto-play prevented, user needs to click play');
    });
  });
  
  player.addEventListener('error', (e) => {
    console.error('Video error:', e);
    showError('Error loading video. Please try again.');
    player.classList.remove('loading');
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
  });

  // Increment view count after successful load
  player.addEventListener('canplaythrough', () => {
    incrementViewCount(video._id);
  });
}

function hideVideoPlayer() {
  console.log('Hiding video player');
  const modal = document.getElementById('videoPlayerModal');
  const player = document.getElementById('mainVideoPlayer');
  const loadingIndicator = document.getElementById('videoLoadingIndicator');
  
  if (!modal || !player) {
    console.error('Missing video player elements');
    return;
  }

  // Pause and reset video
  player.pause();
  player.currentTime = 0;
  player.src = '';
  
  // Reset player state
  player.classList.remove('loading', 'ready');
  if (loadingIndicator) loadingIndicator.classList.add('hidden');
  
  // Hide modal
  modal.classList.add('hidden');
  currentVideoId = null;
}

// Like video from card
async function likeVideoCard(videoId, button) {
  if (!currentUser) {
    showError('Please login to like videos');
    return;
  }
  
  try {
    console.log('Liking video from card:', videoId);
    
    const heartIcon = button.querySelector('i');
    const likeCount = button.querySelector('.like-count');
    const currentLikes = parseInt(likeCount.textContent) || 0;
    const isCurrentlyLiked = heartIcon.classList.contains('fas');
    
    // Optimistically update UI
    if (isCurrentlyLiked) {
      heartIcon.className = 'far fa-heart';
      button.classList.remove('text-red-500');
      likeCount.textContent = Math.max(0, currentLikes - 1);
    } else {
      heartIcon.className = 'fas fa-heart';
      button.classList.add('text-red-500');
      likeCount.textContent = currentLikes + 1;
    }

    const response = await fetch(`${API_URL}/videos/${videoId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to like video');
    }
    
    const data = await response.json();
    console.log('Like response data:', data);
    
    // Update with actual server response
    likeCount.textContent = data.likes;
    if (data.isLiked) {
      heartIcon.className = 'fas fa-heart';
      button.classList.add('text-red-500');
    } else {
      heartIcon.className = 'far fa-heart';
      button.classList.remove('text-red-500');
    }
    
  } catch (error) {
    console.error('Like error:', error);
    showError(error.message);
    
    // Revert optimistic update
    const heartIcon = button.querySelector('i');
    const likeCount = button.querySelector('.like-count');
    if (heartIcon && likeCount) {
      heartIcon.className = 'far fa-heart';
      button.classList.remove('text-red-500');
    }
  }
}

// Delete video from card
async function deleteVideoCard(videoId, button) {
  if (!currentUser) {
    showError('Please login to delete videos');
    return;
  }
  
  // Confirm deletion
  if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
    return;
  }
  
  try {
    console.log('Deleting video from card:', videoId);
    
    // Show loading state
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    button.disabled = true;
    
    const response = await fetch(`${API_URL}/videos/${videoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete video');
    }
    
    const data = await response.json();
    console.log('Delete response data:', data);
    
    showSuccess('Video deleted successfully!');
    
    // Remove the video card from the DOM
    const videoCard = button.closest('.video-card');
    if (videoCard) {
      videoCard.style.opacity = '0';
      videoCard.style.transform = 'scale(0.8)';
      setTimeout(() => {
        videoCard.remove();
      }, 300);
    }
    
    // Refresh video sections
    await loadHomeVideos();
    if (currentUser) {
      await loadMyVideos();
    }
    
  } catch (error) {
    console.error('Delete error:', error);
    showError(error.message);
    
    // Restore button state
    button.innerHTML = originalText;
    button.disabled = false;
  }
}

// Like video
async function likeVideo() {
  if (!currentVideoId) {
    console.error('No current video ID for like operation');
    return;
  }
  
  try {
    console.log('Liking video:', currentVideoId);
    if (!currentUser) {
      showError('Please login to like videos');
      return;
    }

    // Get current like button state
    const likeButton = document.querySelector('.like-button i');
    const likeCount = document.querySelector('.like-count');
    
    // Optimistically update UI
    if (likeButton && likeCount) {
      const currentLikes = parseInt(likeCount.textContent) || 0;
      const isCurrentlyLiked = likeButton.classList.contains('fas');
      
      if (isCurrentlyLiked) {
        // Unlike
        likeButton.className = 'far fa-heart';
        likeButton.parentElement.classList.remove('text-red-500');
        likeCount.textContent = Math.max(0, currentLikes - 1);
      } else {
        // Like
        likeButton.className = 'fas fa-heart text-red-500';
        likeButton.parentElement.classList.add('text-red-500');
        likeCount.textContent = currentLikes + 1;
      }
    }

    const response = await fetch(`${API_URL}/videos/${currentVideoId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('Like response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to like video');
    }
    
    const data = await response.json();
    console.log('Like response data:', data);
    
    // Update with actual server response
    if (likeCount) {
      likeCount.textContent = data.likes;
      console.log('✓ Like count updated to:', data.likes);
    }
    
    if (likeButton) {
      if (data.isLiked) {
        likeButton.className = 'fas fa-heart text-red-500';
        likeButton.parentElement.classList.add('text-red-500');
      } else {
        likeButton.className = 'far fa-heart';
        likeButton.parentElement.classList.remove('text-red-500');
      }
    }
    
    // Refresh video sections to update like states
    await loadHomeVideos();
    if (currentUser) {
      await loadMyVideos();
    }
    
  } catch (error) {
    console.error('Like error:', error);
    showError(error.message);
    
    // Revert optimistic update on error
    const likeButton = document.querySelector('.like-button i');
    const likeCount = document.querySelector('.like-count');
    if (likeButton && likeCount) {
      // This is a simplified revert - in a real app you'd store the original state
      likeButton.className = 'far fa-heart';
      likeButton.parentElement.classList.remove('text-red-500');
    }
  }
}

// Delete video
async function deleteVideo(videoId) {
  if (!videoId) {
    console.error('No video ID for delete operation');
    return;
  }
  
  if (!currentUser) {
    showError('Please login to delete videos');
    return;
  }
  
  // Confirm deletion
  if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
    return;
  }
  
  try {
    console.log('Deleting video:', videoId);
    
    const response = await fetch(`${API_URL}/videos/${videoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('Delete response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete video');
    }
    
    const data = await response.json();
    console.log('Delete response data:', data);
    
    showSuccess('Video deleted successfully!');
    
    // Close video player if it's the deleted video
    if (currentVideoId === videoId) {
      hideVideoPlayer();
    }
    
    // Refresh video sections
    await loadHomeVideos();
    if (currentUser) {
      await loadMyVideos();
    }
    
  } catch (error) {
    console.error('Delete error:', error);
    showError(error.message);
  }
}

// Increment view count
async function incrementViewCount(videoId) {
  if (!videoId) {
    console.error('No video ID for view count increment');
    return;
  }
  
  try {
    console.log('Incrementing view count for video:', videoId);
    const response = await fetch(`${API_URL}/videos/${videoId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('View count response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.warn('View count increment failed:', error.error);
      return; // Don't throw error for view count, just log it
    }

    const data = await response.json();
    console.log('View count updated:', data);
    
    const viewCount = document.querySelector('.view-count');
    if (viewCount) {
      viewCount.textContent = data.views;
      console.log('✓ View count updated to:', data.views);
    }
  } catch (error) {
    console.error('View count error:', error);
    // Don't show error to user for view count issues
  }
}

// Auth modal functions
function showAuthModal() {
  console.log('🔐 Showing auth modal...');
  try {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('hidden');
      console.log('✅ Auth modal shown successfully');
      
      // Focus on the first input field
      const firstInput = modal.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        console.log('✅ Focused on first input field');
      }
    } else {
      console.error('❌ Auth modal element not found!');
    }
  } catch (error) {
    console.error('❌ Error showing auth modal:', error);
  }
}

function hideAuthModal() {
  console.log('🔐 Hiding auth modal...');
  try {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('hidden');
      console.log('✅ Auth modal hidden successfully');
      
      // Clear form fields
      const forms = modal.querySelectorAll('form');
      forms.forEach(form => {
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => input.value = '');
        
        // Clear error messages
        const errorMessages = form.querySelectorAll('.error-message');
        errorMessages.forEach(el => el.remove());
      });
      console.log('✅ Form fields cleared');
    } else {
      console.error('❌ Auth modal element not found!');
    }
  } catch (error) {
    console.error('❌ Error hiding auth modal:', error);
  }
}

function handleLogout() {
  console.log('Handling logout');
  auth.logout();
  currentUser = null;
  updateUIForLoggedOutUser();
  showSuccess('Logged out successfully');
  loadHomeVideos();
}

function toggleUserMenu() {
  console.log('Toggling user menu');
  if (userMenu) userMenu.classList.toggle('hidden');
}

function toggleTheme() {
  console.log('Toggling theme');
  document.documentElement.classList.toggle('dark');
}

function toggleSidebar() {
  console.log('Toggling sidebar');
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (sidebar) sidebar.classList.toggle('collapsed');
  if (mainContent) mainContent.classList.toggle('expanded');
}

// Utility functions
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatViews(views) {
  if (!views) return '0';
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

function formatDate(date) {
  if (!date) return 'Just now';
  const now = new Date();
  const videoDate = new Date(date);
  const diff = now - videoDate;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showError(message) {
  console.error('Showing error:', message);
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => {
      errorDiv.classList.add('hidden');
    }, 5000);
  }
}

function showSuccess(message) {
  console.log('Showing success:', message);
  const successDiv = document.getElementById('successMessage');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
    setTimeout(() => {
      successDiv.classList.add('hidden');
    }, 5000);
  }
}

function showFormError(form, message) {
  console.log('Showing form error:', message);
  
  // Remove existing error messages
  const existingErrors = form.querySelectorAll('.error-message');
  existingErrors.forEach(el => el.remove());
  
  // Create error element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message text-red-500 text-sm mt-2';
  errorDiv.textContent = message;
  
  // Insert after the form
  form.appendChild(errorDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}

// Log that the script has loaded successfully
console.log('App.js loaded and all functions are now globally available!');

// Expose functions globally for HTML onclick handlers
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
window.showEditProfileModal = showEditProfileModal;
window.addComment = addComment;
window.deleteComment = deleteComment;

console.log('✓ All functions exposed globally for HTML onclick handlers');

// Toggle fullscreen
function toggleFullscreen() {
  const modal = document.getElementById('videoPlayerModal');
  const video = document.getElementById('mainVideoPlayer');
  
  if (!document.fullscreenElement) {
    if (modal.requestFullscreen) {
      modal.requestFullscreen();
    } else if (modal.webkitRequestFullscreen) {
      modal.webkitRequestFullscreen();
    } else if (modal.msRequestFullscreen) {
      modal.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

// Share video
function shareVideo() {
  const videoTitle = document.querySelector('.video-title')?.textContent || 'Check out this video!';
  const videoUrl = document.getElementById('mainVideoPlayer')?.src || window.location.href;
  
  if (navigator.share) {
    navigator.share({
      title: videoTitle,
      url: videoUrl
    }).catch(console.error);
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(videoUrl).then(() => {
      showSuccess('Video URL copied to clipboard!');
    }).catch(() => {
      showError('Failed to copy URL');
    });
  }
}

// Enhanced video player setup
function setupVideoPlayer() {
  const video = document.getElementById('mainVideoPlayer');
  const customControls = document.getElementById('customControls');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const progressBar = document.getElementById('progressBar');
  const currentTimeSpan = document.getElementById('currentTime');
  const totalTimeSpan = document.getElementById('totalTime');
  const volumeBtn = document.getElementById('volumeBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  
  if (!video) return;
  
  // Remove existing event listeners to prevent duplicates
  video.removeEventListener('mouseenter', showControls);
  video.removeEventListener('mouseleave', hideControls);
  video.removeEventListener('play', updatePlayButton);
  video.removeEventListener('pause', updatePauseButton);
  video.removeEventListener('timeupdate', updateProgress);
  video.removeEventListener('loadedmetadata', updateTotalTime);
  
  // Show/hide custom controls on hover with better performance
  let controlsTimeout;
  const showControls = () => {
    clearTimeout(controlsTimeout);
    if (customControls) customControls.classList.remove('hidden');
  };
  
  const hideControls = () => {
    controlsTimeout = setTimeout(() => {
      if (customControls) customControls.classList.add('hidden');
    }, 2000);
  };
  
  video.addEventListener('mouseenter', showControls);
  video.addEventListener('mouseleave', hideControls);
  
  // Play/Pause with better error handling
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', async () => {
      try {
        if (video.paused) {
          await video.play();
        } else {
          video.pause();
        }
      } catch (error) {
        console.error('Play/pause error:', error);
        showError('Unable to play video. Please try again.');
      }
    });
  }
  
  // Update play/pause button with better performance
  const updatePlayButton = () => {
    if (playPauseBtn) {
      playPauseBtn.innerHTML = '<i class="fas fa-pause text-xl"></i>';
    }
  };
  
  const updatePauseButton = () => {
    if (playPauseBtn) {
      playPauseBtn.innerHTML = '<i class="fas fa-play text-xl"></i>';
    }
  };
  
  video.addEventListener('play', updatePlayButton);
  video.addEventListener('pause', updatePauseButton);
  
  // Progress bar with throttling for better performance
  let progressUpdateTimeout;
  const updateProgress = () => {
    if (progressUpdateTimeout) return;
    
    progressUpdateTimeout = setTimeout(() => {
      if (video.duration && !isNaN(video.duration)) {
        const progress = (video.currentTime / video.duration) * 100;
        if (progressBar) progressBar.value = progress;
        if (currentTimeSpan) {
          currentTimeSpan.textContent = formatDuration(video.currentTime);
        }
      }
      progressUpdateTimeout = null;
    }, 100); // Throttle to 100ms
  };
  
  video.addEventListener('timeupdate', updateProgress);
  
  // Progress bar seeking with better UX
  if (progressBar) {
    let isSeeking = false;
    
    progressBar.addEventListener('mousedown', () => {
      isSeeking = true;
    });
    
    progressBar.addEventListener('input', () => {
      if (video.duration && !isNaN(video.duration)) {
        const time = (progressBar.value / 100) * video.duration;
        video.currentTime = time;
      }
    });
    
    progressBar.addEventListener('mouseup', () => {
      isSeeking = false;
    });
  }
  
  // Total time update
  const updateTotalTime = () => {
    if (totalTimeSpan && video.duration && !isNaN(video.duration)) {
      totalTimeSpan.textContent = formatDuration(video.duration);
    }
  };
  
  video.addEventListener('loadedmetadata', updateTotalTime);
  
  // Volume controls with better UX
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      const volume = volumeSlider.value / 100;
      video.volume = volume;
      updateVolumeIcon();
    });
  }
  
  if (volumeBtn) {
    volumeBtn.addEventListener('click', () => {
      if (video.volume > 0) {
        video.volume = 0;
        if (volumeSlider) volumeSlider.value = 0;
      } else {
        video.volume = 1;
        if (volumeSlider) volumeSlider.value = 100;
      }
      updateVolumeIcon();
    });
  }
  
  function updateVolumeIcon() {
    if (!volumeBtn) return;
    
    if (video.volume === 0) {
      volumeBtn.innerHTML = '<i class="fas fa-volume-mute text-lg"></i>';
    } else if (video.volume < 0.5) {
      volumeBtn.innerHTML = '<i class="fas fa-volume-down text-lg"></i>';
    } else {
      volumeBtn.innerHTML = '<i class="fas fa-volume-up text-lg"></i>';
    }
  }
  
  // Keyboard shortcuts for better accessibility
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('videoPlayerModal').classList.contains('hidden')) return;
    
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        if (video.paused) video.play();
        else video.pause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        if (volumeSlider) volumeSlider.value = video.volume * 100;
        updateVolumeIcon();
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        if (volumeSlider) volumeSlider.value = video.volume * 100;
        updateVolumeIcon();
        break;
    }
  });
}

console.log('✓ All functions exposed globally for HTML onclick handlers');

// Load playlists
async function loadPlaylists() {
  try {
    if (!currentUser) {
      showError('Please login to view playlists');
      return;
    }

    const response = await fetch(`${API_URL}/playlists`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load playlists');
    }

    const playlists = await response.json();
    displayPlaylists(playlists);
  } catch (error) {
    console.error('Error loading playlists:', error);
    showError(error.message);
  }
}

// Display playlists
function displayPlaylists(playlists) {
  const container = document.getElementById('playlistsGrid');
  if (!container) return;

  if (playlists.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-8">
        <i class="fas fa-list text-4xl text-gray-400 mb-4"></i>
        <p class="text-gray-500 dark:text-gray-400">No playlists yet</p>
        <button onclick="showCreatePlaylistModal()" class="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
          Create Your First Playlist
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = playlists.map(playlist => `
    <div class="bg-white dark:bg-dark-card rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div class="p-4">
        <h3 class="font-semibold text-lg mb-2">${playlist.name}</h3>
        <p class="text-gray-600 dark:text-gray-400 text-sm mb-3">${playlist.description || 'No description'}</p>
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>${playlist.videos.length} videos</span>
          <span>${formatDate(playlist.createdAt)}</span>
        </div>
        <div class="mt-3 flex space-x-2">
          <button onclick="viewPlaylist('${playlist._id}')" class="flex-1 bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark transition-colors">
            View
          </button>
          <button onclick="editPlaylist('${playlist._id}')" class="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Edit
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Load watch later
async function loadWatchLater() {
  try {
    if (!currentUser) {
      showError('Please login to view watch later');
      return;
    }

    const response = await fetch(`${API_URL}/watch-later`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load watch later');
    }

    const videos = await response.json();
    displayVideos(videos, 'watchLaterSection');
  } catch (error) {
    console.error('Error loading watch later:', error);
    showError(error.message);
  }
}

// Load user profile
async function loadUserProfile() {
  try {
    if (!currentUser) {
      showError('Please login to view profile');
      return;
    }

    const response = await fetch(`${API_URL}/users/${currentUser._id}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load profile');
    }

    const data = await response.json();
    displayUserProfile(data.user, data.videos);
  } catch (error) {
    console.error('Error loading profile:', error);
    showError(error.message);
  }
}

// Display user profile
function displayUserProfile(user, videos) {
  const profilePicture = document.getElementById('profilePicture');
  const profileUsername = document.getElementById('profileUsername');
  const profileBio = document.getElementById('profileBio');
  const videoCount = document.getElementById('videoCount');
  const subscriberCount = document.getElementById('subscriberCount');

  if (profilePicture) {
    profilePicture.src = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6B4EFF&color=fff`;
  }
  if (profileUsername) profileUsername.textContent = user.username;
  if (profileBio) profileBio.textContent = user.bio || 'No bio yet';
  if (videoCount) videoCount.textContent = videos.length;
  if (subscriberCount) subscriberCount.textContent = user.subscribers;

  displayVideos(videos, 'profileSection');
}

// Add to watch later
async function addToWatchLater(videoId) {
  if (!currentUser) {
    showError('Please login to add videos to watch later');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/videos/${videoId}/watch-later`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add to watch later');
    }

    showSuccess('Added to watch later!');
  } catch (error) {
    console.error('Error adding to watch later:', error);
    showError(error.message);
  }
}

// Show create playlist modal
function showCreatePlaylistModal() {
  // This would open a modal to create a new playlist
  const name = prompt('Enter playlist name:');
  if (name && name.trim()) {
    createPlaylist(name.trim());
  }
}

// Create playlist
async function createPlaylist(name, description = '') {
  try {
    const response = await fetch(`${API_URL}/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ name, description, isPublic: true })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create playlist');
    }

    showSuccess('Playlist created successfully!');
    loadPlaylists();
  } catch (error) {
    console.error('Error creating playlist:', error);
    showError(error.message);
  }
}

// Show add to playlist modal
function showAddToPlaylistModal(videoId) {
  // This would open a modal to select which playlist to add the video to
  const playlistName = prompt('Enter playlist name to add video to:');
  if (playlistName && playlistName.trim()) {
    addVideoToPlaylist(videoId, playlistName.trim());
  }
}

// Add video to playlist
async function addVideoToPlaylist(videoId, playlistName) {
  try {
    // First get user's playlists
    const response = await fetch(`${API_URL}/playlists`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get playlists');
    }

    const playlists = await response.json();
    const playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());

    if (!playlist) {
      throw new Error('Playlist not found');
    }

    // Add video to playlist
    const addResponse = await fetch(`${API_URL}/playlists/${playlist._id}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ videoId })
    });

    if (!addResponse.ok) {
      const error = await addResponse.json();
      throw new Error(error.error || 'Failed to add video to playlist');
    }

    showSuccess('Video added to playlist!');
  } catch (error) {
    console.error('Error adding video to playlist:', error);
    showError(error.message);
  }
}

// Load and display comments
async function loadComments(videoId) {
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}`);
    if (!response.ok) {
      throw new Error('Failed to load video');
    }

    const video = await response.json();
    displayComments(video.comments || []);
  } catch (error) {
    console.error('Error loading comments:', error);
  }
}

// Display comments
function displayComments(comments) {
  const container = document.getElementById('commentsList');
  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>';
    return;
  }

  container.innerHTML = comments.map(comment => `
    <div class="flex space-x-3">
      <img src="${comment.userId.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userId.username)}&background=6B4EFF&color=fff`}" 
           alt="${comment.userId.username}" class="w-8 h-8 rounded-full flex-shrink-0">
      <div class="flex-1">
        <div class="flex items-center space-x-2 mb-1">
          <span class="font-medium text-sm">${comment.userId.username}</span>
          <span class="text-gray-500 dark:text-gray-400 text-xs">${formatDate(comment.createdAt)}</span>
        </div>
        <p class="text-sm">${comment.text}</p>
        ${currentUser && (comment.userId._id === currentUser._id || comment.userId === currentUser._id) ? 
          `<button onclick="deleteComment('${comment._id}')" class="text-red-500 text-xs hover:text-red-700 mt-1">Delete</button>` : 
          ''
        }
      </div>
    </div>
  `).join('');
}

// Add comment
async function addComment(videoId, text) {
  try {
    const response = await fetch(`${API_URL}/videos/${videoId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add comment');
    }

    const newComment = await response.json();
    loadComments(videoId); // Reload comments
    document.getElementById('commentInput').value = '';
  } catch (error) {
    console.error('Error adding comment:', error);
    showError(error.message);
  }
}

// Delete comment
async function deleteComment(commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/videos/${currentVideoId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete comment');
    }

    loadComments(currentVideoId); // Reload comments
  } catch (error) {
    console.error('Error deleting comment:', error);
    showError(error.message);
  }
}

// Enhanced error handling for API calls
async function apiCall(url, options = {}) {
  try {
    console.log(`🌐 API Call: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, options);
    console.log(`📡 Response status: ${response.status}`);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response received:', text.substring(0, 200));
      throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ API call successful:', data);
    return data;
  } catch (error) {
    console.error('❌ API call failed:', error);
    throw error;
  }
}

// Test API connectivity
async function testAPIConnectivity() {
  try {
    console.log('🧪 Testing API connectivity...');
    const response = await fetch(`${API_URL}/videos`);
    console.log('📡 Test response status:', response.status);
    console.log('📡 Test response headers:', Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    console.log('📡 Content-Type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('✅ API test successful, received JSON data');
      return true;
    } else {
      const text = await response.text();
      console.error('❌ API test failed - received non-JSON response:', text.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.error('❌ API test failed with error:', error);
    return false;
  }
} 