const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes
const healthRoutes = require('./routes/health');
const triggerWorkflowRoutes = require('./routes/tweet-workflow/trigger-workflow');
const completeWorkflowRoutes = require('./routes/tweet-workflow/complete-workflow');
const authorRoutes = require('./routes/authors/authors');
const executeRoutes = require('./routes/trading/execute');
const accountRoutes = require('./routes/trading/account');
const { router: marketRoutes } = require('./routes/trading/market');

// Use routes
app.use('/api/health', healthRoutes);
app.use('/api/process-tweet', triggerWorkflowRoutes);
app.use('/api/process-tweet', completeWorkflowRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/trading/execute', executeRoutes);
app.use('/api/trading/account', accountRoutes);
app.use('/api/trading/market', marketRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Tweet Trade Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
