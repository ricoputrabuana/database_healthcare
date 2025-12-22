require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

/* ================================
           DATABASE POOL
================================ */
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: Number(process.env.MYSQLPORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* ================================
          CREATE TABLES
================================ */
function createTables() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) DEFAULT NULL
    )
  `;

  const viewedDiseasesTable = `
    CREATE TABLE IF NOT EXISTS viewed_diseases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      disease_name VARCHAR(255) NOT NULL,
      disease_slug VARCHAR(255) NOT NULL,
      UNIQUE KEY unique_user_disease (user_id, disease_slug),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const viewedArticlesTable = `
    CREATE TABLE IF NOT EXISTS viewed_articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      article_title VARCHAR(255) NOT NULL,
      article_slug VARCHAR(255) NOT NULL,
      UNIQUE KEY unique_user_article (user_id, article_slug),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  db.query(usersTable, err => {
    if (err) return console.error("❌ users table error:", err);

    db.query(viewedDiseasesTable, err => {
      if (err) return console.error("❌ viewed_diseases table error:", err);

      db.query(viewedArticlesTable, err => {
        if (err) return console.error("❌ viewed_articles table error:", err);

        console.log("✅ All tables created successfully");
      });
    });
  });
}

/* ================================
           AUTH & USERS
================================ */
app.post('/users', (req, res) => {
  const { name, email, password } = req.body;

  db.query(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, password],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true, id: result.insertId });
    }
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0)
        return res.status(400).json({ message: "Email tidak terdaftar" });

      const user = result[0];
      if (user.password !== password)
        return res.status(400).json({ message: "Password salah" });

      res.json({ success: true, user });
    }
  );
});

/* ================================
        SAVE VIEWED DISEASE
================================ */
app.post("/viewed-diseases", (req, res) => {
  const { user_id, disease_name, disease_slug } = req.body;

  db.query(
    `INSERT IGNORE INTO viewed_diseases 
     (user_id, disease_name, disease_slug)
     VALUES (?, ?, ?)`,
    [user_id, disease_name, disease_slug],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

/* ================================
        SAVE VIEWED ARTICLE
================================ */
app.post("/viewed-articles", (req, res) => {
  const { user_id, article_title, article_slug } = req.body;

  db.query(
    `INSERT IGNORE INTO viewed_articles
     (user_id, article_title, article_slug)
     VALUES (?, ?, ?)`,
    [user_id, article_title, article_slug],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

/* ================================
           USER HISTORY
================================ */
app.get("/users/:id/history", (req, res) => {
  const userId = req.params.id;

  db.query(
    "SELECT disease_name, disease_slug FROM viewed_diseases WHERE user_id = ?",
    [userId],
    (err, diseases) => {
      if (err) return res.status(500).json(err);

      db.query(
        "SELECT article_title, article_slug FROM viewed_articles WHERE user_id = ?",
        [userId],
        (err2, articles) => {
          if (err2) return res.status(500).json(err2);

          res.json({ diseases, articles });
        }
      );
    }
  );
});

/* ================================
              START
================================ */
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${port}`);
  createTables();
});
