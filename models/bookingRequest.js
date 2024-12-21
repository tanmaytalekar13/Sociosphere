const mongoose = require('mongoose');
const Joi = require('joi');

// Mongoose Schema for Booking Request
const bookingRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  category: { type: String, required: true }, // Adjust as needed
  contactNumber: { type: String, required: true },
  date: { type: Date, required: true },
  address: { type: String, required: true },
  complexity: {
    type: String,
    enum: ['simple', 'moderate', 'complex', 'super complex'],
  },
  status: {
    type: String,
    enum: ['pending', 'In progress', 'completed', 'canceled', 'queued'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'failed'],
    default: 'pending',
  },
  totalAmount: { type: Number, required: true },
  paymentDetails: {
    transactionId: { type: String, default: null },
    paymentGateway: { type: String, default: null },
  },
  bookedAt: { type: Date, default: Date.now },
  queuePosition: { type: Number },
  queueEnteredAt: { type: Date, default: Date.now },
  isBeingProcessed: { type: Boolean, default: false },
});
bookingRequestSchema.statics.checkConflict = async function (providerId, date, time, bufferInMinutes = 60) {
  const bookingTime = new Date(`${date}T${time}`); // Combine date and time into a single Date object
  const bufferStartTime = new Date(bookingTime.getTime() - bufferInMinutes * 60000);
  const bufferEndTime = new Date(bookingTime.getTime() + bufferInMinutes * 60000);

  return await this.findOne({
    provider: providerId,
    time: {
      $gte: bufferStartTime,
      $lte: bufferEndTime,
    },
  });
};

// Joi Validation Schema for Booking Request
const validateBookingRequest = (data) => {
  const schema = Joi.object({
    user: Joi.string().required(),
    provider: Joi.string().required(),
    category: Joi.string()
      .valid('category1', 'category2', 'category3') // Adjust as needed
      .required(),
    contactNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/) // E.164 format
      .required(),
    date: Joi.date().required(),
    address: Joi.string().required(),
    complexity: Joi.string()
      .valid('simple', 'moderate', 'complex', 'super complex')
      .required(),
    status: Joi.string()
      .valid('pending', 'confirmed', 'completed', 'canceled', 'queued')
      .optional(),
    paymentStatus: Joi.string()
      .valid('paid', 'pending', 'failed')
      .optional(),
    totalAmount: Joi.number().required(),
    paymentDetails: Joi.object({
      transactionId: Joi.string().optional(),
      paymentGateway: Joi.string().optional(),
    }).default({}),
    queuePosition: Joi.number().optional(),
    queueEnteredAt: Joi.date().optional(),
    isBeingProcessed: Joi.boolean().optional(),
  });

  return schema.validate(data);
};

module.exports = {
  BookingRequest: mongoose.model('BookingRequest', bookingRequestSchema),
  validateBookingRequest,
};
