const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storySchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  location: { type: String },
  tags: { type: [String], default: [] },
  images: { type: [String], default: [] },
  pinned: { type: Boolean, default: false },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Text index for search across title, content, and tags. 
// Note: Mongoose might not automatically create indexes if autoIndex is false, 
// but it is true by default in dev.
storySchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('Story', storySchema);
