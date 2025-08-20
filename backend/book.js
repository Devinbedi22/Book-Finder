const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  authors: { type: [String], required: true, validate: arr => arr.length > 0 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  rating: { type: Number, min: 0, max: 5, default: null },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  thumbnail: { type: String, trim: true, default: '' },
  infoLink: { type: String, trim: true, default: '' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true, transform: (_, r) => { r.id = r._id; delete r._id; delete r.__v } }
});

bookSchema.index({ user: 1, title: 1 });

module.exports = mongoose.model('Book', bookSchema);
