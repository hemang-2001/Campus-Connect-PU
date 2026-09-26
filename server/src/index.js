import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

import trackingRoutes from './routes/tracking.js';
import complaintsRoutes from './routes/complaints.js';
import alertsRoutes from './routes/alerts.js';
import profileRoutes from './routes/profile.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// 1. Security & Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        CORS_ORIGIN === '*' ||
        origin === CORS_ORIGIN ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        origin.includes('loca.lt') ||
        origin.includes('ngrok')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '32kb' }));

// 2. Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'campus-connect-server',
    timestamp: new Date().toISOString()
  });
});

// 3. Mount API routes
app.use('/api/tracking', trackingRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/auth', authRoutes);

// 4. 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// 5. Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Campus Connect API running on port ${PORT}`);
  console.log(`📡 CORS allowed for: ${CORS_ORIGIN}`);
});

export default app;
