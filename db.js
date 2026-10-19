require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Neon requiere una conexión segura SSL
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : false,
});

module.exports = pool;
