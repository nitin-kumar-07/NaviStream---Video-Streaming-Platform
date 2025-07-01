const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  videos: [{
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  thumbnail: {
    type: String
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Add method to add video to playlist
playlistSchema.methods.addVideo = async function(videoId) {
  const videoExists = this.videos.some(video => video.videoId.toString() === videoId.toString());
  if (!videoExists) {
    this.videos.push({ videoId: videoId });
    return this.save();
  }
  throw new Error('Video already in playlist');
};

// Add method to remove video from playlist
playlistSchema.methods.removeVideo = async function(videoId) {
  const videoIndex = this.videos.findIndex(video => video.videoId.toString() === videoId.toString());
  if (videoIndex !== -1) {
    this.videos.splice(videoIndex, 1);
    return this.save();
  }
  throw new Error('Video not found in playlist');
};

// Add method to reorder videos
playlistSchema.methods.reorderVideos = async function(videoIds) {
  this.videos = videoIds.map((videoId, index) => ({
    videoId: videoId,
    addedAt: this.videos.find(v => v.videoId.toString() === videoId.toString())?.addedAt || new Date()
  }));
  return this.save();
};

const Playlist = mongoose.model('Playlist', playlistSchema);

module.exports = Playlist; 