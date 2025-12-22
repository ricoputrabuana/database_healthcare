require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

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

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
});


app.post('/users', (req, res) => {
    const { name, email, password } = req.body;

      if (!password || password.trim() === "") {
        return res.status(400).json({ error: "Password wajib diisi" });
      }

    db.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, password],
        (err, result) => {
            if (err) return res.status(500).json(err);

            res.json({
                success: true,
                message: "Registrasi berhasil",
                id: result.insertId
            });
        }
    );
});

/* ================================
            LOGIN MANUAL
================================ */
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Email tidak terdaftar"
                });
            }

            const user = result[0];

            // Akun Google (password NULL) tidak boleh login manual
            if (user.password === null) {
                return res.status(400).json({
                    success: false,
                    message: "Akun ini hanya bisa login menggunakan Google"
                });
            }

            // (Belum hashing sesuai permintaan)
            if (user.password !== password) {
                return res.status(400).json({
                    success: false,
                    message: "Password salah"
                });
            }

            res.json({
                success: true,
                message: "Login berhasil",
                user
            });
        }
    );
});

/* ================================
            LOGIN GOOGLE
================================ */
app.post("/google_login", (req, res) => {
    console.log("GOOGLE LOGIN BODY:", req.body);
    const { name, email } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Email Google tidak ditemukan"
        });
    }

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, result) => {
            if (err) {
                console.log("SELECT ERROR:", err);
                return res.status(500).json(err);
            }

            // CASE 1 — Email belum terdaftar → Buat akun Google
            if (result.length === 0) {
                db.query(
                    "INSERT INTO users (name, email, password) VALUES (?, ?, NULL)",
                    [name, email],
                    (err2, result2) => {
                        if (err2) {
                            console.log("INSERT ERROR:", err2);
                            return res.status(500).json(err2);
                        }

                        return res.json({
                            success: true,
                            message: "Akun Google berhasil dibuat",
                            user: {
                                id: result2.insertId,
                                name,
                                email
                            }
                        });

                    }
                );
            }

            // CASE 2 — Email milik akun Google (password NULL)
            else if (result[0].password === null) {
                return res.json({
                    success: true,
                    message: "Login Google berhasil",
                    user: result[0]
                });
            }

            // CASE 3 — Email milik akun manual (punya password)
            else {
                return res.status(400).json({
                    success: false,
                    message: "Email ini terdaftar dengan password. Silakan login manual."
                });
            }
        }
    );
});

/* ================================
           GET USER BY ID
================================ */
app.get('/users/:id', (req, res) => {
    db.query(
        "SELECT id, name, email FROM users WHERE id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                console.error("GET USER ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: "User tidak ditemukan" });
            }

            res.json(result[0]);
        }
    );
});

app.post("/viewed-diseases", (req, res) => {
  const { user_id, disease_name, disease_slug } = req.body;

  if (!user_id || !disease_name || !disease_slug) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  db.query(
    `INSERT IGNORE INTO viewed_diseases (user_id, disease_name, disease_slug)
     VALUES (?, ?, ?)`,
    [user_id, disease_name.trim(), disease_slug.trim()],
    (err) => {
      if (err) {
        console.error("SAVE DISEASE ERROR:", err);
        return res.status(500).json(err);
      }
      res.json({ success: true });
    }
  );
});

// ================================
// SAVE VIEWED ARTICLE
// ================================
app.post("/viewed-articles", (req, res) => {
  const { user_id, article_title } = req.body;

  db.query(
    `INSERT IGNORE INTO viewed_articles (user_id, article_title)
     VALUES (?, ?)`,
    [user_id, article_title],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

app.get("/users/:id/history", (req, res) => {
  const userId = req.params.id;

  const diseasesQuery =
    "SELECT disease_name, disease_slug FROM viewed_diseases WHERE user_id = ?";
  const articlesQuery =
    "SELECT article_title FROM viewed_articles WHERE user_id = ?";

  db.query(diseasesQuery, [userId], (err, diseases) => {
    if (err) return res.status(500).json(err);

    db.query(articlesQuery, [userId], (err2, articles) => {
      if (err2) return res.status(500).json(err2);

      res.json({
        diseases: diseases.map(d => ({
          name: d.disease_name,
          slug: d.disease_slug
        })),
        articles: articles.map(a => a.article_title),
      });
    });
  });
});

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

      CONSTRAINT fk_viewed_diseases_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `;

  const viewedArticlesTable = `
    CREATE TABLE IF NOT EXISTS viewed_articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      article_title VARCHAR(255) NOT NULL,
      article_slug VARCHAR(255) NOT NULL,

      UNIQUE KEY unique_user_article (user_id, article_slug),

      CONSTRAINT fk_viewed_articles_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `;

  db.query(usersTable, (err) => {
    if (err) return console.error("❌ users table error:", err);

    db.query(viewedDiseasesTable, (err) => {
      if (err) return console.error("❌ viewed_diseases table error:", err);

      db.query(viewedArticlesTable, (err) => {
        if (err) return console.error("❌ viewed_articles table error:", err);

        console.log("✅ All tables created successfully");
      });
    });
  });
}


const port = process.env.PORT || 8080;

app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});
