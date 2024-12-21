const multer = require('multer');

// Configure multer's memory storage
const storage = multer.memoryStorage();

// Create the multer instance with the storage configuration
const upload = multer({ storage });

module.exports = upload; // Export the configured multer instance
