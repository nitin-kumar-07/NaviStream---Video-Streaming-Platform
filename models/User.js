const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profilePicture: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  subscribers: {
    type: Number,
    default: 0
  },
  subscribedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likedVideos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video'
  }],
  watchLater: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video'
  }],
  playlists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'creator', 'admin'],
    default: 'user'
  },
  socialLinks: {
    youtube: String,
    twitter: String,
    instagram: String,
    website: String
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add method to subscribe to a user
userSchema.methods.subscribeTo = async function(userId) {
  if (this.subscribedTo.includes(userId)) {
    // Unsubscribe
    this.subscribedTo = this.subscribedTo.filter(id => id.toString() !== userId.toString());
  } else {
    // Subscribe
    this.subscribedTo.push(userId);
  }
  return this.save();
};

// Add method to add video to watch later
userSchema.methods.addToWatchLater = async function(videoId) {
  if (!this.watchLater.includes(videoId)) {
    this.watchLater.push(videoId);
    return this.save();
  }
  throw new Error('Video already in watch later');
};

// Add method to remove video from watch later
userSchema.methods.removeFromWatchLater = async function(videoId) {
  this.watchLater = this.watchLater.filter(id => id.toString() !== videoId.toString());
  return this.save();
};

// Add method to create playlist
userSchema.methods.createPlaylist = async function(name, description = '', isPublic = true) {
  const Playlist = require('./Playlist');
  const playlist = new Playlist({
    name: name,
    description: description,
    userId: this._id,
    isPublic: isPublic
  });
  await playlist.save();
  
  this.playlists.push(playlist._id);
  await this.save();
  
  return playlist;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 