// routes/auth.js
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Redirect to Google login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Google OAuth callback route
router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/login'  // Handle failed authentication
}), (req, res) => {
  // Generate a JWT token for the user after Google authentication
  const token = jwt.sign(
    { email: req.user.email, id: req.user._id, admin: true},
    process.env.JWT_KEY,
    { expiresIn: '1h' } // Optional: Set token expiration
  );
  // Send the JWT token as a response or set it as a cookie
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' }); // Set httpOnly for security
  res.redirect('/index'); // Redirect to admin dashboard or wherever needed
});

// Admin logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

module.exports = router;
