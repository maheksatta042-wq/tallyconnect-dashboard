import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import requireAuth from "../middleware/requireAuth.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { sendMail } from "../utils/sendMail.js";

const router = express.Router();

// ------------------- TOKEN GENERATOR -------------------
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// ------------------- AUTH ROUTES -------------------

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, isAdmin, companyName } = req.body;

    let companyResult = await pool.query(
      "SELECT id FROM companies WHERE name=$1",
      [companyName]
    );

    let companyId;
    if (companyResult.rows.length === 0) {
      const insertCompany = await pool.query(
        "INSERT INTO companies (name) VALUES ($1) RETURNING id",
        [companyName]
      );
      companyId = insertCompany.rows[0].id;
    } else {
      companyId = companyResult.rows[0].id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userInsert = await pool.query(
      `INSERT INTO users (username, email, password, role, isadmin, company_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, username, email, role, company_id`,
      [
        username,
        email,
        hashedPassword,
        isAdmin ? "ADMIN" : "USER",
        isAdmin || false,
        companyId,
      ]
    );

    res.json({
      message: "User registered successfully",
      user: userInsert.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      res.status(400).json({ message: "Username or email already exists" });
    } else {
      res.status(500).json({ message: err.message });
    }
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password, loginType } = req.body;

    // fetch user by username
    const result = await pool.query("SELECT * FROM users WHERE username=$1", [
      username,
    ]);

    if (result.rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = result.rows[0];

    // verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // admin login check
    if (loginType === "ADMIN" && user.role !== "ADMIN") {
      return res.status(403).json({ message: "Not an admin" });
    }

    // generate token
    const token = jwt.sign(
      { id: user.id, username: user.username }, // do NOT trust role from frontend
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // send response with correct role from DB
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role, // ✅ must exist
        company_id: user.company_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ------------------- PASSWORD RESET -------------------

// ADMIN: pending requests
router.get("/pending-reset-requests", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.id, pr.user_id, pr.token, pr.expires_at, pr.approved,
              u.username, u.email
       FROM password_reset_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.approved=false
       AND u.company_id = (SELECT company_id FROM users WHERE id=$1)`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// USER: request reset
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, companyName } = req.body;

    if (!email || !companyName) {
      return res
        .status(400)
        .json({ message: "Email and company name are required" });
    }

    // Clean expired requests
    await pool.query(
      "DELETE FROM password_reset_requests WHERE expires_at < NOW()"
    );

    const company = await pool.query("SELECT id FROM companies WHERE name=$1", [
      companyName,
    ]);
    if (company.rows.length === 0)
      return res.status(404).json({ message: "Company not found" });

    const companyId = company.rows[0].id;

    const userRes = await pool.query(
      "SELECT id, username FROM users WHERE email=$1 AND company_id=$2",
      [email, companyId]
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = userRes.rows[0];

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await pool.query(
      `INSERT INTO password_reset_requests (user_id, token, expires_at, approved)
       VALUES ($1,$2,$3,false)`,
      [user.id, token, expiresAt]
    );

    const admins = await pool.query(
      "SELECT email FROM users WHERE role='ADMIN' AND company_id=$1",
      [companyId]
    );

    const adminEmails = admins.rows.map((a) => a.email).join(",");
    const approvalLink = `${process.env.BACKEND_URL}/auth/approve-reset/${token}`;

    await sendMail({
      to: adminEmails,
      subject: "Password reset request",
      html: `
        <p>User <b>${user.username}</b> requested a password reset.</p>
        <p>Click below to approve:</p>
        <a href="${approvalLink}"
           style="
             display:inline-block;
             padding:12px 24px;
             background-color:#4CAF50;
             color:white;
             text-decoration:none;
             border-radius:5px;
             font-weight:bold;
           ">
          Approve Reset
        </a>
        <p>This link expires in 2 hours.</p>
      `,
    });

    res.json({ message: "Password reset request sent to admins ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: approve reset
router.post("/approve-reset/:token", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const reqRes = await pool.query(
      `SELECT pr.id, pr.user_id, pr.expires_at, u.email
       FROM password_reset_requests pr
       JOIN users u ON u.id=pr.user_id
       WHERE pr.token=$1`,
      [token]
    );

    if (reqRes.rows.length === 0)
      return res.status(404).json({ message: "Invalid token" });

    const request = reqRes.rows[0];
    if (request.expires_at < new Date())
      return res.status(400).json({ message: "Token expired" });

    await pool.query(
      "UPDATE password_reset_requests SET approved=true WHERE id=$1",
      [request.id]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendMail({
      to: request.email,
      subject: "Reset your password",
      html: `
        <p>Your password reset request was approved.</p>
        <a href="${resetLink}" 
           style="
             display:inline-block;
             padding:12px 24px;
             background-color:#2196F3;
             color:white;
             text-decoration:none;
             border-radius:5px;
             font-weight:bold;
           ">
          Reset Password
        </a>
        <p>This link expires in 2 hours.</p>
      `,
    });

    res.json({ message: "Approved and email sent ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// USER: reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const reqRes = await pool.query(
      "SELECT * FROM password_reset_requests WHERE token=$1 AND approved=true",
      [token]
    );

    if (reqRes.rows.length === 0)
      return res.status(400).json({ message: "Invalid request" });

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [
      hashed,
      reqRes.rows[0].user_id,
    ]);

    await pool.query("DELETE FROM password_reset_requests WHERE id=$1", [
      reqRes.rows[0].id,
    ]);

    res.json({ message: "Password updated successfully ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
