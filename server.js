import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";

// Routes & middleware
import authRoutes from "./routes/auth.js";
import companiesRoute from "./routes/companies.js";
import ledgersRoute from "./routes/ledgers.js";
import vouchersRoute from "./routes/voucherEntry.js";
import billsRoute from "./routes/bills.js";
import ageingRoute from "./routes/ageing.js";
import salesOrderRoutes from "./routes/salesOrder.js";
import salesOrderItemRoutes from "./routes/salesOrderItem.js";
import stockItemRoutes from "./routes/stockItem.js";
import stockSummaryRoutes from "./routes/stockSummary.js";
import reportsRoutes from "./routes/reports.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import invoiceItemRoutes from "./routes/invoiceItem.routes.js";
import syncRoutes from "./routes/sync.routes.js";
import ordersRoutes from "./routes/orders.js";
import inventoryRoutes from "./routes/inventory.js";
import dashboardRoutes from "./routes/dashboard.js";
import usersRoute from "./routes/users.js";
import voucherRoutes from "./routes/vouchers.js";

import requireAuth from "./middleware/requireAuth.js";

// DB
import pool from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

// Auth
app.use("/auth", authRoutes);

// Company

app.use("/company", companiesRoute);

// Ledger (except /sync public)
app.use(
  "/ledger",
  (req, res, next) => {
    if (req.path === "/sync") return next();
    requireAuth(req, res, next);
  },
  ledgersRoute
);

// Voucher entry (except /sync & /mark-inactive public)
app.use(
  "/voucher-entry",
  (req, res, next) => {
    if (req.path === "/sync" || req.path === "/mark-inactive") return next();
    requireAuth(req, res, next);
  },
  vouchersRoute
);

// Protected routes
app.use("/orders", requireAuth, ordersRoutes);
app.use("/bill", billsRoute);
app.use("/ageing", ageingRoute);
app.use("/sales-order", salesOrderRoutes);
app.use("/sales-order-item", salesOrderItemRoutes);
app.use("/stock-item", stockItemRoutes);
app.use("/stock-summary", stockSummaryRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/invoice-item", invoiceItemRoutes);
app.use("/sync", syncRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/users", usersRoute);
app.use("/dashboard", dashboardRoutes);
app.use("/api/users", usersRoute);
app.use("/api/reports", reportsRoutes);
app.use("/api/vouchers", voucherRoutes);

// Static uploads
app.use("/uploads", express.static("uploads"));

// Return the active company
app.get("/company/active", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT company_guid, name FROM companies WHERE is_active = true LIMIT 1`
    );

    if (result.rows.length === 0) {
      // If no company is marked active, pick the first one and mark it active
      const allCompanies = await pool.query(
        `SELECT company_guid, name FROM companies LIMIT 1`
      );

      if (allCompanies.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No companies found. Please sync companies from Tally first.",
        });
      }

      const firstCompany = allCompanies.rows[0];

      // Mark it active
      await pool.query(
        `UPDATE companies SET is_active = true WHERE company_guid = $1`,
        [firstCompany.company_guid]
      );

      console.log(`✅ First company marked active: ${firstCompany.name}`);

      return res.json({
        success: true,
        company_guid: firstCompany.company_guid,
        name: firstCompany.name,
      });
    }

    const company = result.rows[0];

    return res.json({
      success: true,
      company_guid: company.company_guid,
      name: company.name,
    });
  } catch (err) {
    console.error("Error fetching active company:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/", (req, res) => res.send("Backend working!"));
app.get("/check-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
