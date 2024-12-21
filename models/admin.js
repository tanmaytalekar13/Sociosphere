const mongoose = require("mongoose");
const Joi = require("joi");
const bcrypt = require("bcrypt");

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "admin" },
  permissions: { type: [String] },
});

// Hash password before saving

const Admin = mongoose.model("Admin", adminSchema);

// Joi validation schema for Admin
const validateAdmin = Joi.object({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("admin").default("admin"),
  permissions: Joi.array().items(Joi.string()).optional(),
});

module.exports = { Admin, validateAdmin };
