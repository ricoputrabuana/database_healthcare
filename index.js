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
   GET ONE USER (TEST ENDPOINT)
================================ */
app.get("/users", (req, res) => {
    db.query("SELECT name, email FROM users LIMIT 1", (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Database error", details: err });
        }

        if (result.length === 0) {
            return res.json({ name: "No User Found", email: "-" });
        }

        res.json(result[0]);
    });
});

/* ================================
        REGISTER (MANUAL)
================================ */
app.post('/users', (req, res) => {
    const { name, email, password } = req.body;

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
    const { name, email } = req.body;

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, result) => {
            if (err) return res.status(500).json(err);

            // CASE 1 — Email belum terdaftar → Buat akun Google
            if (result.length === 0) {
                db.query(
                    "INSERT INTO users (name, email, password) VALUES (?, ?, NULL)",
                    [name, email],
                    (err2, result2) => {
                        if (err2) return res.status(500).json(err2);

                        return res.json({
                            success: true,
                            message: "Akun Google berhasil dibuat",
                            id: result2.insertId
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
        "SELECT * FROM users WHERE id = ?",
        [req.params.id],
        (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length === 0) {
                return res.status(404).json({ message: "User tidak ditemukan" });
            }

            res.json(result[0]);
        }
    );
});

/* ================================
            START SERVER
================================ */
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
