const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models/user');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Passport Google OAuth configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:4000/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if the User exists or create a new one
    let user = await User.findOne({ email: profile.emails[0].value });

    if (!user) {
      user = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        role: 'User', // Set default role
      });
      await user.save();
    }

    // Generate a JWT token for the user
    const token = jwt.sign(
      { email: user.email, id: user._id, user: true }, 
      process.env.JWT_KEY,
      { expiresIn: '1h' } // Optional: Set token expiration
    );

    // Return user info and token
    done(null, user, { token });
  } catch (error) {
    done(error, false);
  }
}));

// Serialize user for session management
passport.serializeUser((user, done) => {
  done(null, user.id); // Using `user.id` for the session
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});
