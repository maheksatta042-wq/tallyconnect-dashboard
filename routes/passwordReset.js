import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * POST /password-reset/request
 * Logged-in user requests a password reset
 */
router.post("/request", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { message } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO password_reset_requests (user_id, message)
       VALUES ($1, $2)
       RETURNING id, user_id, message, status, created_at`,
      [userId, message || null]
    );

    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error("Password reset request failed:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send password reset request",
    });
  }
});

/**
 * GET /password-reset/requests
 * ADMIN: Get all reset requests
 */
router.get("/requests", requireAuth, async (req, res) => {
  if (!req.user.isadmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, u.username, u.email, r.message, r.status, r.created_at
       FROM password_reset_requests r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch reset requests:", err);
    res.status(500).json({ message: "Failed to fetch reset requests" });
  }
});

/**
 * PUT /password-reset/:id/status
 * ADMIN: Approve or reject a request
 * Body: { status: 'APPROVED' | 'REJECTED' }
 */
router.put("/:id/status", requireAuth, async (req, res) => {
  if (!req.user.isadmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const result = await pool.query(
      `UPDATE password_reset_requests
       SET status = $1
       WHERE id = $2
       RETURNING id, status`,
      [status, id]
    );

    res.json({ success: true, updated: result.rows[0] });
  } catch (err) {
    console.error("Failed to update status:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

export default router;
