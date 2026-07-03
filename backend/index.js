const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware Configuration
app.use(cors());
app.use(express.json());

// Establish Database Connection Pool via secure .env keys
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false } 
});

// Test Database Connection on Launch
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ DB Connection Error:', err.message);
  else console.log('✅ Database securely connected via pool.');
});

// =======================================================
// 🔌 PRODUCTION API ROUTES
// =======================================================

// 1. Authenticate / Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const queryText = 'SELECT id, full_name, phone_number, status FROM members WHERE phone_number = $1 AND password_hash = $2';
    const result = await pool.query(queryText, [phone, password]);
    
    if (result.rows.length > 0) {
      return res.status(200).json({ success: true, user: result.rows[0] });
    }
    res.status(401).json({ success: false, message: "Invalid phone number or password" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server registry error" });
  }
});

// 2. User Registration / Sign-Up Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { fullName, phone, password } = req.body;
  try {
    const userCheck = await pool.query('SELECT id FROM members WHERE phone_number = $1', [phone]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "This mobile number is already registered." });
    }

    const insertQuery = `
      INSERT INTO members (full_name, phone_number, password_hash, status) 
      VALUES ($1, $2, $3, 'Verified') 
      RETURNING id, full_name, phone_number, status
    `;
    const newMember = await pool.query(insertQuery, [fullName, phone, password]);
    res.status(201).json({ success: true, message: "Account created cleanly!", user: newMember.rows[0] });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// 3. Fetch Dashboard Operational State Data
app.get('/api/member/:id/dashboard', async (req, res) => {
  const memberId = req.params.id;
  try {
    const allocationRes = await pool.query(
      'SELECT sa.*, cs.scheme_name, cs.total_value, cs.total_slots, cs.current_month FROM slot_allocations sa JOIN chit_schemes cs ON sa.scheme_id = cs.id WHERE sa.member_id = $1',
      [memberId]
    );

    const ledgerRes = await pool.query(
      'SELECT * FROM payment_ledger WHERE member_id = $1 ORDER BY month_number DESC LIMIT 1',
      [memberId]
    );

    res.status(200).json({
      allocation: allocationRes.rows[0] || null,
      latestBill: ledgerRes.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to pull customer dashboard logs" });
  }
});

// 4. FIFO Slot Booking Rule Process Algorithm Entry Point
app.post('/api/allocation/book', async (req, res) => {
  const { memberId, schemeId, choice1, choice2 } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); 

    const checkC1 = await client.query(
      'SELECT id FROM slot_allocations WHERE scheme_id = $1 AND allocated_month = $2',
      [schemeId, choice1]
    );

    let finalAllocatedMonth = null;

    if (checkC1.rows.length === 0) {
      finalAllocatedMonth = choice1;
    } else {
      const checkC2 = await client.query(
        'SELECT id FROM slot_allocations WHERE scheme_id = $1 AND allocated_month = $2',
        [schemeId, choice2]
      );
      if (checkC2.rows.length === 0) {
        finalAllocatedMonth = choice2;
      }
    }

    if (finalAllocatedMonth === null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: "Both requested month slots have been claimed by earlier FIFO submissions." });
    }

    await client.query(
      'INSERT INTO slot_allocations (scheme_id, member_id, choice_1_month, choice_2_month, allocated_month) VALUES ($1, $2, $3, $4, $5)',
      [schemeId, memberId, choice1, choice2, finalAllocatedMonth]
    );

    await client.query(
      `INSERT INTO payment_ledger 
        (scheme_id, member_id, month_number, base_amount_due, dividend_discount, net_amount_payable, status) 
       VALUES 
        ($1, $2, 1, 5000.00, 0.00, 5000.00, $3)`,
      [schemeId, memberId, 'Pending']
    );

    await client.query('COMMIT');
    res.status(200).json({ success: true, allocatedMonth: finalAllocatedMonth });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: "System allocation transactional fault." });
  } finally {
    client.release();
  }
});

// 5. Update Ledger Payment Record (Simulated Gateway Action Interface)
app.post('/api/payment/process', async (req, res) => {
  const { ledgerId } = req.body;
  try {
    await pool.query(
      'UPDATE payment_ledger SET status = $1, payment_date = NOW() WHERE id = $2',
      ['Paid', ledgerId]
    );
    res.status(200).json({ success: true, message: "Payment processed cleanly." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal transaction registry failure." });
  }
});

app.listen(PORT, () => {
  console.log(`Server actively running on port ${PORT}`);
});