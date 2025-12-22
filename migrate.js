require("dotenv").config();
const mysql = require("mysql2/promise");

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: Number(process.env.MYSQLPORT),
  });

  console.log("Connected to DB");

  // 1️⃣ Tambah kolom disease_slug jika belum ada
  await db.execute(`
    ALTER TABLE viewed_diseases
    ADD COLUMN IF NOT EXISTS disease_slug VARCHAR(255)
  `);

  console.log("Column disease_slug OK");

  // 2️⃣ Tambah UNIQUE constraint (user_id + disease_slug)
  await db.execute(`
    ALTER TABLE viewed_diseases
    ADD UNIQUE KEY unique_user_disease (user_id, disease_slug)
  `);

  console.log("UNIQUE constraint OK");

  await db.end();
  console.log("Migration finished");
}

migrate().catch(err => {
  console.error("Migration error:", err);
});
