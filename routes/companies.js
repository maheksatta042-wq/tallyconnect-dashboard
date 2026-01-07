import express from "express";
import pool from "../db.js";
import requireAuth from "../middleware/requireAuth.js";
console.log("✅ companies routes loaded");

const router = express.Router();

/* =========================
   PUBLIC (NO AUTH)
========================= */

// Get active company
router.get("/active", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ac.company_guid, c.name
       FROM active_company ac
       LEFT JOIN companies c
         ON ac.company_guid = c.company_guid
       WHERE ac.id = 1`
    );

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        company: result.rows[0],
      });
    }

    // If no active company set, pick the first company and make it active
    const firstCompany = await pool.query(
      `SELECT company_guid, name FROM companies ORDER BY created_at ASC LIMIT 1`
    );

    if (firstCompany.rows.length === 0) {
      // No companies exist yet
      return res.json({
        success: true,
        company: null,
      });
    }

    const company = firstCompany.rows[0];

    // Insert into active_company
    await pool.query(
      `INSERT INTO active_company (id, company_guid, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id)
       DO UPDATE SET company_guid = EXCLUDED.company_guid, updated_at = NOW()`,
      [company.company_guid]
    );

    console.log(`✅ First company set as active: ${company.name}`);

    return res.json({
      success: true,
      company,
    });
  } catch (err) {
    console.error("❌ GET /company/active:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load active company",
    });
  }
});

// Create or update company
router.post("/create", async (req, res) => {
  try {
    const { company_guid, name } = req.body;

    if (!company_guid || !name) {
      return res.status(400).json({
        success: false,
        message: "company_guid and name required",
      });
    }

    const result = await pool.query(
      `INSERT INTO companies (company_guid, name)
       VALUES ($1, $2)
       ON CONFLICT (company_guid)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING company_guid, name`,
      [company_guid, name]
    );

    // ✅ If no active company exists, set this one as active
    const activeCheck = await pool.query(
      `SELECT * FROM active_company WHERE id = 1`
    );
    if (activeCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO active_company (id, company_guid, updated_at)
         VALUES (1, $1, NOW())`,
        [company_guid]
      );
      console.log(`✅ Company created and set as active: ${name}`);
    }

    res.json({
      success: true,
      company: result.rows[0],
    });
  } catch (err) {
    console.error("❌ POST /company/create:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create company",
    });
  }
});

/* =========================
   AUTH REQUIRED
========================= */
router.use(requireAuth);

// List companies
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT company_guid, name FROM companies ORDER BY name"
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("❌ GET /company:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
});

// Set active company (ADMIN only)
router.post("/set-active", async (req, res) => {
  try {
    const { company_guid } = req.body;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only ADMIN can switch company",
      });
    }

    const result = await pool.query(
      `INSERT INTO active_company (id, company_guid)
       VALUES (1, $1)
       ON CONFLICT (id)
       DO UPDATE SET
         company_guid = EXCLUDED.company_guid,
         updated_at = NOW()
       RETURNING company_guid`,
      [company_guid]
    );

    global.FORCE_SYNC = true;

    res.json({
      success: true,
      company: result.rows[0],
    });
  } catch (err) {
    console.error("❌ POST /company/set-active:", err);
    res.status(500).json({
      success: false,
      message: "Failed to set active company",
    });
  }
});

export default router;
