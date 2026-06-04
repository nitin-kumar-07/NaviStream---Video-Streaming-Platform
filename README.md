# NaviStream - Cloud Video Streaming Platform

NaviStream is a full-stack web application where users can register, upload videos, stream videos, like, comment, manage playlists, and maintain a watch-later list. The platform uses cloud-based storage for media and a NoSQL database for metadata.

This document explains the complete project in detail: what we built, how we built it, which code files are responsible for each feature, and how to present it clearly in interviews.

## 1) Project Overview

### Core Objective

Build a secure and scalable video platform with:

- user authentication and authorization
- cloud video upload and streaming
- content discovery (search, trending, category filters)
- social engagement (likes, comments, subscriptions)
- personal organization (watch later, playlists, profile)

### High-Level Architecture

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas via Mongoose
- **Media Storage/CDN:** Cloudinary
- **Authentication:** JWT + bcryptjs

Data flow:

1. User action in browser triggers API call.
2. Express route validates request and authenticates user if protected.
3. Mongoose reads/writes metadata in MongoDB.
4. Cloudinary stores/serves actual video files.
5. Frontend updates UI dynamically with JSON response.

## 2) Tech Stack and Libraries

Dependencies are defined in `package.json`.

### Backend Libraries

- `express`: HTTP server and API routing
- `mongoose`: MongoDB ODM (schemas, validation, model methods)
- `jsonwebtoken`: token creation and verification
- `bcryptjs`: password hashing
- `multer`: multipart file handling
- `cloudinary`: cloud media upload and delivery
- `cors`: cross-origin policy setup
- `dotenv`: environment variable management

### Dev Tools

- `nodemon`: auto-restart backend in development

### Frontend

- plain `index.html` for structure
- `styles/main.css` for responsive styling and theme system
- `js/app.js` for all client-side state, API calls, rendering, and event logic

## 3) Folder and File Responsibilities

### Root Files

- `server.js` - full backend app: middleware, DB connection, API endpoints
- `index.html` - complete UI layout: sidebar, sections, modals, player
- `js/app.js` - frontend behavior and API integration
- `styles/main.css` - complete visual design and responsive rules
- `package.json` - scripts and dependencies
- `README.md` - complete project documentation

### Backend Support Folders

- `models/User.js` - user schema and user methods
- `models/Video.js` - video schema, comment subdocument, video methods
- `models/Playlist.js` - playlist schema and methods
- `middleware/auth.js` - JWT route-protection middleware

### Runtime/Upload Folder

- `uploads/` - temporary local storage before upload to Cloudinary

## 4) Environment Variables

Create `.env` in project root:

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<db-name>
JWT_SECRET=your_secure_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
```

Notes:

- `JWT_SECRET` is required for token signing/verification.
- Cloudinary keys are required for upload and video delivery.
- In production, set `NODE_ENV=production` and configure `FRONTEND_URL`.

## 5) How We Built The Project (Step-by-Step)

### Step 1: Backend Foundation

In `server.js`:

- loaded env vars with `dotenv`
- initialized Express app
- configured CORS, body parsers, static file serving
- added request timeout middleware
- connected MongoDB with retry logic using `connectDB()`

### Step 2: Data Modeling

Implemented Mongoose schemas:

- `User` for auth/profile/subscription/watch-later/playlist references
- `Video` for title, description, URL, thumbnail, category, views, likes, comments
- `Playlist` for named collections of videos

Added model methods to keep business logic close to data:

- `User.comparePassword`, `User.createPlaylist`, `User.addToWatchLater`
- `Video.toggleLike`, `Video.isLikedBy`, `Video.addComment`, `Video.removeComment`
- `Playlist.addVideo`, `Playlist.removeVideo`

### Step 3: Authentication System

Built auth endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Security implementation:

- password hashing with bcrypt pre-save hook
- JWT token generated on register/login
- protected routes via middleware that reads `Authorization: Bearer <token>`

### Step 4: Video Upload and Cloudinary Integration

Upload pipeline in `/api/videos/upload`:

1. `multer` stores video temporarily in `uploads/`
2. backend uploads file to Cloudinary (`resource_type: "video"`)
3. Cloudinary returns secure URL + `public_id`
4. thumbnail URL generated from Cloudinary transformation
5. video metadata saved in MongoDB
6. temporary local file deleted

### Step 5: Video Discovery and Engagement APIs

Built endpoints for:

- all videos + sorting + category filtering
- search by title/description
- trending list
- recommendations
- like/unlike
- view increment
- comments create/delete

### Step 6: User-Centric Features

Added:

- my videos
- liked videos
- watch later
- playlists (create/list/add video)
- profile read/update
- subscribe/unsubscribe to creators

### Step 7: Frontend Application Logic

In `js/app.js`:

- created `Auth` class to manage token and user state
- wired form handlers (login/register/upload/comment)
- built dynamic section rendering with `showSection()`
- implemented card rendering with `createVideoCard()`
- built player modal with related videos and action buttons
- added upload progress bar using `XMLHttpRequest`

### Step 8: UI and Responsive Design

In `styles/main.css`:

- CSS variables for dark/light themes
- desktop sidebar + mobile bottom nav
- card layouts, player page, modals, toasts, skeleton loaders
- responsive breakpoints for tablet/mobile

## 6) API Endpoints (Implemented)

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)

### Videos

- `POST /api/videos/upload` (protected)
- `GET /api/videos`
- `GET /api/videos/trending`
- `GET /api/videos/recommendations`
- `GET /api/videos/my-videos` (protected)
- `GET /api/videos/liked` (protected)
- `GET /api/videos/search`
- `GET /api/videos/advanced-search`
- `PUT /api/videos/:id` (protected, owner)
- `DELETE /api/videos/:id` (protected, owner)
- `POST /api/videos/:videoId/like` (protected)
- `POST /api/videos/:videoId/view` (protected)

### Comments

- `POST /api/videos/:videoId/comments` (protected)
- `DELETE /api/videos/:videoId/comments/:commentId` (protected)

### Watch Later

- `POST /api/videos/:id/watch-later` (protected)
- `POST /api/videos/:videoId/watch-later` (protected)
- `GET /api/watch-later` (protected)

### Playlists

- `POST /api/playlists` (protected)
- `GET /api/playlists` (protected)
- `POST /api/playlists/:playlistId/videos` (protected)

### Users

- `PUT /api/users/profile` (protected)
- `GET /api/users/:userId`
- `POST /api/users/:id/subscribe` (protected)

## 7) Frontend Features and Their Code Areas

### Auth UI and State

- `Auth` class, `checkAuth()`, `setupAuthModal()`

### Video Feed

- `loadHomeVideos()`, `displayVideos()`, `createVideoCard()`

### Search/Filter/Sort

- `searchVideos()`, `syncCategoryPills()`, `loadHomeVideos()` query params

### Upload

- `showUploadModal()`, `handleUploadSubmit()`, `uploadWithProgress()`

### Player and Engagement

- `showVideoPlayer()`, `likeVideo()`, `incrementViewCount()`, `shareVideo()`

### Comments

- `loadComments()`, `addComment()`, `deleteComment()`

### Library Features

- `loadLikedVideos()`, `loadWatchLater()`, `loadPlaylists()`, `createPlaylist()`

### Profile

- `loadUserProfile()`, `displayUserProfile()`

## 8) Security and Validation

- JWT-protected routes for sensitive actions
- password hashing before save
- basic request validation in auth and upload endpoints
- file type filtering in `multer`
- file size limit (500MB)
- schema validation constraints (`required`, `enum`, `maxlength`, etc.)

## 9) Key Engineering Decisions

### Why MongoDB + Mongoose?

- flexible schema evolution for social features and nested comments
- direct support for arrays and ObjectId references

### Why Cloudinary?

- stores large media files outside app server
- provides permanent secure URLs and global delivery
- supports transformations (thumbnail generation)

### Why Vanilla JS Frontend?

- direct control over DOM and state logic
- demonstrates core frontend fundamentals without framework abstraction

## 10) Known Integration Notes

Current codebase has some practical notes to remember:

- Backend default port is `3001` while frontend `API_URL` is currently `http://localhost:5000/api`.
- Frontend comment loader expects `GET /api/videos/:videoId`, but this specific endpoint is not currently defined.
- Watch-later has two POST routes with slightly different behavior.

These are common final-integration cleanup tasks and are easy to align in a polishing pass.

## 11) Installation and Run

### Prerequisites

- Node.js (14+ recommended)
- MongoDB Atlas cluster
- Cloudinary account

### Commands

```bash
npm install
npm run dev
```

or:

```bash
npm start
```

Open in browser:

```text
http://localhost:3001
```

## 12) Interview-Ready Explanation (Short Version)

NaviStream is a full-stack cloud video streaming platform built with Vanilla JS, Express, MongoDB, and Cloudinary. We implemented secure JWT authentication, cloud-based upload/streaming, metadata persistence with Mongoose models, and interactive social features like likes, comments, playlists, subscriptions, and watch later. The frontend is a dynamic SPA-style interface with sections, modals, player controls, and responsive design. The backend exposes RESTful endpoints, handles authorization, validates data, and integrates cloud upload with local temp-file cleanup.

## 13) Future Enhancements

- add pagination and infinite scroll
- add refresh tokens and token expiry management
- add rate limiting and request throttling
- modularize server routes/controllers/services
- add test coverage (unit + integration + API)
- add video details endpoint and align frontend API base URL
- improve recommendation algorithm and analytics
