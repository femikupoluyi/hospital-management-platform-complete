#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database connection
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// ===============================
// OWNER CRM ENDPOINTS
// ===============================

// Get all owner accounts with contracts
app.get('/api/owners', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        oa.*,
        COUNT(DISTINCT h.id) as hospital_count,
        COALESCE(oa.total_payouts, 0) as total_payouts,
        COALESCE(oa.satisfaction_score, 0) as avg_satisfaction
      FROM crm.owner_accounts oa
      LEFT JOIN organization.hospitals h ON h.owner_id = oa.owner_id
      GROUP BY oa.id
      ORDER BY oa.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get owner payouts
app.get('/api/owners/:ownerId/payouts', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT * FROM crm.owner_payouts 
      WHERE owner_id = $1 
      ORDER BY payout_date DESC
    `, [req.params.ownerId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Create owner payout
app.post('/api/owners/:ownerId/payouts', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { amount, period_start, period_end, payment_method, reference_number } = req.body;
    
    const result = await client.query(`
      INSERT INTO crm.owner_payouts 
      (id, owner_id, amount, period_start, period_end, payment_method, 
       reference_number, status, payout_date, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'processed', NOW(), NOW())
      RETURNING *
    `, [req.params.ownerId, amount, period_start, period_end, 
        payment_method || 'bank_transfer', reference_number]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Send communication to owner
app.post('/api/owners/:ownerId/communications', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { subject, message, channel, priority } = req.body;
    
    const result = await client.query(`
      INSERT INTO crm.owner_communications 
      (id, owner_id, communication_type, channel, subject, message, 
       priority, status, sent_at, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'sent', NOW(), NOW())
      RETURNING *
    `, [req.params.ownerId, 'notification', channel || 'email', 
        subject, message, priority || 'normal']);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get owner satisfaction metrics
app.get('/api/owners/:ownerId/satisfaction', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        AVG(satisfaction_score) as avg_score,
        COUNT(*) as survey_count,
        MAX(survey_date) as last_survey
      FROM crm.owner_satisfaction_surveys
      WHERE owner_id = $1
    `, [req.params.ownerId]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// ===============================
// PATIENT CRM ENDPOINTS
// ===============================

// Get all patients
app.get('/api/patients', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT a.id) as appointment_count,
        MAX(a.appointment_date) as last_appointment,
        COALESCE(SUM(pp.points), 0) as loyalty_points
      FROM crm.patients p
      LEFT JOIN crm.appointments a ON a.patient_id = p.id
      LEFT JOIN loyalty.patient_points pp ON pp.patient_id = p.id AND pp.transaction_type IN ('bonus', 'earned')
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Create new patient
app.post('/api/patients', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { 
      first_name, last_name, email, phone, date_of_birth,
      gender, address, city, state, emergency_contact
    } = req.body;
    
    const patientId = crypto.randomUUID();
    const patientNumber = 'PAT-' + Date.now().toString(36).toUpperCase();
    
    const result = await client.query(`
      INSERT INTO crm.patients 
      (id, patient_number, first_name, last_name, email, phone, 
       date_of_birth, gender, address, city, state, country, 
       emergency_contact_name, emergency_contact_phone, created_at)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Ghana', 
       $12, $13, NOW())
      RETURNING *
    `, [patientId, patientNumber, first_name, last_name, email, phone,
        date_of_birth, gender, address, city, state,
        emergency_contact?.name || 'Emergency Contact',
        emergency_contact?.phone || phone]);
    
    // Initialize loyalty points - get first program or create one
    const programResult = await client.query(`
      SELECT id FROM loyalty.programs LIMIT 1
    `);
    
    let programId;
    if (programResult.rows.length > 0) {
      programId = programResult.rows[0].id;
    } else {
      // Create a default program if none exists
      const newProgram = await client.query(`
        INSERT INTO loyalty.programs (id, name, description, points_per_visit, is_active)
        VALUES (gen_random_uuid(), 'Default Program', 'Hospital loyalty program', 10, true)
        RETURNING id
      `);
      programId = newProgram.rows[0].id;
    }
    
    await client.query(`
      INSERT INTO loyalty.patient_points 
      (id, patient_id, program_id, transaction_type, points, balance_before, balance_after, description, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, 'bonus', 100, 0, 100, 'Welcome bonus', NOW())
    `, [patientId, programId]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get patient appointments
app.get('/api/patients/:patientId/appointments', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        a.*,
        h.name as hospital_name,
        s.name as doctor_name
      FROM crm.appointments a
      LEFT JOIN organization.hospitals h ON h.id = a.hospital_id
      LEFT JOIN hr.staff s ON s.id = a.doctor_id
      WHERE a.patient_id = $1
      ORDER BY a.appointment_date DESC
    `, [req.params.patientId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Schedule appointment
app.post('/api/appointments', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { 
      patient_id, hospital_id, doctor_name, department,
      appointment_date, appointment_time, appointment_type, 
      reason_for_visit, notes 
    } = req.body;
    
    const appointmentId = crypto.randomUUID();
    const appointmentNumber = 'APT-' + Date.now().toString(36).toUpperCase();
    
    // Create appointment
    const result = await client.query(`
      INSERT INTO crm.appointments 
      (id, patient_id, hospital_id, appointment_number, doctor_name, department,
       appointment_date, appointment_time, appointment_type, reason_for_visit,
       status, notes, created_at)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled', $11, NOW())
      RETURNING *
    `, [appointmentId, patient_id, hospital_id || crypto.randomUUID(), 
        appointmentNumber, doctor_name || 'Dr. General',
        department || 'General Medicine', appointment_date, 
        appointment_time, appointment_type || 'consultation',
        reason_for_visit, notes]);
    
    // Create reminder
    const scheduledTime = new Date(appointment_date + ' ' + appointment_time);
    scheduledTime.setDate(scheduledTime.getDate() - 1); // 24 hours before
    
    await client.query(`
      INSERT INTO crm.appointment_reminders 
      (id, appointment_id, reminder_type, reminder_channel, 
       scheduled_time, status, message_content, created_at)
      VALUES 
      (gen_random_uuid(), $1, '24_hour', 'sms', 
       $2, 'pending', 'Reminder: Your appointment is tomorrow', NOW())
    `, [appointmentId, scheduledTime.toISOString()]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get all appointments
app.get('/api/appointments', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT a.*, p.first_name, p.last_name, p.patient_number
      FROM crm.appointments a
      JOIN crm.patients p ON p.id = a.patient_id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get appointment reminders
app.get('/api/appointments/:appointmentId/reminders', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT * FROM crm.appointment_reminders 
      WHERE appointment_id = $1
      ORDER BY reminder_date, reminder_time
    `, [req.params.appointmentId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Submit patient feedback
app.post('/api/patients/:patientId/feedback', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { 
      appointment_id, rating, feedback_text, categories 
    } = req.body;
    
    const result = await client.query(`
      INSERT INTO crm.patient_feedback 
      (id, patient_id, appointment_id, rating, feedback_text, 
       feedback_categories, status, submitted_at, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, 
       'received', NOW(), NOW())
      RETURNING *
    `, [req.params.patientId, appointment_id, rating, 
        feedback_text, JSON.stringify(categories || [])]);
    
    // Award loyalty points for feedback
    await client.query(`
      UPDATE loyalty.patient_points 
      SET 
        points_balance = points_balance + 50,
        lifetime_points = lifetime_points + 50,
        updated_at = NOW()
      WHERE patient_id = $1
    `, [req.params.patientId]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// ===============================
// LOYALTY PROGRAM ENDPOINTS
// ===============================

// Get patient loyalty status
app.get('/api/patients/:patientId/loyalty', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        pp.*,
        lp.program_name,
        lp.description,
        (SELECT COUNT(*) FROM loyalty.redemptions WHERE patient_id = pp.patient_id) as total_redemptions
      FROM loyalty.patient_points pp
      LEFT JOIN loyalty.programs lp ON lp.id = pp.program_id
      WHERE pp.patient_id = $1
    `, [req.params.patientId]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get available rewards
app.get('/api/loyalty/rewards', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT * FROM loyalty.rewards 
      WHERE status = 'active'
      ORDER BY points_required ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Redeem loyalty points
app.post('/api/loyalty/redeem', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { patient_id, reward_id, points_used } = req.body;
    
    // Check balance
    const balanceCheck = await client.query(`
      SELECT points_balance FROM loyalty.patient_points 
      WHERE patient_id = $1
    `, [patient_id]);
    
    if (balanceCheck.rows[0]?.points_balance < points_used) {
      return res.status(400).json({ success: false, error: 'Insufficient points' });
    }
    
    // Create redemption
    const redemptionId = crypto.randomUUID();
    const redemptionCode = 'REDEEM-' + Date.now().toString(36).toUpperCase();
    
    const result = await client.query(`
      INSERT INTO loyalty.redemptions 
      (id, patient_id, reward_id, points_used, redemption_code, 
       status, redeemed_at, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, $3, $4, 'completed', NOW(), NOW())
      RETURNING *
    `, [patient_id, reward_id, points_used, redemptionCode]);
    
    // Deduct points
    await client.query(`
      UPDATE loyalty.patient_points 
      SET 
        points_balance = points_balance - $1,
        updated_at = NOW()
      WHERE patient_id = $2
    `, [points_used, patient_id]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// ===============================
// COMMUNICATION CAMPAIGN ENDPOINTS
// ===============================

// Create campaign
app.post('/api/campaigns', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { 
      campaign_name, campaign_type, channel, target_audience,
      subject, content, scheduled_date 
    } = req.body;
    
    const campaignId = crypto.randomUUID();
    
    const result = await client.query(`
      INSERT INTO communications.campaigns 
      (id, campaign_name, campaign_type, channel, target_audience, 
       subject, content, status, scheduled_date, created_at)
      VALUES 
      ($1, $2, $3, $4, $5::jsonb, $6, $7, 'scheduled', $8, NOW())
      RETURNING *
    `, [campaignId, campaign_name, campaign_type || 'health_promotion',
        channel, JSON.stringify(target_audience || {}),
        subject, content, scheduled_date || NOW()]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get campaigns
app.get('/api/campaigns', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT 
        c.*,
        COUNT(cr.id) as recipient_count,
        COUNT(cr.id) FILTER (WHERE cr.status = 'delivered') as delivered_count
      FROM communications.campaigns c
      LEFT JOIN communications.campaign_recipients cr ON cr.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Send WhatsApp message
app.post('/api/communications/whatsapp', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { recipient_id, recipient_type, message, template_id } = req.body;
    
    const result = await client.query(`
      INSERT INTO communications.message_queue 
      (id, channel, recipient_id, recipient_type, message_content, 
       template_id, priority, status, created_at)
      VALUES 
      (gen_random_uuid(), 'whatsapp', $1, $2, $3, $4, 
       'normal', 'queued', NOW())
      RETURNING *
    `, [recipient_id, recipient_type || 'patient', message, template_id]);
    
    // Simulate sending (in production, integrate with WhatsApp Business API)
    setTimeout(async () => {
      const updateClient = new Client(DB_CONFIG);
      await updateClient.connect();
      await updateClient.query(`
        UPDATE communications.message_queue 
        SET status = 'sent', sent_at = NOW() 
        WHERE id = $1
      `, [result.rows[0].id]);
      await updateClient.end();
    }, 2000);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Send SMS
app.post('/api/communications/sms', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { recipient_id, recipient_type, message } = req.body;
    
    const result = await client.query(`
      INSERT INTO communications.message_queue 
      (id, channel, recipient_id, recipient_type, message_content, 
       priority, status, created_at)
      VALUES 
      (gen_random_uuid(), 'sms', $1, $2, $3, 'high', 'queued', NOW())
      RETURNING *
    `, [recipient_id, recipient_type || 'patient', message]);
    
    // Simulate sending (in production, integrate with SMS gateway)
    setTimeout(async () => {
      const updateClient = new Client(DB_CONFIG);
      await updateClient.connect();
      await updateClient.query(`
        UPDATE communications.message_queue 
        SET status = 'sent', sent_at = NOW() 
        WHERE id = $1
      `, [result.rows[0].id]);
      await updateClient.end();
    }, 1000);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Send Email
app.post('/api/communications/email', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { recipient_id, recipient_type, subject, message } = req.body;
    
    const result = await client.query(`
      INSERT INTO communications.message_queue 
      (id, channel, recipient_id, recipient_type, subject, 
       message_content, priority, status, created_at)
      VALUES 
      (gen_random_uuid(), 'email', $1, $2, $3, $4, 'normal', 'queued', NOW())
      RETURNING *
    `, [recipient_id, recipient_type || 'patient', subject, message]);
    
    // Simulate sending (in production, integrate with email service)
    setTimeout(async () => {
      const updateClient = new Client(DB_CONFIG);
      await updateClient.connect();
      await updateClient.query(`
        UPDATE communications.message_queue 
        SET status = 'sent', sent_at = NOW() 
        WHERE id = $1
      `, [result.rows[0].id]);
      await updateClient.end();
    }, 1500);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// ===============================
// DASHBOARD & ANALYTICS
// ===============================

// Get CRM dashboard metrics
app.get('/api/crm/metrics', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const metrics = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM crm.patients WHERE status = 'active') as total_patients,
        (SELECT COUNT(*) FROM crm.owner_accounts WHERE account_status = 'active') as total_owners,
        (SELECT COUNT(*) FROM crm.appointments WHERE appointment_date >= CURRENT_DATE) as upcoming_appointments,
        (SELECT AVG(rating) FROM crm.patient_feedback WHERE submitted_at >= CURRENT_DATE - INTERVAL '30 days') as avg_satisfaction,
        (SELECT SUM(amount) FROM crm.owner_payouts WHERE payout_date >= CURRENT_DATE - INTERVAL '30 days') as monthly_payouts,
        (SELECT COUNT(*) FROM communications.campaigns WHERE status = 'active') as active_campaigns
    `);
    
    res.json({ success: true, data: metrics.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'CRM Backend Server',
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`✅ CRM Backend Server running on port ${PORT}`);
  console.log(`   Access at: http://localhost:${PORT}`);
});

module.exports = app;
