const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

app.use(bodyParser.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  const email = req.body.email || req.query.email || null;
  db.run(
    'INSERT INTO analytics (user_id, action) VALUES ((SELECT id FROM users WHERE email = ?), ?)',
    [email, req.method + ' ' + req.path],
    () => next()
  );
});

const db = new sqlite3.Database('./gym.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    age INTEGER,
    weight INTEGER,
    goals TEXT,
    points INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS completed_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    workout_id INTEGER,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    feedback TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS wearables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    steps INTEGER,
    heart_rate INTEGER,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

let workouts = [
  { id: 1, name: 'Push Ups', sets: 3, reps: 10 },
  { id: 2, name: 'Squats', sets: 3, reps: 15 },
];

app.post('/signup', (req, res) => {
  const { email, password, age, weight, goals } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      return res.status(400).json({ error: 'User already exists' });
    }
    db.run(
      'INSERT INTO users (email, password, age, weight, goals) VALUES (?, ?, ?, ?, ?)',
      [email, password, age, weight, goals],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({
          message: 'Signup successful',
          user: { id: this.lastID, email, age, weight, goals },
        });
      }
    );
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { id, email: em, age, weight, goals } = user;
    res.json({ message: 'Login successful', user: { id, email: em, age, weight, goals } });
  });
});

app.get('/workouts', (req, res) => {
  res.json(workouts);
});

app.post('/ai-workout', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  db.get('SELECT id, age, weight, goals FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });

    db.all('SELECT feedback FROM feedback WHERE user_id = ?', [user.id], async (fbErr, fbRows) => {
      if (fbErr) return res.status(500).json({ error: 'Database error' });
      const feedbackText = fbRows.map(r => r.feedback).join('\n');
      db.get('SELECT steps, heart_rate FROM wearables WHERE user_id = ? ORDER BY date DESC LIMIT 1', [user.id], async (wErr, wearable) => {
        if (wErr) return res.status(500).json({ error: 'Database error' });
        const wearableInfo = wearable ? `Steps today: ${wearable.steps}, Heart rate: ${wearable.heart_rate}.` : '';
        const prompt = `Create a short workout plan in JSON with three exercises for a user aged ${user.age} weighing ${user.weight}kg with goals: ${user.goals}. ${wearableInfo} Consider the following feedback:\n${feedbackText}`;
      try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({ workout: text });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'LLM error' });
      }
    });
  });
});
});

app.post('/feedback', (req, res) => {
  const { email, feedback } = req.body;
  if (!email || !feedback) {
    return res.status(400).json({ error: 'Email and feedback required' });
  }
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });
    db.run('INSERT INTO feedback (user_id, feedback) VALUES (?, ?)', [user.id, feedback], err2 => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Feedback recorded' });
    });
  });
});

app.post('/log', (req, res) => {
  const { email, workoutId } = req.body;
  if (!email || !workoutId) {
    return res.status(400).json({ error: 'Email and workoutId required' });
  }
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });
    db.run(
      'INSERT INTO completed_workouts (user_id, workout_id) VALUES (?, ?)',
      [user.id, workoutId],
      err => {
        if (err) return res.status(500).json({ error: 'Database error' });
        db.run('UPDATE users SET points = points + 10 WHERE id = ?', [user.id]);
        db.get('SELECT points FROM users WHERE id = ?', [user.id], (e2, row) => {
          res.json({ message: 'Workout logged', points: row ? row.points : 0 });
        });
      }
    );
  });
});

app.get('/logs', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });
    db.all(
      'SELECT workout_id, date FROM completed_workouts WHERE user_id = ?',
      [user.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
      }
    );
  });
});

app.get('/tutorials', (_req, res) => {
  res.json([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=VbfpW0pbvaU'
  ]);
});

app.post('/voice', (req, res) => {
  const { email, transcript } = req.body;
  if (!email || !transcript) {
    return res.status(400).json({ error: 'Email and transcript required' });
  }
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });
    db.run('INSERT INTO feedback (user_id, feedback) VALUES (?, ?)', [user.id, transcript]);
    res.json({ message: 'Voice feedback recorded' });
  });
});

app.post('/wearable', (req, res) => {
  const { email, steps, heart_rate } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });
    db.run(
      'INSERT INTO wearables (user_id, steps, heart_rate) VALUES (?, ?, ?)',
      [user.id, steps || 0, heart_rate || 0]
    );
    res.json({ message: 'Wearable data saved' });
  });
});

app.post('/share', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  res.json({ link: `https://example.com/share?user=${encodeURIComponent(email)}` });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
