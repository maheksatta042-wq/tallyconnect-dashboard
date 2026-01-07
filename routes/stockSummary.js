import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/sync", async (req, res) => {
  const {
    stock_guid,
    company_guid,
    closing_qty,
    closing_value,
    as_on,
  } = req.body;

  await pool.query(
    `
    INSERT INTO stock_summary
    (stock_guid, company_guid, closing_qty, closing_value, as_on)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (stock_guid, as_on)
    DO UPDATE SET
      closing_qty = EXCLUDED.closing_qty,
      closing_value = EXCLUDED.closing_value
    `,
    [
      stock_guid,
      company_guid,
      closing_qty,
      closing_value,
      as_on,
    ]
  );

  res.json({ status: "ok" });
});

export default router;
