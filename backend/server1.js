/* ------------------------------------------------------------------
   server1.js – Full‑stack Book‑Tracker API (updated)
   Improvements
   ────────────
   • Added Helmet + morgan + express‑rate‑limit for security / logging
   • Centralised CORS with explicit allow‑list (fallback '*')
   • Uses GOOGLE_BOOKS_API_KEY if provided (env) and supports pagination
   • Better JWT error handling + reusable auth middleware helper
   • Graceful handling of invalid Mongo ObjectId
   • Single front‑end static folder (configurable via FRONTEND_DIR env)
------------------------------------------------------------------ */
require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const axios    = require('axios');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const helmet   = require('helmet');
const morgan   = require('morgan');
const rateLimit= require('express-rate-limit');

const app = express();

/* ────────────────────────────────────────────────────────────────── */
/* 1. Global Middleware                                             */
/* ────────────────────────────────────────────────────────────────── */
app.use(helmet());                          // sets secure HTTP headers
app.use(morgan('dev'));                     // request logging
app.use(express.json({ limit: '10kb' }));   // parse JSON (limit 10 KB)

/* CORS – allow only frontend origin if provided */
const ALLOW_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: ALLOW_ORIGIN }));

/* Basic rate‑limiting (100 req / 15 min per IP) */
app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 100, standardHeaders: true }));

/* Static files (frontend) – fallback to ../frontend */
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

/* ────────────────────────────────────────────────────────────────── */
/* 2. Database                                                      */
/* ────────────────────────────────────────────────────────────────── */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/book-tracker';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('✅ MongoDB connected'))
  .catch(err=>{
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

/* ────────────────────────────────────────────────────────────────── */
/* 3. Models & Routes                                               */
/* ────────────────────────────────────────────────────────────────── */
const Book = require('./book');
const authRoutes = require('./auth');

app.use('/api/users', authRoutes);

/* ── JWT Auth middleware helper ─────────────────────────────────── */
const auth = (req,res,next)=>{
  const authHeader = req.headers.authorization;
  if(!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message:'Access denied: No token.'});
  const token = authHeader.split(' ')[1];
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  }catch(err){
    return res.status(401).json({ message:'Invalid or expired token' });
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* 4. Book CRUD                                                     */
/* ────────────────────────────────────────────────────────────────── */
// Add a book
app.post('/api/books', auth, async (req,res)=>{
  const { title, authors } = req.body;
  if(!title || !Array.isArray(authors) || authors.length===0)
    return res.status(400).json({ message:'Title and at least one author are required' });
  try{
    const book = new Book({ ...req.body, user: req.userId });
    const saved = await book.save();
    res.status(201).json(saved);
  }catch(err){
    console.error('Add Book Error:', err);
    res.status(500).json({ message:'Failed to save book'});
  }
});

// Get books (optionally filter by author)
app.get('/api/books', auth, async (req,res)=>{
  const filter={ user:req.userId };
  if(req.query.author) filter['authors.0'] = new RegExp(req.query.author,'i');
  try{
    const books = await Book.find(filter).sort({ createdAt:-1 });
    res.json(books);
  }catch(err){
    console.error('Get Books Error:', err);
    res.status(500).json({ message:'Failed to fetch books' });
  }
});

// Delete a book by ID
app.delete('/api/books/:id', auth, async (req,res)=>{
  const { id } = req.params;
  if(!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message:'Invalid book ID' });
  try{
    const deleted = await Book.findOneAndDelete({ _id:id, user:req.userId });
    if(!deleted) return res.status(404).json({ message:'Book not found or not owned by user' });
    res.json({ message:'Book deleted' });
  }catch(err){
    console.error('Delete Book Error:', err);
    res.status(500).json({ message:'Failed to delete book' });
  }
});

/* ────────────────────────────────────────────────────────────────── */
/* 5. Google Books Proxy Search                                     */
/* ────────────────────────────────────────────────────────────────── */
app.get('/api/search', async (req,res)=>{
  const { q, filter, printType, orderBy, langRestrict, startIndex = 0 } = req.query;
  if(!q) return res.status(400).json({ message:'Missing query parameter "q"' });

  try{
    const params = {
      q,
      maxResults: 20,
      startIndex: Number(startIndex),
      ...(filter && { filter }),
      ...(printType && { printType }),
      ...(orderBy && { orderBy }),
      ...(langRestrict && { langRestrict }),
      ...(process.env.GOOGLE_BOOKS_API_KEY && { key: process.env.GOOGLE_BOOKS_API_KEY })
    };

    const { data } = await axios.get('https://www.googleapis.com/books/v1/volumes', { params });

    const books = (data.items || []).map(item=>({
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
  }catch(err){
    console.error('Google Books API error:', err.response?.data || err.message);
    res.status(500).json({ message:'Failed to fetch books from Google Books API' });
  }
});

/* ────────────────────────────────────────────────────────────────── */
/* 6. Frontend Fallback (SPA)                                       */
/* ────────────────────────────────────────────────────────────────── */
app.get(/^\/(?!api).*/, (req,res)=>{
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

/* ────────────────────────────────────────────────────────────────── */
/* 7. Start Server                                                 */
/* ────────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>{
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
