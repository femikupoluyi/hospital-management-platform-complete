#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('/root'));

// Database connection
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'HMS Module',
    timestamp: new Date().toISOString()
  });
});

// Serve HMS frontend
app.get('/', (req, res) => {
  res.sendFile('/root/hms-frontend.html');
});

// =====================
// EMR ENDPOINTS
// =====================

// Get all patients
app.get('/api/hms/patients', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT p.*, h.name as hospital_name
      FROM crm.patients p
      LEFT JOIN organization.hospitals h ON p.hospital_id = h.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Create new patient
app.post('/api/hms/patients', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { first_name, last_name, date_of_birth, gender, phone, email, address, hospital_id } = req.body;
  
  try {
    await client.connect();
    await client.query('BEGIN');
    
    // Create patient
    const patientResult = await client.query(`
      INSERT INTO crm.patients (first_name, last_name, date_of_birth, gender, phone_number, email, address, hospital_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [first_name, last_name, date_of_birth, gender, phone, email, address, hospital_id || 1]);
    
    // Create empty medical record
    await client.query(`
      INSERT INTO emr.medical_records (patient_id)
      VALUES ($1)
    `, [patientResult.rows[0].id]);
    
    await client.query('COMMIT');
    res.json(patientResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating patient:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get medical records
app.get('/api/hms/medical-records/:patientId', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT mr.*, v.*, p.*
      FROM emr.medical_records mr
      LEFT JOIN emr.visits v ON v.patient_id = mr.patient_id
      LEFT JOIN emr.prescriptions p ON p.visit_id = v.id
      WHERE mr.patient_id = $1
    `, [req.params.patientId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =====================
// BILLING ENDPOINTS
// =====================

// Get all invoices
app.get('/api/hms/billing/invoices', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT i.*, p.first_name, p.last_name, h.name as hospital_name
      FROM billing.invoices i
      LEFT JOIN emr.patients p ON i.patient_id = p.id
      LEFT JOIN organization.hospitals h ON i.hospital_id = h.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Create invoice
app.post('/api/hms/billing/invoices', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { patient_id, hospital_id, total_amount, payment_method, items } = req.body;
  
  try {
    await client.connect();
    await client.query('BEGIN');
    
    const invoiceResult = await client.query(`
      INSERT INTO billing.invoices (patient_id, hospital_id, total_amount, payment_method, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `, [patient_id, hospital_id || 1, total_amount, payment_method]);
    
    // Add invoice items
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(`
          INSERT INTO billing.invoice_items (invoice_id, description, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [invoiceResult.rows[0].id, item.description, item.quantity, item.unit_price, item.total_price]);
      }
    }
    
    await client.query('COMMIT');
    res.json(invoiceResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =====================
// INVENTORY ENDPOINTS
// =====================

// Get inventory items
app.get('/api/hms/inventory', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT i.*, h.name as hospital_name
      FROM inventory.items i
      LEFT JOIN organization.hospitals h ON i.hospital_id = h.id
      ORDER BY i.quantity_available ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Update inventory
app.put('/api/hms/inventory/:itemId', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { quantity_available, reorder_level } = req.body;
  
  try {
    await client.connect();
    const result = await client.query(`
      UPDATE inventory.items 
      SET quantity_available = $1, reorder_level = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [quantity_available, reorder_level, req.params.itemId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =====================
// HR & ROSTERING
// =====================

// Get staff members
app.get('/api/hms/hr/staff', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT s.*, h.name as hospital_name
      FROM hr.staff s
      LEFT JOIN organization.hospitals h ON s.hospital_id = h.id
      ORDER BY s.department, s.last_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get roster
app.get('/api/hms/hr/roster', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT r.*, s.first_name, s.last_name, s.role
      FROM hr.roster r
      LEFT JOIN hr.staff s ON r.staff_id = s.id
      WHERE r.date >= CURRENT_DATE
      ORDER BY r.date, r.shift
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roster:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =====================
// ANALYTICS DASHBOARD
// =====================

// Get real-time stats
app.get('/api/hms/analytics/realtime', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM emr.patients) as total_patients,
        (SELECT COUNT(*) FROM emr.visits WHERE date >= CURRENT_DATE) as today_visits,
        (SELECT COUNT(*) FROM billing.invoices WHERE status = 'pending') as pending_invoices,
        (SELECT SUM(total_amount) FROM billing.invoices WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as monthly_revenue,
        (SELECT COUNT(*) FROM hr.staff WHERE employment_status = 'active') as active_staff,
        (SELECT COUNT(*) FROM inventory.items WHERE quantity_available <= reorder_level) as low_stock_items
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`HMS Module running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
  console.log(`External: https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so`);
});
