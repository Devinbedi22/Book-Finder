// Book model – enhanced schema for Book Tracker 💾
// ─────────────────────────────────────────────────────
// • Added optional ISBN + pageCount fields for richer metadata
// • Unique compound index (user + title + authors[0]) to prevent duplicates
// • Text index on title & authors for faster search / autocomplete
// • Pre‑save hook trims and deduplicates authors array
// • Virtual `shortDescription` (first 140 chars) for previews
//
// Note: Existing documents remain compatible (new fields are optional)

const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    authors: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one author is required',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    pageCount: {
      type: Number,
      min: 1,
      default: null,
    },
    isbn: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    thumbnail: {
      type: String,
      trim: true,
      default: '',
    },
    infoLink: {
      type: String,
      trim: true,
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

/* ── Indexes ───────────────────────────────────────── */
// Prevent duplicate records by same user with same title + primary author.
bookSchema.index({ user: 1, title: 1, 'authors.0': 1 }, { unique: true });
// Full‑text search index
bookSchema.index({ title: 'text', authors: 'text' });

/* ── Virtuals ─────────────────────────────────────── */
bookSchema.virtual('shortDescription').get(function () {
  return this.description ? `${this.description.slice(0, 140)}${this.description.length > 140 ? '…' : ''}` : '';
});

/* ── Hooks ─────────────────────────────────────────── */
// Trim & deduplicate authors list before save
bookSchema.pre('save', function (next) {
  if (this.authors && Array.isArray(this.authors)) {
    this.authors = [...new Set(this.authors.map((a) => a.trim()))];
  }
  next();
});

module.exports = mongoose.model('Book', bookSchema);
