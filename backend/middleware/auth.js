/**
 * Authorization middleware to validate bearer token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Authorization header required',
      message: 'Please provide a valid bearer token in the Authorization header'
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Invalid authorization format',
      message: 'Authorization header must start with "Bearer "'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (!token) {
    return res.status(401).json({
      error: 'Token required',
      message: 'Please provide a token after "Bearer "'
    });
  }

  const adminApiKey = process.env.ADMIN_API_KEY;
  
  if (!adminApiKey) {
    console.error('ADMIN_API_KEY environment variable is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Admin API key not configured'
    });
  }

  if (token !== adminApiKey) {
    return res.status(403).json({
      error: 'Invalid token',
      message: 'The provided token is not valid'
    });
  }

  next();
}

module.exports = { requireAuth };
