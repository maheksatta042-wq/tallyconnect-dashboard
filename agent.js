import axios from "axios";
import xml2js from "xml2js";
//import pool from "../tally-backend/db.js";
import { parseStringPromise } from "xml2js";
import crypto from "crypto";
import fs from "fs";

const STATE_FILE = "./agent-sync-state.json";

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { last_voucher_alterid: 0 };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

//import "dotenv/config";

let ACTIVE_COMPANY_GUID = null;

// BACKEND URL
const BACKEND_URL = "http://localhost:4000";

// Tally URL
const TALLY_URL = "http://localhost:9000";

// 5 second timer
//const SYNC_INTERVAL = 5000;
// 5 minute timer
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms

global.FORCE_SYNC = false;

function generatePayloadHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}


// MAIN SYNC FUNCTION
async function syncAllData() {
  console.log("🔄 Sync started...");

  try {
    await loadActiveCompany();   // 🔥 ADD THIS
    if (!ACTIVE_COMPANY_GUID) return;

    await syncCompanies();
   await syncLedgers();
    await syncVouchers();
    //await syncOrders();

    await syncStockMasters();
    await syncBills();
await fetchStockSummary();

    console.log("✅ Sync complete!\n");
  } catch (err) {
    console.log("⛔ Sync failed:", err.message);
  }
}




async function loadActiveCompany() {
  try {
    const res = await axios.get("http://localhost:4000/company/active");

    if (res.data.success && res.data.company_guid) {
      ACTIVE_COMPANY_GUID = res.data.company_guid;
      console.log("🏢 Active Company GUID:", ACTIVE_COMPANY_GUID);
    } else {
      ACTIVE_COMPANY_GUID = null; // 🔥 REQUIRED
      console.log("⚠️ No active company set");
    }
  } catch (err) {
    ACTIVE_COMPANY_GUID = null;   // 🔥 REQUIRED
    console.error("Failed to load active company", err.message);
  }
}













/* --------------------------
   1. SYNC COMPANIES
--------------------------- */
async function syncCompanies() {
  const xmlRequest = `
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>Company Collection</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="Company Collection">
      <TYPE>Company</TYPE>
      <FETCH>NAME,GUID</FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>
`;

  const response = await axios.post(TALLY_URL, xmlRequest, {
    headers: { "Content-Type": "text/xml" },
  });

  console.log("RAW XML:\n", response.data);

  const jsonData = await parseStringPromise(response.data);

  const companies =
    jsonData?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0]?.COMPANY || [];

  console.log("Companies from Tally:", companies.length);

  for (let c of companies) {
    await axios.post("http://localhost:4000/company/create", {
  company_guid:
    typeof c.GUID?.[0] === "string" ? c.GUID?.[0] : c.GUID?.[0]?._,
  name:
    typeof c.NAME?.[0] === "string" ? c.NAME?.[0] : c.NAME?.[0]?._,
});

  }





}


/* --------------------------
   2. SYNC LEDGERS
--------------------------- */
async function syncLedgers() {
  if (!ACTIVE_COMPANY_GUID) {
    console.log("⚠️ Company not loaded yet. Skipping ledger sync.");
    return;
  }

  const xmlRequest = `
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>Ledger Collection</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="Ledger Collection">
      <TYPE>Ledger</TYPE>
     <FETCH>
NAME,
GUID,
PARENT,
OPENINGBALANCE,
CLOSINGBALANCE,
ISBILLWISEON
</FETCH>

     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>
`;

  const res = await axios.post(TALLY_URL, xmlRequest, {
    headers: { "Content-Type": "text/xml" },
  });

  const parser = new xml2js.Parser({ explicitArray: false });
  const parsed = await parser.parseStringPromise(res.data);

  const ledgers = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER || [];
  const ledgerArray = Array.isArray(ledgers) ? ledgers : [ledgers];

  console.log("Ledgers from Tally:", ledgerArray.length);

  for (const l of ledgerArray) {

  const payload = {
  name: l.$?.NAME,
  parent_group:
    typeof l.PARENT === "string" ? l.PARENT : l.PARENT?._,
  opening_balance: Number(l.OPENINGBALANCE?._ || l.OPENINGBALANCE || 0),
  closing_balance: Number(l.CLOSINGBALANCE?._ || l.CLOSINGBALANCE || 0),
  type: l.ISBILLWISEON === "Yes" ? "Party" : "General",
};

// 🔐 HASH PAYLOAD
const payload_hash = crypto
  .createHash("sha256")
  .update(JSON.stringify(payload))
  .digest("hex");

    // ✅ ADD THIS (ledger master insert)
  await axios.post(`${BACKEND_URL}/ledger/sync`, {
    ledger_guid:
      typeof l.GUID === "string" ? l.GUID : l.GUID?._,
    company_guid: ACTIVE_COMPANY_GUID,
    name: l.$?.NAME,
    parent_group:
      typeof l.PARENT === "string" ? l.PARENT : l.PARENT?._,
    opening_balance: payload.opening_balance,
    closing_balance: payload.closing_balance,
    type: payload.type,
  });

  await axios.post(`${BACKEND_URL}/sync/event`, {
    entity_type: "LEDGER",
    entity_guid:
      typeof l.GUID === "string" ? l.GUID : l.GUID?._,
    company_guid: ACTIVE_COMPANY_GUID,
    operation: "UPSERT",
    source: "TALLY",
    payload,
    payload_hash, // 🔥 THIS IS THE NEW ADDITION
  });

  console.log("📥 Ledger queued:", l.$?.NAME);
}

}




const BATCH_SIZE = 500;



/* --------------------------
   3. SYNC VOUCHERS
--------------------------- */


async function syncVouchers() {
const invoiceItemBatch = [];

const invoiceBatch = [];

  if (!ACTIVE_COMPANY_GUID) {
    console.log("⚠️ No active company. Skipping vouchers.");
    return;
  }
    const voucherEntryBatch = [];
    const activeVoucherGuids = [];


  const xmlRequest = `z
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>Voucher Collection</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <SVFROMDATE>20240101</SVFROMDATE>
    <SVTODATE>20251231</SVTODATE>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="Voucher Collection">
      <TYPE>Voucher</TYPE>
      <FETCH>
        GUID,
        ALTERID,
        DATE,
        VOUCHERNUMBER,
        VOUCHERTYPENAME,
        PARTYLEDGERNAME,
        ALLLEDGERENTRIES.LIST,
        INVENTORYENTRIES.LIST
      </FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>
`;

  const res = await axios.post(TALLY_URL, xmlRequest, {
    headers: { "Content-Type": "text/xml" },
  });

  console.log("RAW DAYBOOK XML:\n", res.data);

  const parsed = await parseStringPromise(res.data);

  const messages =
    parsed?.ENVELOPE?.BODY?.[0]
      ?.IMPORTDATA?.[0]
      ?.REQUESTDATA?.[0]
      ?.TALLYMESSAGE || [];

  const msgArray = Array.isArray(messages) ? messages : [messages];

  console.log("TALLYMESSAGE count:", msgArray.length);

  let voucherCount = 0;
// const activeVoucherGuids = new Set();

  for (const msg of msgArray) {
    if (!msg.VOUCHER) continue;

    const v = msg.VOUCHER[0];
    voucherCount++;

    // 🔹 Voucher GUID
const voucherGuid =
  typeof v.GUID?.[0] === "string" ? v.GUID[0] : v.GUID?.[0]?._;

activeVoucherGuids.push(voucherGuid);

// 🔹 Voucher Date
const voucherDate =
  v.DATE?.[0] ||
  v.REFERENCEDATE?.[0] ||
  null;

// 🔹 Voucher Type (⭐ MUST COME FIRST)
const voucherType =
  v.VOUCHERTYPENAME?.[0] ||
  v.VOUCHERTYPE?.[0] ||
  null;


     if (voucherCount <= 3) {
    console.log("🔎 FULL VOUCHER OBJECT:", JSON.stringify(v, null, 2));
  }


  const isPurchaseInvoice =
  voucherType &&
  voucherType.toLowerCase().includes("purchase");
console.log("📘 Voucher Type:", voucherType);


if (isPurchaseInvoice) {
  const invoiceGuid =
    typeof v.GUID?.[0] === "string" ? v.GUID[0] : v.GUID?.[0]?._;

  const invoiceDate = v.DATE?.[0] || null;
  const invoiceNo = v.VOUCHERNUMBER?.[0] || null;
  const partyName = v.PARTYLEDGERNAME?.[0] || null;

  const ledgerEntries = v["ALLLEDGERENTRIES.LIST"] || [];
  const entryArray = Array.isArray(ledgerEntries)
    ? ledgerEntries
    : [ledgerEntries];

  let totalAmount = 0;

  for (const e of entryArray) {
    totalAmount += Math.abs(Number(e.AMOUNT?.[0] || 0));
  }

  // 🔹 Save Purchase Invoice Header
  await axios.post(`${BACKEND_URL}/invoice/sync`, {
    invoice_guid: invoiceGuid,
    company_guid: ACTIVE_COMPANY_GUID,
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    invoice_type: "Purchase",
    party_name: partyName,
    total_amount: totalAmount,
  });

  // 🔥 CREATE SALES ORDER FROM SALES INVOICE

invoiceBatch.push({
  invoice_guid: invoiceGuid,
  company_guid: ACTIVE_COMPANY_GUID,
  invoice_no: invoiceNo,
  invoice_date: invoiceDate,
  invoice_type: "Purchase",
  party_name: partyName,
  total_amount: totalAmount,
});
if (invoiceBatch.length >= BATCH_SIZE) {
  await axios.post(
    `${BACKEND_URL}/invoice/bulk-sync`,
    invoiceBatch
  );
  invoiceBatch.length = 0;
}


  // 🔹 Save Line Items
const purchaseItems = v["INVENTORYENTRIES.LIST"] || [];
const purchaseItemArray = Array.isArray(purchaseItems)
  ? purchaseItems
  : [purchaseItems];


 for (const i of purchaseItemArray) {
  await axios.post(`${BACKEND_URL}/invoice-item/sync`, {
    invoice_guid: invoiceGuid,
    item_name: i.STOCKITEMNAME?.[0] || i.LEDGERNAME?.[0] || null,
    quantity: Number(i.ACTUALQTY?.[0] || 0),
    rate: Number(i.RATE?.[0]?.replace(/[^0-9.-]/g, "") || 0),
    amount: Math.abs(Number(i.AMOUNT?.[0] || 0)),
  });

  invoiceItemBatch.push({
    invoice_guid: invoiceGuid,
    company_guid: ACTIVE_COMPANY_GUID,
    item_name: i.STOCKITEMNAME?.[0] || i.LEDGERNAME?.[0] || null,
    quantity: Number(i.ACTUALQTY?.[0] || 0),
    rate: Number(i.RATE?.[0]?.replace(/[^0-9.-]/g, "") || 0),
    amount: Math.abs(Number(i.AMOUNT?.[0] || 0)),
  });

  if (invoiceItemBatch.length >= BATCH_SIZE) {
    await axios.post(
      `${BACKEND_URL}/invoice-item/bulk-sync`,
      invoiceItemBatch
    );
    invoiceItemBatch.length = 0;
  }
}


  console.log(`🧾 Purchase Invoice synced → ${invoiceNo}`);


}


   
const isSalesInvoice =
  voucherType &&
  (
    voucherType.toLowerCase().includes("invoice") ||
    voucherType.toLowerCase().includes("sales")
  );

if (isSalesInvoice) {
  const invoiceGuid =
    typeof v.GUID?.[0] === "string" ? v.GUID[0] : v.GUID?.[0]?._;

  const invoiceDate = v.DATE?.[0] || null;
  const invoiceNo = v.VOUCHERNUMBER?.[0] || null;
  const partyName = v.PARTYLEDGERNAME?.[0] || null;

  const ledgerEntries = v["ALLLEDGERENTRIES.LIST"] || [];
  const entryArray = Array.isArray(ledgerEntries)
    ? ledgerEntries
    : [ledgerEntries];

  let totalAmount = 0;

  for (const e of entryArray) {
    totalAmount += Math.abs(Number(e.AMOUNT?.[0] || 0));
  }

  // 🔹 Save Invoice Header
  await axios.post(`${BACKEND_URL}/invoice/sync`, {
    invoice_guid: invoiceGuid,
    company_guid: ACTIVE_COMPANY_GUID,
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    invoice_type: "Sales",
    party_name: partyName,
    total_amount: totalAmount,
  });

  invoiceBatch.push({
  invoice_guid: invoiceGuid,
  company_guid: ACTIVE_COMPANY_GUID,
  invoice_no: invoiceNo,
  invoice_date: invoiceDate,
  invoice_type: "Sales",
  party_name: partyName,
  total_amount: totalAmount,
});
if (invoiceBatch.length >= BATCH_SIZE) {
  await axios.post(
    `${BACKEND_URL}/invoice/bulk-sync`,
    invoiceBatch
  );
  invoiceBatch.length = 0;
}

   // ✅ CREATE SALES ORDER FROM SALES INVOICE
  await axios.post(`${BACKEND_URL}/sales-order/sync`, {
    order_guid: invoiceGuid,
    company_guid: ACTIVE_COMPANY_GUID,
    order_no: invoiceNo,
    order_date: invoiceDate,
    order_type: voucherType,
    party_name: partyName,
    total_amount: totalAmount,
    status: "Pending",
    due_date: null
  });

  console.log(`📦 Sales Order created → ${invoiceNo}`);

  // 🔹 Save Invoice Line Items
  const salesItems = v["INVENTORYENTRIES.LIST"] || [];
const salesItemArray = Array.isArray(salesItems)
  ? salesItems
  : [salesItems];


for (const i of salesItemArray) {
  await axios.post(`${BACKEND_URL}/invoice-item/sync`, {
    invoice_guid: invoiceGuid,
    item_name: i.STOCKITEMNAME?.[0] || null,
    quantity: Number(i.ACTUALQTY?.[0] || 0),
    rate: Number(i.RATE?.[0]?.replace(/[^0-9.-]/g, "") || 0),
    amount: Math.abs(Number(i.AMOUNT?.[0] || 0)),
  });

  invoiceItemBatch.push({
    invoice_guid: invoiceGuid,
    company_guid: ACTIVE_COMPANY_GUID,
    item_name: i.STOCKITEMNAME?.[0] || null,
    quantity: Number(i.ACTUALQTY?.[0] || 0),
    rate: Number(i.RATE?.[0]?.replace(/[^0-9.-]/g, "") || 0),
    amount: Math.abs(Number(i.AMOUNT?.[0] || 0)),
  });

  if (invoiceItemBatch.length >= BATCH_SIZE) {
    await axios.post(
      `${BACKEND_URL}/invoice-item/bulk-sync`,
      invoiceItemBatch
    );
    invoiceItemBatch.length = 0;
  }
}


  console.log(`🧾 Sales Invoice synced → ${invoiceNo}`);



}


const referenceNo =
  v.REFERENCE?.[0] ||
  v.REFERENCENUMBER?.[0] ||
  null;


    const entries = v["ALLLEDGERENTRIES.LIST"] || [];
    const entryArray = Array.isArray(entries) ? entries : [entries];
//const referenceNo = v.REFERENCE?.[0] || null;
    for (const e of entryArray) {
      const isDebit = e.ISDEEMEDPOSITIVE?.[0] === "No";

    voucherEntryBatch.push({
  voucher_guid: voucherGuid,
  company_guid: ACTIVE_COMPANY_GUID,
  reference_no: referenceNo,
  voucher_date: voucherDate,
  voucher_type: voucherType,
  ledger_name: e.LEDGERNAME?.[0],
  amount: Math.abs(Number(e.AMOUNT?.[0] || 0)),
  is_debit: isDebit,
});
if (voucherEntryBatch.length >= BATCH_SIZE) {
  await axios.post(
    `${BACKEND_URL}/voucher-entry/bulk-sync`,
    voucherEntryBatch
  );
  voucherEntryBatch.length = 0;
}




      console.log(
        `Entry synced → ${e.LEDGERNAME?.[0]} : ${isDebit ? "DR" : "CR"}`
      );
    }
  }
// 🔴 Mark deleted vouchers as inactive


console.log("🧹 Inactive vouchers cleaned");


  console.log("Vouchers from Tally:", voucherCount);
    // 🔒 Mark deleted vouchers as inactive
  if (activeVoucherGuids.length > 0) {
    await axios.post(
      `${BACKEND_URL}/voucher-entry/mark-inactive`,
      { activeVoucherGuids }
    );
  }


if (voucherEntryBatch.length) {
  await axios.post(
    `${BACKEND_URL}/voucher-entry/bulk-sync`,
    voucherEntryBatch
  );
}

if (invoiceBatch.length > 0) {
  await axios.post(
    `${BACKEND_URL}/invoice/bulk-sync`,
    invoiceBatch
  );
}

if (invoiceItemBatch.length > 0) {
  await axios.post(
    `${BACKEND_URL}/invoice-item/bulk-sync`,
    invoiceItemBatch
  );
}
}



/* --------------------------
   4. SYNC BILLS
--------------------------- */
/* --------------------------
   4. SYNC BILLS
--------------------------- */
async function syncBills() {
  if (!ACTIVE_COMPANY_GUID) {
    console.log("⚠️ No active company. Skipping bills sync.");
    return;
  }

  console.log("🧾 Syncing Bills Receivable (Flat Report)...");

  const xmlRequest = `
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Bills Receivable</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
     <SVCOMPANY>Tally</SVCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>
`;

  const res = await axios.post(TALLY_URL, xmlRequest, {
    headers: { "Content-Type": "text/xml" },
  });

  console.log("RAW BILLS RECEIVABLE XML:\n", res.data);

  const parsed = await parseStringPromise(res.data);

  // ✅ DIRECT ENVELOPE LEVEL DATA
  const billFixed = parsed?.ENVELOPE?.BILLFIXED?.[0];
  const closingAmount = parsed?.ENVELOPE?.BILLCL?.[0];
  const dueDate = parsed?.ENVELOPE?.BILLDUE?.[0];

  if (!billFixed) {
    console.log("⚠️ No bill data found");
    return;
  }

  const payload = {
    company_guid: ACTIVE_COMPANY_GUID,
    ledger_name: billFixed.BILLPARTY?.[0],
    bill_name: billFixed.BILLREF?.[0],
    bill_date: billFixed.BILLDATE?.[0],
    amount: Math.abs(Number(closingAmount || 0)),
    pending_amount: Math.abs(Number(closingAmount || 0)),
    due_date: dueDate,
  };

  if (!payload.ledger_name || !payload.bill_name) {
    console.log("⚠️ Invalid bill payload:", payload);
    return;
  }

  await axios.post(`${BACKEND_URL}/bill/sync`, payload);

  console.log(
    `✅ Bill synced → ${payload.ledger_name} | ${payload.bill_name} | ${payload.pending_amount}`
  );



}



/* --------------------------
   5. SYNC SALES ORDERS
--------------------------- */
/* --------------------------
   5. SYNC SALES ORDERS
--------------------------- */


//inventory data 

async function fetchStockSummary() {
  if (!ACTIVE_COMPANY_GUID) return;

  const xml = `
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Stock Summary</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    </STATICVARIABLES>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>
`;

  const res = await axios.post(TALLY_URL, xml, {
    headers: { "Content-Type": "text/xml" },
  });

  const parsed = await parseStringPromise(res.data);

  const rows =
    parsed?.ENVELOPE?.BODY?.[0]?.EXPORTDATA?.[0]?.DSPACCNAME || [];

  const rowArray = Array.isArray(rows) ? rows : [rows];

  console.log("📊 Stock Summary Rows:", rowArray.length);

  for (const r of rowArray) {
    const itemName = r?.DSPACCNAME?.[0];
    const closingQty = r?.DSPQTY?.[0];
    const closingValue = r?.DSPVALUE?.[0];

    if (!itemName) continue;

    await axios.post(`${BACKEND_URL}/stock-summary/sync`, {
      company_guid: ACTIVE_COMPANY_GUID,
      item_name: itemName,
      closing_qty: Number(closingQty || 0),
      closing_value: Number(closingValue || 0),
    });

    console.log(`📦 Stock updated → ${itemName}`);
  }
}



 // STOCK MASTER SYNC (Items)

async function syncStockMasters() {
  if (!ACTIVE_COMPANY_GUID) return;

  const xmlRequest = `
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>StockItem Collection</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="StockItem Collection">
      <TYPE>StockItem</TYPE>
      <FETCH>
       NAME,GUID,BASEUNITS,OPENINGBALANCE,OPENINGVALUE
      </FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>
`;

  const res = await axios.post(TALLY_URL, xmlRequest, {
    headers: { "Content-Type": "text/xml" },
  });

  const parsed = await parseStringPromise(res.data);

  const items =
    parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM || [];

  const itemArray = Array.isArray(items) ? items : [items];

  console.log("📦 Stock Items:", itemArray.length);

  for (const i of itemArray) {
   // await axios.post(`${BACKEND_URL}/stock-item/sync`, {
    //  stock_guid: i.GUID?.[0] || i.GUID?._,
    await axios.post(`${BACKEND_URL}/stock-item/sync`, {
  item_guid: i.GUID?.[0] || i.GUID?._,
      company_guid: ACTIVE_COMPANY_GUID,
      name: i.NAME?.[0],
      unit: i.BASEUNITS?.[0],
      opening_qty: Number(i.OPENINGBALANCE?.[0] || 0),
      opening_value: Number(i.OPENINGVALUE?.[0] || 0),
    });
  }
}





/* --------------------------
   START AUTO SYNC
--------------------------- */
console.log("🟢 Tally Agent started...");
// setInterval(syncAllData, SYNC_INTERVAL);

// Run first sync immediately
syncAllData();

// Continue syncing every interval
setInterval(async () => {
  if (global.FORCE_SYNC) {
    console.log("⚡ Forced sync triggered");
    global.FORCE_SYNC = false;
    await syncAllData();
  }
}, 1000);



// Regular sync
setInterval(syncAllData, SYNC_INTERVAL);


//setTimeout(() => {
//  startSync();
//}, 3000); // wait 3 seconds before sync
