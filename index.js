const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./gym.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    age INTEGER,
    weight INTEGER,
    goals TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS completed_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    workout_id INTEGER,
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
        res.json({ message: 'Workout logged' });
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
