/**
 * ============================================================================
 * SIXERZONE TURF BOOKING SYSTEM - PRODUCTION-READY SERVER
 * ============================================================================
 * 
 * This is the main entry point for the SixerZone Turf Booking backend API.
 * It initializes the Express server with comprehensive security measures,
 * connects to the PostgreSQL database, and sets up all API routes.
 * 
 * @version 2.0.0
 * @author SixerZone Team
 * 
 * Security Features:
 * - Rate limiting on all endpoints
 * - Helmet security headers
 * - XSS protection
 * - HTTP Parameter Pollution prevention
 * - CORS with whitelist
 * - Request sanitization
 * - Compression for performance
 * - Comprehensive error handling
 * - Audit logging
 * 
 * Main Features:
 * - RESTful API for turf ground management
 * - Booking system with conflict detection
 * - Razorpay payment gateway integration
 * - Real-time availability checking
 * - Admin panel with authentication
 * - Online and offline booking support
 * 
 * ============================================================================
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import db from './models/index.js';
import groundsRouter from './routes/grounds.js';
import bookingsRouter from './routes/bookings.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';

// Security middleware imports
import {
  helmetConfig,
  xssProtection,
  hppProtection,
  sanitizeRequest,
  corsOptions,
  apiLimiter,
  auditLogger
} from './middleware/security.js';

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// SECURITY MIDDLEWARE (Applied First)
// ============================================================================

/**
 * Helmet - Secures Express apps by setting various HTTP headers
 * Protects against XSS, clickjacking, and other common vulnerabilities
 */
app.use(helmetConfig);

/**
 * CORS - Cross-Origin Resource Sharing Configuration
 * Restricts which domains can access the API
 * In production, only whitelisted domains are allowed
 */
app.use(cors(corsOptions));

/**
 * Compression - Compresses response bodies for better performance
 * Reduces bandwidth usage and improves load times
 */
app.use(compression());

/**
 * Rate Limiting - Prevents abuse and DDoS attacks
 * Limits the number of requests per IP address
 */
app.use('/api/', apiLimiter);

/**
 * Audit Logger - Logs all incoming requests
 * Useful for security monitoring and debugging
 */
if (NODE_ENV === 'production') {
  app.use(auditLogger);
}

// ============================================================================
// BODY PARSING MIDDLEWARE (Must come before sanitization)
// ============================================================================

/**
 * JSON Body Parser
 * Parses incoming requests with JSON payloads
 * Limited to 10mb to prevent payload attacks
 */
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for Razorpay webhook signature verification
    req.rawBody = buf;
  }
}));

/**
 * URL-encoded Body Parser
 * Parses incoming requests with URL-encoded payloads
 */
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// ============================================================================
// INPUT SANITIZATION (After parsing, before routes)
// ============================================================================

/**
 * XSS Protection - Sanitizes user input
 * Removes malicious scripts from request data
 * Must run AFTER body parsing
 */
app.use(xssProtection);

/**
 * HPP Protection - HTTP Parameter Pollution prevention
 * Protects against parameter pollution attacks
 * Must run AFTER body parsing
 */
app.use(hppProtection);

/**
 * Request Sanitization
 * Custom middleware to sanitize all incoming data
 * Removes potentially dangerous characters and scripts
 */
app.use(sanitizeRequest);

// ============================================================================
// HEALTH CHECK & MONITORING ENDPOINTS
// ============================================================================

/**
 * Health Check Endpoint
 * Used for server monitoring, load balancers, and uptime checks
 * Returns server status and basic information
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'SixerZone Turf Booking API is running',
    version: '2.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API Information Endpoint
 * Provides information about available API endpoints
 */
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SixerZone Turf Booking API v2.0',
    documentation: '/api/docs',
    endpoints: {
      grounds: '/api/grounds',
      bookings: '/api/bookings',
      payments: '/api/payments',
      admin: '/api/admin'
    },
    security: {
      rateLimit: 'Enabled',
      helmet: 'Enabled',
      xss: 'Enabled',
      hpp: 'Enabled',
      cors: 'Whitelisted'
    }
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Ground Management Routes
 * Handles CRUD operations for turf grounds
 */
app.use('/api', groundsRouter);

/**
 * Booking Management Routes
 * Handles booking creation, retrieval, and management
 */
app.use('/api', bookingsRouter);

/**
 * Payment Processing Routes
 * Handles Razorpay payment gateway integration
 */
app.use('/api', paymentsRouter);

/**
 * Admin Management Routes
 * Handles admin authentication and management operations
 * Includes enhanced rate limiting for authentication endpoints
 */
app.use('/api/admin', adminRouter);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * 404 Not Found Handler
 * Handles requests to undefined routes
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

/**
 * Global Error Handler
 * Catches and handles all errors in the application
 * Provides different responses for development and production
 */
app.use((err, req, res, next) => {
  // Log error for monitoring
  console.error('Error caught by global handler:', {
    name: err.name,
    message: err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // Determine error status code
  const statusCode = err.status || err.statusCode || 500;
  
  // Prepare error response
  const errorResponse = {
    success: false,
    error: err.name || 'InternalServerError',
    message: statusCode === 500 && NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    timestamp: new Date().toISOString()
  };
  
  // Add stack trace in development mode
  if (NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
});

// ============================================================================
// DATABASE CONNECTION & SERVER STARTUP
// ============================================================================

/**
 * Initialize Database and Start Server
 * 
 * This function:
 * 1. Tests the database connection
 * 2. Syncs database models (creates tables if they don't exist)
 * 3. Starts the Express server
 * 4. Sets up graceful shutdown handlers
 */
(async () => {
  try {
    console.log('');
    console.log('============================================');
    console.log('  SIXERZONE TURF BOOKING SYSTEM');
    console.log('============================================');
    console.log('  Initializing server...');
    console.log('');
    
    // Test database connection
    await db.sequelize.authenticate();
    console.log('  ✓ Database connection established');
    
    // Sync database models
    await db.sequelize.sync({ 
      force: false,  // Never set to true in production!
      alter: false   // Use migrations for schema changes in production
    });
    console.log('  ✓ Database models synchronized');
    
    // Start the Express server
    const server = app.listen(PORT, () => {
      console.log('  ✓ Server started successfully');
      console.log('');
      console.log('============================================');
      console.log('  SERVER INFORMATION');
      console.log('============================================');
      console.log(`  Status:      Running`);
      console.log(`  Environment: ${NODE_ENV}`);
      console.log(`  Port:        ${PORT}`);
      console.log(`  API URL:     http://localhost:${PORT}`);
      console.log(`  Health:      http://localhost:${PORT}/health`);
      console.log('');
      console.log('  SECURITY FEATURES');
      console.log('  ✓ Rate Limiting');
      console.log('  ✓ Helmet Security Headers');
      console.log('  ✓ XSS Protection');
      console.log('  ✓ HPP Protection');
      console.log('  ✓ CORS Whitelist');
      console.log('  ✓ Request Sanitization');
      console.log('  ✓ Response Compression');
      console.log('============================================');
      console.log('');
    });

    // Store server instance for graceful shutdown
    app.locals.server = server;
    
  } catch (error) {
    console.error('');
    console.error('============================================');
    console.error('  FATAL ERROR: Failed to start server');
    console.error('============================================');
    console.error('  Error Name:   ', error.name);
    console.error('  Error Message:', error.message);
    if (NODE_ENV === 'development') {
      console.error('  Stack Trace:');
      console.error(error.stack);
    }
    console.error('============================================');
    console.error('');
    
    // Exit the process with failure code
    process.exit(1);
  }
})();

// ============================================================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================================================

/**
 * Graceful Shutdown Function
 * Closes all connections and exits cleanly
 */
const gracefulShutdown = async (signal) => {
  console.log('');
  console.log(`${signal} signal received: initiating graceful shutdown`);
  console.log('');
  
  try {
    // Close HTTP server
    if (app.locals.server) {
      console.log('  Closing HTTP server...');
      app.locals.server.close(() => {
        console.log('  ✓ HTTP server closed');
      });
    }
    
    // Close database connections
    console.log('  Closing database connections...');
    await db.sequelize.close();
    console.log('  ✓ Database connections closed');
    
    console.log('');
    console.log('  Shutdown completed successfully');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('  Error during shutdown:', error.message);
    console.error('');
    process.exit(1);
  }
};

/**
 * Handle SIGTERM signal (e.g., from Docker, Kubernetes, or PM2)
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * Handle SIGINT signal (e.g., Ctrl+C in terminal)
 */
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Handle Unhandled Promise Rejections
 * Logs the error and continues execution (change to exit in production if needed)
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('============================================');
  console.error('  UNHANDLED PROMISE REJECTION');
  console.error('============================================');
  console.error('  Reason:', reason);
  console.error('  Promise:', promise);
  console.error('============================================');
  console.error('');
  
  // In production, you might want to shut down gracefully
  if (NODE_ENV === 'production') {
    // Optional: Send to monitoring service (e.g., Sentry, New Relic)
    // Then gracefully shut down
    // gracefulShutdown('UnhandledRejection');
  }
});

/**
 * Handle Uncaught Exceptions
 * Logs the error and shuts down the server
 */
process.on('uncaughtException', (error) => {
  console.error('');
  console.error('============================================');
  console.error('  UNCAUGHT EXCEPTION');
  console.error('============================================');
  console.error('  Name:   ', error.name);
  console.error('  Message:', error.message);
  console.error('  Stack:');
  console.error(error.stack);
  console.error('============================================');
  console.error('');
  
  // Uncaught exceptions are serious - shut down immediately
  process.exit(1);
});

// Export app for testing purposes
export default app;
