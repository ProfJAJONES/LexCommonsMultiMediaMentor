const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.json', '.docx', '.doc', '.html', '.csv']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/library');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new Error('File type not allowed'));
  }
});

// Professor: upload file
router.post('/', requireAuth, requireRole('professor'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const result = await db.query(
      `INSERT INTO professor_library (professor_id, filename, originalname, mimetype, size)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.user_id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
    );
    res.status(201).json({ file: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Professor: list their files
router.get('/', requireAuth, requireRole('professor'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM professor_library WHERE professor_id = $1 ORDER BY uploaded_at DESC',
      [req.user.user_id]
    );
    res.json({ files: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Professor: delete file
router.delete('/:id', requireAuth, requireRole('professor'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM professor_library WHERE id = $1 AND professor_id = $2',
      [req.params.id, req.user.user_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'File not found' });

    // Delete from disk
    const filepath = path.join(uploadDir, result.rows[0].filename);
    await fs.promises.unlink(filepath).catch(() => {});

    await db.query('DELETE FROM professor_library WHERE id = $1', [req.params.id]);
    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get professor library context for AI (called when student is in a class)
router.get('/context/:professorId', requireAuth, async (req, res) => {
  try {
    // Verify the requesting student is enrolled in this professor's class
    const enrollment = await db.query(
      `SELECT enrollments.id FROM enrollments
       JOIN classes ON enrollments.class_id = classes.id
       WHERE enrollments.student_id = $1 AND classes.professor_id = $2`,
      [req.user.user_id, req.params.professorId]
    );

    if (!enrollment.rows.length && req.user.user_id !== req.params.professorId) {
      return res.status(403).json({ error: 'Not enrolled in this professor\'s class' });
    }

    const files = await db.query(
      'SELECT * FROM professor_library WHERE professor_id = $1 ORDER BY uploaded_at ASC',
      [req.params.professorId]
    );

    // Read text-readable files
    const textTypes = new Set(['text/plain', 'text/html', 'text/markdown', 'application/json']);
    const contexts = await Promise.all(files.rows.map(async (file) => {
      const filepath = path.join(uploadDir, file.filename);
      try { await fs.promises.access(filepath); } catch { return null; }
      if (textTypes.has(file.mimetype)) {
        try {
          const content = (await fs.promises.readFile(filepath, 'utf8')).slice(0, 4000);
          return { name: file.originalname, content };
        } catch { return null; }
      }
      return { name: file.originalname, content: '[Binary file — use filename as context reference]' };
    }));
    const validContexts = contexts.filter(Boolean);

    res.json({ contexts: validContexts, fileCount: files.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;