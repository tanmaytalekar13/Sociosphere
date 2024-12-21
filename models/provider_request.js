const mongoose = require('mongoose');
const Joi = require('joi');

const requestSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  feedback: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Request = mongoose.model('Request', requestSchema);

// Joi validation schema for Request
const requestValidationSchema = Joi.object({
  provider: Joi.string().required(),
  category: Joi.string().required(),
  status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
  feedback: Joi.string().optional()
});

module.exports = { Request, requestValidationSchema };
