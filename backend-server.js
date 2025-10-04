const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const port = 5000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'GrandPro HMSO Backend API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'GrandPro HMSO Backend API',
    timestamp: new Date().toISOString()
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'GrandPro HMSO API',
    version: '1.0.0',
    modules: [
      'Digital Sourcing & Onboarding',
      'CRM (Owner & Patient)',
      'Hospital Management SaaS',
      'Operations Command Centre',
      'Partner Integrations',
      'Data & Analytics'
    ]
  });
});

// CRM Endpoints
app.get('/api/crm/overview', async (req, res) => {
  try {
    const stats = {
      activeOwners: 1,
      totalPatients: 156,
      todaysAppointments: 18,
      pendingPayouts: 25000,
      appointmentCompletionRate: 88.5,
      communicationOpenRate: 68.5
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Owners endpoints
app.get('/api/crm/owners', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        oa.*,
        h.hospital_name,
        h.location,
        h.contact_email
      FROM crm.owner_accounts oa
      LEFT JOIN onboarding.hospitals h ON oa.hospital_id = h.hospital_id
      ORDER BY oa.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/crm/owners/payouts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        op.*,
        oa.owner_name,
        h.hospital_name
      FROM crm.owner_payouts op
      JOIN crm.owner_accounts oa ON op.owner_id = oa.owner_id
      LEFT JOIN onboarding.hospitals h ON oa.hospital_id = h.hospital_id
      ORDER BY op.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crm/owners/satisfaction', async (req, res) => {
  try {
    const { owner_id, scores, comments } = req.body;
    
    const result = await pool.query(`
      INSERT INTO crm.owner_satisfaction_surveys 
      (owner_id, overall_score, management_quality_score, communication_score, 
       support_score, financial_transparency_score, technology_score, comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      owner_id,
      scores.overall || 0,
      scores.management_quality || 0,
      scores.communication || 0,
      scores.support || 0,
      scores.financial_transparency || 0,
      scores.technology || 0,
      comments
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Patients endpoints
app.get('/api/crm/patients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM crm.patients 
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crm/patients', async (req, res) => {
  try {
    const { 
      first_name, last_name, email, phone, date_of_birth,
      address, medical_history, emergency_contact
    } = req.body;
    
    const patient_id = 'PT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    const result = await pool.query(`
      INSERT INTO crm.patients 
      (patient_id, first_name, last_name, email, phone, date_of_birth,
       address, medical_history, emergency_contact, loyalty_points, loyalty_tier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'Bronze')
      RETURNING *
    `, [
      patient_id, first_name, last_name, email, phone, date_of_birth,
      address, medical_history, emergency_contact
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appointments endpoints
app.get('/api/crm/appointments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.phone as patient_phone
      FROM crm.appointments a
      JOIN crm.patients p ON a.patient_id = p.patient_id
      ORDER BY a.appointment_date DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crm/appointments', async (req, res) => {
  try {
    const { 
      patient_id, appointment_date, appointment_time, doctor_name,
      department, reason, notes
    } = req.body;
    
    const appointment_id = 'APT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    const result = await pool.query(`
      INSERT INTO crm.appointments 
      (appointment_id, patient_id, appointment_date, appointment_time,
       doctor_name, department, reason, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
      RETURNING *
    `, [
      appointment_id, patient_id, appointment_date, appointment_time,
      doctor_name, department, reason, notes
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Feedback endpoint
app.post('/api/crm/feedback', async (req, res) => {
  try {
    const { 
      patient_id, appointment_id, service_quality_rating, 
      staff_friendliness_rating, cleanliness_rating, wait_time_rating,
      overall_rating, comments, would_recommend
    } = req.body;
    
    const feedback_id = require('crypto').randomUUID();
    
    const result = await pool.query(`
      INSERT INTO crm.patient_feedback 
      (feedback_id, patient_id, appointment_id, service_quality_rating,
       staff_friendliness_rating, cleanliness_rating, wait_time_rating,
       overall_rating, comments, would_recommend)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      feedback_id, patient_id, appointment_id, service_quality_rating,
      staff_friendliness_rating, cleanliness_rating, wait_time_rating,
      overall_rating, comments, would_recommend
    ]);
    
    // Award loyalty points for feedback
    const avgRating = (service_quality_rating + staff_friendliness_rating + 
                      cleanliness_rating + wait_time_rating + overall_rating) / 5;
    const points = avgRating >= 4 ? 20 : 10;
    
    await pool.query(`
      UPDATE crm.patients 
      SET loyalty_points = loyalty_points + $1
      WHERE patient_id = $2
    `, [points, patient_id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reminders endpoint
app.post('/api/crm/reminders', async (req, res) => {
  try {
    const { appointment_id, days_before, channel, message_template } = req.body;
    
    const reminder_id = require('crypto').randomUUID();
    
    const result = await pool.query(`
      INSERT INTO crm.appointment_reminders 
      (reminder_id, appointment_id, reminder_date, channel, message_template, status)
      VALUES ($1, $2, CURRENT_DATE + INTERVAL '${days_before} days', $3, $4, 'scheduled')
      RETURNING *
    `, [reminder_id, appointment_id, channel, message_template]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Campaign endpoints
app.get('/api/crm/campaigns', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM communications.campaigns 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crm/campaigns', async (req, res) => {
  try {
    const { 
      campaign_name, campaign_type, target_audience, 
      channels, message_content, scheduled_date
    } = req.body;
    
    const campaign_id = require('crypto').randomUUID();
    
    const result = await pool.query(`
      INSERT INTO communications.campaigns 
      (campaign_id, campaign_name, campaign_type, target_audience,
       channels, message_content, scheduled_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
      RETURNING *
    `, [
      campaign_id, campaign_name, campaign_type, target_audience,
      channels, message_content, scheduled_date
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Onboarding endpoints
app.get('/api/onboarding/hospitals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM onboarding.hospitals 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/onboarding/applications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        h.hospital_name,
        h.location
      FROM onboarding.applications a
      JOIN onboarding.hospitals h ON a.hospital_id = h.hospital_id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hospital Management endpoints
app.get('/api/hms/overview', async (req, res) => {
  try {
    const stats = {
      totalBeds: 300,
      occupancyRate: 75.5,
      todaysAdmissions: 12,
      todaysDischarges: 8,
      activeDoctors: 45,
      activeNurses: 120,
      pendingBills: 42,
      monthlyRevenue: 450000
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Operations Command Centre endpoints
app.get('/api/occ/metrics', async (req, res) => {
  try {
    const metrics = {
      realTimeMetrics: {
        currentOccupancy: 226,
        availableBeds: 74,
        waitingPatients: 8,
        averageWaitTime: 35,
        staffOnDuty: 165
      },
      alerts: [
        { level: 'warning', message: 'Low stock: Paracetamol in Pharmacy A' },
        { level: 'info', message: 'Scheduled maintenance for MRI machine at 2 PM' }
      ]
    };
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Initialize HMS tables and start server
async function initializeAndStart() {
  try {
    // Try to create HMS schema and tables
    console.log('Initializing HMS tables...');
    const createTablesSQL = fs.readFileSync('/root/create-hms-tables.sql', 'utf8');
    
    // Split SQL into individual statements and execute
    const statements = createTablesSQL.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement + ';');
        } catch (err) {
          // Ignore errors if tables already exist
          if (!err.message.includes('already exists')) {
            console.error('Error creating table:', err.message);
          }
        }
      }
    }
    
    console.log('HMS tables initialized');
    
    // Start server
    app.listen(port, '0.0.0.0', () => {
      console.log(`Backend API running on port ${port}`);
      console.log(`Access at: https://backend-morphvm-mkofwuzh.http.cloud.morph.so`);
    });
  } catch (error) {
    console.error('Initialization error:', error);
    // Start server anyway
    app.listen(port, '0.0.0.0', () => {
      console.log(`Backend API running on port ${port} (with initialization errors)`);
    });
  }
}

initializeAndStart();
