const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Resend } = require('resend');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const resend = new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

router.post('/register', async (req, res) => {
  const { email, password, full_name, profCode } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password and full name are required' });
  }
  const userRole = (profCode && profCode === process.env.PROFESSOR_CODE) ? 'professor' : 'student';
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const password_hash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const result = await db.query(
      'INSERT INTO users (email, password_hash, role, full_name, verification_token) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, full_name',
      [email, password_hash, userRole, full_name, verificationToken]
    );
    const newUser = result.rows[0];

    // Send verification email
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    resend.emails.send({
      from: 'Law School Commons <noreply@lawschoolcommons.com>',
      to: email,
      subject: 'Verify your Law School Commons email',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <h1 style="font-size:24px;font-weight:700;color:#0d1117;margin-bottom:8px;">Verify your email</h1>
          <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Hi ${escapeHtml(full_name)}, click below to verify your Law School Commons account.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#4a9eff;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Verify Email
          </a>
          <p style="color:#999;font-size:13px;margin-top:24px;">If you didn't create this account, ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
          <p style="color:#bbb;font-size:12px;">Law School Commons</p>
        </div>
      `
    }).catch(err => console.error('Verification email error:', err));

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify email token
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const result = await db.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id',
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired token' });
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(64).toString('hex');
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expires]
    );
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires
    });
    res.json({ user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name, email_verified: user.email_verified } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM sessions WHERE token = $1', [req.cookies.token]);
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT email_verified, onboarding_completed, streak, longest_streak FROM users WHERE id = $1', [req.user.user_id]);
    const emailVerified = result.rows[0]?.email_verified || false;
    const onboardingCompleted = result.rows[0]?.onboarding_completed || false;
    const streak = result.rows[0]?.streak || 0;
    const longestStreak = result.rows[0]?.longest_streak || 0;
    res.json({ user: { id: req.user.user_id, email: req.user.email, role: req.user.role, full_name: req.user.full_name, email_verified: emailVerified, onboarding_completed: onboardingCompleted, streak, longest_streak: longestStreak } });
  } catch (err) {
    res.json({ user: { id: req.user.user_id, email: req.user.email, role: req.user.role, full_name: req.user.full_name } });
  }
});

// Update profile
router.patch('/profile', requireAuth, async (req, res) => {
  const { full_name, email, current_password, new_password, school_name, school_url } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.user_id]);
    const user = userResult.rows[0];

    if (new_password) {
      if (!current_password) return res.status(400).json({ error: 'Current password is required' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const updates = [];
    const values = [];
    let i = 1;

    if (full_name) { updates.push(`full_name = $${i++}`); values.push(full_name); }
    if (email) { updates.push(`email = $${i++}`); values.push(email); }
    if (new_password) {
      const hash = await bcrypt.hash(new_password, 12);
      updates.push(`password_hash = $${i++}`); values.push(hash);
    }
    if (school_name) { updates.push(`school_name = $${i++}`); values.push(school_name); }
    if (school_url !== undefined) { updates.push(`school_url = $${i++}`); values.push(school_url); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.user.user_id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`, values);

    if (new_password) {
      await db.query('DELETE FROM sessions WHERE user_id = $1 AND token != $2', [req.user.user_id, req.cookies.token]);
    }

    res.json({ message: 'Profile updated' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Resend verification email
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT full_name, email, email_verified FROM users WHERE id = $1', [req.user.user_id]);
    const user = result.rows[0];
    if (user.email_verified) return res.status(400).json({ error: 'Email already verified' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await db.query('UPDATE users SET verification_token = $1 WHERE id = $2', [verificationToken, req.user.user_id]);

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await resend.emails.send({
      from: 'Law School Commons <noreply@lawschoolcommons.com>',
      to: user.email,
      subject: 'Verify your Law School Commons email',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <h1 style="font-size:24px;font-weight:700;color:#0d1117;margin-bottom:8px;">Verify your email</h1>
          <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Hi ${escapeHtml(user.full_name)}, click below to verify your Law School Commons account.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#4a9eff;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Verify Email
          </a>
        </div>
      `
    });

    res.json({ message: 'Verification email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Update streak on activity
router.post('/activity', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT streak, longest_streak, last_activity_date FROM users WHERE id = $1',
      [req.user.user_id]
    );
    const user = result.rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const last  = user.last_activity_date ? new Date(user.last_activity_date).toISOString().slice(0, 10) : null;

    if (last === today) return res.json({ streak: user.streak, longest_streak: user.longest_streak });

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = (last === yesterday) ? user.streak + 1 : 1;
    const newLongest = Math.max(newStreak, user.longest_streak || 0);

    await db.query(
      'UPDATE users SET streak = $1, longest_streak = $2, last_activity_date = $3 WHERE id = $4',
      [newStreak, newLongest, today, req.user.user_id]
    );

    res.json({ streak: newStreak, longest_streak: newLongest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete onboarding
router.post('/complete-onboarding', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE users SET onboarding_completed = TRUE WHERE id = $1', [req.user.user_id]);
    res.json({ message: 'Onboarding completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restart onboarding
router.post('/restart-onboarding', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE users SET onboarding_completed = FALSE WHERE id = $1', [req.user.user_id]);
    res.json({ message: 'Onboarding reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
