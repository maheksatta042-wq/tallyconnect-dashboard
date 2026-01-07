import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * Inventory API
 * GET /inventory
 */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        si.item_guid::text AS id,
        si.name,
        0 AS opening,
        0 AS inward,
        0 AS outward,
        0 AS closing,
        0 AS rate,
        10 AS "minStock"
      FROM stock_items si
      WHERE si.company_guid::text = (
        SELECT company_guid FROM active_company WHERE id = 1
      )
      ORDER BY si.name;
    `);

    res.json(rows);
  } catch (err) {
    console.error("Inventory error:", err.message);
    res.status(500).json({ error: err.message });
  }
});









export default router;
