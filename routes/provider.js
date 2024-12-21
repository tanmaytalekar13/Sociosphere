const express = require("express");
const router = express.Router();
const { Provider, providerValidationSchema } = require("../models/provider");
const {
  Request,
  requestValidationSchema,
} = require("../models/provider_request");
const Joi = require("joi");
const { Category } = require("../models/category");
const mongoose = require("mongoose");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validateProvider } = require("../middlewares/provider");
const upload=require("../config/multer");
const authenticateJWT=require("../middlewares/user")
const {User} = require("../models/user");
const supabase = require('../config/supabase');
const uploadController=require('../controllers/uploadProvider.controller')
const {Booking} = require('../models/booking');
const { BookingRequest } = require("../models/bookingRequest");
const VerificationToken = require('../models/VerificationToken'); 
// Middleware for validating MongoDB Object IDs
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).send("Invalid ID.");
  }
  next();
};
function disableCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}
// Use this middleware for all admin routes
router.use(disableCache);
// Get all providers
router.get("/", async (req, res) => {
 try {
  res.render("provider_login");
 } catch (error) {
  res.status(404).send(error.message);
 }
});

// Provider registration
const pendingVerifications = {};
// POST /register
router.post('/register', async (req, res) => {
  try {
    const { error } = providerValidationSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, password, contactNumber, address, category, charges, experience } = req.body;

    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) return res.status(400).json({ message: 'Provider already exists with this email' });

    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Save the token and data to the database
    await VerificationToken.create({
      token: verificationToken,
      data: {
        name,
        email,
        password,
        contactNumber,
        address,
        category,
        charges,
        experience,
      },
      createdAt: new Date(),
    });

    const verificationLink = `http://localhost:4000/provider/verify/${verificationToken}`;
    console.log('Verification Link:', verificationLink);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Please verify your email',
      text: `Click the following link to verify your email: ${verificationLink}`,
    };

    await transporter.sendMail(mailOptions);
    return res.status(201).send('Registration successful. Please check your email to verify your account.');
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(500).send('Server error');
  }
});

// GET /verify/:token
router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Find the verification entry using the token
    const verificationEntry = await VerificationToken.findOne({ token });
    if (!verificationEntry) return res.status(400).send('Invalid or expired token');

    // Extract provider data from the verification entry
    const providerData = verificationEntry.data;

    // Create a new Provider document
    const newProvider = new Provider({
      ...providerData,
      isVerified: true,
    });

    await newProvider.save();

    // Create a new Request document for the provider
    const request = new Request({
      provider: newProvider._id,
      category: providerData.category,
      status: 'pending',
    });

    await request.save();

    // Clean up the verification token after successful verification
    await VerificationToken.deleteOne({ token });

    res.status(200).send('Email verified successfully, and request created.');
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).send('Server error');
  }
});

router.get("/register", async (req, res) => {
  try {
    const categories = await Category.find();
    res.render("provider_register", { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching categories");
  }
});
// Provider login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password are required.");
  }

  try {
    // Find user by email
    const provider_user = await Provider.findOne({ email }).select("+password");
    if (!provider_user) {
      return res.status(401).send("User not found");
    }
    // Validate password
    const validPassword = await bcrypt.compare(password, provider_user.password);
    if (!validPassword) {
      return res.status(401).send("Invalid password");
    }

    // Generate token
    const token = jwt.sign(
      { email: provider_user.email, _id: provider_user._id },
      process.env.JWT_KEY
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
    });

    // Check if the provider has an image
    const provider = await Provider.findOne({ email });
    if (!provider.image) {
      return res.status(200).redirect("/provider/upload-Image");
    }

    // Check if the provider's availability array is empty
    if (provider.availability.length === 0) {
      return res.status(200).redirect("/provider/createAvailability");
    }

    // Redirect to dashboard if both conditions are met
    return res.status(200).redirect("/provider/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Failed to log in");
  }
});
router.get('/dashboard', validateProvider, async (req, res) => {
  try {
    // Ensure the provider data is available
    if (!req.provider) {
      return res.status(400).send("Provider data is missing");
    }

    // Fetch the provider and include the image field
    const provider = await Provider.findById(req.provider._id).populate('category');
    
    if (!provider) {
      return res.status(404).send('Provider not found');
    }
    // Render the provider dashboard with the provider data
    res.render('provider_dashboard', { provider });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});
router.post('/availability',validateProvider,async (req, res) =>{
  const { availability } = req.body;
  try {
      const provider = await Provider.findById(req.provider._id);
      if (!provider) {
          return res.status(404).send('Provider not found');
      }
      provider.availability = availability;

      await provider.save();

      res.status(200).redirect('/provider/upload-Image');
  } catch (error) {
      console.error(error);
      res.status(500).send('Error updating availability');
  }
})
router.get("/createAvailability",validateProvider,async (req, res) =>{
  try{
    res.render('createAvailability');
  }
  catch(error){
    console.error(error);
    res.status(500).send("Error fetching availability");
  }
})
router.get("/upload-Image",validateProvider,async (req, res) =>{
  try {
    res.render('uploadImage');
  } catch (error) {
    res.status(500).send("Error uploading image");
  }
})
router.post("/upload-Image", validateProvider, upload.single('image'), uploadController.uploadImage);
// Logout route
router.get("/logout", async (req, res) => {
  res.clearCookie("token"); // Clear the token cookie
  res.redirect("/provider/");
});
router.post('/update-profile',validateProvider , async (req, res) => {
  const { contact, experience, charges } = req.body;

  try {
      const provider = await Provider.findById(req.user._id); // Now req.user should be defined
      if (!provider) {
          return res.status(404).send('Provider not found');
      }

      provider.contactNumber = contact || provider.contactNumber;
      provider.experience = experience || provider.experience;
      provider.charges = charges || provider.charges;

      await provider.save();

      res.redirect('/provider/dashboard');
  } catch (error) {
      console.error(error);
      res.status(500).send('Error updating profile');
  }
});
router.post("/update-Image", validateProvider, upload.single('image'), uploadController.updateImage);
router.post('/delete-availability/:id',validateProvider ,async (req, res) => {
  try {
    const availabilityId = req.params.id;
    const provider = await Provider.findById(req.user._id);
    
    // Remove the availability from the provider's availability array
    provider.availability = provider.availability.filter(availability => availability._id.toString() !== availabilityId);
    await provider.save();
    
    res.redirect('/provider/dashboard'); // Redirect to the dashboard or availability page
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});
router.post('/update-availability', validateProvider, async (req, res) => {
  const { availabilityId, startTime, endTime } = req.body;

  try {
      const provider = await Provider.findById(req.user._id);
      if (!provider) {
          return res.status(404).send('Provider not found');
      }

      // Find the availability item by its ID
      const availability = provider.availability.find(item => item._id.toString() === availabilityId);
      
      // If availability item doesn't exist, handle the case
      if (!availability) {
          return res.status(404).send('Availability not found');
      }

      // Update the startTime and endTime if provided
      availability.startTime = startTime || availability.startTime;
      availability.endTime = endTime || availability.endTime;

      await provider.save();

      res.redirect('/provider/dashboard');
  } catch (error) {
      console.error(error);
      res.status(500).send('Error updating availability');
  }
});
router.post('/add-availability', validateProvider, async (req, res) => {
  const { day, startTime, endTime } = req.body;

  // Check if the provider already has availability for the same day and time
  const existingAvailability = await Provider.findOne({
    'availability.day': day,
    'availability.startTime': startTime,
    'availability.endTime': endTime
  });

  if (existingAvailability) {
    // If the same availability exists, send a response with an error message
    return res.status(400).json({ message: 'Availability for this day and time already exists!' });
  }

  // Proceed to add the new availability
  const newAvailability = { day, startTime, endTime, slots: [] };
  await Provider.updateOne(
    { _id: req.provider._id },
    { $push: { availability: newAvailability } }
  );

  res.redirect('/provider/dashboard');
});

router.get("/queue", validateProvider, async (req, res) => {
  try {
    console.log(req.user)
    const provider = await Provider.findById(req.user._id); // Now req.user should be defined
      if (!provider) {
          return res.status(404).send('Provider not found');
      }
   res.render('provider_queue',{provider: provider})
  } catch (err) {
    res.status(500).send("Failed to fetch providers.");
  }
});
router.post("/queue/status", validateProvider, async (req, res) => {
  const { status ,id} = req.body;
  const bookingId = id;
  try {
    // Find the provider from the logged-in user
    const provider = await Provider.findById(req.user._id);
    if (!provider) {
      return res.status(404).send('Provider not found');
    }

    // First, try to find the booking by ID
    let booking = await Booking.findById(bookingId);

    if (!booking) {
      // If not found in Booking, check in BookingRequest
      booking = await BookingRequest.findById(bookingId);
      if (!booking) {
        return res.status(404).send('Booking not found');
      }
    }

    // Update the booking's queue status
    booking.status = status;
    await booking.save();

    // Respond with a success message
    res.status(200).json({
      success: true,
      message: 'Status updated successfully'
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status"
    });
  }
})
router.get("/profile/:id",authenticateJWT, async (req, res) => {
  try {
      // Fetch provider details using the provided id
      const provider = await Provider.findById(req.params.id).select('-password -profileApprovedByAdmin');  // Exclude password and profileApprovedByAdmin
      const userEmail = req.user.email; 
    
      // यूज़र मॉडल से उस ईमेल के आधार पर यूज़र को ढूंढें
      const user = await User.findOne({ email: userEmail });
      
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // यूज़र का नाम प्राप्त करें
      const userName = user.name;
      
      // If provider is not found, return 404 error
      if (!provider) {
          return res.status(404).send('Provider not found');
      }
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);
    
        // Get the search term from the query string
        const searchTerm = req.query.search || "";
    
        // Fetch providers with filtering based on the search term (case-insensitive search)
        let providers = await Provider.find({ category: categoryId });
    
        if (searchTerm) {
          providers = providers.filter(provider =>
            provider.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            provider.description.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
    
        // Convert image Buffer to Base64
        providers = providers.map((provider) => {
          return {
            ...provider._doc,
            image: provider.image || null, // Use the URL directly if it exists
          };
        });
    
        // Fetch categories with filtering based on the search term
        const categories = await Category.find({
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { description: { $regex: searchTerm, $options: "i" } },
          ],
        });
    
        if (!categories || categories.length === 0) {
          return res.render("index", { categories: [], searchTerm,userName  });
        }
    
        res.render("provider_profile", {
          category,
          providers,
          categories,
          searchTerm,
          provider,
          userName  
        });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});
router.post("/portfolio",validateProvider,upload.single('file'),uploadController.Portfolio)
router.get("/portfolio",validateProvider,async(req,res)=>{
  try{
    const provider = await Provider.findById(req.user._id);
    if (!provider) {
        return res.status(404).send('Provider not found');
    }
    res.render('Portfolio-provider',{provider: provider})
  }
  catch(err){
    res.status(500).send("Failed to fetch providers.");
  }
})
// Assuming you have a model like Portfolio
router.delete("/portfolio/delete", validateProvider, uploadController.PortfolioDelete);
router.get("/profile",validateProvider,async(req,res)=>{
  try{
    if (!req.provider) {
      return res.status(400).send("Provider data is missing");
    }

    // Fetch the provider and include the image field
    const provider = await Provider.findById(req.provider._id).populate('category');
    
    if (!provider) {
      return res.status(404).send('Provider not found');
    }
    res.render('ProviderProfile',{provider: provider})
  }
  catch(err){
    res.status(500).send("Failed to fetch providers.");
  }
})
module.exports = router;
