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

// Get all users
app.get('/users', (req, res) => {
    db.query("SELECT * FROM users", (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Insert new user
app.post('/users', (req, res) => {
    const { nama, email } = req.body;

    db.query(
        "INSERT INTO users (nama, email) VALUES (?, ?)",
        [nama, email],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.json({ success: true, id: result.insertId });
        }
    );
});

// Get user by ID
app.get('/users/:id', (req, res) => {
    db.query(
        "SELECT * FROM users WHERE id = ?",
        [req.params.id],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.json(result[0]);
        }
    );
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
