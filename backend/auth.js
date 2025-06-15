const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2 },
  email: { type: String, required: true, unique: true, lowercase: true, match: [/.+@.+\..+/, 'Invalid email'] },
  password: { type: String, required: true, minlength: 6 }
});
const User = mongoose.model('User', userSchema);

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'All fields are required' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 chars' });
  if (await User.findOne({ email })) return res.status(409).json({ message: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  await new User({ username, email, password: hash }).save();
  res.status(201).json({ message: 'User created' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user) return res.status(401).json({ message: 'Invalid creds' });
  if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Invalid creds' });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;
