require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== MONGODB CONNECTION =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ===== MODELS & ROUTES =====
const Book = require('./book');
const authRoutes = require('./auth');
app.use('/api/users', authRoutes);

// ===== AUTH MIDDLEWARE =====
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ===== BOOK ROUTES =====

// Add a book
app.post('/api/books', auth, async (req, res) => {
  const { title, authors } = req.body;
  if (!title || !Array.isArray(authors) || authors.length === 0) {
    return res.status(400).json({ error: 'Missing title or authors' });
  }

  try {
    const book = new Book({ ...req.body, user: req.userId });
    const saved = await book.save();
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user's books (with optional author filter)
app.get('/api/books', auth, async (req, res) => {
  const filter = { user: req.userId };

  if (req.query.author) {
    filter['authors.0'] = new RegExp(req.query.author, 'i');
  }

  try {
    const books = await Book.find(filter).sort({ createdAt: -1 });
    res.json(books);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Delete a book
app.delete('/api/books/:id', auth, async (req, res) => {
  try {
    const deleted = await Book.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Book not found or not owned by user' });

    res.json({ message: 'Book deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// ===== GOOGLE BOOKS SEARCH API =====
app.get('/api/search', async (req, res) => {
  const { q, filter, printType, orderBy, langRestrict } = req.query;

  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

  try {
    const params = {
      q,
      maxResults: 20,
      ...(filter && { filter }),
      ...(printType && { printType }),
      ...(orderBy && { orderBy }),
      ...(langRestrict && { langRestrict })
    };

    const response = await axios.get('https://www.googleapis.com/books/v1/volumes', { params });

    const books = (response.data.items || []).map(item => ({
      id: item.id,
      title: item.volumeInfo.title || 'Untitled',
      authors: item.volumeInfo.authors || [],
      description: item.volumeInfo.description || '',
      rating: item.volumeInfo.averageRating ?? null,
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
      infoLink: item.volumeInfo.infoLink || '',
      genre: (item.volumeInfo.categories || [])[0] || ''
    }));

    res.json(books);
  } catch (err) {
    console.error('Google Books API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch books from Google Books' });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
