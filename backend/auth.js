const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const router = express.Router();

// ===== User Schema =====
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/.+@.+\..+/, 'Invalid email format']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  }
});

const User = mongoose.model('User', userSchema);

// ===== Signup Route =====
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashed
    }).save();

    req.session.userId = newUser._id;  // Create session after registration
    res.status(201).json({ message: 'User registered and logged in' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ===== Login Route =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user._id;  // Set session
    res.json({ message: 'Logged in successfully' });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ===== Logout Route =====
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err.message);
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// ===== Get Current User =====
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ user: null });

    const user = await User.findById(req.session.userId).select('-password');
    res.json({ user });
  } catch (err) {
    console.error('Error getting user:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
