const jwt = require('jsonwebtoken');
require('dotenv').config(); // Ensure your `.env` file is loaded

const authenticateJWT = (req, res, next) => {
  // Get the token from cookies or Authorization header
  const token =
    req.cookies?.token || req.headers['authorization']?.split(' ')[1];

  // If no token is found, return unauthorized error
  if (!token) {
    return res.status(401).json({ error: 'Access Denied. Token missing.' });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_KEY, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Attach the user information to req
    req.user = decodedUser;
    next(); // Pass control to the next middleware or route handler
  });
};

module.exports = authenticateJWT;
