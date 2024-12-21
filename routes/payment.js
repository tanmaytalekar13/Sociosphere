const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const router = express.Router();
require('dotenv').config();

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create an order
router.post('/create-order', async (req, res) => {
    const { amount, currency } = req.body;
    
    try {
      const order = await razorpay.orders.create({
        amount: amount, // in paise
        currency: currency,
        receipt: `order_rcpt_${Date.now()}`,
        payment_capture: '1', // Automatically capture payment
      });
  
      if (!order) {
        return res.status(500).json({ error: 'Failed to create order' });
      }
  
      res.status(200).json({ order });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Server error while creating order' });
    }
  });
// Verify payment signature
router.post('/verify-signature', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (generated_signature === razorpay_signature) {
    res.status(200).json({ success: true, message: 'Payment Verified Successfully' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid Signature' });
  }
});

module.exports = router;
