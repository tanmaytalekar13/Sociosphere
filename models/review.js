const mongoose = require('mongoose');
const Joi = require('joi');

const reviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String },
    feedback: { type: String }, // New feedback field
    createdAt: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);

// Joi validation schema for Review
const reviewValidationSchema = Joi.object({
    user: Joi.string().required(),
    provider: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required(),
    reviewText: Joi.string().optional(),
    feedback: Joi.string().optional() // New feedback validation
});

module.exports = { Review, reviewValidationSchema };
