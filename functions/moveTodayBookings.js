const { Booking } = require('../models/booking'); // Adjust path as needed
const { PastBooking } = require('../models/pastBooking'); // Adjust path as needed
const { BookingRequest } = require('../models/bookingRequest'); // Adjust path as needed

const moveBookings = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999); // End of today

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1); // Start of yesterday
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999); // End of yesterday

        console.log(`Processing bookings for today: ${today.toISOString().split('T')[0]} and moving past bookings.`);

        // Step 1: Move yesterday's bookings from Booking to PastBooking
        const yesterdaysBookings = await Booking.find({
            date: { $gte: yesterday, $lt: today },
        });

        if (yesterdaysBookings.length) {
            // Prepare data for the PastBooking collection
            const pastBookings = yesterdaysBookings.map((booking) => ({
                user: booking.user,
                provider: booking.provider,
                category: booking.category,
                contactNumber: booking.contactNumber,
                date: booking.date,
                time: booking.time || null,
                address: booking.address,
                complexity: booking.complexity,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
                totalAmount: booking.totalAmount,
                paymentDetails: booking.paymentDetails,
                bookedAt: booking.bookedAt,
                queuePosition: booking.queuePosition || null,
                queueEnteredAt: booking.queueEnteredAt || null,
                isBeingProcessed: booking.isBeingProcessed || false,
            }));

            // Insert into PastBooking collection
            await PastBooking.insertMany(pastBookings);

            // Remove yesterday's bookings from Booking
            const idsToDelete = yesterdaysBookings.map((booking) => booking._id);
            await Booking.deleteMany({ _id: { $in: idsToDelete } });

            console.log(`Successfully moved ${yesterdaysBookings.length} past booking(s) to PastBooking module.`);
        } else {
            console.log('No past bookings to move.');
        }

        // Step 2: Move today's requests from BookingRequest to Booking
        const todaysRequests = await BookingRequest.find({
            date: { $gte: today, $lt: endOfDay },
        });

        if (todaysRequests.length) {
            // Prepare data for the Booking collection
            const bookings = todaysRequests.map((request) => ({
                user: request.user,
                provider: request.provider,
                category: request.category,
                contactNumber: request.contactNumber,
                date: request.date,
                time: request.time || null,
                address: request.address,
                complexity: request.complexity,
                status: request.status,
                paymentStatus: request.paymentStatus,
                totalAmount: request.totalAmount,
                paymentDetails: request.paymentDetails,
                bookedAt: request.bookedAt,
                queuePosition: request.queuePosition || null,
                queueEnteredAt: request.queueEnteredAt || null,
                isBeingProcessed: request.isBeingProcessed || false,
            }));

            // Insert into Booking collection
            await Booking.insertMany(bookings);

            // Remove entries from BookingRequest
            const idsToDelete = todaysRequests.map((request) => request._id);
            await BookingRequest.deleteMany({ _id: { $in: idsToDelete } });

            console.log(`Successfully moved ${todaysRequests.length} booking request(s) to Booking module.`);
        } else {
            console.log('No booking requests to move for today.');
        }
    } catch (error) {
        console.error('Error processing bookings:', error);
    }
};

module.exports = moveBookings;
