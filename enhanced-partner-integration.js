#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const bodyParser = require('body-parser');
const axios = require('axios');

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
    service: 'Partner Integration API',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile('/root/partner-integration-portal.html');
});

// =============================
// INSURANCE & HMO INTEGRATION
// =============================

// Get all insurance partners
app.get('/api/partners/insurance', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT id, partner_name as name, partner_type, api_endpoint, 
             is_active, integration_status, contact_email, contact_phone,
             coverage_types, supported_services
      FROM partner_ecosystem.insurance_partners
      WHERE is_active = true
      ORDER BY partner_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching insurance partners:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Submit insurance claim
app.post('/api/partners/insurance/claims', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { partner_id, patient_id, claim_amount, diagnosis_code, treatment_code } = req.body;
  
  try {
    await client.connect();
    await client.query('BEGIN');
    
    // Generate a claim UUID
    const claimUuid = await client.query(`SELECT gen_random_uuid() as uuid`);
    const claimId = claimUuid.rows[0].uuid;
    
    // Record the claim submission
    const claimResult = await client.query(`
      INSERT INTO partner_ecosystem.insurance_api_transactions 
      (partner_id, claim_id, transaction_type, request_payload, status, transaction_ref, created_at)
      VALUES ($1, $2, 'claim_submission', $3, 'Pending', $4, CURRENT_TIMESTAMP)
      RETURNING *
    `, [partner_id, claimId, JSON.stringify({ patient_id, claim_amount, diagnosis_code, treatment_code }), 
        `TXN-${Date.now()}`]);
    
    // Simulate API call to insurance partner
    const mockResponse = {
      claim_id: `CLM-${Date.now()}`,
      status: 'submitted',
      estimated_processing_time: '3-5 business days',
      amount_approved: claim_amount * 0.8 // 80% approval rate mock
    };
    
    // Update transaction with response
    await client.query(`
      UPDATE partner_ecosystem.insurance_api_transactions
      SET response_payload = $1, status = 'Success', completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(mockResponse), claimResult.rows[0].id]);
    
    await client.query('COMMIT');
    res.json({ ...claimResult.rows[0], response: mockResponse });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting claim:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get claim status
app.get('/api/partners/insurance/claims/:claimId', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT * FROM partner_ecosystem.insurance_api_transactions
      WHERE response_payload->>'claim_id' = $1 OR transaction_ref = $1
    `, [req.params.claimId]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Claim not found' });
    }
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =============================
// PHARMACY & SUPPLIER INTEGRATION
// =============================

// Get pharmacy suppliers
app.get('/api/partners/pharmacy', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT id, supplier_name as name, supplier_type, api_endpoint,
             is_active, auto_restock_enabled, minimum_order_value,
             delivery_lead_time_days, contact_email, contact_phone
      FROM partner_ecosystem.pharmacy_suppliers
      WHERE is_active = true
      ORDER BY supplier_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pharmacy suppliers:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Auto-restock order
app.post('/api/partners/pharmacy/restock', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { supplier_id, hospital_id, items } = req.body;
  
  try {
    await client.connect();
    await client.query('BEGIN');
    
    // Create restock order
    const orderResult = await client.query(`
      INSERT INTO partner_ecosystem.auto_restock_orders
      (supplier_id, hospital_id, items_requested, total_amount, order_status, trigger_type, created_at)
      VALUES ($1, $2, $3, $4, 'Pending', 'manual', CURRENT_TIMESTAMP)
      RETURNING *
    `, [supplier_id, hospital_id || '37f6c11b-5ded-4c17-930d-88b1fec06301', JSON.stringify(items), 
        items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)]);
    
    // Simulate supplier API call
    const mockResponse = {
      order_id: `ORD-${Date.now()}`,
      status: 'confirmed',
      estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      tracking_number: `TRK-${Math.random().toString(36).substring(7).toUpperCase()}`
    };
    
    // Update order with supplier response
    await client.query(`
      UPDATE partner_ecosystem.auto_restock_orders
      SET order_status = 'Confirmed', api_response = $2, expected_delivery = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [orderResult.rows[0].id, JSON.stringify(mockResponse), mockResponse.estimated_delivery]);
    
    await client.query('COMMIT');
    res.json({ ...orderResult.rows[0], supplier_response: mockResponse });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating restock order:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get restock orders
app.get('/api/partners/pharmacy/orders', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT o.*, s.supplier_name, h.name as hospital_name
      FROM partner_ecosystem.auto_restock_orders o
      LEFT JOIN partner_ecosystem.pharmacy_suppliers s ON o.supplier_id = s.id
      LEFT JOIN organization.hospitals h ON o.hospital_id = h.id
      ORDER BY o.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =============================
// TELEMEDICINE INTEGRATION
// =============================

// Get telemedicine providers
app.get('/api/partners/telemedicine/providers', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT id, provider_name as name, platform_type, api_endpoint,
             is_active, supported_specialties as specialties
      FROM partner_ecosystem.telemedicine_providers
      WHERE is_active = true
      ORDER BY provider_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching telemedicine providers:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Create telemedicine session
app.post('/api/partners/telemedicine/sessions', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { provider_id, patient_id, doctor_id, scheduled_time } = req.body;
  
  try {
    await client.connect();
    
    // Create session
    const sessionResult = await client.query(`
      INSERT INTO partner_ecosystem.telemedicine_sessions
      (provider_id, patient_id, staff_id, start_time, session_url, session_status, session_type)
      VALUES ($1, $2, $3, $4, $5, 'Scheduled', 'Video')
      RETURNING *
    `, [provider_id, patient_id, doctor_id || 1, scheduled_time || new Date().toISOString(),
        `https://telemedicine.example.com/session/${Date.now()}`]);
    
    res.json(sessionResult.rows[0]);
  } catch (error) {
    console.error('Error creating telemedicine session:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get telemedicine sessions
app.get('/api/partners/telemedicine/sessions', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT s.*, p.provider_name
      FROM partner_ecosystem.telemedicine_sessions s
      LEFT JOIN partner_ecosystem.telemedicine_providers p ON s.provider_id = p.id
      ORDER BY s.start_time DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =============================
// COMPLIANCE & REPORTING
// =============================

// Get compliance partners
app.get('/api/partners/compliance', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT id, partner_name as name, partner_type, reporting_frequency,
             api_endpoint, report_format, is_mandatory, is_active
      FROM partner_ecosystem.compliance_partners
      WHERE is_active = true
      ORDER BY partner_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching compliance partners:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Submit compliance report
app.post('/api/partners/compliance/submit', async (req, res) => {
  const client = new Client(DB_CONFIG);
  const { partner_id, report_type, report_data, hospital_id } = req.body;
  
  try {
    await client.connect();
    
    // Create submission
    const submissionResult = await client.query(`
      INSERT INTO partner_ecosystem.compliance_submissions
      (partner_id, hospital_id, report_type, data_payload, submission_status, submission_method,
       reporting_period_start, reporting_period_end, submitted_at)
      VALUES ($1, $2, $3, $4, 'Submitted', 'API', 
              DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
              CURRENT_TIMESTAMP)
      RETURNING *
    `, [partner_id, hospital_id || '37f6c11b-5ded-4c17-930d-88b1fec06301', report_type, JSON.stringify(report_data)]);
    
    // Log the submission
    await client.query(`
      INSERT INTO partner_ecosystem.api_integration_logs
      (api_type, endpoint, request_data, response_data, status)
      VALUES ('compliance', '/submit', $1, $2, 'success')
    `, [JSON.stringify(req.body), JSON.stringify(submissionResult.rows[0])]);
    
    res.json(submissionResult.rows[0]);
  } catch (error) {
    console.error('Error submitting compliance report:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get compliance submissions
app.get('/api/partners/compliance/submissions', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT s.*, p.partner_name
      FROM partner_ecosystem.compliance_submissions s
      LEFT JOIN partner_ecosystem.compliance_partners p ON s.partner_id = p.id
      ORDER BY s.submitted_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// =============================
// INTEGRATION DASHBOARD
// =============================

// Get integration stats
app.get('/api/partners/dashboard', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT * FROM partner_ecosystem.integration_dashboard
    `);
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Get API logs
app.get('/api/partners/logs', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT * FROM partner_ecosystem.api_integration_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

const PORT = process.env.PORT || 11000;
app.listen(PORT, () => {
  console.log(`Partner Integration API running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
  console.log(`External: https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so`);
});
