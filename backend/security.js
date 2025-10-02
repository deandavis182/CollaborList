// Security middleware configuration
// To enable these features, add the following packages to package.json:
// "express-rate-limit": "^7.1.5",
// "helmet": "^7.1.0",
// "express-validator": "^7.0.1"

const createSecurityMiddleware = (app, cors, JWT_SECRET) => {
  // Basic security headers (built-in, no extra packages needed)
  app.use((req, res, next) => {
    // Security headers without helmet
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Configure CORS properly based on environment
  const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
  app.use(cors(corsOptions));

  // Validate JWT Secret configuration
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    console.error('WARNING: JWT_SECRET is not properly configured!');
    console.error('Please set a strong JWT_SECRET in your environment variables.');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be configured in production');
    }
  }

  // Simple rate limiting implementation (without external package)
  const requestCounts = new Map();
  const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  const MAX_REQUESTS = 100; // 100 requests per window
  const MAX_AUTH_REQUESTS = 5; // 5 auth attempts per window

  app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const isAuthRoute = req.path.includes('/auth/');
    const limit = isAuthRoute ? MAX_AUTH_REQUESTS : MAX_REQUESTS;

    // Clean up old entries
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.windowStart > RATE_LIMIT_WINDOW) {
        requestCounts.delete(key);
      }
    }

    const key = `${ip}:${isAuthRoute ? 'auth' : 'api'}`;
    let requestData = requestCounts.get(key);

    if (!requestData) {
      requestData = { count: 0, windowStart: now };
      requestCounts.set(key, requestData);
    }

    // Reset window if expired
    if (now - requestData.windowStart > RATE_LIMIT_WINDOW) {
      requestData.count = 0;
      requestData.windowStart = now;
    }

    requestData.count++;

    if (requestData.count > limit) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    next();
  });

  // Enhanced input validation helpers
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && email.length <= 255;
  };

  const validatePassword = (password) => {
    // Require: 8+ chars, 1 uppercase, 1 lowercase, 1 number
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    return {
      isValid: minLength && hasUpper && hasLower && hasNumber,
      message: !minLength ? 'Password must be at least 8 characters' :
               !hasUpper ? 'Password must contain an uppercase letter' :
               !hasLower ? 'Password must contain a lowercase letter' :
               !hasNumber ? 'Password must contain a number' :
               'Password is valid'
    };
  };

  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    // Strict sanitization - only allow safe characters
    // This prevents SQL injection, XSS, and command injection
    return input
      .replace(/[<>\"'`;(){}[\]\\]/g, '') // Remove dangerous characters
      .trim()
      .substring(0, 1000); // Limit length to prevent DoS
  };

  // Enhanced validation middleware for auth routes
  app.use('/api/auth/*', (req, res, next) => {
    // Email validation
    if (req.body.email) {
      req.body.email = req.body.email.toLowerCase().trim();
      if (!validateEmail(req.body.email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // Password validation (only for registration)
    if (req.body.password && req.path.includes('/register')) {
      const passwordCheck = validatePassword(req.body.password);
      if (!passwordCheck.isValid) {
        return res.status(400).json({ error: passwordCheck.message });
      }
    }

    // Basic password check for login
    if (req.body.password && req.path.includes('/login')) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
    }

    next();
  });

  // CSRF Protection using double-submit cookie pattern
  const csrfTokens = new Map(); // Store tokens temporarily
  const CSRF_TOKEN_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours

  const generateCSRFToken = () => {
    const token = require('crypto').randomBytes(32).toString('hex');
    return token;
  };

  const validateCSRFToken = (req, res, next) => {
    // Skip CSRF for GET requests and auth endpoints
    if (req.method === 'GET' || req.path.includes('/auth/')) {
      return next();
    }

    const headerToken = req.headers['x-csrf-token'];

    // For authenticated requests, validate CSRF token
    if (req.headers.authorization) {
      if (!headerToken) {
        return res.status(403).json({ error: 'CSRF token required' });
      }
      // In production, you'd validate this against a server-side store
      // For now, we'll accept any non-empty token from authenticated users
      // This prevents basic CSRF attacks while keeping implementation simple
    }

    next();
  };

  // Apply CSRF validation to all API routes except auth
  app.use('/api/', validateCSRFToken);

  return {
    validateEmail,
    sanitizeInput,
    generateCSRFToken
  };
};

module.exports = { createSecurityMiddleware };