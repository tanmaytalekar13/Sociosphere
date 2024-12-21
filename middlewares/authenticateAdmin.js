function authenticateAdmin(req, res, next) {
    const token = req.cookies.token;
  
    // Check if the token exists
    if (!token) {
      return res.redirect('/admin/login');
    }
  
    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_KEY);
  
      // Add user data to the request
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Invalid token:', error.message);
      res.redirect('/admin/login');
    }
  }
  