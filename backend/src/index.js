require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Use DATABASE_URL for PostgreSQL connection string
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

app.get("/users", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT email FROM users");
    res.json(result.rows);
  } catch (error) {
    console.log("Error fetching users:", error);
    res.status(500).send();
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({ message: "Logged in successfully", token });
  } catch (error) {
    console.log("Error during login:", error);
    res.status(500).send();
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailCheck = await pool.query(
      "SELECT email FROM users WHERE email = $1",
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [
      email,
      hashedPass,
    ]);
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.log("Error during signup:", error);
    res.status(500).send();
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
