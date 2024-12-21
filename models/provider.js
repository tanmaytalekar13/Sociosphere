const mongoose = require('mongoose');
const Joi = require('joi');
const bcrypt = require('bcrypt');

// Availability Schema
const availabilitySchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true,
    },
    startTime: { type: String, required: true }, // HH:mm format
    endTime: { type: String, required: true }, // HH:mm format
    slots: [{ type: String }] // Array of time slots in HH:mm format
});

// Provider Schema
const providerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String },
    password: { type: String, required: true, select: false },
    contactNumber: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviews: [
        {
            userName: { type: String, required: true },
            rating: { type: Number, min: 1, max: 5, required: true },
            date: { type: Date, default: Date.now },
            reviewText: { type: String },
        },
    ],
    portfolio: {
        images: [
            {
                title: String,
                description: String,
                url: String,
                dateUploaded: { type: Date, default: Date.now },
            },
        ],
        videos: [
            {
                title: String,
                description: String,
                url: String,
                dateUploaded: { type: Date, default: Date.now },
            },
        ],
    },
    averageRating: { type: Number, default: 0 },
    charges: { type: Number, required: true },
    experience: { type: String },
    profileApprovedByAdmin: { type: Boolean, default: false },
    availability: [availabilitySchema], // Embed availability schema
});

// Hash password before saving
providerSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to verify password
providerSchema.methods.isValidPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Provider Model
const Provider = mongoose.model('Provider', providerSchema);

// Joi Validation Schema for Provider
const providerValidationSchema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    image: Joi.string().uri().optional(),
    password: Joi.string().min(6).required(),
    contactNumber: Joi.string().optional(),
    category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    charges: Joi.number().required(),
    experience: Joi.string().optional(),
    availability: Joi.array().items(
        Joi.object({
            day: Joi.string()
                .valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
                .required(),
            startTime: Joi.string()
                .pattern(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
                .required(), // HH:mm format
            endTime: Joi.string()
                .pattern(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
                .required(), // HH:mm format
            slots: Joi.array().items(
                Joi.string().pattern(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
            ).optional(), // Array of slots in HH:mm format
        })
    ).optional(),
});

module.exports = { Provider, providerValidationSchema };
