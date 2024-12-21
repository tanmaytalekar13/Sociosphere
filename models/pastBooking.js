const mongoose = require('mongoose');
const Joi = require('joi');

// Mongoose Schema for PastBooking (with Instant Service Queue Handling)
const pastBookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  contactNumber: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: false },
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
  queuePosition: { type: Number, default: 0 },
  queueEnteredAt: { type: Date, default: Date.now },
  isBeingProcessed: { type: Boolean, default: false },
});

// Joi Validation Schema for PastBooking (with Instant Service Queue Handling)
const validatePastBooking = (data) => {
  const schema = Joi.object({
    user: Joi.string().required(),
    provider: Joi.string().required(),
    category: Joi.string().required(),
    date: Joi.date().required(),
    time: Joi.string().required(),
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
    cancellationFee: Joi.number().optional(),
    paymentDetails: Joi.object({
      transactionId: Joi.string().optional(),
      paymentGateway: Joi.string().optional(),
    }).optional(),
    queuePosition: Joi.number().optional(),
    queueEnteredAt: Joi.date().optional(),
    isBeingProcessed: Joi.boolean().optional(),
  });

  return schema.validate(data);
};

module.exports = {
  pastBooking: mongoose.model('PastBooking', pastBookingSchema),
  validatePastBooking,
};
