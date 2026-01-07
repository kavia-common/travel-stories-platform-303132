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

// Connect to Database
connectDB();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Travel Story Backend API' });
});

// Error Handler
app.use(errorHandler);

module.exports = app;
