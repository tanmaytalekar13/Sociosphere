const mongoose = require('mongoose');
const Joi = require('joi');

// Define the Mongoose schema for Payment
const paymentSchema = new mongoose.Schema({
    orderId: {
      type: String,
      required: true,
    },
    paymentId: {
      type: String,
    },
    signature: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: 'pending',
    },
  }, { timestamps: true });

// Create the Mongoose model
const Payment = mongoose.model('Payment', paymentSchema);

// Define the Joi schema for Payment
const paymentJoiSchema = Joi.object({
    order: Joi.string().required(),
    amount: Joi.number().positive().required(),
    method: Joi.string().required(),
    status: Joi.string().required(),
    transactionId: Joi.string().required()
});

// Function to validate payment data
const validatePayment = (data) => {
    return paymentJoiSchema.validate(data);
};

// Export both the Mongoose model and the validation function
module.exports = {
    Payment,
    validatePayment
};
