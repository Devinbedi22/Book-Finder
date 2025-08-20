require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));


const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); 

app.use(session({
  secret: process.env.SESSION_SECRET || 'yoursecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    httpOnly: true,
    secure: isProduction,        
    sameSite: isProduction ? 'none' : 'lax', 
    maxAge: 1000 * 60 * 60 * 24
  }
}));




app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(cors({
  credentials: true,
}));
app.use(express.json());


const Book = require('./book');
const authRoutes = require('./auth');
app.use('/api/users', authRoutes);


const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};




app.post('/api/books', requireLogin, async (req, res) => {
  const { title, authors } = req.body;
  if (!title || !Array.isArray(authors) || authors.length === 0) {
    return res.status(400).json({ message: 'Title and at least one author are required' });
  }

  try {
    const book = new Book({ ...req.body, user: req.session.userId });
    const saved = await book.save();
    res.status(201).json(saved);
  } catch (e) {
    console.error('Add Book Error:', e.message);
    res.status(500).json({ message: 'Failed to save book' });
  }
});


app.get('/api/books', requireLogin, async (req, res) => {
  const filter = { user: req.session.userId };
  if (req.query.author) {
    filter['authors.0'] = new RegExp(req.query.author, 'i');
  }

  try {
    const books = await Book.find(filter).sort({ createdAt: -1 });
    res.json(books);
  } catch (e) {
    console.error('Get Books Error:', e.message);
    res.status(500).json({ message: 'Failed to fetch books' });
  }
});


app.delete('/api/books/:id', requireLogin, async (req, res) => {
  try {
    const deleted = await Book.findOneAndDelete({ _id: req.params.id, user: req.session.userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Book not found or not owned by user' });
    }

    res.json({ message: 'Book deleted' });
  } catch (e) {
    console.error('Delete Book Error:', e.message);
    res.status(500).json({ message: 'Failed to delete book' });
  }
});


app.get('/api/search', async (req, res) => {
  const { q, filter, printType, orderBy, langRestrict } = req.query;
  if (!q) return res.status(400).json({ message: 'Missing query parameter "q"' });

  try {
    const params = {
      q,
      maxResults: 20,
      ...(filter && { filter }),
      ...(printType && { printType }),
      ...(orderBy && { orderBy }),
      ...(langRestrict && { langRestrict }),
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
      genre: (item.volumeInfo.categories || [])[0] || '',
    }));

    res.json(books);
  } catch (err) {
    console.error('Google Books API error:', err.message);
    res.status(500).json({ message: 'Failed to fetch books from Google Books API' });
  }
});


const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
