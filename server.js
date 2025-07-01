// Load environment variables first
require('dotenv').config();

// Debug environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('Environment variables loaded:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  // Don't log the full MongoDB URI in production
  console.log('MongoDB URI length:', process.env.MONGODB_URI?.length || 0);
}

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Video = require('./models/Video');
const User = require('./models/User');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const bcrypt = require('bcryptjs');
const authMiddleware = require('./middleware/auth');
const path = require('path');
const Playlist = require('./models/Playlist');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(__dirname));
app.use(express.static('public'));
app.use(express.static('js'));
app.use(express.static('styles'));
app.use(express.static('assets'));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Configure multer storage with better Cloudinary options
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'navistream',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv'],
    transformation: [
      { quality: 'auto' },
      { width: 1280, crop: 'scale' }
    ],
    eager: [
      { 
        format: 'mp4',
        quality: 'auto',
        width: 1280,
        crop: 'scale'
      },
      { 
        format: 'jpg',
        quality: 'auto',
        width: 1280,
        crop: 'scale'
      }
    ],
    eager_async: true,
    eager_notification_url: process.env.NODE_ENV === 'production' ? 
      `${process.env.BACKEND_URL}/api/videos/upload/notification` : 
      'http://localhost:3001/api/videos/upload/notification'
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Supported formats: MP4, MOV, AVI, MKV'), false);
      return;
    }
    cb(null, true);
  }
});

// Connect to MongoDB with retry logic
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Only log the URI in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Attempting to connect to MongoDB...');
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});

// Initial connection
connectDB();

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) throw new Error();

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Register request received:', req.body);
    const { username, email, password } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User already exists' 
      });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    
    console.log('Registration successful for user:', user.username);
    
    res.status(201).json({ 
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }, 
      token 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    
    console.log('Login successful for user:', user.username);
    
    res.json({ 
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }, 
      token 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Video upload with metadata and better error handling
app.post('/api/videos/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    console.log('POST /api/videos/upload - Request:', {
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      } : null,
      body: req.body,
      user: req.user._id
    });

    if (!req.file) {
      console.log('No video file provided');
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, category } = req.body;
    if (!title) {
      console.log('Title is required');
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log('Uploading to Cloudinary...');
    console.log('File path:', req.file.path);
    console.log('File exists:', fs.existsSync(req.file.path));
    
    // Upload to Cloudinary with better error handling
    let result;
    try {
      result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'navistream/videos',
        eager: [
          { format: 'mp4', quality: 'auto' }
        ],
        eager_async: true
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      return res.status(500).json({ 
        error: 'Failed to upload video to cloud storage',
        details: cloudinaryError.message 
      });
    }

    console.log('Cloudinary upload result:', {
      public_id: result.public_id,
      secure_url: result.secure_url,
      duration: result.duration,
      width: result.width,
      height: result.height
    });

    // Generate thumbnail
    const thumbnail = cloudinary.url(result.public_id, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 400, height: 225, crop: 'fill' }
      ]
    });
    console.log('Generated thumbnail:', thumbnail);

    // Create video document
    const video = new Video({
      title: title.trim(),
      description: (description || 'No description provided').trim(),
      category: category || 'other',
      url: result.secure_url,
      publicId: result.public_id,
      thumbnail,
      duration: result.duration || 0,
      userId: req.user._id,
      views: 0,
      likes: []
    });

    await video.save();
    console.log('Video saved successfully:', {
      id: video._id,
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail
    });

    // Clean up temporary file
    if (req.file && req.file.path && fs.existsSync(req.file.path) && !req.file.path.startsWith('http')) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Temporary file deleted');
      } catch (unlinkError) {
        console.warn('Failed to delete temporary file:', unlinkError.message);
      }
    }

    const populatedVideo = await video.populate('userId', 'username');
    console.log('Video populated with user data');
    
    res.status(201).json({
      message: 'Video uploaded successfully',
      video: populatedVideo
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up temporary file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path) && !req.file.path.startsWith('http')) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Temporary file deleted after error');
      } catch (unlinkError) {
        console.warn('Failed to delete temporary file after error:', unlinkError.message);
      }
    }
    
    if (error.name === 'ValidationError') {
      console.log('Validation error:', error.errors);
      return res.status(400).json({ 
        error: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.name === 'MongoError' && error.code === 11000) {
      console.log('Duplicate video entry');
      return res.status(400).json({ 
        error: 'Duplicate video entry' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to upload video',
      details: error.message 
    });
  }
});

// Get all videos with sorting and filtering
app.get('/api/videos', async (req, res) => {
  try {
    console.log('GET /api/videos - Query params:', req.query);
    const { sort, category } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'mostViewed') {
      sortOption = { views: -1 };
    } else if (sort === 'mostLiked') {
      sortOption = { likes: -1 };
    }

    console.log('MongoDB query:', { query, sortOption });

    const videos = await Video.find(query)
      .sort(sortOption)
      .populate('userId', 'username')
      .limit(50);

    console.log(`Found ${videos.length} videos`);
    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get trending videos
app.get('/api/videos/trending', async (req, res) => {
  try {
    console.log('GET /api/videos/trending');
    const videos = await Video.find()
      .sort({ views: -1, likes: -1 })
      .populate('userId', 'username')
      .limit(20);

    console.log(`Found ${videos.length} trending videos`);
    res.json(videos);
  } catch (error) {
    console.error('Get trending videos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get liked videos
app.get('/api/videos/liked', authMiddleware, async (req, res) => {
  try {
    console.log('GET /api/videos/liked - User:', req.user._id);
    const videos = await Video.find({ likes: req.user._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'username');

    console.log(`Found ${videos.length} liked videos`);
    res.json(videos);
  } catch (error) {
    console.error('Get liked videos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Like/Unlike video
app.post('/api/videos/:videoId/like', authMiddleware, async (req, res) => {
  try {
    console.log('POST /api/videos/like - Video:', req.params.videoId, 'User:', req.user._id);
    
    // Validate video ID
    if (!mongoose.Types.ObjectId.isValid(req.params.videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    
    const video = await Video.findById(req.params.videoId);
    if (!video) {
      console.log('Video not found');
      return res.status(404).json({ error: 'Video not found' });
    }

    // Use the toggleLike method from the model
    await video.toggleLike(req.user._id);
    
    console.log('Updated likes count:', video.likes.length);
    res.json({ 
      likes: video.likes.length,
      isLiked: video.isLikedBy(req.user._id)
    });
  } catch (error) {
    console.error('Like video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Increment view count
app.post('/api/videos/:videoId/view', authMiddleware, async (req, res) => {
  try {
    console.log('POST /api/videos/view - Video:', req.params.videoId);
    const video = await Video.findById(req.params.videoId);
    if (!video) {
      console.log('Video not found');
      return res.status(404).json({ error: 'Video not found' });
    }

    video.views += 1;
    await video.save();
    console.log('Updated view count:', video.views);
    res.json({ views: video.views });
  } catch (error) {
    console.error('Increment view count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get video recommendations
app.get('/api/videos/recommendations', async (req, res) => {
  try {
    const { category } = req.query;
    const videos = await Video.find(category ? { category } : {})
      .sort({ views: -1 })
      .limit(10)
      .populate('userId', 'username profilePicture');
    res.json(videos);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update video metadata
app.put('/api/videos/:id', authMiddleware, async (req, res) => {
  try {
    const video = await Video.findOne({ _id: req.params.id, userId: req.user._id });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    Object.assign(video, req.body);
    await video.save();
    res.json(video);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete video
app.delete('/api/videos/:id', authMiddleware, async (req, res) => {
  try {
    console.log('DELETE /api/videos - Video:', req.params.id, 'User:', req.user._id);
    
    const video = await Video.findOne({ _id: req.params.id, userId: req.user._id });
    if (!video) {
      console.log('Video not found or user not authorized');
      return res.status(404).json({ error: 'Video not found' });
    }

    console.log('Deleting video from Cloudinary:', video.publicId);
    await cloudinary.uploader.destroy(video.publicId, { resource_type: 'video' });
    
    console.log('Deleting video from database');
    await Video.deleteOne({ _id: req.params.id });
    
    console.log('Video deleted successfully');
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's videos
app.get('/api/videos/my-videos', authMiddleware, async (req, res) => {
  try {
    const videos = await Video.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'username');

    res.json(videos);
  } catch (error) {
    console.error('Get my videos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search videos with improved functionality
app.get('/api/videos/search', async (req, res) => {
  try {
    const { q, category } = req.query;
    const query = {};

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'username');

    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Watch Later Routes
app.post('/api/videos/:id/watch-later', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const videoId = req.params.id;
    
    const watchLaterIndex = user.watchLater.indexOf(videoId);
    if (watchLaterIndex === -1) {
      user.watchLater.push(videoId);
    } else {
      user.watchLater.splice(watchLaterIndex, 1);
    }

    await user.save();
    res.json({ watchLater: user.watchLater });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update watch later list' });
  }
});

// Subscribe Routes
app.post('/api/users/:id/subscribe', authMiddleware, async (req, res) => {
  try {
    const userToSubscribe = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToSubscribe) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscribedIndex = currentUser.subscribedTo.indexOf(userToSubscribe._id);
    if (subscribedIndex === -1) {
      currentUser.subscribedTo.push(userToSubscribe._id);
      userToSubscribe.subscribers += 1;
    } else {
      currentUser.subscribedTo.splice(subscribedIndex, 1);
      userToSubscribe.subscribers -= 1;
    }

    await currentUser.save();
    await userToSubscribe.save();

    res.json({ 
      subscribed: subscribedIndex === -1,
      subscribers: userToSubscribe.subscribers 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Check authentication status
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Comment routes
app.post('/api/videos/:videoId/comments', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const video = await Video.findById(req.params.videoId);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    await video.addComment(req.user._id, text);
    
    // Populate user info for the new comment
    await video.populate('comments.userId', 'username profilePicture');
    
    const newComment = video.comments[video.comments.length - 1];
    res.json(newComment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/videos/:videoId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    await video.removeComment(req.params.commentId, req.user._id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Playlist routes
app.post('/api/playlists', authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const user = await User.findById(req.user._id);
    
    const playlist = await user.createPlaylist(name, description, isPublic);
    res.json(playlist);
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/playlists', authMiddleware, async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.user._id })
      .populate('videos.videoId', 'title thumbnail duration views')
      .sort({ createdAt: -1 });
    res.json(playlists);
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/playlists/:playlistId/videos', authMiddleware, async (req, res) => {
  try {
    const { videoId } = req.body;
    const playlist = await Playlist.findOne({ _id: req.params.playlistId, userId: req.user._id });
    
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    
    await playlist.addVideo(videoId);
    res.json({ message: 'Video added to playlist' });
  } catch (error) {
    console.error('Add video to playlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User profile routes
app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const { username, bio, socialLinks } = req.body;
    const user = await User.findById(req.user._id);
    
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username;
    }
    
    if (bio !== undefined) user.bio = bio;
    if (socialLinks) user.socialLinks = { ...user.socialLinks, ...socialLinks };
    
    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -email')
      .populate('playlists', 'name description thumbnail videos');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's videos
    const videos = await Video.find({ userId: req.params.userId, isPublic: true })
      .populate('userId', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ user, videos });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Advanced search
app.get('/api/videos/advanced-search', async (req, res) => {
  try {
    const { q, category, duration, sort, dateRange, tags } = req.query;
    const query = { isPublic: true };
    
    // Text search
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }
    
    // Category filter
    if (category) {
      query.category = category;
    }
    
    // Duration filter
    if (duration) {
      const [min, max] = duration.split('-').map(Number);
      if (min && max) {
        query.duration = { $gte: min, $lte: max };
      } else if (min) {
        query.duration = { $gte: min };
      } else if (max) {
        query.duration = { $lte: max };
      }
    }
    
    // Date range filter
    if (dateRange) {
      const days = parseInt(dateRange);
      const date = new Date();
      date.setDate(date.getDate() - days);
      query.createdAt = { $gte: date };
    }
    
    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    
    // Sort options
    let sortOption = { createdAt: -1 };
    if (sort === 'views') sortOption = { views: -1 };
    else if (sort === 'likes') sortOption = { 'likes.length': -1 };
    else if (sort === 'duration') sortOption = { duration: -1 };
    
    const videos = await Video.find(query)
      .populate('userId', 'username profilePicture')
      .sort(sortOption)
      .limit(50);
    
    res.json(videos);
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Watch later routes
app.post('/api/videos/:videoId/watch-later', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    await user.addToWatchLater(req.params.videoId);
    res.json({ message: 'Added to watch later' });
  } catch (error) {
    console.error('Add to watch later error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/watch-later', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('watchLater');
    const videos = await Video.find({ _id: { $in: user.watchLater } })
      .populate('userId', 'username profilePicture')
      .sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    console.error('Get watch later error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
