const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const storyRoutes = require('./routes/stories');
const uploadRoutes = require('./routes/upload');
const errorHandler = require('./middleware/errorHandler');

require('dotenv').config();

if (!process.env.ACCESS_TOKEN_SECRET) {
    console.error('FATAL ERROR: ACCESS_TOKEN_SECRET is not defined.');
    process.exit(1);
}

// Connect to Database
connectDB();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const app = express();

/**
 * CORS / Preflight handling
 * - The frontend runs on port 3000; backend runs on port 3001.
 * - Requests may hit both /api/* and non-/api paths (e.g. /auth/register) depending on FE configuration.
 * - We therefore handle preflight globally and configure an origin allowlist.
 *
 * ENV:
 *  - REACT_APP_FRONTEND_URL: optional; if set, is treated as an allowed Origin.
 */
const allowedOrigins = new Set(
  [
    process.env.REACT_APP_FRONTEND_URL, // e.g. https://...:3000
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean)
);

// We echo back the origin when allowed (required if credentials are ever enabled).
const corsOptionsDelegate = (req, callback) => {
  const requestOrigin = req.header('Origin');

  // Non-browser clients (no Origin header) should be allowed.
  if (!requestOrigin) {
    return callback(null, {
      origin: false, // do not add ACAO header when there is no Origin
    });
  }

  if (allowedOrigins.has(requestOrigin)) {
    return callback(null, {
      origin: requestOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      exposedHeaders: ['Content-Length'],
      maxAge: 86400, // cache preflight for 24h
      optionsSuccessStatus: 204,
    });
  }

  // Reject unknown origins but still respond (without ACAO) instead of crashing.
  return callback(null, {
    origin: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  });
};

app.use(cors(corsOptionsDelegate));

/**
 * Global preflight handler.
 * This ensures OPTIONS never falls through to missing routes / upstream 502s.
 */
app.options('*', cors(corsOptionsDelegate));

app.use(express.json());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  let protocol = req.protocol;

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');
  
  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Routes (canonical)
app.use('/api/auth', authRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/upload', uploadRoutes);

/**
 * Backwards-compatible route aliases.
 * Some frontends may call /auth/* instead of /api/auth/*.
 * Keeping these prevents CORS/preflight failures due to path mismatch.
 */
app.use('/auth', authRoutes);
app.use('/stories', storyRoutes);
app.use('/upload', uploadRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Travel Story Backend API' });
});

// Error Handler
app.use(errorHandler);

module.exports = app;
