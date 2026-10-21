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
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    // Determine client key safely:
    // Prioritize authenticated user ID so individual managers/agents
    // are not throttled together when proxying through shared Vercel/gateway IPs
    let clientKey = req.user?.id || req.user?._id || null;
    if (!clientKey) {
      let clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        // First IP in list is client IP
        const parts = String(forwarded).split(',');
        if (parts.length > 0 && parts[0].trim()) {
          clientIp = parts[0].trim();
        }
      }
      clientKey = clientIp;
    }

    // Provide higher ceiling for authenticated staff (managers/agents)
    const effectiveMax = req.user ? Math.max(max, 1000) : max;

    const now = Date.now();
    let record = store.get(clientKey);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      store.set(clientKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, effectiveMax - record.count);
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', effectiveMax);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > effectiveMax) {
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
  max: 60,
  message: 'Too many authentication attempts. Please try again after 15 minutes.'
});

const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // High limit to accommodate testing and development OTP flows
  message: 'Too many OTP requests. Please wait a few minutes before requesting again.'
});

const uploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500, // Raised from 25 to 500 to accommodate multi-file vendor onboarding (images, logo, docs)
  message: 'Upload rate limit exceeded. Please wait a few minutes before uploading more files.'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 600,
  message: 'API rate limit exceeded. Please slow down your requests.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
  apiLimiter
};
