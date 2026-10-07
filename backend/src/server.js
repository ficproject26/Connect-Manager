const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./config/db');
const { realtimeWebSocketServer } = require('./realtime');
const { sanitizeInput } = require('./middleware/sanitizeMiddleware');
const { apiLimiter } = require('./middleware/rateLimitMiddleware');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 8005;

// Trust reverse proxy (Vercel, AWS ALB, Nginx)
app.set('trust proxy', 1);

// Remove Express fingerprinting
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Strict Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy restricting unnecessary browser features
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(), payment=()');
  // Cross-Origin Isolation
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Enforce HSTS in production or over HTTPS
  if (process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self'; connect-src 'self' https: wss: ws:; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
  );

  next();
});

// Explicit CORS Origin Allowlist
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://connect-manager.vercel.app',
  'https://manager.ficapp.in'
];

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
    const trimmed = o.trim();
    if (trimmed && !ALLOWED_ORIGINS.includes(trimmed)) {
      ALLOWED_ORIGINS.push(trimmed);
    }
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, server-to-server curl, health checks)
    if (!origin) return callback(null, true);
    
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      if (allowed === origin) return true;
      // Allow dynamic subdomains for configured apex domain if needed
      if (origin.endsWith('.vercel.app') || origin.endsWith('.ficapp.in')) return true;
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Error: Origin '${origin}' is not authorized by access control policy.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  maxAge: 86400
}));

// Request Body Limits (DoS protection against memory exhaustion)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Global Input Sanitization against NoSQL injection & prototype pollution
app.use(sanitizeInput);

// Global API rate limiting
app.use('/api', apiLimiter);

// Serve static uploads with nosniff and caching
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Agent Manager Portal Backend API'
  });
});

// Routes (Manager Portal Scope)
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const locationRoutes = require('./routes/locationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const managerDirectoryRoutes = require('./routes/managerDirectoryRoutes');
const { router: notificationRoutes } = require('./routes/notificationRoutes');
const taskRoutes = require('./routes/taskRoutes');
const shopVisitRoutes = require('./routes/shopVisitRoutes');
const agentRoutes = require('./routes/agentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const managerOnboardingRoutes = require('./routes/managerOnboardingRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api', locationRoutes); // /api/states, /api/districts, /api/divisions, /api/pincodes
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/managers', managerDirectoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/qc-tasks', taskRoutes);
app.use('/api/shop-visits', shopVisitRoutes);
app.use('/api/operations', agentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/manager-onboarding', managerOnboardingRoutes);

// Centralized production-safe error handling
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = err.status || (err.message && err.message.includes('CORS') ? 403 : 500);
  
  if (!isProd) {
    console.error('Unhandled server error:', err.stack || err.message);
  } else if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: isProd && statusCode >= 500
      ? 'An unexpected internal server error occurred. Please try again later.'
      : (err.message || 'An error occurred.')
  });
});

async function startServer() {
  const server = http.createServer(app);
  realtimeWebSocketServer.attach(server);

  server.listen(PORT, () => {
    console.log('=============================================');
    console.log(`Agent Manager API Server running on port ${PORT}`);
    console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`Realtime WS: ws://localhost:${PORT}/ws`);
    console.log('=============================================');
  });

  if (db.initDatabase) {
    db.initDatabase().catch(e => console.warn('[Manager Database] Init error:', e.message));
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
