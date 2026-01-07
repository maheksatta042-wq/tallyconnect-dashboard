import express from "express";
import pool from "../db.js";

const router = express.Router();

/* =========================
   SYNC VOUCHER (FLAT)
========================= */
router.post("/sync", async (req, res) => {
  const {
    voucher_guid,
    company_guid,
    voucher_type,
    voucher_number,
    date,
    ledger_name,
    amount,
    company_name,
  } = req.body;

  // 🔐 validation
  if (!voucher_guid || !company_guid) {
    return res.status(400).json({
      success: false,
      error: "voucher_guid and company_guid are required",
    });
  }

  try {
    await pool.query(
      `
      INSERT INTO vouchers
      (
        voucher_guid,
        company_guid,
        voucher_type,
        voucher_number,
        date,
        ledger_name,
        amount,
        company_name
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (voucher_guid)
      DO UPDATE SET
        voucher_type   = EXCLUDED.voucher_type,
        voucher_number = EXCLUDED.voucher_number,
        date           = EXCLUDED.date,
        ledger_name    = EXCLUDED.ledger_name,
        amount         = EXCLUDED.amount,
        company_name   = EXCLUDED.company_name
      `,
      [
        voucher_guid,
        company_guid,
        voucher_type,
        voucher_number,
        date,
        ledger_name,
        amount,
        company_name,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Voucher sync error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================
   GET VOUCHERS (UI)
========================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM vouchers
      ORDER BY date DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Voucher fetch error:", err.message);
    res.status(500).json({ success: false });
  }
});

export default router;
