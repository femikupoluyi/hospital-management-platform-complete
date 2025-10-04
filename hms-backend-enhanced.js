const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = 9000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('/root'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'HMS Backend Enhanced',
    timestamp: new Date().toISOString()
  });
});

// ==================== ELECTRONIC MEDICAL RECORDS ====================

// Get all patients
app.get('/api/emr/patients', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        e.patient_id,
        e.patient_name,
        e.patient_age,
        e.patient_gender,
        e.contact_phone,
        e.contact_email,
        COUNT(DISTINCT e.encounter_id) as total_visits,
        MAX(e.encounter_date) as last_visit
      FROM emr.encounters e
      GROUP BY e.patient_id, e.patient_name, e.patient_age, e.patient_gender, 
               e.contact_phone, e.contact_email
      ORDER BY last_visit DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Create new patient record
app.post('/api/emr/patients', async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, blood_type, allergies } = req.body;
    
    // Create an encounter for the new patient
    const query = `
      INSERT INTO emr.encounters (
        patient_id, patient_name, patient_age, patient_gender, 
        contact_phone, contact_email, encounter_date, encounter_type, 
        chief_complaint, status
      ) VALUES (
        'PT-' || LPAD(CAST(FLOOR(RANDOM() * 100000) AS TEXT), 5, '0'),
        $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'Registration', 
        'New Patient Registration', 'Active'
      ) RETURNING *
    `;
    const values = [name, age, gender, phone, email];
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient record' });
  }
});

// Get patient medical history
app.get('/api/emr/patients/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get encounters
    const encounters = await pool.query(`
      SELECT * FROM emr.encounters 
      WHERE patient_id = $1 
      ORDER BY encounter_date DESC
    `, [id]);
    
    // Get diagnoses
    const diagnoses = await pool.query(`
      SELECT * FROM emr.diagnoses 
      WHERE patient_id = $1 
      ORDER BY diagnosis_date DESC
    `, [id]);
    
    // Get prescriptions
    const prescriptions = await pool.query(`
      SELECT * FROM emr.prescriptions 
      WHERE patient_id = $1 
      ORDER BY prescription_date DESC
    `, [id]);
    
    // Get lab tests
    const labTests = await pool.query(`
      SELECT * FROM emr.lab_tests 
      WHERE patient_id = $1 
      ORDER BY test_date DESC
    `, [id]);
    
    // Get vital signs
    const vitals = await pool.query(`
      SELECT * FROM emr.vital_signs 
      WHERE patient_id = $1 
      ORDER BY measurement_date DESC
      LIMIT 10
    `, [id]);
    
    res.json({
      encounters: encounters.rows,
      diagnoses: diagnoses.rows,
      prescriptions: prescriptions.rows,
      labTests: labTests.rows,
      vitalSigns: vitals.rows
    });
  } catch (error) {
    console.error('Error fetching medical history:', error);
    res.status(500).json({ error: 'Failed to fetch medical history' });
  }
});

// Add clinical note
app.post('/api/emr/clinical-notes', async (req, res) => {
  try {
    const { encounter_id, note_type, note_text, created_by } = req.body;
    const query = `
      INSERT INTO emr.clinical_notes (encounter_id, note_type, note_text, created_by, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await pool.query(query, [encounter_id, note_type, note_text, created_by]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding clinical note:', error);
    res.status(500).json({ error: 'Failed to add clinical note' });
  }
});

// Add prescription
app.post('/api/emr/prescriptions', async (req, res) => {
  try {
    const { patient_id, encounter_id, medication, dosage, frequency, duration, prescribed_by } = req.body;
    const query = `
      INSERT INTO emr.prescriptions (
        patient_id, encounter_id, medication, dosage, frequency, 
        duration, prescribed_by, prescription_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 'Active')
      RETURNING *
    `;
    const result = await pool.query(query, [
      patient_id, encounter_id, medication, dosage, frequency, duration, prescribed_by
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({ error: 'Failed to add prescription' });
  }
});

// ==================== BILLING & REVENUE ====================

// Get all invoices
app.get('/api/billing/invoices', async (req, res) => {
  try {
    const query = `
      SELECT 
        i.*,
        COUNT(DISTINCT ii.item_id) as item_count,
        SUM(ii.quantity * ii.unit_price) as calculated_total
      FROM billing.invoices i
      LEFT JOIN billing.invoice_items ii ON i.invoice_id = ii.invoice_id
      GROUP BY i.invoice_id
      ORDER BY i.created_at DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Create invoice
app.post('/api/billing/invoices', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { patient_id, patient_name, items, payment_method, insurance_provider } = req.body;
    
    // Calculate total
    const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    
    // Create invoice
    const invoiceQuery = `
      INSERT INTO billing.invoices (
        invoice_number, patient_id, patient_name, total_amount, 
        payment_status, payment_method, insurance_provider, created_at
      ) VALUES (
        'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(CAST(FLOOR(RANDOM() * 10000) AS TEXT), 4, '0'),
        $1, $2, $3, 'Pending', $4, $5, CURRENT_TIMESTAMP
      ) RETURNING *
    `;
    const invoiceResult = await client.query(invoiceQuery, [
      patient_id, patient_name, total_amount, payment_method, insurance_provider
    ]);
    const invoice = invoiceResult.rows[0];
    
    // Add invoice items
    for (const item of items) {
      const itemQuery = `
        INSERT INTO billing.invoice_items (
          invoice_id, description, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      await client.query(itemQuery, [
        invoice.invoice_id, item.description, item.quantity, 
        item.unit_price, item.quantity * item.unit_price
      ]);
    }
    
    await client.query('COMMIT');
    res.json(invoice);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

// Process payment
app.post('/api/billing/payments', async (req, res) => {
  try {
    const { invoice_id, amount, payment_method, reference_number } = req.body;
    
    // Record payment
    const paymentQuery = `
      INSERT INTO billing.payments (
        invoice_id, amount, payment_method, payment_date, 
        reference_number, status
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'Completed')
      RETURNING *
    `;
    const paymentResult = await pool.query(paymentQuery, [
      invoice_id, amount, payment_method, reference_number
    ]);
    
    // Update invoice status
    await pool.query(`
      UPDATE billing.invoices 
      SET payment_status = 'Paid', updated_at = CURRENT_TIMESTAMP
      WHERE invoice_id = $1
    `, [invoice_id]);
    
    res.json(paymentResult.rows[0]);
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Get revenue analytics
app.get('/api/billing/analytics', async (req, res) => {
  try {
    const dailyRevenue = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as invoice_count,
        SUM(total_amount) as revenue,
        SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN payment_status = 'Pending' THEN total_amount ELSE 0 END) as pending_revenue
      FROM billing.invoices
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    const paymentMethods = await pool.query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as total
      FROM billing.invoices
      WHERE payment_status = 'Paid'
      GROUP BY payment_method
    `);
    
    const insuranceStats = await pool.query(`
      SELECT 
        insurance_provider,
        COUNT(*) as claim_count,
        SUM(claim_amount) as total_claimed,
        SUM(approved_amount) as total_approved,
        AVG(EXTRACT(DAY FROM (approval_date - submission_date))) as avg_processing_days
      FROM billing.insurance_claims
      WHERE status = 'Approved'
      GROUP BY insurance_provider
    `);
    
    res.json({
      dailyRevenue: dailyRevenue.rows,
      paymentMethods: paymentMethods.rows,
      insuranceStats: insuranceStats.rows
    });
  } catch (error) {
    console.error('Error fetching billing analytics:', error);
    res.status(500).json({ error: 'Failed to fetch billing analytics' });
  }
});

// ==================== INVENTORY MANAGEMENT ====================

// Get inventory items
app.get('/api/inventory/items', async (req, res) => {
  try {
    const query = `
      SELECT 
        i.*,
        ic.name as category_name,
        CASE 
          WHEN i.current_quantity <= i.reorder_level THEN 'Low Stock'
          WHEN i.current_quantity <= i.reorder_level * 1.5 THEN 'Warning'
          ELSE 'Good'
        END as stock_status
      FROM hms.inventory_items i
      LEFT JOIN hms.inventory_categories ic ON i.category_id = ic.category_id
      ORDER BY i.current_quantity ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add stock
app.post('/api/inventory/stock-entry', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { item_id, quantity, transaction_type, supplier, batch_number, expiry_date } = req.body;
    
    // Record transaction
    const transQuery = `
      INSERT INTO hms.stock_transactions (
        item_id, quantity, transaction_type, transaction_date, 
        reference_number, performed_by
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
      RETURNING *
    `;
    const transResult = await client.query(transQuery, [
      item_id, quantity, transaction_type, 
      'STOCK-' + Date.now(), 'System'
    ]);
    
    // Update current stock
    const updateQuery = transaction_type === 'In' 
      ? `UPDATE hms.inventory_items SET current_quantity = current_quantity + $2, last_updated = CURRENT_TIMESTAMP WHERE item_id = $1`
      : `UPDATE hms.inventory_items SET current_quantity = current_quantity - $2, last_updated = CURRENT_TIMESTAMP WHERE item_id = $1`;
    
    await client.query(updateQuery, [item_id, quantity]);
    
    await client.query('COMMIT');
    res.json(transResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding stock:', error);
    res.status(500).json({ error: 'Failed to add stock entry' });
  } finally {
    client.release();
  }
});

// Get low stock items
app.get('/api/inventory/low-stock', async (req, res) => {
  try {
    const query = `
      SELECT 
        i.*,
        ic.name as category_name,
        (i.reorder_level - i.current_quantity) as shortage_quantity,
        i.reorder_quantity as suggested_order
      FROM hms.inventory_items i
      LEFT JOIN hms.inventory_categories ic ON i.category_id = ic.category_id
      WHERE i.current_quantity <= i.reorder_level
      ORDER BY (i.current_quantity::float / NULLIF(i.reorder_level, 0)) ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Auto reorder
app.post('/api/inventory/auto-reorder', async (req, res) => {
  try {
    const { item_id } = req.body;
    
    // Get item details
    const item = await pool.query(
      'SELECT * FROM hms.inventory_items WHERE item_id = $1', 
      [item_id]
    );
    
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const itemData = item.rows[0];
    
    // Create purchase order
    const orderQuery = `
      INSERT INTO inventory.purchase_orders (
        order_number, supplier_id, order_date, expected_delivery, 
        total_amount, status
      ) VALUES (
        'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(CAST(FLOOR(RANDOM() * 10000) AS TEXT), 4, '0'),
        1, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days',
        $1, 'Pending'
      ) RETURNING *
    `;
    const orderResult = await pool.query(orderQuery, [
      itemData.unit_cost * itemData.reorder_quantity
    ]);
    
    // Add order item
    await pool.query(`
      INSERT INTO inventory.po_items (
        po_id, item_name, quantity, unit_price, total_price
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      orderResult.rows[0].po_id,
      itemData.name,
      itemData.reorder_quantity,
      itemData.unit_cost,
      itemData.unit_cost * itemData.reorder_quantity
    ]);
    
    res.json({
      message: 'Reorder placed successfully',
      order: orderResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating reorder:', error);
    res.status(500).json({ error: 'Failed to create reorder' });
  }
});

// ==================== STAFF MANAGEMENT ====================

// Get all staff
app.get('/api/staff/all', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        COUNT(DISTINCT ss.schedule_id) as total_shifts,
        COUNT(DISTINCT a.attendance_id) as attendance_count
      FROM hms.staff s
      LEFT JOIN hms.staff_schedules ss ON s.staff_id = ss.staff_id
      LEFT JOIN hms.attendance a ON s.staff_id = a.staff_id
      GROUP BY s.staff_id
      ORDER BY s.name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Add staff schedule
app.post('/api/staff/schedule', async (req, res) => {
  try {
    const { staff_id, shift_date, shift_start, shift_end, department, role } = req.body;
    
    const query = `
      INSERT INTO hms.staff_schedules (
        staff_id, shift_date, shift_start, shift_end, department, status
      ) VALUES ($1, $2, $3, $4, $5, 'Scheduled')
      RETURNING *
    `;
    const result = await pool.query(query, [
      staff_id, shift_date, shift_start, shift_end, department
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding schedule:', error);
    res.status(500).json({ error: 'Failed to add schedule' });
  }
});

// Get today's roster
app.get('/api/staff/roster/today', async (req, res) => {
  try {
    const query = `
      SELECT 
        ss.*,
        s.name as staff_name,
        s.position,
        s.department as staff_department,
        s.contact_phone,
        a.check_in_time,
        a.check_out_time,
        CASE 
          WHEN a.attendance_id IS NOT NULL THEN 'Present'
          WHEN CURRENT_TIME > ss.shift_end THEN 'Absent'
          WHEN CURRENT_TIME < ss.shift_start THEN 'Not Started'
          ELSE 'On Duty'
        END as attendance_status
      FROM hms.staff_schedules ss
      JOIN hms.staff s ON ss.staff_id = s.staff_id
      LEFT JOIN hms.attendance a ON s.staff_id = a.staff_id 
        AND a.attendance_date = CURRENT_DATE
      WHERE ss.shift_date = CURRENT_DATE
      ORDER BY ss.shift_start
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roster:', error);
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});

// Record attendance
app.post('/api/staff/attendance', async (req, res) => {
  try {
    const { staff_id, check_type } = req.body;
    
    if (check_type === 'check_in') {
      const query = `
        INSERT INTO hms.attendance (
          staff_id, attendance_date, check_in_time, status
        ) VALUES ($1, CURRENT_DATE, CURRENT_TIME, 'Present')
        ON CONFLICT (staff_id, attendance_date) 
        DO UPDATE SET check_in_time = CURRENT_TIME
        RETURNING *
      `;
      const result = await pool.query(query, [staff_id]);
      res.json(result.rows[0]);
    } else {
      const query = `
        UPDATE hms.attendance 
        SET check_out_time = CURRENT_TIME,
            hours_worked = EXTRACT(HOUR FROM (CURRENT_TIME - check_in_time))
        WHERE staff_id = $1 AND attendance_date = CURRENT_DATE
        RETURNING *
      `;
      const result = await pool.query(query, [staff_id]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// ==================== BED MANAGEMENT ====================

// Get all beds
app.get('/api/beds/all', async (req, res) => {
  try {
    const query = `
      SELECT 
        b.*,
        w.name as ward_name,
        w.ward_type,
        e.patient_name,
        e.patient_id,
        e.encounter_id,
        e.encounter_date as admission_date
      FROM hms.beds b
      LEFT JOIN hms.wards w ON b.ward_id = w.ward_id
      LEFT JOIN emr.encounters e ON b.bed_id = e.assigned_bed 
        AND e.status = 'Admitted'
      ORDER BY w.name, b.bed_number
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ error: 'Failed to fetch beds' });
  }
});

// Get available beds
app.get('/api/beds/available', async (req, res) => {
  try {
    const query = `
      SELECT 
        b.*,
        w.name as ward_name,
        w.ward_type
      FROM hms.beds b
      LEFT JOIN hms.wards w ON b.ward_id = w.ward_id
      WHERE b.is_occupied = false AND b.is_available = true
      ORDER BY w.name, b.bed_number
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({ error: 'Failed to fetch available beds' });
  }
});

// New admission
app.post('/api/beds/admission', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { 
      patient_name, patient_age, patient_gender, contact_phone,
      bed_id, ward_id, chief_complaint, admitting_doctor 
    } = req.body;
    
    // Create encounter
    const encounterQuery = `
      INSERT INTO emr.encounters (
        patient_id, patient_name, patient_age, patient_gender,
        contact_phone, encounter_date, encounter_type, chief_complaint,
        assigned_bed, status
      ) VALUES (
        'PT-' || LPAD(CAST(FLOOR(RANDOM() * 100000) AS TEXT), 5, '0'),
        $1, $2, $3, $4, CURRENT_TIMESTAMP, 'Admission', $5, $6, 'Admitted'
      ) RETURNING *
    `;
    const encounterResult = await client.query(encounterQuery, [
      patient_name, patient_age, patient_gender, contact_phone,
      chief_complaint, bed_id
    ]);
    
    // Update bed status
    await client.query(
      'UPDATE hms.beds SET is_occupied = true WHERE bed_id = $1',
      [bed_id]
    );
    
    // Update ward occupancy
    await client.query(`
      UPDATE hms.wards 
      SET occupied_beds = occupied_beds + 1 
      WHERE ward_id = $1
    `, [ward_id]);
    
    await client.query('COMMIT');
    res.json(encounterResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating admission:', error);
    res.status(500).json({ error: 'Failed to create admission' });
  } finally {
    client.release();
  }
});

// Discharge patient
app.post('/api/beds/discharge', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { encounter_id, bed_id, ward_id, discharge_notes } = req.body;
    
    // Update encounter
    await client.query(`
      UPDATE emr.encounters 
      SET status = 'Discharged', 
          discharge_date = CURRENT_TIMESTAMP,
          discharge_notes = $2
      WHERE encounter_id = $1
    `, [encounter_id, discharge_notes]);
    
    // Free up bed
    await client.query(
      'UPDATE hms.beds SET is_occupied = false WHERE bed_id = $1',
      [bed_id]
    );
    
    // Update ward occupancy
    await client.query(`
      UPDATE hms.wards 
      SET occupied_beds = occupied_beds - 1 
      WHERE ward_id = $1
    `, [ward_id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Patient discharged successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error discharging patient:', error);
    res.status(500).json({ error: 'Failed to discharge patient' });
  } finally {
    client.release();
  }
});

// ==================== ANALYTICS DASHBOARD ====================

// Get dashboard metrics
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    // Get occupancy metrics
    const occupancy = await pool.query(`
      SELECT 
        COUNT(DISTINCT w.ward_id) as total_wards,
        SUM(w.total_beds) as total_beds,
        SUM(w.occupied_beds) as occupied_beds,
        ROUND(AVG(w.occupied_beds::numeric / NULLIF(w.total_beds, 0) * 100), 1) as occupancy_rate
      FROM hms.wards w
    `);
    
    // Get today's stats
    const todayStats = await pool.query(`
      SELECT 
        COUNT(CASE WHEN encounter_type = 'Admission' THEN 1 END) as admissions_today,
        COUNT(CASE WHEN status = 'Discharged' AND DATE(discharge_date) = CURRENT_DATE THEN 1 END) as discharges_today,
        COUNT(CASE WHEN encounter_type = 'Emergency' THEN 1 END) as emergency_visits
      FROM emr.encounters
      WHERE DATE(encounter_date) = CURRENT_DATE
    `);
    
    // Get revenue stats
    const revenue = await pool.query(`
      SELECT 
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total_amount ELSE 0 END) as today_revenue,
        SUM(CASE WHEN DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days' THEN total_amount ELSE 0 END) as week_revenue,
        SUM(CASE WHEN DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days' THEN total_amount ELSE 0 END) as month_revenue,
        COUNT(CASE WHEN payment_status = 'Pending' THEN 1 END) as pending_bills
      FROM billing.invoices
    `);
    
    // Get staff metrics
    const staffMetrics = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.staff_id) as total_staff,
        COUNT(DISTINCT CASE WHEN ss.shift_date = CURRENT_DATE THEN s.staff_id END) as staff_on_duty,
        COUNT(DISTINCT CASE WHEN a.attendance_date = CURRENT_DATE THEN a.staff_id END) as present_today
      FROM hms.staff s
      LEFT JOIN hms.staff_schedules ss ON s.staff_id = ss.staff_id
      LEFT JOIN hms.attendance a ON s.staff_id = a.staff_id
    `);
    
    // Get inventory alerts
    const inventoryAlerts = await pool.query(`
      SELECT COUNT(*) as low_stock_count
      FROM hms.inventory_items
      WHERE current_quantity <= reorder_level
    `);
    
    res.json({
      occupancy: occupancy.rows[0],
      todayStats: todayStats.rows[0],
      revenue: revenue.rows[0],
      staffMetrics: staffMetrics.rows[0],
      inventoryAlerts: inventoryAlerts.rows[0]
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// Get trend data
app.get('/api/analytics/trends', async (req, res) => {
  try {
    const admissionTrends = await pool.query(`
      SELECT 
        DATE(encounter_date) as date,
        COUNT(*) as admissions,
        COUNT(CASE WHEN encounter_type = 'Emergency' THEN 1 END) as emergency,
        COUNT(CASE WHEN encounter_type = 'Outpatient' THEN 1 END) as outpatient
      FROM emr.encounters
      WHERE encounter_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(encounter_date)
      ORDER BY date
    `);
    
    const revenueTrends = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as revenue,
        COUNT(*) as invoice_count
      FROM billing.invoices
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    const occupancyTrends = await pool.query(`
      SELECT 
        w.name as ward_name,
        w.ward_type,
        w.total_beds,
        w.occupied_beds,
        ROUND(w.occupied_beds::numeric / NULLIF(w.total_beds, 0) * 100, 1) as occupancy_rate
      FROM hms.wards w
      ORDER BY occupancy_rate DESC
    `);
    
    res.json({
      admissionTrends: admissionTrends.rows,
      revenueTrends: revenueTrends.rows,
      occupancyByWard: occupancyTrends.rows
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Export report
app.get('/api/analytics/export', async (req, res) => {
  try {
    const { type, start_date, end_date } = req.query;
    
    let data;
    switch(type) {
      case 'patients':
        data = await pool.query(`
          SELECT * FROM emr.encounters 
          WHERE encounter_date BETWEEN $1 AND $2
          ORDER BY encounter_date DESC
        `, [start_date, end_date]);
        break;
      case 'revenue':
        data = await pool.query(`
          SELECT * FROM billing.invoices
          WHERE created_at BETWEEN $1 AND $2
          ORDER BY created_at DESC
        `, [start_date, end_date]);
        break;
      case 'inventory':
        data = await pool.query(`
          SELECT * FROM hms.stock_transactions
          WHERE transaction_date BETWEEN $1 AND $2
          ORDER BY transaction_date DESC
        `, [start_date, end_date]);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    
    res.json({
      report_type: type,
      period: { start: start_date, end: end_date },
      data: data.rows,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Serve enhanced HMS frontend
app.get('/', (req, res) => {
  res.sendFile('/root/hms-frontend-enhanced.html');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HMS Backend Enhanced running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
});
