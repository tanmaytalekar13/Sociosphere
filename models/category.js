const mongoose = require('mongoose');
const Joi = require('joi');

// Mongoose Schema for Category
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String} // Storing image as Buffer
});

const Category = mongoose.model('Category', categorySchema);

// Joi validation schema for Category
const categoryValidationSchema = Joi.object({
    name: Joi.string().min(3).required(),
    description: Joi.string().optional(),
});

module.exports = { Category, categoryValidationSchema };
