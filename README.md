 NaviStream – Cloud-Based Video Streaming Platform

NaviStream is a full-stack web application that allows users to upload, stream, like, and manage videos securely using cloud infrastructure. It features user authentication, MongoDB Atlas for storage, and Cloudinary for media hosting.

🚀 Features

🔐 User Authentication (Register / Login / Logout)

📄 Video Upload using Cloudinary

🎮 Video Streaming directly from Cloudinary

💬 Video Metadata (title, description, thumbnail, category)
❤️ Like & Watch Later Functionality
🔎 Search & Recommendations
🗞️ MongoDB Atlas Integration
📁 JWT-based Route Protection


🌟 Project Objective
To build a secure, scalable video platform that enables users to upload and stream videos using cloud-based technologies like MongoDB Atlas and Cloudinary.

💻 Frontend Implementation
Pure HTML, CSS, and JavaScript (no frameworks)
Communicates with backend using fetch()
Dynamically renders video cards, thumbnails, likes, and categories


🚜 Backend Implementation
Express.js handles API routing
Middleware: auth.js verifies JWT tokens
Endpoints:
/api/auth/register
/api/auth/login
/api/videos/upload
/api/videos, /api/videos/search, etc.
Uses multer-storage-cloudinary to handle video uploads


📂 MongoDB Atlas
Stores users and video metadata
Cloud-based, secure NoSQL database
Connection handled by Mongoose
await mongoose.connect(process.env.MONGODB_URI, {...})


☁️ Cloudinary Integration
Stores uploaded video files securely
Returns video url, public_id, and allows thumbnail access
Used in <video> tags on the frontend


🔐 Authentication
JWT is generated during login
Protected routes verify token using middleware
Passwords are hashed using bcryptjs


📷 Upload & Streaming Flow
User selects video
Video uploaded to Cloudinary
Metadata saved in MongoDB
Videos streamed via Cloudinary URLs


🛠️ Tech Stack

🌐 Frontend:
HTML, CSS, Vanilla JS
Responsive Design


🔧 Backend:
Node.js + Express.js
MongoDB Atlas via Mongoose
Cloudinary (via multer-storage-cloudinary)
JWT for Authentication
bcryptjs for Password Hashing


📁 Folder Structure (Explained)

📆 NaviStream/
🔹 models/
🔹   User.js               # Mongoose schema for user data
🔹   Video.js              # Mongoose schema for video metadata
🔹 middleware/
🔹   auth.js               # JWT auth middleware
🔹 public/
🔹   index.html            # Main frontend HTML page
🔹   css/
🔹     style.css           # Stylesheet
🔹   js/
🔹     main.js             # UI + event logic
🔹     auth.js             # Login/register logic
🔹     videoService.js     # API calls for videos
🔹     ui.js               # UI rendering functions
🔹 .env                   # Environment variables (secret keys)
🔹 server.js              # Main backend server
🔹 package.json           # Node project info
🔹 README.md              # Project documentation

Videos streamed via Cloudinary URLs
