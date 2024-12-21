const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
require('dotenv').config();

const { Admin } = require('../models/admin');
const { Category } = require('../models/category');
const { Provider } = require('../models/provider');
const { Request } = require('../models/provider_request');
const { User } = require('../models/user');
const { validateAdmin } = require('../middlewares/admin');

// Middleware to disable caching
function disableCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}

// Use this middleware for all admin routes
router.use(disableCache);

// Development-only route for creating an admin
if (process.env.NODE_ENV === "development") {
  router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
  
    if (!name || !email || !password) {
      return res.status(400).send("Please provide name, email, and password");
    }
  
    try {
      // Check if the user already exists
      const existingUser = await Admin.findOne({ email});
      if (existingUser) {
        return res.status(400).send("User already exists");
      }
  
      // Generate salt and hash the password
      const salt = await bcrypt.genSalt(10);  // Generate salt with 10 rounds
      const hashedPassword = await bcrypt.hash(password, salt);  // Hash the password
  
      // Create a new user
      const user = new Admin({
        name,
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: "admin",  // You can adjust the role based on your requirements
      });
  
      // Save the user to the database
      await user.save();
  
      // Generate JWT token
      const token = jwt.sign({ email: user.email, id: user._id, admin: true }, process.env.JWT_KEY);
  
      // Send the token in a cookie
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  
      // Send success response
      res.status(201).send("Admin registered successfully");
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).send(error.message);
    }
  });
  
}


// Admin login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Check if both email and password are provided
  if (!email || !password) {
    return res.status(400).send("Please provide both email and password");
  }

  try {
    // Find the user by email (trim and convert to lowercase to avoid case sensitivity issues)
    const user = await Admin.findOne({ email: email.trim().toLowerCase() });

    // If user is not found, return an error
    if (!user) {
      console.log("User not found for email:", email); // Debugging log
      return res.status(401).send("Invalid email or password");
    }

    console.log("User found:", user.email); // Log the user

    // Debugging the password comparison
    const validPassword = await bcrypt.compare(password, user.password);
    console.log("Stored password:", user.password); // Log the stored hashed password
    console.log("Entered password:", password); // Log the entered password
    console.log("Password match result:", validPassword); // Log the result

    if (!validPassword) {
      console.log("Password does not match");
      return res.status(401).send("Invalid email or password");
    }

    // Generate JWT token
    const token = jwt.sign({ email: user.email, id: user._id, admin: true }, process.env.JWT_KEY);

    // Send token in a cookie (httpOnly and secure for production)
    res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    // Redirect to the admin dashboard or send a success message
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send(error.message);
  }
});

// Render login page
router.get('/login', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.render('admin_login');
});

// Admin logout
router.get('/logout', (req, res) => {
  res.clearCookie("token");
  res.redirect('/admin/login');
});

// View pending requests
// Approve or reject a provider request
router.post('/requests/:requestId/approve', validateAdmin, async (req, res) => {
  const { requestId } = req.params;
  const { status, feedback } = req.body;

  console.log('Incoming request:', { requestId, status, feedback }); // Debugging log

  try {
    const schema = Joi.object({
      status: Joi.string().valid('approved', 'rejected').required(),
      feedback: Joi.string().allow('').optional(), // Accept empty feedback
    });

    const { error } = schema.validate({ status, feedback });
    if (error) return res.status(400).send(error.details[0].message);

    // Find the request by requestId
    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).send('Request not found');
    }

    // Assuming the request has a reference to the provider, update the provider's status
    const provider = await Provider.findById(request.provider);
    if (!provider) {
      return res.status(404).send('Provider not found');
    }

    // Update the status of the request and the provider
    request.status = status;
    provider.status = status;

    if (status === 'rejected') {
      request.feedback = feedback || 'No feedback provided';
    }

    // Save the updated request and provider
    await request.save();
    await provider.save();

    res.status(200).send('Request and provider status updated successfully');
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).send('Internal Server Error');
  }
});
// Dashboard route
router.get('/dashboard', validateAdmin, async (req, res) => {
  try {
    const total_Providers = await Provider.countDocuments();
    const total_Users = await User.countDocuments();
    const total_Categories = await Category.countDocuments();

    const providers = await Provider.find().populate('category');
    const categories = await Category.find();
    const requests = await Request.find({ status: 'pending' })
      .populate('provider')
      .populate('category');

    res.render('admin_dashboard', { 
      providers, 
      requests, 
      categories, 
      total_Providers,
      total_Users,
      total_Categories 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving data for the dashboard.");
  }
});
router.get('/categories',validateAdmin, async (req, res) => {
  try {
    const categories = await Category.find();
    res.render('categaryfunctions',{categories})
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching categories");
  }
})
router.get('/requests',validateAdmin, async (req, res) => {
  try {
    const requests = await Request.find({ status: 'pending' })
      .populate('provider')
      .populate('category'); 
    res.render('Request',{
      requests
    })
  } catch (error) {
    res.status(500).send("Error fetching requests");
  }
})
router.get('/requests/:id/profile', validateAdmin, async (req, res) => {
  const providerId = req.params.id;

  try {
    // Find the provider and populate the category field
    const provider = await Provider.findById(providerId).populate('category');
    if (!provider) {
      return res.status(404).send("Provider not found");
    }

    res.render('Pprofile', { provider });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching provider details");
  }
});
router.get('/contact', validateAdmin, async (req, res)=>{
  try {
    res.render('contact')
  } catch (error) {
    console.error(error);
  }
})
module.exports = router;
