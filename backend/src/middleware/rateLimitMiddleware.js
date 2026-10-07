/**
 * Rate Limiting Middleware for Master Production Security Hardening
 * Protects authentication, OTP, uploads, and sensitive API endpoints against:
 * - Brute force attacks
 * - Credential stuffing
 * - Resource exhaustion & DoS
 */

const createRateLimiter = ({ windowMs = 60 * 1000, max = 100, message = 'Too many requests, please try again later.' }) => {
  const store = new Map(); // ip -> { count: number, resetTime: number }

  // Periodic cleanup of expired entries every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 2 * 60 * 1000);
  cleanupInterval.unref();

  return (req, res, next) => {
    // Determine client IP safely
    let clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // First IP in list is client IP
      const parts = String(forwarded).split(',');
      if (parts.length > 0 && parts[0].trim()) {
        clientIp = parts[0].trim();
      }
    }

    const now = Date.now();
    let record = store.get(clientIp);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      store.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: `${retryAfterSeconds}s`
      });
    }

    next();
  };
};

// Standard rate limiters
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
});

const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 8,
  message: 'Too many OTP requests from this IP address. Please wait 10 minutes before requesting again.'
});

const uploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 25,
  message: 'Upload rate limit exceeded. Please wait a few minutes before uploading more files.'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: 'API rate limit exceeded. Please slow down your requests.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
  apiLimiter
};
