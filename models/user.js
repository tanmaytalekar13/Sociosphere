const mongoose = require('mongoose');
const Joi = require('joi');
const bcrypt = require('bcrypt');

// User schema definition
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String},
  role: { type: String, enum: ['User', 'admin'], default: 'User' },
  address: { type: String, maxlength: 255 }, // Optional
  contactNumber: {
    type: String,
    match: /^[0-9]{10}$/,
    
  },
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  verificationToken: { type: String }, // Add field for token
  isVerified: { type: Boolean, default: false }, // Add field for verification status
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Joi validation schema for User
const userValidationSchema = Joi.object({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).optional(),
  role: Joi.string().valid('User', 'admin').default('User'),
  address: Joi.string().max(255).optional(),
  contactNumber: Joi.string().pattern(/^[0-9]{10}$/).optional(),
});

module.exports = { User, userValidationSchema };
