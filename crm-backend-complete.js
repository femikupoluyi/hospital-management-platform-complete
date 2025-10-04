const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database connection
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// WebSocket connections for real-time updates
const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('New WebSocket connection for CRM');
    
    ws.on('close', () => {
        wsClients.delete(ws);
    });
});

// Broadcast function
function broadcast(data) {
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Email configuration (example using Gmail)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'notifications@grandprohmso.com',
        pass: 'your-app-password'
    }
});

// SMS configuration (placeholder for Twilio/other service)
const sendSMS = async (phone, message) => {
    // Integrate with Twilio or other SMS service
    console.log(`SMS to ${phone}: ${message}`);
    return { success: true, messageId: 'SMS' + Date.now() };
};

// WhatsApp configuration (placeholder for WhatsApp Business API)
const sendWhatsApp = async (phone, message, mediaUrl = null) => {
    // Integrate with WhatsApp Business API
    console.log(`WhatsApp to ${phone}: ${message}`);
    return { success: true, messageId: 'WA' + Date.now() };
};

// ===================== OWNER CRM ENDPOINTS =====================

// Get all hospital owners
app.get('/api/owners', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, 
                   COUNT(DISTINCT c.id) as contract_count,
                   SUM(p.amount) as total_payouts,
                   AVG(s.satisfaction_score) as avg_satisfaction
            FROM crm.hospital_owners o
            LEFT JOIN crm.owner_contracts c ON o.id = c.owner_id
            LEFT JOIN crm.owner_payouts p ON o.id = p.owner_id
            LEFT JOIN crm.owner_satisfaction s ON o.id = s.owner_id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching owners:', error);
        res.status(500).json({ error: 'Failed to fetch owners' });
    }
});

// Create new hospital owner
app.post('/api/owners', async (req, res) => {
    try {
        const { 
            name, email, phone, hospitalName, 
            hospitalId, address, registrationNumber 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.hospital_owners 
            (owner_name, email, phone, hospital_name, hospital_id, address, registration_number, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `, [name, email, phone, hospitalName, hospitalId, address, registrationNumber]);
        
        broadcast({ type: 'owner_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating owner:', error);
        res.status(500).json({ error: 'Failed to create owner' });
    }
});

// Owner contracts management
app.get('/api/owners/:ownerId/contracts', async (req, res) => {
    try {
        const { ownerId } = req.params;
        
        const result = await pool.query(`
            SELECT * FROM crm.owner_contracts 
            WHERE owner_id = $1
            ORDER BY start_date DESC
        `, [ownerId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({ error: 'Failed to fetch contracts' });
    }
});

// Create/Update contract
app.post('/api/owners/:ownerId/contracts', async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { 
            contractNumber, startDate, endDate, 
            revenueShare, terms, status 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.owner_contracts 
            (owner_id, contract_number, start_date, end_date, revenue_share_percentage, terms, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `, [ownerId, contractNumber, startDate, endDate, revenueShare, terms, status || 'active']);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating contract:', error);
        res.status(500).json({ error: 'Failed to create contract' });
    }
});

// Payout management
app.get('/api/owners/:ownerId/payouts', async (req, res) => {
    try {
        const { ownerId } = req.params;
        
        const result = await pool.query(`
            SELECT * FROM crm.owner_payouts 
            WHERE owner_id = $1
            ORDER BY payout_date DESC
        `, [ownerId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payouts:', error);
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
});

// Process payout
app.post('/api/owners/:ownerId/payouts', async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { 
            amount, payoutDate, period, 
            paymentMethod, referenceNumber 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.owner_payouts 
            (owner_id, amount, payout_date, period, payment_method, reference_number, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
            RETURNING *
        `, [ownerId, amount, payoutDate, period, paymentMethod, referenceNumber]);
        
        // Send notification
        const owner = await pool.query('SELECT * FROM crm.hospital_owners WHERE id = $1', [ownerId]);
        if (owner.rows.length > 0) {
            await sendSMS(owner.rows[0].phone, `Payout of $${amount} has been processed for ${period}.`);
        }
        
        broadcast({ type: 'payout_processed', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error processing payout:', error);
        res.status(500).json({ error: 'Failed to process payout' });
    }
});

// Communication tracking
app.post('/api/owners/:ownerId/communications', async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { 
            type, subject, message, 
            channel, recipient 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.owner_communications 
            (owner_id, communication_type, subject, message, channel, recipient, sent_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `, [ownerId, type, subject, message, channel, recipient]);
        
        // Send actual communication
        if (channel === 'email') {
            await emailTransporter.sendMail({
                to: recipient,
                subject: subject,
                text: message
            });
        } else if (channel === 'sms') {
            await sendSMS(recipient, message);
        } else if (channel === 'whatsapp') {
            await sendWhatsApp(recipient, message);
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error sending communication:', error);
        res.status(500).json({ error: 'Failed to send communication' });
    }
});

// Satisfaction metrics
app.post('/api/owners/:ownerId/satisfaction', async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { 
            satisfactionScore, feedback, 
            category, surveyDate 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.owner_satisfaction 
            (owner_id, satisfaction_score, feedback, category, survey_date, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `, [ownerId, satisfactionScore, feedback, category, surveyDate || new Date()]);
        
        broadcast({ type: 'satisfaction_recorded', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error recording satisfaction:', error);
        res.status(500).json({ error: 'Failed to record satisfaction' });
    }
});

// ===================== PATIENT CRM ENDPOINTS =====================

// Get all patients
app.get('/api/patients', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   COUNT(DISTINCT a.id) as appointment_count,
                   COUNT(DISTINCT f.id) as feedback_count,
                   lp.points as loyalty_points
            FROM crm.patients p
            LEFT JOIN crm.appointments a ON p.id = a.patient_id
            LEFT JOIN crm.patient_feedback f ON p.id = f.patient_id
            LEFT JOIN loyalty.patient_points lp ON p.id = lp.patient_id
            GROUP BY p.id, lp.points
            ORDER BY p.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// Create patient
app.post('/api/patients', async (req, res) => {
    try {
        const { 
            firstName, lastName, email, phone, 
            dateOfBirth, address, bloodGroup 
        } = req.body;
        
        const patientId = 'P' + Date.now();
        
        const result = await pool.query(`
            INSERT INTO crm.patients 
            (patient_id, first_name, last_name, email, phone, date_of_birth, address, blood_group, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
        `, [patientId, firstName, lastName, email, phone, dateOfBirth, address, bloodGroup]);
        
        // Initialize loyalty points
        await pool.query(`
            INSERT INTO loyalty.patient_points 
            (patient_id, points, tier, created_at)
            VALUES ($1, 0, 'bronze', NOW())
        `, [result.rows[0].id]);
        
        broadcast({ type: 'patient_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating patient:', error);
        res.status(500).json({ error: 'Failed to create patient' });
    }
});

// Appointment scheduling
app.get('/api/appointments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, p.first_name, p.last_name, p.phone, p.email
            FROM crm.appointments a
            JOIN crm.patients p ON a.patient_id = p.id
            WHERE a.appointment_date >= CURRENT_DATE
            ORDER BY a.appointment_date, a.appointment_time
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

app.post('/api/appointments', async (req, res) => {
    try {
        const { 
            patientId, doctorName, appointmentDate, 
            appointmentTime, department, reason 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.appointments 
            (patient_id, doctor_name, appointment_date, appointment_time, department, reason, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
            RETURNING *
        `, [patientId, doctorName, appointmentDate, appointmentTime, department, reason]);
        
        // Get patient details for reminder
        const patient = await pool.query('SELECT * FROM crm.patients WHERE id = $1', [patientId]);
        
        if (patient.rows.length > 0) {
            const p = patient.rows[0];
            
            // Schedule reminder (in production, use a job queue)
            const reminderMessage = `Reminder: You have an appointment on ${appointmentDate} at ${appointmentTime} with ${doctorName} in ${department} department.`;
            
            // Send immediate confirmation
            await sendSMS(p.phone, `Appointment confirmed for ${appointmentDate} at ${appointmentTime}`);
            await sendWhatsApp(p.phone, reminderMessage);
            
            // Store reminder for later
            await pool.query(`
                INSERT INTO crm.appointment_reminders 
                (appointment_id, reminder_type, scheduled_time, message, status)
                VALUES ($1, 'sms', $2, $3, 'scheduled')
            `, [result.rows[0].id, new Date(appointmentDate + ' ' + appointmentTime).getTime() - 86400000, reminderMessage]);
        }
        
        broadcast({ type: 'appointment_scheduled', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error scheduling appointment:', error);
        res.status(500).json({ error: 'Failed to schedule appointment' });
    }
});

// Appointment reminders
app.get('/api/appointments/reminders/pending', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, a.*, p.phone, p.email, p.first_name
            FROM crm.appointment_reminders r
            JOIN crm.appointments a ON r.appointment_id = a.id
            JOIN crm.patients p ON a.patient_id = p.id
            WHERE r.status = 'scheduled' 
            AND r.scheduled_time <= NOW() + INTERVAL '24 hours'
        `);
        
        // Process reminders
        for (const reminder of result.rows) {
            if (reminder.reminder_type === 'sms') {
                await sendSMS(reminder.phone, reminder.message);
            } else if (reminder.reminder_type === 'whatsapp') {
                await sendWhatsApp(reminder.phone, reminder.message);
            } else if (reminder.reminder_type === 'email') {
                await emailTransporter.sendMail({
                    to: reminder.email,
                    subject: 'Appointment Reminder',
                    text: reminder.message
                });
            }
            
            // Mark as sent
            await pool.query(
                'UPDATE crm.appointment_reminders SET status = $1, sent_at = NOW() WHERE id = $2',
                ['sent', reminder.id]
            );
        }
        
        res.json({ 
            success: true, 
            reminders_sent: result.rows.length 
        });
    } catch (error) {
        console.error('Error processing reminders:', error);
        res.status(500).json({ error: 'Failed to process reminders' });
    }
});

// Patient feedback
app.post('/api/patient-feedback', async (req, res) => {
    try {
        const { 
            patientId, rating, feedback, 
            category, visitDate 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.patient_feedback 
            (patient_id, rating, feedback, category, visit_date, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `, [patientId, rating, feedback, category, visitDate]);
        
        // Award loyalty points for feedback
        const points = rating >= 4 ? 50 : 25;
        await pool.query(`
            UPDATE loyalty.patient_points 
            SET points = points + $1, updated_at = NOW()
            WHERE patient_id = $2
        `, [points, patientId]);
        
        broadcast({ type: 'feedback_received', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error recording feedback:', error);
        res.status(500).json({ error: 'Failed to record feedback' });
    }
});

// ===================== LOYALTY PROGRAM =====================

// Get loyalty status
app.get('/api/loyalty/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        
        const result = await pool.query(`
            SELECT p.*, 
                   (SELECT COUNT(*) FROM loyalty.redemptions WHERE patient_id = p.patient_id) as redemptions_count,
                   (SELECT SUM(points_redeemed) FROM loyalty.redemptions WHERE patient_id = p.patient_id) as total_redeemed
            FROM loyalty.patient_points p
            WHERE p.patient_id = $1
        `, [patientId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Loyalty account not found' });
        }
        
        const rewards = await pool.query('SELECT * FROM loyalty.rewards WHERE points_required <= $1', 
            [result.rows[0].points]);
        
        res.json({
            loyalty: result.rows[0],
            available_rewards: rewards.rows
        });
    } catch (error) {
        console.error('Error fetching loyalty status:', error);
        res.status(500).json({ error: 'Failed to fetch loyalty status' });
    }
});

// Award points
app.post('/api/loyalty/:patientId/award', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { points, reason, activityType } = req.body;
        
        await pool.query(`
            UPDATE loyalty.patient_points 
            SET points = points + $1, updated_at = NOW()
            WHERE patient_id = $2
        `, [points, patientId]);
        
        // Update tier if necessary
        const result = await pool.query(
            'SELECT points FROM loyalty.patient_points WHERE patient_id = $1',
            [patientId]
        );
        
        const totalPoints = result.rows[0].points;
        let tier = 'bronze';
        if (totalPoints >= 5000) tier = 'platinum';
        else if (totalPoints >= 2000) tier = 'gold';
        else if (totalPoints >= 500) tier = 'silver';
        
        await pool.query(
            'UPDATE loyalty.patient_points SET tier = $1 WHERE patient_id = $2',
            [tier, patientId]
        );
        
        res.json({ 
            success: true, 
            points_awarded: points,
            total_points: totalPoints,
            tier: tier
        });
    } catch (error) {
        console.error('Error awarding points:', error);
        res.status(500).json({ error: 'Failed to award points' });
    }
});

// Redeem reward
app.post('/api/loyalty/:patientId/redeem', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { rewardId } = req.body;
        
        // Get reward details
        const reward = await pool.query('SELECT * FROM loyalty.rewards WHERE id = $1', [rewardId]);
        if (reward.rows.length === 0) {
            return res.status(404).json({ error: 'Reward not found' });
        }
        
        // Check points
        const points = await pool.query(
            'SELECT points FROM loyalty.patient_points WHERE patient_id = $1',
            [patientId]
        );
        
        if (points.rows[0].points < reward.rows[0].points_required) {
            return res.status(400).json({ error: 'Insufficient points' });
        }
        
        // Process redemption
        const redemptionCode = 'RED' + Date.now();
        
        await pool.query(`
            INSERT INTO loyalty.redemptions 
            (patient_id, reward_id, points_redeemed, redemption_code, status, created_at)
            VALUES ($1, $2, $3, $4, 'completed', NOW())
        `, [patientId, rewardId, reward.rows[0].points_required, redemptionCode]);
        
        // Deduct points
        await pool.query(`
            UPDATE loyalty.patient_points 
            SET points = points - $1 
            WHERE patient_id = $2
        `, [reward.rows[0].points_required, patientId]);
        
        res.json({
            success: true,
            redemption_code: redemptionCode,
            reward: reward.rows[0]
        });
    } catch (error) {
        console.error('Error redeeming reward:', error);
        res.status(500).json({ error: 'Failed to redeem reward' });
    }
});

// ===================== CAMPAIGN MANAGEMENT =====================

// Create campaign
app.post('/api/campaigns', async (req, res) => {
    try {
        const { 
            name, type, message, 
            targetAudience, channels, scheduledTime 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO communications.campaigns 
            (campaign_name, campaign_type, message, target_audience, channels, scheduled_time, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
            RETURNING *
        `, [name, type, message, targetAudience, JSON.stringify(channels), scheduledTime]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// Send campaign
app.post('/api/campaigns/:campaignId/send', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        // Get campaign details
        const campaign = await pool.query(
            'SELECT * FROM communications.campaigns WHERE id = $1',
            [campaignId]
        );
        
        if (campaign.rows.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        const c = campaign.rows[0];
        const channels = JSON.parse(c.channels);
        
        // Get target recipients
        let recipients = [];
        if (c.target_audience === 'all_patients') {
            const patients = await pool.query('SELECT * FROM crm.patients');
            recipients = patients.rows;
        } else if (c.target_audience === 'all_owners') {
            const owners = await pool.query('SELECT * FROM crm.hospital_owners');
            recipients = owners.rows;
        }
        
        let messagesSent = 0;
        
        // Send messages
        for (const recipient of recipients) {
            if (channels.includes('sms') && recipient.phone) {
                await sendSMS(recipient.phone, c.message);
                messagesSent++;
            }
            if (channels.includes('whatsapp') && recipient.phone) {
                await sendWhatsApp(recipient.phone, c.message);
                messagesSent++;
            }
            if (channels.includes('email') && recipient.email) {
                await emailTransporter.sendMail({
                    to: recipient.email,
                    subject: c.campaign_name,
                    text: c.message
                });
                messagesSent++;
            }
            
            // Track recipient
            await pool.query(`
                INSERT INTO communications.campaign_recipients 
                (campaign_id, recipient_id, recipient_type, channels_used, sent_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [campaignId, recipient.id, c.target_audience, JSON.stringify(channels)]);
        }
        
        // Update campaign status
        await pool.query(
            'UPDATE communications.campaigns SET status = $1, sent_at = NOW() WHERE id = $2',
            ['sent', campaignId]
        );
        
        res.json({
            success: true,
            campaign_id: campaignId,
            recipients_count: recipients.length,
            messages_sent: messagesSent
        });
    } catch (error) {
        console.error('Error sending campaign:', error);
        res.status(500).json({ error: 'Failed to send campaign' });
    }
});

// Health promotion campaigns
app.get('/api/campaigns/health-promotions', async (req, res) => {
    try {
        const campaigns = [
            {
                id: 1,
                name: 'Diabetes Awareness Week',
                message: 'Free blood sugar testing this week! Visit our hospital for a complimentary diabetes screening.',
                channels: ['sms', 'whatsapp', 'email']
            },
            {
                id: 2,
                name: 'Vaccination Reminder',
                message: 'It\'s time for your annual flu vaccination. Book your appointment today and stay protected.',
                channels: ['sms', 'whatsapp']
            },
            {
                id: 3,
                name: 'Wellness Check-up',
                message: 'Regular health check-ups save lives. Schedule your annual wellness exam today and get 20% off.',
                channels: ['email', 'whatsapp']
            },
            {
                id: 4,
                name: 'Mental Health Support',
                message: 'Your mental health matters. Join our free stress management workshop this Saturday.',
                channels: ['sms', 'email']
            }
        ];
        
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch health promotions' });
    }
});

// ===================== DASHBOARD & ANALYTICS =====================

app.get('/api/crm/dashboard', async (req, res) => {
    try {
        const [owners, patients, appointments, campaigns, satisfaction, loyalty] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM crm.hospital_owners'),
            pool.query('SELECT COUNT(*) as count FROM crm.patients'),
            pool.query('SELECT COUNT(*) as count FROM crm.appointments WHERE appointment_date >= CURRENT_DATE'),
            pool.query('SELECT COUNT(*) as count FROM communications.campaigns WHERE status = \'sent\''),
            pool.query('SELECT AVG(satisfaction_score) as avg FROM crm.owner_satisfaction'),
            pool.query('SELECT SUM(points) as total FROM loyalty.patient_points')
        ]);
        
        res.json({
            owners: owners.rows[0].count,
            patients: patients.rows[0].count,
            upcoming_appointments: appointments.rows[0].count,
            campaigns_sent: campaigns.rows[0].count,
            avg_satisfaction: satisfaction.rows[0].avg || 0,
            total_loyalty_points: loyalty.rows[0].total || 0
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'CRM & Relationship Management System',
        version: '2.0.0',
        status: 'operational',
        modules: {
            owner_crm: {
                contracts: '/api/owners/:ownerId/contracts',
                payouts: '/api/owners/:ownerId/payouts',
                communications: '/api/owners/:ownerId/communications',
                satisfaction: '/api/owners/:ownerId/satisfaction'
            },
            patient_crm: {
                appointments: '/api/appointments',
                feedback: '/api/patient-feedback',
                loyalty: '/api/loyalty/:patientId',
                reminders: '/api/appointments/reminders/pending'
            },
            campaigns: {
                create: '/api/campaigns',
                send: '/api/campaigns/:campaignId/send',
                health_promotions: '/api/campaigns/health-promotions'
            }
        },
        integrations: ['WhatsApp', 'SMS', 'Email']
    });
});

// Start server
const PORT = process.env.PORT || 7002;
server.listen(PORT, () => {
    console.log(`CRM Backend running on port ${PORT}`);
    console.log('Features enabled:');
    console.log('- Owner CRM: Contracts, Payouts, Communications, Satisfaction');
    console.log('- Patient CRM: Appointments, Reminders, Feedback, Loyalty');
    console.log('- Campaign Management: WhatsApp, SMS, Email');
    console.log('- Real-time updates via WebSocket');
});

module.exports = { app, server };
