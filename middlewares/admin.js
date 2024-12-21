const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware to validate admin access
async function validateAdmin(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/admin/login"); // Redirect to login if no token
    }

    // Verify token
    const data = jwt.verify(token, process.env.JWT_KEY);

    // Check if the user is an admin
    if (!data.admin) {
      return res.status(403).send("Access denied. Admins only.");
    }

    req.user = data; // Attach user data to request
    next();
  } catch (error) {
    console.error("Token verification failed:", error);

    if (error.name === "TokenExpiredError") {
      return res.redirect("/admin/login?error=token_expired"); // Handle expired tokens
    }

    res.redirect("/admin/login");
  }
}

// Middleware to check if user is logged in
async function userIsloggedin(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}

module.exports = { validateAdmin, userIsloggedin };
