import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import fs from "fs";
import path from "path";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = express.Router();

/* =========================================================
   SELF ROUTES (LOGGED-IN USER)
========================================================= */

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.email,
         u.role,
         u.avatar_url,
         c.name AS company,
         u.dashboard_permissions,
         u.ledger_permissions,
         u.vouchers_permissions,
         u.orders_permissions,
         u.inventory_permissions,
         u.notification_preferences
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ /users/me error:", err);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

router.put("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { username, email, company_id } = req.body;

    await pool.query(
      `UPDATE users
       SET username = $1,
           email = $2,
           company_id = $3
       WHERE id = $4`,
      [username, email, company_id, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Profile update failed:", err);
    res.status(500).json({ message: "Profile update failed" });
  }
});

/* =========================================================
   NOTIFICATIONS
========================================================= */

router.get("/me/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      "SELECT notification_preferences FROM users WHERE id = $1",
      [userId]
    );

    res.json(result.rows[0]?.notification_preferences || {});
  } catch (err) {
    console.error("❌ Notifications fetch failed:", err);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

router.put("/me/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    await pool.query(
      "UPDATE users SET notification_preferences = $1::jsonb WHERE id = $2",
      [req.body, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Notifications update failed:", err);
    res.status(500).json({ message: "Failed to save notifications" });
  }
});

/* =========================================================
   AVATAR UPLOAD
========================================================= */

router.post(
  "/me/avatar",
  requireAuth,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const oldAvatarRes = await pool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [userId]
      );

      const oldAvatarUrl = oldAvatarRes.rows[0]?.avatar_url;

      if (oldAvatarUrl) {
        const oldPath = path.join(
          process.cwd(),
          oldAvatarUrl.replace(/^\//, "")
        );
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const avatarPath = `/uploads/avatars/${req.file.filename}`;

      await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
        avatarPath,
        userId,
      ]);

      res.json({ success: true, avatarUrl: avatarPath });
    } catch (err) {
      console.error("❌ Avatar upload failed:", err);
      res.status(500).json({ message: "Avatar upload failed" });
    }
  }
);

/* =========================================================
   ADMIN ROUTES
========================================================= */

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.email,
         u.role,
         u.ledger_permissions,
         u.vouchers_permissions,
         u.orders_permissions,
         u.inventory_permissions,
         u.dashboard_permissions,
         c.name AS company
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ORDER BY u.id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch users failed:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, company_id } = req.body;

    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);

    if (exists.rows.length) {
      return res.status(400).json({ message: "User already exists" });
    }

    const username = email.split("@")[0];

    const result = await pool.query(
      `INSERT INTO users (username, email, password, role, isadmin, company_id)
       VALUES ($1, $2, $3, 'USER', false, $4)
       RETURNING id, username, email`,
      [username, email, password, company_id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("❌ Create user failed:", err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

/* =========================================================
   PERMISSION HELPERS
========================================================= */

const updateJsonColumn = (column) => async (req, res) => {
  try {
    await pool.query(`UPDATE users SET ${column} = $1::jsonb WHERE id = $2`, [
      req.body,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Update ${column} failed:`, err);
    res.status(500).json({ message: `Failed to update ${column}` });
  }
};

router.put(
  "/:id/voucher-permissions",
  requireAuth,
  requireAdmin,
  updateJsonColumn("vouchers_permissions")
);
router.put(
  "/:id/ledger-permissions",
  requireAuth,
  requireAdmin,
  updateJsonColumn("ledger_permissions")
);
router.put(
  "/:id/orders-permissions",
  requireAuth,
  requireAdmin,
  updateJsonColumn("orders_permissions")
);
router.put(
  "/:id/inventory-permissions",
  requireAuth,
  requireAdmin,
  updateJsonColumn("inventory_permissions")
);
router.put(
  "/:id/dashboard-permissions",
  requireAuth,
  requireAdmin,
  updateJsonColumn("dashboard_permissions")
);

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete user failed:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.get("/:id/ledgers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT ledger_name FROM user_ledger_permissions WHERE user_id = $1 ORDER BY ledger_name",
      [req.params.id]
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Fetch ledgers failed:", err);
    res.json([]);
  }
});

export default router;
