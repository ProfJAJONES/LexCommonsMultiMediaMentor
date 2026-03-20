const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Resend } = require('resend');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate a readable class code like TORTS-4K2X
function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
}

// Professor: create a class
router.post('/', requireAuth, requireRole('professor'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Class name is required' });

  try {
    let code, attempts = 0;
    while (attempts < 10) {
      code = generateCode();
      const exists = await db.query('SELECT id FROM classes WHERE code = $1', [code]);
      if (!exists.rows.length) break;
      attempts++;
    }

    const result = await db.query(
      'INSERT INTO classes (name, code, professor_id) VALUES ($1, $2, $3) RETURNING *',
      [name, code, req.user.user_id]
    );
    res.status(201).json({ class: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Professor: get their classes
router.get('/', requireAuth, requireRole('professor'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT classes.*,
        COUNT(enrollments.id) AS student_count
       FROM classes
       LEFT JOIN enrollments ON enrollments.class_id = classes.id
       WHERE classes.professor_id = $1
       GROUP BY classes.id
       ORDER BY classes.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Professor: delete a class
router.delete('/:id', requireAuth, requireRole('professor'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM classes WHERE id = $1 AND professor_id = $2',
      [req.params.id, req.user.user_id]
    );
    res.json({ message: 'Class deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Professor: get students in a class with progress
router.get('/:id/students', requireAuth, requireRole('professor'), async (req, res) => {
  try {
    const classResult = await db.query(
      'SELECT * FROM classes WHERE id = $1 AND professor_id = $2',
      [req.params.id, req.user.user_id]
    );
    if (!classResult.rows.length) return res.status(403).json({ error: 'Access denied' });

    const students = await db.query(
      `SELECT 
        users.id,
        users.full_name,
        users.email,
        users.last_login,
        enrollments.enrolled_at,
        COUNT(DISTINCT progress.id) AS steps_completed,
        COUNT(DISTINCT quiz_scores.id) AS quizzes_completed
       FROM enrollments
       JOIN users ON enrollments.student_id = users.id
       LEFT JOIN progress ON progress.user_id = users.id
       LEFT JOIN quiz_scores ON quiz_scores.user_id = users.id
       WHERE enrollments.class_id = $1
       GROUP BY users.id, users.full_name, users.email, users.last_login, enrollments.enrolled_at
       ORDER BY users.full_name ASC`,
      [req.params.id]
    );

    const topicProgress = await db.query(
      `SELECT 
        progress.user_id,
        progress.topic_id,
        COUNT(*) AS steps_completed
       FROM progress
       JOIN enrollments ON enrollments.student_id = progress.user_id
       WHERE enrollments.class_id = $1
       GROUP BY progress.user_id, progress.topic_id`,
      [req.params.id]
    );

    res.json({
      class: classResult.rows[0],
      students: students.rows,
      topicProgress: topicProgress.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Professor: send announcement to all students
router.post('/:id/announce', requireAuth, requireRole('professor'), async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });

  try {
    const classResult = await db.query(
      'SELECT * FROM classes WHERE id = $1 AND professor_id = $2',
      [req.params.id, req.user.user_id]
    );
    if (!classResult.rows.length) return res.status(403).json({ error: 'Not authorized' });
    const cls = classResult.rows[0];

    const students = await db.query(
      `SELECT users.email, users.full_name FROM users
       JOIN enrollments ON enrollments.student_id = users.id
       WHERE enrollments.class_id = $1 AND users.email_verified = TRUE`,
      [req.params.id]
    );

    if (!students.rows.length) return res.status(400).json({ error: 'No verified students enrolled' });

    const sends = students.rows.map(student =>
      resend.emails.send({
        from: 'Law School Commons <noreply@lawschoolcommons.com>',
        to: student.email,
        subject: '[' + cls.name + '] ' + subject,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
            <div style="background:#f0f6fa;border-radius:12px;padding:24px;margin-bottom:24px;">
              <div style="font-size:12px;color:#7a9bb0;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Class Announcement</div>
              <div style="font-size:20px;font-weight:800;color:#1e3a4f;">${cls.name}</div>
            </div>
            <h2 style="font-size:18px;font-weight:700;color:#1e3a4f;margin-bottom:16px;">${escapeHtml(subject)}</h2>
            <div style="font-size:15px;color:#444;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</div>
            <hr style="border:none;border-top:1px solid #e1eef5;margin:32px 0;">
            <p style="color:#bbb;font-size:12px;">You received this because you are enrolled in ${cls.name} on Law School Commons.</p>
          </div>
        `
      }).catch(err => console.error('Email error for', student.email, err))
    );

    await Promise.all(sends);
    res.json({ message: 'Announcement sent to ' + students.rows.length + ' student' + (students.rows.length === 1 ? '' : 's') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Student: join a class by code
router.post('/join', requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Class code is required' });

  try {
    const classResult = await db.query(
      'SELECT * FROM classes WHERE code = $1',
      [code.toUpperCase().trim()]
    );
    if (!classResult.rows.length) return res.status(404).json({ error: 'Class not found — check your code' });

    const cls = classResult.rows[0];

    const existing = await db.query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND class_id = $2',
      [req.user.user_id, cls.id]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'You are already enrolled in this class' });

    await db.query(
      'INSERT INTO enrollments (student_id, class_id) VALUES ($1, $2)',
      [req.user.user_id, cls.id]
    );

    res.json({ message: 'Enrolled successfully', class: { id: cls.id, name: cls.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Student: get their enrolled classes
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT classes.id, classes.name, classes.code, users.full_name AS professor_name, users.id AS professor_id, enrollments.enrolled_at
       FROM enrollments
       JOIN classes ON enrollments.class_id = classes.id
       JOIN users ON classes.professor_id = users.id
       WHERE enrollments.student_id = $1
       ORDER BY enrollments.enrolled_at DESC`,
      [req.user.user_id]
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Student: leave a class
router.delete('/mine/:classId', requireAuth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM enrollments WHERE student_id = $1 AND class_id = $2',
      [req.user.user_id, req.params.classId]
    );
    res.json({ message: 'Left class successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
