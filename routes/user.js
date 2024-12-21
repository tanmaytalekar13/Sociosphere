const express = require("express");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { User, userValidationSchema } = require("../models/user");
const { Category } = require("../models/category");
const { Booking, bookingValidationSchema } = require("../models/booking");
const { Provider } = require("../models/provider");
const { BookingRequest } = require("../models/bookingRequest");
const authenticateJWT = require("../middlewares/user");
const twilio = require('twilio');
require("dotenv").config();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { console } = require("inspector");
const axios=require("axios");
const router = express.Router();

function disableCache(req, res, next) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
}

// Use this middleware for all admin routes
router.use(disableCache);

// User Registration
const pendingVerifications = {}; // Temporary in-memory store

router.post('/register', async (req, res) => {
  const { name, email, password, contactNumber, address } = req.body;

  const { error } = userValidationSchema.validate({
    name,
    email,
    password,
    contactNumber,
    address,
  });
  if (error) return res.status(400).send(error.details[0].message);

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('User already exists with this email.');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Temporarily store the user data with verificationToken
    pendingVerifications[verificationToken] = {
      name,
      email,
      password,
      contactNumber,
      address,
      isVerified: false,
    };

    const verificationLink = `http://localhost:4000/verify/${verificationToken}`;
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

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully');
      res
        .status(201)
        .send('Registration successful. Please check your email to verify your account.');
    } catch (error) {
      console.error('Error sending email:', error.message);
      delete pendingVerifications[verificationToken]; // Clean up on failure
      return res.status(500).send('Error sending email');
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).send('Server error');
  }
});

// GET /verify/:token route
router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const userData = pendingVerifications[token];
    if (!userData) {
      console.error('Token not found:', token);
      return res.status(400).send('Invalid or expired token');
    }

    // Save the user to the database
    const newUser = new User({
      ...userData,
      verificationToken: null,
      isVerified: true,
    });

    await newUser.save();
    
    // Clean up the temporary store
    delete pendingVerifications[token];

    res.status(200).send('Email verified successfully');
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).send('Server error');
  }
});
// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password are required.");
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).send("User not found.");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).send("Invalid password.");
    }

    // Generate JWT token
    const token = jwt.sign(
      { email: user.email, _id: user._id },
      process.env.JWT_KEY,
      { expiresIn: "1h" } // Set expiration time
    );

    // Set cookie or return token directly
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Ensure cookie works in development too
    });
    console.log(token);
    // Redirect to the index page after login
    res.redirect("/index");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Failed to log in.");
  }
});
// User Logout
router.get("/logout", async (req, res) => {
  res.clearCookie("token"); // Clear the token cookie
  res.redirect("/"); // Redirect to home page after logout
});
// Views
router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("userLogin");
});
router.get("/book/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params; // Provider ID
  const userId = req.user.id; // Authenticated user ID
  const userEmail = req.user.email; // Authenticated user email

  try {
    // Find the user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Get user's name, contact number, and address
    const userName = user.name;
    let userContact = user.contactNumber;
    let useraddress = user.address;

    if (!userContact || userContact.length !== 10) {
      userContact = "";
    }
    if (!useraddress) {
      useraddress = "";
    }

    // Find the provider by ID and populate category
    const provider = await Provider.findById(id).populate("category", "name");
    if (!provider) {
      return res.status(404).send("Provider not found");
    }

    // Prepare provider data
    const providerData = {
      ...provider._doc,
      image: provider.image || null, 
    };

    // Prepare availability data
    const availableDays = provider.availability.map((avail) => ({
      day: avail.day,
      startTime: avail.startTime,
      endTime: avail.endTime,
    }));

    // Day mapping and unavailable days calculation
    const dayMapping = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const allDays = Object.keys(dayMapping);
    const availableDayNames = availableDays.map((day) => day.day);
    const unavailableDays = allDays.filter(
      (day) => !availableDayNames.includes(day)
    );
    const unavailableDaysIndexes = unavailableDays.map(
      (day) => dayMapping[day]
    );

    const result = [0, ...unavailableDaysIndexes];

    // Fetch all bookings for the provider and populate the user field
    const bookings = await Booking.find({ provider: provider._id }).populate(
      "user",
      "name"
    );

    // Determine the queue data
    const queueData = bookings.length
      ? bookings.map((booking) => ({
          userName: booking.user ? booking.user.name : "Unknown User",
          userContact: booking.contactNumber || "N/A",
          queuePosition: booking.queuePosition,
          date: booking.date,
          complexity: booking.complexity,
          time: booking.time,
          status: booking.status,
        }))
      : [];
      const estimatedWaitTime = calculateEstimatedWaitTime(queueData);
      function calculateEstimatedWaitTime(queueData) {
        let simpleCount = 0;
        let moderateCount = 0;
        let complexCount = 0;
        let superComplexCount = 0;
      
        // Count the number of bookings for each complexity level
        queueData.forEach(booking => {
          switch (booking.complexity) {
            case 'simple':
              simpleCount++;
              break;
            case 'moderate':
              moderateCount++;
              break;
            case 'complex':
              complexCount++;
              break;
            case 'super complex':
              superComplexCount++;
              break;
          }
        });
      
        // Calculate total wait time (in hours) for each complexity level
        const simpleWaitTime = simpleCount * 1; // 1 hour per simple booking
        const moderateWaitTime = moderateCount * (1 + 3) / 2; // Average of 1-3 hours per moderate booking
        const complexWaitTime = complexCount * (3 + 5) / 2; // Average of 3-5 hours per complex booking
        const superComplexWaitTime = superComplexCount * (5 + 7) / 2; // Average of 5-7 hours per super complex booking
      
        // Calculate total number of bookings
        const totalBookings = simpleCount + moderateCount + complexCount + superComplexCount;
      
        // Set buffer time based on whether the queue is empty or not
        let bufferTime = totalBookings === 0 ? 1 : 1.5;
      
        // Calculate total estimated wait time
        const totalWaitTime = simpleWaitTime + moderateWaitTime + complexWaitTime + superComplexWaitTime + bufferTime;
      
        return totalWaitTime;
      }
      
    // Render the booking page
    res.render("book", {
      provider: {
        _id: providerData._id,
        name: providerData.name,
        categoryName: providerData.category.name,
        charges: providerData.charges,
        image: providerData.image,
        experience: providerData.experience,
      },
      availableDays,
      result,
      queueData, // Pass the queue data
      queueSize: bookings.length, // Size of the queue
      userName,
      userContact,
      useraddress,
      userId,
      userEmail,
      estimatedWaitTime
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching provider details");
  }
});
router.get("/queue/size/:id/:date", authenticateJWT, async (req, res) => {
  const { id } = req.params; // Provider ID
  const date = new Date(req.params.date); // Date passed from the client

  try {
    // Find all bookings for the provider on the given date
    const bookings = await Booking.find({
      provider: id,
      date: { $eq: date }
    }).populate("user", "name");

    // Find all booking requests for the provider on the given date
    const bookingRequests = await BookingRequest.find({
      provider: id,
      date: { $eq: date }
    }).populate("user", "name");

    // Combine both bookings and booking requests
    const combinedData = [...bookings, ...bookingRequests];

    // Calculate the queue size and positions
    const queueData = combinedData.map((item, index) => ({
      userName: item.user ? item.user.name : "Unknown User",
      userContact: item.contactNumber || "N/A",
      queuePosition: index + 1, // Position in the queue (1-based index)
      date: item.date,
      complexity: item.complexity,
      time: item.time,
      status: item.status,
      _id: item._id,
      address: item.address
    }));

    const estimatedWaitTime = calculateEstimatedWaitTime(queueData);

    res.json({
      queueSize: queueData.length,
      queueData,
      estimatedWaitTime 
    });

    function calculateEstimatedWaitTime(queueData) {
      let simpleCount = 0;
      let moderateCount = 0;
      let complexCount = 0;
      let superComplexCount = 0;
    
      // Count the number of bookings for each complexity level
      queueData.forEach(item => {
        switch (item.complexity) {
          case 'simple':
            simpleCount++;
            break;
          case 'moderate':
            moderateCount++;
            break;
          case 'complex':
            complexCount++;
            break;
          case 'super complex':
            superComplexCount++;
            break;
        }
      });
    
      // Calculate total wait time (in hours) for each complexity level
      const simpleWaitTime = simpleCount * 1; // 1 hour per simple booking
      const moderateWaitTime = moderateCount * (1 + 2) / 2; // Average of 1-3 hours per moderate booking
      const complexWaitTime = complexCount * (3 + 5) / 2; // Average of 3-5 hours per complex booking
      const superComplexWaitTime = superComplexCount * (5 + 9) / 2; // Average of 5-7 hours per super complex booking
    
      // Buffer time in hours (e.g., 1-1.5 hours)
      const bufferTime = 1.5;
    
      // Calculate total estimated wait time
      const totalWaitTime = simpleWaitTime + moderateWaitTime + complexWaitTime + superComplexWaitTime + bufferTime;
    
      return totalWaitTime;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching queue data" });
  }
});
router.get("/queue/size/:id/:date/page", authenticateJWT, async (req, res) => {
  const { id } = req.params; // Provider ID
  const date = new Date(req.params.date); // Date passed from the client

  try {
    // Ensure that the date is at midnight (start of the day) for proper comparison
    date.setHours(0, 0, 0, 0);

    // First, try to find bookings in the BookingRequest model
    let bookingsRequest = await BookingRequest.find({
      provider: id,
      date: { $gte: date, $lt: new Date(date).setHours(24, 0, 0, 0) } // Date range for the full day
    }).populate("user", "name");

    // Then, try the Booking model
    let bookings = await Booking.find({
      provider: id,
      date: { $gte: date, $lt: new Date(date).setHours(24, 0, 0, 0) } // Date range for the full day
    }).populate("user", "name");

    // Combine both BookingRequest and Booking data
    const combinedBookings = [...bookingsRequest, ...bookings];

    // If no bookings were found, return an empty response
    if (combinedBookings.length === 0) {
      return res.json({
        queueSize: 0,
        queueData: [],
        estimatedWaitTime: 0
      });
    }

    // Calculate the queue size and positions
    const queueData = combinedBookings.map((booking, index) => ({
      userName: booking.user ? booking.user.name : "Unknown User",
      userContact: booking.contactNumber || "N/A",
      queuePosition: index + 1, // Position in the queue (1-based index)
      date: booking.date,
      complexity: booking.complexity,
      time: booking.time,
      status: booking.status,
      _id: booking._id
    }));

    // Calculate the estimated wait time
    const estimatedWaitTime = calculateEstimatedWaitTime(queueData);

    res.json({
      queueSize: queueData.length,
      queueData,
      estimatedWaitTime
    });

    function calculateEstimatedWaitTime(queueData) {
      let simpleCount = 0;
      let moderateCount = 0;
      let complexCount = 0;
      let superComplexCount = 0;

      // Count the number of bookings for each complexity level
      queueData.forEach(booking => {
        switch (booking.complexity) {
          case 'simple':
            simpleCount++;
            break;
          case 'moderate':
            moderateCount++;
            break;
          case 'complex':
            complexCount++;
            break;
          case 'super complex':
            superComplexCount++;
            break;
        }
      });

      // Calculate total wait time (in hours) for each complexity level
      const simpleWaitTime = simpleCount * 1; // 1 hour per simple booking
      const moderateWaitTime = moderateCount * (1 + 2) / 2; // Average of 1-3 hours per moderate booking
      const complexWaitTime = complexCount * (3 + 5) / 2; // Average of 3-5 hours per complex booking
      const superComplexWaitTime = superComplexCount * (5 + 9) / 2; // Average of 5-7 hours per super complex booking

      // Buffer time in hours (e.g., 1-1.5 hours)
      const bufferTime = 1.5;

      // Calculate total estimated wait time
      const totalWaitTime = simpleWaitTime + moderateWaitTime + complexWaitTime + superComplexWaitTime + bufferTime;

      return totalWaitTime;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching queue data" });
  }
});
// POST Route (Handle Booking)
router.post("/book/instant/:providerid/:userId", authenticateJWT, async (req, res) => {
  const { userContact, complexity, totalAmount, useraddress, transactionId } = req.body;

  if (!userContact || !complexity || !totalAmount || !useraddress) {
    return res.status(400).send("Missing required fields");
  }

  try {
    const provider = await Provider.findById(req.params.providerid);
    if (!provider) return res.status(404).send("Provider not found");

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).send("User not found");

    const currentDateTime = new Date();

    const conflict = await Booking.checkConflict(
      provider._id,
      currentDateTime.toDateString(),
      currentDateTime.toTimeString()
    );

    if (conflict) return res.status(400).send("Time slot is already booked");

    const queueCount = await Booking.countDocuments({
      provider: provider._id,
      status: { $in: ["queued", "pending"] },
    });

    const booking = new Booking({
      user: req.params.userId,
      provider: req.params.providerid,
      category: provider.category,
      contactNumber: userContact,
      date: currentDateTime.toDateString(),
      time: currentDateTime.toTimeString(),
      address: useraddress,
      complexity,
      totalAmount,
      queueEnteredAt: currentDateTime,
      queuePosition: queueCount + 1,
      paymentDetails: { transactionId },
    });

    await booking.save();

    // Booking details to be sent via SMS
    const bookingDetails = `Booking ID: ${booking._id}, Provider: ${provider.name}, Date: ${currentDateTime.toDateString()}, Time: ${currentDateTime.toTimeString()}`;

    // Call SMS endpoint
    await axios.post('http://localhost:4000/booking/book-success', {
      phoneNumber: '91'+userContact,
      bookingDetails: bookingDetails
    })
    .then(response => {
      console.log("SMS sent successfully", response.data);
    })
    .catch(error => {
      console.error("Error sending SMS:", error.response ? error.response.data : error.message);
    });
    
    return res.redirect(`/ThankYou/${booking._id}`);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error creating booking");
  }
});
router.post("/book/schedule/:providerid/:userId", authenticateJWT, async (req, res) => {
  const { userContact, complexity, totalAmount, useraddress, date, transactionId } = req.body;

  // Validate required fields
  if (!userContact || !complexity || !totalAmount || !useraddress || !date) {
    return res.status(400).send("Missing required fields");
  }

  try {
    // Find provider
    const provider = await Provider.findById(req.params.providerid);
    if (!provider) return res.status(404).send("Provider not found");

    // Find user
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).send("User not found");

    // Validate the date
    const bookingDate = new Date(date);

    // Get the queue size for the provider on the selected date
    const queueCount = await BookingRequest.countDocuments({
      provider: provider._id,
      date: bookingDate,
      status: { $in: ["queued", "pending"] },
    });

    // Create a new booking request
    const bookingRequest = new BookingRequest({
      user: req.params.userId,
      provider: req.params.providerid,
      category: provider.category,
      contactNumber: userContact,
      date: bookingDate, // Save the date part
      time: new Date(), // Save current timestamp
      address: useraddress,
      complexity,
      totalAmount,
      queueEnteredAt: new Date(), // Timestamp for sorting in the queue
      queuePosition: queueCount + 1, // Position based on queue size
      paymentDetails: {
        transactionId,
      },
    });

    // Save the booking request to the database
    await bookingRequest.save();

    const bookingDetails = `Booking ID: ${bookingRequest._id}, Provider: ${provider.name}, Date: ${bookingDate.toDateString()}}`;

    // Call SMS endpoint
    await axios.post('http://localhost:4000/booking/book-success', {
      phoneNumber: '91'+userContact,
      bookingDetails: bookingDetails
    })
    // Redirect to the Thank You page with bookingId
    return res.redirect(`/ThankYou/${bookingRequest._id}`);
  } catch (error) {
    res.send(404, error)

    // Ensure a response is sent only once
    if (!res.headersSent) {
      return res.status(500).send("Error creating booking");
    }
  }
});
router.get("/register", async (req, res) => {
  res.render("userRegistration");
});
// Index with authentication middleware
router.get("/index", authenticateJWT, async (req, res) => {
  try {
    const userEmail = req.user.email;
    console.log("User email:", userEmail);

    const user = await User.findOne({ email: userEmail }).lean();
    if (!user) {
      return res.status(404).send("User not found");
    }

    const userName = user.name;
    console.log("User name:", userName);

    const searchTerm = req.query.search || "";
    const categories = await Category.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    }).lean();
    console.log("Fetched categories:", categories);

    res.render("index", { categories, searchTerm, userName });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send("Server error");
  }
});

router.get("/ThankYou/:id", authenticateJWT, async function (req, res) {
  const userEmail = req.user.email; // Authenticated user email

  try {
    // Find the user based on the authenticated email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const bookingId = req.params.id;
    
    // Find the booking in both BookingRequest and Booking collections
    const booking = await BookingRequest.findById(bookingId) || await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    // Find the category associated with the booking
    const category = await Category.findById(booking.category);
    if (!category) {
      return res.status(404).send("Category not found");
    }

    const categoryName = category.name;

    // Format the date as DD-MM-YYYY
    const bookingDate = new Date(booking.date);
    const formattedDate = `${bookingDate.getDate().toString().padStart(2, '0')}-${(bookingDate.getMonth() + 1).toString().padStart(2, '0')}-${bookingDate.getFullYear()}`;

    // Render the thank you page with the booking details
    res.render("booking_success", {
      booking,
      user,
      userName: user.name, // Pass userName directly from the user object
      categoryName,
      Date: formattedDate
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error rendering Thank You page");
  }
});
router.get('/queue',authenticateJWT, async (req, res) => {
  try {
    const providers=await Provider.find(req.params.provider);
    const userEmail = req.user.email;

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).send("User not found");
    }

    // यूज़र का नाम प्राप्त करें
    const userName = user.name;
    const searchTerm = req.query.search || "";
    const categories = await Category.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } }, // Search in the 'name' field
        { description: { $regex: searchTerm, $options: "i" } }, // Search in the 'description' field
      ],
    });

    if (!categories || categories.length === 0) {
      return res.render("index", { categories: [], searchTerm });
    }
    res.render('Queue', { providers,categories, searchTerm, userName });
    
  } catch (error) {
    res.send(error);
  }
})
router.get('/queue/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const provider = await Provider.findById(id).populate("category", "name");
    if (!provider) {
      return res.status(404).send("Provider not found");
    }

    const availableDays = provider.availability.map((avail) => ({
      day: avail.day,
      startTime: avail.startTime,
      endTime: avail.endTime,
    }));

    // Day mapping and unavailable days calculation
    const dayMapping = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const allDays = Object.keys(dayMapping);
    const availableDayNames = availableDays.map((day) => day.day);
    const unavailableDays = allDays.filter(
      (day) => !availableDayNames.includes(day)
    );
    const unavailableDaysIndexes = unavailableDays.map(
      (day) => dayMapping[day]
    );

    const result = [0, ...unavailableDaysIndexes]; // Result includes disabled days

    res.json(result)
  } catch (error) {
    res.send(error);
  }
});
const accountSid = process.env.accountSid; // Replace with your Twilio Account SID
const authToken = process.env.authToken;   // Replace with your Twilio Auth Token
const twilioClient = twilio(accountSid, authToken);

router.post("/book-success", async (req, res) => {
  const { phoneNumber, bookingDetails } = req.body;
  console.log("Received booking details:", req.body);

  if (!phoneNumber || !bookingDetails) {
    return res.status(400).send("Missing required fields");
  }

  const message = `Your booking is confirmed! Details: ${bookingDetails}`;

  try {
    // Ensure Twilio client is initialized correctly
    await twilioClient.messages.create({
      body: message,
      from: "13613147028", // Twilio phone number
      to: phoneNumber,     // User's phone number
    });

    console.log("SMS sent successfully");
    return res.status(200).send("SMS sent successfully");
  } catch (error) {
    console.error("Error sending SMS:", error.message || error);
    return res.status(500).send("Failed to send SMS");
  }
});

module.exports = router;
