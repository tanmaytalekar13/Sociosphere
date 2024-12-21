const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  data: { type: Object, required: true }, // Store provider data temporarily
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // 1-hour TTL
});

module.exports = mongoose.model('VerificationToken', verificationTokenSchema);
