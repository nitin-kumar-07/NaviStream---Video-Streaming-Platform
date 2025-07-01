const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    enum: ['gaming', 'music', 'education', 'entertainment', 'sports', 'other'],
    default: 'other'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  tags: [{
    type: String,
    trim: true
  }],
  format: {
    type: String
  },
  size: {
    type: Number
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  playlistId: {
      type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist'
  }
}, {
  timestamps: true
});

// Add text index for search
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Add method to increment views
videoSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

// Add method to toggle like
videoSchema.methods.toggleLike = async function(userId) {
  const userIdStr = userId.toString();
  const userIndex = this.likes.findIndex(likeId => likeId.toString() === userIdStr);
  
  if (userIndex === -1) {
    // Add like
    this.likes.push(userId);
  } else {
    // Remove like
    this.likes.splice(userIndex, 1);
  }
  
  return this.save();
};

// Add method to check if user liked the video
videoSchema.methods.isLikedBy = function(userId) {
  const userIdStr = userId.toString();
  return this.likes.some(likeId => likeId.toString() === userIdStr);
};

// Add method to add comment
videoSchema.methods.addComment = async function(userId, text) {
  this.comments.push({
    userId: userId,
    text: text
  });
  return this.save();
};

// Add method to remove comment
videoSchema.methods.removeComment = async function(commentId, userId) {
  const commentIndex = this.comments.findIndex(comment => 
    comment._id.toString() === commentId && comment.userId.toString() === userId.toString()
  );
  
  if (commentIndex !== -1) {
    this.comments.splice(commentIndex, 1);
    return this.save();
  }
  throw new Error('Comment not found or unauthorized');
};

const Video = mongoose.model('Video', videoSchema);

module.exports = Video; 