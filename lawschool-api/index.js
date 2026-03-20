require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const contentRoutes = require('./routes/content');
const passwordResetRoutes = require('./routes/passwordReset');
const userApiKeyRoutes = require('./routes/userApiKey');
const classRoutes = require('./routes/classes');
const libraryRoutes = require('./routes/library');
const adminRoutes = require('./routes/admin');
const bookmarkRoutes = require('./routes/bookmarks');
const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map(o => o.trim()).filter(Boolean);
if (!allowedOrigins.length) {
  console.warn('WARNING: FRONTEND_URL is not set. CORS will block all cross-origin requests.');
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user/apikey', userApiKeyRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/auth', passwordResetRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});