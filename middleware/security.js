/**
 * ============================================================================
 * SECURITY MIDDLEWARE - Production-Grade Security Configuration
 * ============================================================================
 *
 * This module implements comprehensive security measures for the API including:
 * - Rate limiting to prevent abuse and DDoS attacks
 * - Request validation and sanitization
 * - Security headers via Helmet
 * - Custom XSS protection (Express 5.x compatible)
 * - Custom HPP (HTTP Parameter Pollution) prevention (Express 5.x compatible)
 * - SQL injection pattern detection
 * - Request auditing
 *
 * IMPORTANT: This module uses CUSTOM implementations of XSS and HPP protection
 * instead of xss-clean and hpp packages, which are incompatible with Express 5.x.
 * These custom implementations are fully compatible and provide equivalent security.
 *
 * @module middleware/security
 * @requires express-rate-limit
 * @requires helmet
 * @version 2.0.0
 *
 * ============================================================================
 */

import rateLimit from "express-rate-limit";
import helmet from "helmet";

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

/**
 * General API Rate Limiter
 * Limits each IP to 100 requests per 15 minutes
 * Prevents brute force attacks and API abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain IPs (optional - for internal services)
  skip: (req) => {
    // Example: Skip rate limiting for localhost in development
    if (process.env.NODE_ENV === "development") {
      return false; // Apply rate limiting even in development
    }
    return false;
  },
});

/**
 * Strict Rate Limiter for Authentication Endpoints
 * Limits each IP to 5 login attempts per 15 minutes
 * Critical for preventing brute force attacks on login
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth requests
});

/**
 * Payment Endpoint Rate Limiter
 * Limits each IP to 20 payment requests per hour
 * Prevents payment gateway abuse and testing attacks
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 payment requests per hour
  message: {
    success: false,
    message: "Too many payment requests, please try again after an hour",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Booking Creation Rate Limiter
 * Limits each IP to 10 booking attempts per hour
 * Prevents spam bookings and system abuse
 */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 booking attempts per hour
  message: {
    success: false,
    message: "Too many booking attempts, please try again after an hour",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// HELMET SECURITY HEADERS
// ============================================================================

/**
 * Helmet Configuration
 * Sets various HTTP headers to protect against common web vulnerabilities:
 * - XSS attacks
 * - Clickjacking
 * - MIME type sniffing
 * - And more...
 */
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // Expect-CT header
  expectCt: { maxAge: 86400 },
  // Frameguard to prevent clickjacking
  frameguard: { action: "deny" },
  // Hide powered by Express
  hidePoweredBy: true,
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // IE No Open
  ieNoOpen: true,
  // Don't sniff mimetype
  noSniff: true,
  // Referrer Policy
  referrerPolicy: { policy: "no-referrer" },
  // XSS Filter
  xssFilter: true,
});

// ============================================================================
// XSS PROTECTION
// ============================================================================

/**
 * Custom XSS Protection Middleware
 * Sanitizes user input to prevent Cross-Site Scripting attacks
 * Compatible with Express 5.x - creates new sanitized objects instead of modifying read-only properties
 */
export const xssProtection = (req, res, next) => {
  try {
    /**
     * Sanitize a string value to remove XSS threats
     * @param {string} value - The string to sanitize
     * @returns {string} - Sanitized string
     */
    const sanitizeValue = (value) => {
      if (typeof value !== "string") return value;

      return (
        value
          // Remove script tags
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          // Remove iframe tags
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
          // Remove object tags
          .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
          // Remove embed tags
          .replace(/<embed\b[^<]*>/gi, "")
          // Remove on* event handlers
          .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
          .replace(/\son\w+\s*=\s*[^\s>]*/gi, "")
          // Remove javascript: protocol
          .replace(/javascript:/gi, "")
          // Remove data: protocol from suspicious contexts
          .replace(/<[^>]*data:text\/html[^>]*>/gi, "")
          // Trim whitespace
          .trim()
      );
    };

    /**
     * Recursively sanitize an object
     * @param {*} obj - Object to sanitize
     * @returns {*} - Sanitized object
     */
    const sanitizeObject = (obj) => {
      if (obj === null || obj === undefined) return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item));
      }

      if (typeof obj === "object" && obj.constructor === Object) {
        const sanitized = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            sanitized[key] = sanitizeObject(obj[key]);
          }
        }
        return sanitized;
      }

      if (typeof obj === "string") {
        return sanitizeValue(obj);
      }

      return obj;
    };

    // Sanitize request body (create new object to avoid read-only property issues)
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query params (create new object)
    if (req.query && typeof req.query === "object") {
      const sanitizedQuery = {};
      for (const key in req.query) {
        if (Object.prototype.hasOwnProperty.call(req.query, key)) {
          sanitizedQuery[key] = sanitizeObject(req.query[key]);
        }
      }
      // Use defineProperty to override the read-only getter
      Object.defineProperty(req, "query", {
        value: sanitizedQuery,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    // Sanitize URL params
    if (req.params && typeof req.params === "object") {
      const sanitizedParams = {};
      for (const key in req.params) {
        if (req.params.hasOwnProperty(key)) {
          sanitizedParams[key] = sanitizeObject(req.params[key]);
        }
      }
      req.params = sanitizedParams;
    }

    next();
  } catch (error) {
    console.error("XSS Protection Error:", error);
    // Continue even if sanitization fails
    next();
  }
};

// ============================================================================
// HPP PROTECTION
// ============================================================================

/**
 * Custom HTTP Parameter Pollution Protection
 * Protects against HTTP Parameter Pollution attacks
 * Ensures only the last parameter is used when duplicates are sent
 * Compatible with Express 5.x
 */
export const hppProtection = (req, res, next) => {
  try {
    // Whitelist of parameters that are allowed to be arrays
    const whitelist = ["filter", "sort", "fields", "amenities", "tags"];

    /**
     * Deduplicate parameters - keep only last value unless whitelisted
     * @param {Object} params - Parameters object to process
     * @returns {Object} - Deduplicated parameters
     */
    const deduplicateParams = (params) => {
      if (!params || typeof params !== "object") return params;

      const deduplicated = {};

      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          const value = params[key];

          // If it's an array and not whitelisted, keep only the last value
          if (Array.isArray(value) && !whitelist.includes(key)) {
            deduplicated[key] = value[value.length - 1];
          } else {
            deduplicated[key] = value;
          }
        }
      }

      return deduplicated;
    };

    // Protect query parameters
    if (req.query && typeof req.query === "object") {
      const deduplicated = deduplicateParams(req.query);
      Object.defineProperty(req, "query", {
        value: deduplicated,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    // Protect body parameters
    if (req.body && typeof req.body === "object") {
      req.body = deduplicateParams(req.body);
    }

    next();
  } catch (error) {
    console.error("HPP Protection Error:", error);
    // Continue even if deduplication fails
    next();
  }
};

// ============================================================================
// REQUEST SANITIZATION
// ============================================================================

/**
 * Additional Request Sanitization
 * Extra layer of validation for sensitive operations
 * This runs after xssProtection for defense in depth
 */
export const sanitizeRequest = (req, res, next) => {
  try {
    // Additional validation for SQL injection patterns
    const sqlPatterns = [
      /('|(\-\-)|(;)|(\|\|)|(\*))/gi,
      /(\bUNION\b.*\bSELECT\b)/gi,
      /(\bINSERT\b.*\bINTO\b)/gi,
      /(\bDELETE\b.*\bFROM\b)/gi,
      /(\bDROP\b.*\bTABLE\b)/gi,
      /(\bUPDATE\b.*\bSET\b)/gi,
    ];

    /**
     * Check if value contains SQL injection patterns
     * @param {string} value - Value to check
     * @returns {boolean} - True if suspicious
     */
    const hasSqlInjection = (value) => {
      if (typeof value !== "string") return false;
      return sqlPatterns.some((pattern) => pattern.test(value));
    };

    /**
     * Validate request data
     * @param {Object} data - Data to validate
     * @returns {boolean} - True if valid
     */
    const validateData = (data) => {
      if (!data || typeof data !== "object") return true;

      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const value = data[key];

          if (typeof value === "string" && hasSqlInjection(value)) {
            return false;
          }

          if (typeof value === "object" && !validateData(value)) {
            return false;
          }
        }
      }

      return true;
    };

    // Validate all request data
    if (
      !validateData(req.body) ||
      !validateData(req.query) ||
      !validateData(req.params)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data detected",
      });
    }

    next();
  } catch (error) {
    console.error("Request Sanitization Error:", error);
    next();
  }
};

// ============================================================================
// CORS SECURITY
// ============================================================================

/**
 * Secure CORS Configuration
 * Defines allowed origins, methods, and headers for cross-origin requests
 * Supports multiple frontend URLs for production, staging, and preview deployments
 */
export const corsOptions = {
  // List of allowed origins
  origin: (origin, callback) => {
    // Parse FRONTEND_URL which can be comma-separated for multiple origins
    const frontendUrls = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : [];

    const allowedOrigins = [
      ...frontendUrls,
      "http://localhost:5173",
      "http://localhost:3000",
    ].filter(Boolean); // Remove undefined/empty values

    // Allow Vercel deployments in any environment
    const isVercelPreview = origin && origin.includes(".vercel.app");
    const isAllowed =
      !origin || allowedOrigins.indexOf(origin) !== -1 || isVercelPreview;

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  // Allowed HTTP methods
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  // Allowed headers
  allowedHeaders: ["Content-Type", "Authorization"],
  // Expose headers
  exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  // Preflight cache duration
  maxAge: 86400, // 24 hours
  // Success status for preflight
  optionsSuccessStatus: 204,
};

// ============================================================================
// REQUEST LOGGING (Security Audit Trail)
// ============================================================================

/**
 * Security Audit Logger
 * Logs all incoming requests for security monitoring
 * Useful for detecting suspicious activity patterns
 */
export const auditLogger = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
    // Don't log sensitive data
    body:
      req.body && !req.path.includes("login") && !req.path.includes("payment")
        ? JSON.stringify(req.body).substring(0, 100)
        : "[REDACTED]",
  };

  // In production, send this to a proper logging service
  if (process.env.NODE_ENV === "production") {
    // TODO: Integrate with logging service (e.g., Winston, Loggly, etc.)
    console.log("AUDIT:", JSON.stringify(logData));
  }

  next();
};

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Validation Error Handler
 * Formats express-validator errors into consistent response format
 */
export const handleValidationErrors = (errors) => {
  const formattedErrors = {};
  errors.forEach((error) => {
    if (!formattedErrors[error.path]) {
      formattedErrors[error.path] = [];
    }
    formattedErrors[error.path].push(error.msg);
  });
  return formattedErrors;
};

/**
 * Export all security middleware as a single object for easier import
 */
export default {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  bookingLimiter,
  helmetConfig,
  xssProtection,
  hppProtection,
  sanitizeRequest,
  corsOptions,
  auditLogger,
  handleValidationErrors,
};
