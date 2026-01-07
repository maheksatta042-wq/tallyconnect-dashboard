import express from "express";
import pool from "../db.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import requireAuth from "../middleware/requireAuth.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config(); // load .env

const router = express.Router();

// ----------------------
// GMAIL SMTP transporter
// ----------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "dhruvvii83@gmail.com", // your Gmail
    pass: "ukrkztfghzyjgply", // your Gmail app password
  },
});

transporter.verify((err, success) => {
  if (err) console.log("SMTP Error:", err);
  else console.log("SMTP Ready:", success);
});

// ----------------------
// GET /auth/pending-reset-requests
// ----------------------
router.get("/pending-reset-requests", requireAuth, async (req, res) => {
  const adminId = req.user.id;

  try {
    const adminResult = await pool.query(
      "SELECT company_id FROM users WHERE id=$1 AND role='ADMIN'",
      [adminId]
    );

    if (adminResult.rows.length === 0)
      return res.status(403).json({ message: "Not an admin" });

    const companyId = adminResult.rows[0].company_id;

    const requests = await pool.query(
      `SELECT pr.id, pr.token, u.username, u.email
       FROM password_reset_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.approved=FALSE AND u.company_id=$1`,
      [companyId]
    );

    res.json(requests.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// POST /auth/forgot-password
// ----------------------
router.post("/forgot-password", async (req, res) => {
  let { email, companyName } = req.body;
  email = email?.trim();
  companyName = companyName?.trim();

  if (!email || !companyName) {
    return res
      .status(400)
      .json({ message: "Email and company name are required" });
  }

  try {
    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE LOWER(name)=LOWER($1)",
      [companyName]
    );
    if (companyResult.rows.length === 0)
      return res.status(404).json({ message: "Company not found" });
    const company = companyResult.rows[0];

    const userResult = await pool.query(
      "SELECT id, username, email FROM users WHERE LOWER(email)=LOWER($1) AND company_id=$2",
      [email, company.id]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ message: "User not found" });
    const user = userResult.rows[0];

    // generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      "INSERT INTO password_reset_requests (user_id, token, expires_at, approved) VALUES ($1, $2, $3, FALSE)",
      [user.id, token, expiresAt]
    );

    const adminsResult = await pool.query(
      "SELECT email FROM users WHERE role='ADMIN' AND company_id=$1",
      [company.id]
    );
    const adminEmails = adminsResult.rows.map((r) => r.email);

    const approvalLink = `${process.env.BACKEND_URL}/auth/approve-reset/${token}`;

    // send email to admins
    await transporter.sendMail({
      from: `"Tally Connect" <dhruvvii83@gmail.com>`,
      to: adminEmails.join(","),
      subject: `Password Reset Request`,
      html: `
        <p>User <b>${user.username}</b> requested a password reset.</p>
        <p><a href="${approvalLink}">Approve Request</a></p>
        <p>Expires in 1 hour</p>
      `,
    });

    res.json({ message: "Request sent to admins" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// GET /auth/approve-reset/:token
// ----------------------
router.get("/approve-reset/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const reqResult = await pool.query(
      `SELECT pr.id, pr.user_id, pr.expires_at, pr.approved,
              u.email, u.username
       FROM password_reset_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token=$1`,
      [token]
    );
    if (reqResult.rows.length === 0)
      return res.status(400).send("Invalid token");

    const request = reqResult.rows[0];
    if (request.approved) return res.send("Already approved");
    if (request.expires_at < new Date()) return res.send("Token expired");

    await pool.query(
      "UPDATE password_reset_requests SET approved=TRUE, approved_at=NOW() WHERE id=$1",
      [request.id]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    // send email to user
    await transporter.sendMail({
      from: `"Tally Connect" <dhruvvii83@gmail.com>`,
      to: request.email,
      subject: "Password Reset Approved",
      html: `
        <p>Your password reset request was approved.</p>
        <p><a href="${resetLink}">Reset Password</a></p>
      `,
    });

    res.send("Password reset approved successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ----------------------
// POST /auth/reset-password/:token
// ----------------------
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM password_reset_requests WHERE token=$1 AND approved=TRUE AND expires_at > NOW()",
      [token]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ message: "Invalid or expired token" });

    const request = result.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [
      hashedPassword,
      request.user_id,
    ]);
    await pool.query("DELETE FROM password_reset_requests WHERE id=$1", [
      request.id,
    ]);

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
