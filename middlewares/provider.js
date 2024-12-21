const jwt = require("jsonwebtoken");
const { Provider } = require('../models/provider'); // Adjust the path as needed
require("dotenv").config();

async function validateProvider(req, res, next) {
  try {
    // Get the token from the cookies
    let token = req.cookies.token;
    if (!token) {
      return res.status(401).redirect("/provider/");
    }

    // Verify the token
    let data = jwt.verify(token, process.env.JWT_KEY);
    req.user = data;

    // Fetch the provider details from the database using the user ID
    const provider = await Provider.findById(req.user._id);
    if (!provider) {
      return res.status(404).send("Provider not found");
    }

    // Attach the provider data to the request object
    req.provider = provider;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(401).send("Unauthorized access");
  }
}
async function validaterole(req, res, next) {
  if(req.user.role!=='provider'){
    return res.status(403).send("Access denied. Only providers can access this route.");
  }
  next();
}

module.exports = { validateProvider,validaterole };
