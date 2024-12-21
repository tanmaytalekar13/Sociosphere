// middlewares/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models/user'); // Adjust path as necessary
const { Provider } = require('../models/provider'); // Adjust path as necessary

const authenticate = async (req, res, next) => {
    const token = req.cookies.token || req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY);
        
        // Check if the token belongs to a User or Provider
        const user = await User.findById(decoded._id);
        const provider = await Provider.findById(decoded._id);

        if (!user && !provider) {
            return res.status(401).json({ error: 'Invalid token.' });
        }

        // Attach user or provider to the request
        req.user = user; // This will be null if a provider is logged in
        req.provider = provider; // This will be null if a user is logged in
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

module.exports = authenticate;
