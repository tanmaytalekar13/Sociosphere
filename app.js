const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const cors = require('cors');
const cron = require('node-cron');

// Route imports
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const categoryRouter = require('./routes/category');
const providerRouter = require('./routes/provider');
const userRouter = require('./routes/user');
const paymentRoutes = require('./routes/payment');
const bookingRoutes = require('./routes/booking');
const moveBookings = require('./functions/moveTodayBookings');
// Load environment variables
dotenv.config();

// Initialize database connection
require('./config/db');

// Google OAuth configuration
require('./config/google_oauth_confing');

// Create an Express application instance
const app = express();
app.use(cors());

// Middleware to serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Session management
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 }, // Adjust secure based on NODE_ENV
  })
);

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Cookie parser
app.use(cookieParser());


// Route handlers
app.use('/', userRouter);
app.use('/admin', adminRouter);
app.use('/category', categoryRouter);
app.use('/provider', providerRouter);
app.use('/auth', authRouter);
app.use('/api/payment', paymentRoutes);
app.use('/booking', bookingRoutes);


cron.schedule('0 0 * * *', async () => {
  console.log('Running moveBookings job...');
  await moveBookings();
});
// Start the server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
