const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 8005;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
});

// Auto-seed if database is clean
const seedData = require('./seed/seed');
async function startServer() {
  const usersCount = await db.users.count();
  if (usersCount === 0) {
    console.log('No data found in datastore. Running seed...');
    await seedData();
  }

  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Agent Manager API Server running on port ${PORT}`);
    console.log(`🌐 Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`=============================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
