require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

// Connect MySQL
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: Number(process.env.MYSQLPORT)
});

// Test connection
db.connect((err) => {
    if (err) {
        console.error("MySQL error:", err);
        return;
    }
    console.log("MySQL Connected!");
});

/* ================================
        REGISTER (MANUAL)
================================ */
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

// ================================
// SAVE VIEWED DISEASE
// ================================
app.post("/viewed-diseases", (req, res) => {
  const { user_id, disease_name } = req.body;

  db.query(
    `INSERT IGNORE INTO viewed_diseases (user_id, disease_name)
     VALUES (?, ?)`,
    [user_id, disease_name],
    (err) => {
      if (err) return res.status(500).json(err);
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
    "SELECT disease_name FROM viewed_diseases WHERE user_id = ?";
  const articlesQuery =
    "SELECT article_title FROM viewed_articles WHERE user_id = ?";

  db.query(diseasesQuery, [userId], (err, diseases) => {
    if (err) return res.status(500).json(err);

    db.query(articlesQuery, [userId], (err2, articles) => {
      if (err2) return res.status(500).json(err2);

      res.json({
        diseases: diseases.map(d => d.disease_name),
        articles: articles.map(a => a.article_title),
      });
    });
  });
});


const port = process.env.PORT || 8080;

app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});
