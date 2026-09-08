'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
require('dotenv').config();

const authRouter          = require('./routes/auth');
const familyRouter        = require('./routes/family');
const goalsRouter         = require('./routes/goals');
const depositsRouter      = require('./routes/deposits');
const notificationsRouter = require('./routes/notifications');
const voiceRouter         = require('./routes/voice');
const chatRouter          = require('./routes/chat');
const syncRouter          = require('./routes/sync');
const usersRouter         = require('./routes/users');
const errorHandler        = require('./middleware/errorHandler');
const { verifyToken }     = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

const path = require('path');
const { seedDatabase } = require('./scripts/seed');

// ── Security & utility middleware ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve static frontend files directly from Express ─────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ── Health-check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Public client config (exposing only safe public keys, no server secrets) ──
app.get('/api/config', (_req, res) => {
  res.json({
    firebase: {
      apiKey:            process.env.FIREBASE_API_KEY || 'demo-api-key',
      authDomain:        process.env.FIREBASE_AUTH_DOMAIN || 'sanchay-plus-dev.firebaseapp.com',
      projectId:         process.env.FIREBASE_PROJECT_ID || 'sanchay-plus-dev',
      storageBucket:     `${process.env.FIREBASE_PROJECT_ID || 'sanchay-plus-dev'}.appspot.com`,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '1234567890',
      appId:             process.env.FIREBASE_APP_ID || '1:1234567890:web:demo',
    },
  });
});

// ── Seeding endpoint (for demo / dev setup) ──────────────────────────────────
app.post('/api/seed', async (_req, res, next) => {
  try {
    const summary = await seedDatabase();
    res.json({ message: 'Patil family demo dataset seeded successfully', ...summary });
  } catch (err) {
    next(err);
  }
});

// ── Public API routes ─────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Protected API routes ──────────────────────────────────────────────────────
app.use('/api/family',        verifyToken, familyRouter);
app.use('/api/goals',         verifyToken, goalsRouter);
app.use('/api/deposits',      verifyToken, depositsRouter);
app.use('/api/notifications', verifyToken, notificationsRouter);
app.use('/api/voice',         verifyToken, voiceRouter);
app.use('/api/chat',          verifyToken, chatRouter);
app.use('/api/sync',          verifyToken, syncRouter);
app.use('/api/users',         verifyToken, usersRouter);

// ── Root redirect to dashboard ────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.redirect('/pages/dashboard.html');
});

// ── 404 API handler ───────────────────────────────────────────────────────────
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Fallback for single-page routing ──────────────────────────────────────────
app.use((_req, res) => {
  res.redirect('/pages/dashboard.html');
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  // Auto-seed in development mode on startup so all features work immediately
  seedDatabase().catch(err => console.warn('[AutoSeed] Startup notice:', err.message));

  app.listen(PORT, () => {
    console.log(`[Sanchay+] Server running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

module.exports = app;
