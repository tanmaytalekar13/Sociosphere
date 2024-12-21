const express = require("express");
const router = express.Router();
const authenticateJWT = require("../middlewares/user");
const { Booking } = require("../models/booking");
const { Category } = require("../models/category");
const { Provider } = require("../models/provider");
const { User } = require("../models/user");
const { BookingRequest } = require("../models/bookingRequest");
const {pastBooking } = require("../models/pastBooking");
const twilio = require("twilio");
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id });
    const bookingRequests = await BookingRequest.find({ user: req.user.id });
    const pastBookingRequests = await pastBooking.find({ user: req.user.id });

    if (!bookings.length && !bookingRequests.length && !pastBookingRequests.length) {
      return res.send("No bookings or booking requests found for the authenticated user.");
    }

    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const category = await Category.findById(booking.category).select("name");
        const provider = await Provider.findById(booking.provider).select("name");
        const user = await User.findById(booking.user).select("name");

        return {
          ...booking._doc,
          categoryName: category ? category.name : "Unknown Category",
          providerName: provider ? provider.name : "Unknown Provider",
          userName: user ? user.name : "Unknown User",
        };
      })
    );

    const enrichedBookingRequests = await Promise.all(
      bookingRequests.map(async (bookingRequest) => {
        const category = await Category.findById(bookingRequest.category).select("name");
        const provider = await Provider.findById(bookingRequest.provider).select("name");
        const user = await User.findById(bookingRequest.user).select("name");

        return {
          ...bookingRequest._doc,
          categoryName: category ? category.name : "Unknown Category",
          providerName: provider ? provider.name : "Unknown Provider",
          userName: user ? user.name : "Unknown User",
        };
      })
    );

    const enrichedPastBookings = await Promise.all(
      pastBookingRequests.map(async (bookingRequest) => {
        const category = await Category.findById(bookingRequest.category).select("name");
        const provider = await Provider.findById(bookingRequest.provider).select("name");
        const user = await User.findById(bookingRequest.user).select("name");

        return {
          ...bookingRequest._doc,
          categoryName: category ? category.name : "Unknown Category",
          providerName: provider ? provider.name : "Unknown Provider",
          userName: user ? user.name : "Unknown User",
        };
      })
    );

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const searchTerm = req.query.search || "";
    const categories = await Category.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    });

    const allEnrichedData = [...enrichedBookings, ...enrichedBookingRequests, ...enrichedPastBookings];
    res.render("Bookings", { allEnrichedData, searchTerm, categories, userName: user.name });
  } catch (error) {
    console.error("Error finding bookings, booking requests, or past bookings:", error);
    res.status(500).send("Error finding bookings, booking requests, or past bookings");
  }
});

router.post('/rating-review/:id', authenticateJWT, async (req, res) => {
    const { rating, review } = req.body;

    try {
        // Find the provider by ID
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).send('Provider not found');
        }

        // Validate inputs
        if (!rating || !review) {
            return res.status(400).send('Rating and review are required');
        }

        // Find the user submitting the review
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Add the review
        const newReview = {
            userName: user.name,
            rating,
            reviewText: review,
            date: new Date(),
        };

        provider.reviews.push(newReview);
        console.log(newReview);
        // Update the average rating
        const totalRatings = provider.reviews.reduce((sum, r) => sum + r.rating, 0);
        provider.averageRating = totalRatings / provider.reviews.length;

        // Save the provider
        await provider.save();

        res.status(200).send('Rating and review submitted successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
router.get('/Reviews/:id', authenticateJWT,async(req, res) => {
  try {
    // Find the provider by ID
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).send('Provider not found');
    }

    res.render('Review', { reviews: provider.reviews,provider });
  } catch (error) {
    console.error('Error finding provider:', error);
    res.status(500).send('Server error');
  }
})
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
