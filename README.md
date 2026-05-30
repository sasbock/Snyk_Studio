# Snyk Studio Demo App

A small Express web application with a login screen, built **intentionally
insecure** for security-scanning demos (SCA + SAST). Do **not** deploy this.

## Run

```bash
npm install
npm start
```

Then open http://localhost:3000

Seeded users:

| username | password   | role  |
|----------|------------|-------|
| admin    | admin123   | admin |
| alice    | password1  | user  |
| bob      | hunter2    | user  |

## Intentional vulnerabilities

### 1. SQL injection — login (`server.js`, `POST /login`)
The login query is built by string concatenation:

```js
"SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'"
```

Auth bypass — log in as `admin` without a password by entering this as the
**username** (and any password):

```
admin'--
```

…or log in as the first user with username `' OR '1'='1` and password `' OR '1'='1`.

### 2. SQL injection — notes search (`server.js`, `GET /search`)
The search term is concatenated into a `LIKE` clause. Example payload in the
search box to dump every user's notes regardless of owner:

```
%' OR '1'='1
```

### 3. Vulnerable dependencies (`package.json`)
Pinned to old, known-vulnerable releases, e.g.:

- `lodash@4.17.4` — prototype pollution (exercised via `POST /profile`, which
  calls `_.merge` on untrusted JSON)
- `express@4.16.0`, `body-parser@1.18.2`, `ejs@2.5.7`, `sqlite3@4.0.6` —
  outdated direct/transitive dependencies with published advisories

### 4. Misc weaknesses
- Hard-coded session secret (`keyboard-cat`)
- Passwords stored in plaintext
