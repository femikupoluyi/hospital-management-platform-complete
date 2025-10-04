#!/usr/bin/env node

/**
 * Hospital Management System - Complete Functional Backend
 * All features implemented and working
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database connection
const connectionString = 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// WebSocket connections
const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log('WebSocket client connected');
  
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date() });
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Initialize database schemas and tables
async function initializeDatabase() {
  try {
    // Create HMS schema if not exists
    await pool.query('CREATE SCHEMA IF NOT EXISTS hms');
    
    // Create all necessary tables
    const tables = [
      // Patients table
      `CREATE TABLE IF NOT EXISTS hms.patients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INTEGER,
        gender VARCHAR(10),
        phone VARCHAR(20),
        email VARCHAR(255),
        address TEXT,
        blood_group VARCHAR(10),
        emergency_contact VARCHAR(20),
        insurance_provider VARCHAR(100),
        insurance_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Medical Records table
      `CREATE TABLE IF NOT EXISTS hms.medical_records (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(50) REFERENCES hms.patients(id),
        doctor_id VARCHAR(50),
        visit_date DATE,
        chief_complaint TEXT,
        diagnosis TEXT,
        prescription TEXT,
        lab_results TEXT,
        vital_signs JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Billing table
      `CREATE TABLE IF NOT EXISTS hms.billing (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(50),
        invoice_number VARCHAR(50) UNIQUE,
        total_amount DECIMAL(10, 2),
        paid_amount DECIMAL(10, 2) DEFAULT 0,
        payment_method VARCHAR(50),
        payment_status VARCHAR(20) DEFAULT 'pending',
        insurance_claim_number VARCHAR(100),
        items JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Inventory table
      `CREATE TABLE IF NOT EXISTS hms.inventory (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(50) UNIQUE,
        item_name VARCHAR(255),
        category VARCHAR(100),
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(20),
        reorder_level INTEGER DEFAULT 10,
        unit_price DECIMAL(10, 2),
        expiry_date DATE,
        supplier VARCHAR(255),
        last_restocked DATE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Staff table
      `CREATE TABLE IF NOT EXISTS hms.staff (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100),
        department VARCHAR(100),
        specialization VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(20),
        shift VARCHAR(20),
        salary DECIMAL(10, 2),
        join_date DATE,
        status VARCHAR(20) DEFAULT 'active'
      )`,
      
      // Staff Schedule table
      `CREATE TABLE IF NOT EXISTS hms.staff_schedules (
        id SERIAL PRIMARY KEY,
        staff_id VARCHAR(50) REFERENCES hms.staff(id),
        date DATE,
        shift VARCHAR(20),
        start_time TIME,
        end_time TIME,
        department VARCHAR(100),
        status VARCHAR(20) DEFAULT 'scheduled'
      )`,
      
      // Beds table
      `CREATE TABLE IF NOT EXISTS hms.beds (
        id SERIAL PRIMARY KEY,
        bed_number VARCHAR(20) UNIQUE,
        ward VARCHAR(100),
        room_number VARCHAR(20),
        bed_type VARCHAR(50),
        is_occupied BOOLEAN DEFAULT false,
        patient_id VARCHAR(50),
        admission_date TIMESTAMP,
        expected_discharge DATE,
        daily_rate DECIMAL(10, 2)
      )`,
      
      // Admissions table
      `CREATE TABLE IF NOT EXISTS hms.admissions (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(50),
        bed_id INTEGER REFERENCES hms.beds(id),
        admission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        discharge_date TIMESTAMP,
        doctor_id VARCHAR(50),
        diagnosis TEXT,
        status VARCHAR(20) DEFAULT 'active'
      )`
    ];
    
    for (const query of tables) {
      await pool.query(query);
    }
    
    console.log('✓ Database initialized successfully');
    
    // Insert sample data if tables are empty
    await insertSampleData();
    
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Insert sample data
async function insertSampleData() {
  try {
    // Check if data exists
    const patientCount = await pool.query('SELECT COUNT(*) FROM hms.patients');
    if (patientCount.rows[0].count > 0) return;
    
    // Insert sample patients
    const patients = [
      ['PAT001', 'John Doe', 45, 'Male', '0551234567', 'john@email.com', '123 Main St', 'O+', '0559876543', 'NHIS', 'NHIS123'],
      ['PAT002', 'Jane Smith', 32, 'Female', '0241234567', 'jane@email.com', '456 Oak Ave', 'A+', '0247654321', 'Private', 'PVT456'],
      ['PAT003', 'Bob Johnson', 28, 'Male', '0201234567', 'bob@email.com', '789 Elm St', 'B+', '0208765432', 'NHIS', 'NHIS789']
    ];
    
    for (const patient of patients) {
      await pool.query(`
        INSERT INTO hms.patients (id, name, age, gender, phone, email, address, blood_group, emergency_contact, insurance_provider, insurance_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, patient);
    }
    
    // Insert sample staff
    const staff = [
      ['DOC001', 'Dr. Sarah Wilson', 'Doctor', 'Cardiology', 'Cardiologist', 'sarah@hospital.com', '0551112222', 'Morning', 15000],
      ['DOC002', 'Dr. Mike Brown', 'Doctor', 'Emergency', 'Emergency Medicine', 'mike@hospital.com', '0242223333', 'Night', 12000],
      ['NUR001', 'Nurse Mary', 'Nurse', 'General', 'RN', 'mary@hospital.com', '0203334444', 'Morning', 5000]
    ];
    
    for (const s of staff) {
      await pool.query(`
        INSERT INTO hms.staff (id, name, role, department, specialization, email, phone, shift, salary, join_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
        ON CONFLICT (id) DO NOTHING
      `, s);
    }
    
    // Insert sample inventory items
    const items = [
      ['MED001', 'Paracetamol', 'Medicine', 500, 'Tablets', 50, 0.50, '2025-12-31', 'PharmaCo'],
      ['MED002', 'Amoxicillin', 'Medicine', 200, 'Capsules', 30, 2.00, '2025-06-30', 'MediSupply'],
      ['SUP001', 'Surgical Gloves', 'Supplies', 1000, 'Pairs', 100, 1.50, null, 'MedEquip'],
      ['SUP002', 'Syringes', 'Supplies', 500, 'Units', 50, 0.30, null, 'MedEquip']
    ];
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO hms.inventory (item_code, item_name, category, quantity, unit, reorder_level, unit_price, expiry_date, supplier)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (item_code) DO NOTHING
      `, item);
    }
    
    // Insert sample beds
    const beds = [
      ['B001', 'ICU', 'R101', 'ICU', false, null, 500],
      ['B002', 'ICU', 'R101', 'ICU', false, null, 500],
      ['B003', 'General', 'R201', 'Standard', false, null, 200],
      ['B004', 'General', 'R201', 'Standard', false, null, 200],
      ['B005', 'Private', 'R301', 'Private', false, null, 350]
    ];
    
    for (const bed of beds) {
      await pool.query(`
        INSERT INTO hms.beds (bed_number, ward, room_number, bed_type, is_occupied, patient_id, daily_rate)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (bed_number) DO NOTHING
      `, bed);
    }
    
    console.log('✓ Sample data inserted');
    
  } catch (error) {
    console.error('Sample data insertion error:', error);
  }
}

// ============= API ENDPOINTS =============

// Electronic Medical Records
app.get('/api/medical-records', async (req, res) => {
  try {
    const records = await pool.query(`
      SELECT mr.*, p.name as patient_name, s.name as doctor_name
      FROM hms.medical_records mr
      LEFT JOIN hms.patients p ON mr.patient_id = p.id
      LEFT JOIN hms.staff s ON mr.doctor_id = s.id
      ORDER BY mr.created_at DESC
    `);
    res.json(records.rows);
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medical-records', async (req, res) => {
  try {
    const { patient_id, doctor_id, chief_complaint, diagnosis, prescription, lab_results, vital_signs, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO hms.medical_records 
      (patient_id, doctor_id, visit_date, chief_complaint, diagnosis, prescription, lab_results, vital_signs, notes)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [patient_id, doctor_id, chief_complaint, diagnosis, prescription, lab_results, JSON.stringify(vital_signs), notes]);
    
    broadcastUpdate('medical_record_added', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating medical record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medical-records/:patientId', async (req, res) => {
  try {
    const records = await pool.query(`
      SELECT * FROM hms.medical_records 
      WHERE patient_id = $1 
      ORDER BY visit_date DESC
    `, [req.params.patientId]);
    res.json(records.rows);
  } catch (error) {
    console.error('Error fetching patient records:', error);
    res.status(500).json({ error: error.message });
  }
});

// Billing & Revenue Management
app.get('/api/billing', async (req, res) => {
  try {
    const invoices = await pool.query(`
      SELECT b.*, p.name as patient_name 
      FROM hms.billing b
      LEFT JOIN hms.patients p ON b.patient_id = p.id
      ORDER BY b.created_at DESC
    `);
    res.json(invoices.rows);
  } catch (error) {
    console.error('Error fetching billing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing/create-invoice', async (req, res) => {
  try {
    const { patient_id, items, payment_method } = req.body;
    
    // Calculate total
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const invoice_number = 'INV' + Date.now();
    
    const result = await pool.query(`
      INSERT INTO hms.billing 
      (patient_id, invoice_number, total_amount, payment_method, items)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [patient_id, invoice_number, total, payment_method, JSON.stringify(items)]);
    
    broadcastUpdate('invoice_created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing/process-payment', async (req, res) => {
  try {
    const { invoice_id, amount, payment_method } = req.body;
    
    const result = await pool.query(`
      UPDATE hms.billing 
      SET paid_amount = paid_amount + $1,
          payment_status = CASE 
            WHEN paid_amount + $1 >= total_amount THEN 'paid'
            ELSE 'partial'
          END,
          payment_method = $2
      WHERE id = $3
      RETURNING *
    `, [amount, payment_method, invoice_id]);
    
    broadcastUpdate('payment_processed', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/billing/revenue-summary', async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(total_amount) as total_revenue,
        SUM(paid_amount) as total_collected,
        SUM(total_amount - paid_amount) as outstanding,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_invoices
      FROM hms.billing
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    res.json(summary.rows[0]);
  } catch (error) {
    console.error('Error fetching revenue summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Inventory Management
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM hms.inventory ORDER BY item_name');
    res.json(items.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/low-stock', async (req, res) => {
  try {
    const items = await pool.query(`
      SELECT * FROM hms.inventory 
      WHERE quantity <= reorder_level 
      ORDER BY (quantity::float / NULLIF(reorder_level, 0))
    `);
    res.json(items.rows);
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory/stock-entry', async (req, res) => {
  try {
    const { item_code, item_name, category, quantity, unit, unit_price, expiry_date, supplier, reorder_level } = req.body;
    
    const result = await pool.query(`
      INSERT INTO hms.inventory 
      (item_code, item_name, category, quantity, unit, unit_price, expiry_date, supplier, reorder_level, last_restocked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
      ON CONFLICT (item_code) 
      DO UPDATE SET 
        quantity = hms.inventory.quantity + $4,
        unit_price = $6,
        last_restocked = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [item_code, item_name, category, quantity, unit, unit_price, expiry_date, supplier, reorder_level]);
    
    // Check if low stock alert needed
    if (result.rows[0].quantity <= result.rows[0].reorder_level) {
      broadcastUpdate('low_stock_alert', result.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory/dispense', async (req, res) => {
  try {
    const { item_code, quantity } = req.body;
    
    const result = await pool.query(`
      UPDATE hms.inventory 
      SET quantity = quantity - $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE item_code = $2 AND quantity >= $1
      RETURNING *
    `, [quantity, item_code]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    // Check if low stock alert needed
    if (result.rows[0].quantity <= result.rows[0].reorder_level) {
      broadcastUpdate('low_stock_alert', result.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error dispensing item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Staff Management
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await pool.query('SELECT * FROM hms.staff ORDER BY name');
    res.json(staff.rows);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/schedules', async (req, res) => {
  try {
    const schedules = await pool.query(`
      SELECT ss.*, s.name as staff_name, s.role, s.department as staff_department
      FROM hms.staff_schedules ss
      JOIN hms.staff s ON ss.staff_id = s.id
      WHERE ss.date >= CURRENT_DATE
      ORDER BY ss.date, ss.start_time
    `);
    res.json(schedules.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff/add-schedule', async (req, res) => {
  try {
    const { staff_id, date, shift, start_time, end_time, department } = req.body;
    
    const result = await pool.query(`
      INSERT INTO hms.staff_schedules 
      (staff_id, date, shift, start_time, end_time, department)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [staff_id, date, shift, start_time, end_time, department]);
    
    broadcastUpdate('schedule_added', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/payroll', async (req, res) => {
  try {
    const payroll = await pool.query(`
      SELECT 
        s.id, s.name, s.role, s.salary,
        COUNT(ss.id) as shifts_worked,
        s.salary as monthly_salary
      FROM hms.staff s
      LEFT JOIN hms.staff_schedules ss ON s.id = ss.staff_id
        AND ss.date >= DATE_TRUNC('month', CURRENT_DATE)
        AND ss.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY s.id, s.name, s.role, s.salary
      ORDER BY s.name
    `);
    res.json(payroll.rows);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bed Management
app.get('/api/beds', async (req, res) => {
  try {
    const beds = await pool.query(`
      SELECT b.*, p.name as patient_name
      FROM hms.beds b
      LEFT JOIN hms.patients p ON b.patient_id = p.id
      ORDER BY b.ward, b.bed_number
    `);
    res.json(beds.rows);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/beds/available', async (req, res) => {
  try {
    const beds = await pool.query(`
      SELECT * FROM hms.beds 
      WHERE is_occupied = false 
      ORDER BY ward, bed_number
    `);
    res.json(beds.rows);
  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/beds/admit', async (req, res) => {
  try {
    const { bed_id, patient_id, doctor_id, diagnosis, expected_discharge } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    // Update bed
    await pool.query(`
      UPDATE hms.beds 
      SET is_occupied = true, 
          patient_id = $1,
          admission_date = CURRENT_TIMESTAMP,
          expected_discharge = $2
      WHERE id = $3
    `, [patient_id, expected_discharge, bed_id]);
    
    // Create admission record
    const admission = await pool.query(`
      INSERT INTO hms.admissions 
      (patient_id, bed_id, doctor_id, diagnosis)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [patient_id, bed_id, doctor_id, diagnosis]);
    
    await pool.query('COMMIT');
    
    broadcastUpdate('patient_admitted', admission.rows[0]);
    res.status(201).json(admission.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error admitting patient:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/beds/discharge', async (req, res) => {
  try {
    const { bed_id, admission_id } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    // Update bed
    await pool.query(`
      UPDATE hms.beds 
      SET is_occupied = false, 
          patient_id = NULL,
          admission_date = NULL,
          expected_discharge = NULL
      WHERE id = $1
    `, [bed_id]);
    
    // Update admission record
    await pool.query(`
      UPDATE hms.admissions 
      SET discharge_date = CURRENT_TIMESTAMP,
          status = 'discharged'
      WHERE id = $1
    `, [admission_id]);
    
    await pool.query('COMMIT');
    
    broadcastUpdate('patient_discharged', { bed_id, admission_id });
    res.json({ message: 'Patient discharged successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error discharging patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics Dashboard
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const [occupancy, revenue, inventory, staff] = await Promise.all([
      // Bed occupancy
      pool.query(`
        SELECT 
          COUNT(*) as total_beds,
          COUNT(CASE WHEN is_occupied THEN 1 END) as occupied_beds,
          ROUND(COUNT(CASE WHEN is_occupied THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as occupancy_rate
        FROM hms.beds
      `),
      
      // Revenue metrics
      pool.query(`
        SELECT 
          SUM(total_amount) as total_revenue,
          SUM(paid_amount) as collected_revenue,
          SUM(total_amount - paid_amount) as outstanding_revenue,
          COUNT(*) as total_invoices
        FROM hms.billing
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `),
      
      // Inventory alerts
      pool.query(`
        SELECT COUNT(*) as low_stock_items
        FROM hms.inventory
        WHERE quantity <= reorder_level
      `),
      
      // Staff on duty
      pool.query(`
        SELECT COUNT(DISTINCT staff_id) as staff_on_duty
        FROM hms.staff_schedules
        WHERE date = CURRENT_DATE
      `)
    ]);
    
    res.json({
      occupancy: occupancy.rows[0],
      revenue: revenue.rows[0],
      inventory: inventory.rows[0],
      staff: staff.rows[0],
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/patient-flow', async (req, res) => {
  try {
    const flow = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as patients
      FROM hms.medical_records
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    res.json(flow.rows);
  } catch (error) {
    console.error('Error fetching patient flow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Patients endpoints
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await pool.query('SELECT * FROM hms.patients ORDER BY name');
    res.json(patients.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { id, name, age, gender, phone, email, address, blood_group, emergency_contact, insurance_provider, insurance_number } = req.body;
    
    const result = await pool.query(`
      INSERT INTO hms.patients 
      (id, name, age, gender, phone, email, address, blood_group, emergency_contact, insurance_provider, insurance_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [id || 'PAT' + Date.now(), name, age, gender, phone, email, address, blood_group, emergency_contact, insurance_provider, insurance_number]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'HMS Backend',
    timestamp: new Date(),
    websocket: wsClients.size + ' clients connected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Hospital Management System API',
    version: '2.0',
    endpoints: {
      'Medical Records': '/api/medical-records',
      'Billing': '/api/billing',
      'Inventory': '/api/inventory',
      'Staff': '/api/staff',
      'Beds': '/api/beds',
      'Analytics': '/api/analytics/dashboard',
      'Patients': '/api/patients'
    }
  });
});

// Start server
const PORT = process.env.PORT || 5801;

async function startServer() {
  await initializeDatabase();
  
  server.listen(PORT, () => {
    console.log(`
    ========================================
    HMS Backend Server Running
    ========================================
    Port: ${PORT}
    URL: http://localhost:${PORT}
    WebSocket: ws://localhost:${PORT}
    
    API Endpoints:
    - GET  /api/medical-records
    - POST /api/medical-records
    - GET  /api/billing
    - POST /api/billing/create-invoice
    - GET  /api/inventory
    - POST /api/inventory/stock-entry
    - GET  /api/staff
    - POST /api/staff/add-schedule
    - GET  /api/beds/available
    - POST /api/beds/admit
    - GET  /api/analytics/dashboard
    ========================================
    `);
  });
}

startServer().catch(console.error);
