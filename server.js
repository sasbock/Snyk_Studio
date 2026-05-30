const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const _ = require('lodash');

const { db, ready } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: 'keyboard-cat', // hard-coded secret (intentional weakness)
    resave: false,
    saveUninitialized: true
  })
);

// --- Auth guard ----------------------------------------------------------
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

// --- Routes --------------------------------------------------------------
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: req.query.error || null });
});

// VULNERABLE: SQL injection.
// The username and password are concatenated directly into the SQL string,
// so input like  username = admin'--  or  ' OR '1'='1  bypasses authentication.
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const query =
    "SELECT * FROM users WHERE username = '" +
    username +
    "' AND password = '" +
    password +
    "'";

  console.log('[login] executing query:', query);

  db.get(query, (err, row) => {
    if (err) {
      console.error(err);
      return res.redirect('/login?error=' + encodeURIComponent(err.message));
    }
    if (!row) {
      return res.redirect('/login?error=Invalid+credentials');
    }
    req.session.user = { id: row.id, username: row.username, role: row.role };
    return res.redirect('/dashboard');
  });
});

app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { user: req.session.user, notes: [], q: '' });
});

// VULNERABLE: SQL injection in the notes search.
// The search term is concatenated into a LIKE clause without parameterization.
app.get('/search', requireLogin, (req, res) => {
  const q = req.query.q || '';
  const owner = req.session.user.username;

  const query =
    "SELECT * FROM notes WHERE owner = '" +
    owner +
    "' AND title LIKE '%" +
    q +
    "%'";

  console.log('[search] executing query:', query);

  db.all(query, (err, rows) => {
    if (err) {
      return res.render('dashboard', {
        user: req.session.user,
        notes: [],
        q,
        error: err.message
      });
    }
    res.render('dashboard', { user: req.session.user, notes: rows || [], q });
  });
});

// VULNERABLE: lodash.merge prototype pollution (lodash 4.17.4).
// Untrusted JSON is merged into a config object using a vulnerable lodash version.
app.post('/profile', requireLogin, bodyParser.json(), (req, res) => {
  const profile = {};
  _.merge(profile, req.body);
  res.json({ ok: true, profile });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Wait for the in-memory database to finish initializing before serving.
ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Demo app listening on http://localhost:${PORT}`);
      console.log('Seeded users: admin/admin123, alice/password1, bob/hunter2');
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
