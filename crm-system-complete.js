const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const axios = require('axios');

// Database configuration
const DATABASE_URL = 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const app = express();
const PORT = 7000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'crm-secret-key-2024';

// Email configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'noreply@grandpro.com',
        pass: process.env.EMAIL_PASS || 'demo-password'
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS crm`);
        
        // ===================== OWNER CRM TABLES =====================
        
        // Hospital Owners table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.hospital_owners (
                id SERIAL PRIMARY KEY,
                owner_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                hospital_name VARCHAR(255),
                hospital_id VARCHAR(50),
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'active',
                satisfaction_score DECIMAL(3,2),
                last_contact_date TIMESTAMP,
                preferred_contact_method VARCHAR(50) DEFAULT 'email',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Contracts Management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.owner_contracts (
                id SERIAL PRIMARY KEY,
                contract_id VARCHAR(50) UNIQUE NOT NULL,
                owner_id INTEGER REFERENCES crm.hospital_owners(id),
                contract_type VARCHAR(100),
                start_date DATE NOT NULL,
                end_date DATE,
                status VARCHAR(50) DEFAULT 'active',
                terms JSONB,
                revenue_share_percentage DECIMAL(5,2),
                monthly_fee DECIMAL(12,2),
                performance_metrics JSONB,
                renewal_status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Payouts Management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.owner_payouts (
                id SERIAL PRIMARY KEY,
                payout_id VARCHAR(50) UNIQUE NOT NULL,
                owner_id INTEGER REFERENCES crm.hospital_owners(id),
                contract_id INTEGER REFERENCES crm.owner_contracts(id),
                amount DECIMAL(12,2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'NGN',
                payout_date DATE NOT NULL,
                payment_method VARCHAR(50),
                bank_details JSONB,
                status VARCHAR(50) DEFAULT 'pending',
                transaction_reference VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Owner Communications
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.owner_communications (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER REFERENCES crm.hospital_owners(id),
                communication_type VARCHAR(50),
                channel VARCHAR(50),
                subject VARCHAR(255),
                message TEXT,
                status VARCHAR(50) DEFAULT 'sent',
                response TEXT,
                sentiment_score DECIMAL(3,2),
                tags TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Owner Satisfaction Metrics
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.owner_satisfaction (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER REFERENCES crm.hospital_owners(id),
                survey_id VARCHAR(50),
                overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 10),
                service_quality INTEGER,
                support_quality INTEGER,
                platform_usability INTEGER,
                value_for_money INTEGER,
                likelihood_to_renew INTEGER,
                feedback TEXT,
                improvement_suggestions TEXT,
                survey_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ===================== PATIENT CRM TABLES =====================
        
        // Patients table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.patients (
                id SERIAL PRIMARY KEY,
                patient_id VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                whatsapp_number VARCHAR(50),
                date_of_birth DATE,
                gender VARCHAR(20),
                address TEXT,
                medical_record_number VARCHAR(100),
                insurance_provider VARCHAR(100),
                insurance_number VARCHAR(100),
                emergency_contact JSONB,
                preferred_contact_method VARCHAR(50) DEFAULT 'email',
                communication_preferences JSONB,
                loyalty_points INTEGER DEFAULT 0,
                loyalty_tier VARCHAR(50) DEFAULT 'bronze',
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_visit_date TIMESTAMP,
                total_visits INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Appointments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.appointments (
                id SERIAL PRIMARY KEY,
                appointment_id VARCHAR(50) UNIQUE NOT NULL,
                patient_id INTEGER REFERENCES crm.patients(id),
                doctor_name VARCHAR(255),
                department VARCHAR(100),
                appointment_date TIMESTAMP NOT NULL,
                appointment_type VARCHAR(100),
                status VARCHAR(50) DEFAULT 'scheduled',
                duration_minutes INTEGER DEFAULT 30,
                reason TEXT,
                notes TEXT,
                reminder_sent BOOLEAN DEFAULT false,
                reminder_sent_at TIMESTAMP,
                check_in_time TIMESTAMP,
                check_out_time TIMESTAMP,
                no_show BOOLEAN DEFAULT false,
                rescheduled_from INTEGER REFERENCES crm.appointments(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Appointment Reminders
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.appointment_reminders (
                id SERIAL PRIMARY KEY,
                appointment_id INTEGER REFERENCES crm.appointments(id),
                reminder_type VARCHAR(50),
                scheduled_time TIMESTAMP NOT NULL,
                channel VARCHAR(50),
                message TEXT,
                sent BOOLEAN DEFAULT false,
                sent_at TIMESTAMP,
                delivery_status VARCHAR(50),
                response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Patient Feedback
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.patient_feedback (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES crm.patients(id),
                appointment_id INTEGER REFERENCES crm.appointments(id),
                feedback_type VARCHAR(50),
                overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
                doctor_rating INTEGER,
                facility_rating INTEGER,
                wait_time_rating INTEGER,
                staff_rating INTEGER,
                cleanliness_rating INTEGER,
                comments TEXT,
                improvement_suggestions TEXT,
                would_recommend BOOLEAN,
                feedback_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                follow_up_required BOOLEAN DEFAULT false,
                follow_up_notes TEXT
            )
        `);

        // Loyalty Program
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.loyalty_transactions (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES crm.patients(id),
                transaction_type VARCHAR(50),
                points INTEGER NOT NULL,
                description TEXT,
                reference_id VARCHAR(100),
                expiry_date DATE,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Loyalty Rewards
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.loyalty_rewards (
                id SERIAL PRIMARY KEY,
                reward_code VARCHAR(50) UNIQUE NOT NULL,
                reward_name VARCHAR(255) NOT NULL,
                description TEXT,
                points_required INTEGER NOT NULL,
                category VARCHAR(100),
                valid_from DATE,
                valid_until DATE,
                max_redemptions INTEGER,
                current_redemptions INTEGER DEFAULT 0,
                terms_conditions TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Reward Redemptions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.reward_redemptions (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES crm.patients(id),
                reward_id INTEGER REFERENCES crm.loyalty_rewards(id),
                redemption_code VARCHAR(50) UNIQUE NOT NULL,
                points_used INTEGER NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                redeemed_at TIMESTAMP,
                expires_at TIMESTAMP,
                used_at TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Communication Campaigns
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.communication_campaigns (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(50) UNIQUE NOT NULL,
                campaign_name VARCHAR(255) NOT NULL,
                campaign_type VARCHAR(100),
                target_audience VARCHAR(100),
                channels TEXT[],
                message_template TEXT,
                personalization_fields JSONB,
                scheduled_date TIMESTAMP,
                status VARCHAR(50) DEFAULT 'draft',
                sent_count INTEGER DEFAULT 0,
                opened_count INTEGER DEFAULT 0,
                clicked_count INTEGER DEFAULT 0,
                conversion_count INTEGER DEFAULT 0,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                executed_at TIMESTAMP
            )
        `);

        // Campaign Recipients
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.campaign_recipients (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES crm.communication_campaigns(id),
                patient_id INTEGER REFERENCES crm.patients(id),
                owner_id INTEGER REFERENCES crm.hospital_owners(id),
                channel VARCHAR(50),
                contact_info VARCHAR(255),
                message_sent BOOLEAN DEFAULT false,
                sent_at TIMESTAMP,
                delivered BOOLEAN DEFAULT false,
                opened BOOLEAN DEFAULT false,
                clicked BOOLEAN DEFAULT false,
                unsubscribed BOOLEAN DEFAULT false,
                bounce_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // WhatsApp/SMS Integration
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.messaging_queue (
                id SERIAL PRIMARY KEY,
                message_id VARCHAR(50) UNIQUE NOT NULL,
                recipient_type VARCHAR(50),
                recipient_id INTEGER,
                recipient_number VARCHAR(50) NOT NULL,
                channel VARCHAR(20) NOT NULL,
                message_type VARCHAR(50),
                message_content TEXT NOT NULL,
                media_url TEXT,
                template_id VARCHAR(100),
                priority INTEGER DEFAULT 5,
                scheduled_time TIMESTAMP,
                status VARCHAR(50) DEFAULT 'queued',
                attempts INTEGER DEFAULT 0,
                sent_at TIMESTAMP,
                delivered_at TIMESTAMP,
                read_at TIMESTAMP,
                failed_reason TEXT,
                provider_message_id VARCHAR(100),
                cost DECIMAL(10,4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Health Promotion Content
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.health_content (
                id SERIAL PRIMARY KEY,
                content_id VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                content_type VARCHAR(50),
                category VARCHAR(100),
                content_body TEXT NOT NULL,
                media_urls TEXT[],
                target_demographics JSONB,
                languages TEXT[],
                tags TEXT[],
                author VARCHAR(255),
                approved_by VARCHAR(255),
                approved_at TIMESTAMP,
                published BOOLEAN DEFAULT false,
                published_at TIMESTAMP,
                views INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Follow-up Schedules
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm.follow_ups (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES crm.patients(id),
                appointment_id INTEGER REFERENCES crm.appointments(id),
                follow_up_type VARCHAR(100),
                scheduled_date DATE NOT NULL,
                reason TEXT,
                priority VARCHAR(20) DEFAULT 'normal',
                assigned_to VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                completed_at TIMESTAMP,
                outcome TEXT,
                next_action TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('CRM database tables initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize database on startup
initializeDatabase();

// ===================== AUTHENTICATION =====================

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// ===================== OWNER CRM ENDPOINTS =====================

// Create/Register Hospital Owner
app.post('/api/owners/register', async (req, res) => {
    try {
        const {
            name, email, phone, hospital_name,
            hospital_id, preferred_contact_method
        } = req.body;
        
        const ownerId = 'OWN-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(`
            INSERT INTO crm.hospital_owners 
            (owner_id, name, email, phone, hospital_name, hospital_id, preferred_contact_method)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [ownerId, name, email, phone, hospital_name, hospital_id, preferred_contact_method]);
        
        res.json({
            success: true,
            owner: result.rows[0]
        });
    } catch (error) {
        console.error('Owner registration error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get all hospital owners
app.get('/api/owners', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, 
                   COUNT(DISTINCT c.id) as contract_count,
                   COUNT(DISTINCT p.id) as payout_count,
                   AVG(s.overall_score) as avg_satisfaction
            FROM crm.hospital_owners o
            LEFT JOIN crm.owner_contracts c ON o.id = c.owner_id
            LEFT JOIN crm.owner_payouts p ON o.id = p.owner_id
            LEFT JOIN crm.owner_satisfaction s ON o.id = s.owner_id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `);
        
        res.json({
            success: true,
            owners: result.rows
        });
    } catch (error) {
        console.error('Get owners error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create owner contract
app.post('/api/owners/:ownerId/contracts', authenticateToken, async (req, res) => {
    try {
        const {
            contract_type, start_date, end_date,
            revenue_share_percentage, monthly_fee, terms
        } = req.body;
        
        const contractId = 'CON-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(`
            INSERT INTO crm.owner_contracts
            (contract_id, owner_id, contract_type, start_date, end_date, 
             revenue_share_percentage, monthly_fee, terms)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [contractId, req.params.ownerId, contract_type, start_date, end_date,
            revenue_share_percentage, monthly_fee, terms]);
        
        res.json({
            success: true,
            contract: result.rows[0]
        });
    } catch (error) {
        console.error('Create contract error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Process owner payout
app.post('/api/owners/:ownerId/payouts', authenticateToken, async (req, res) => {
    try {
        const {
            contract_id, amount, payout_date,
            payment_method, bank_details, notes
        } = req.body;
        
        const payoutId = 'PAY-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(`
            INSERT INTO crm.owner_payouts
            (payout_id, owner_id, contract_id, amount, payout_date,
             payment_method, bank_details, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processed')
            RETURNING *
        `, [payoutId, req.params.ownerId, contract_id, amount, payout_date,
            payment_method, bank_details, notes]);
        
        // Send payout notification
        await sendOwnerNotification(req.params.ownerId, 
            'Payout Processed',
            `Your payout of ${amount} has been processed and will be credited to your account.`
        );
        
        res.json({
            success: true,
            payout: result.rows[0]
        });
    } catch (error) {
        console.error('Process payout error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get owner satisfaction metrics
app.get('/api/owners/:ownerId/satisfaction', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM crm.owner_satisfaction
            WHERE owner_id = $1
            ORDER BY survey_date DESC
        `, [req.params.ownerId]);
        
        const avgScore = await pool.query(`
            SELECT 
                AVG(overall_score) as avg_overall,
                AVG(service_quality) as avg_service,
                AVG(support_quality) as avg_support,
                AVG(platform_usability) as avg_usability,
                AVG(value_for_money) as avg_value
            FROM crm.owner_satisfaction
            WHERE owner_id = $1
        `, [req.params.ownerId]);
        
        res.json({
            success: true,
            surveys: result.rows,
            averages: avgScore.rows[0]
        });
    } catch (error) {
        console.error('Get satisfaction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit owner satisfaction survey
app.post('/api/owners/:ownerId/satisfaction', async (req, res) => {
    try {
        const surveyId = 'SUR-' + uuidv4().substring(0, 8).toUpperCase();
        const surveyData = { ...req.body, survey_id: surveyId };
        
        const result = await pool.query(`
            INSERT INTO crm.owner_satisfaction
            (owner_id, survey_id, overall_score, service_quality, support_quality,
             platform_usability, value_for_money, likelihood_to_renew, feedback,
             improvement_suggestions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [req.params.ownerId, surveyId, surveyData.overall_score,
            surveyData.service_quality, surveyData.support_quality,
            surveyData.platform_usability, surveyData.value_for_money,
            surveyData.likelihood_to_renew, surveyData.feedback,
            surveyData.improvement_suggestions]);
        
        // Update owner's satisfaction score
        await pool.query(`
            UPDATE crm.hospital_owners
            SET satisfaction_score = $1
            WHERE id = $2
        `, [surveyData.overall_score / 10, req.params.ownerId]);
        
        res.json({
            success: true,
            survey: result.rows[0]
        });
    } catch (error) {
        console.error('Submit satisfaction error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ===================== PATIENT CRM ENDPOINTS =====================

// Register new patient
app.post('/api/patients/register', async (req, res) => {
    try {
        const patientData = req.body;
        const patientId = 'PAT-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(`
            INSERT INTO crm.patients
            (patient_id, first_name, last_name, email, phone, whatsapp_number,
             date_of_birth, gender, address, insurance_provider, insurance_number,
             emergency_contact, preferred_contact_method, communication_preferences)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [patientId, patientData.first_name, patientData.last_name,
            patientData.email, patientData.phone, patientData.whatsapp_number,
            patientData.date_of_birth, patientData.gender, patientData.address,
            patientData.insurance_provider, patientData.insurance_number,
            patientData.emergency_contact, patientData.preferred_contact_method,
            patientData.communication_preferences]);
        
        // Award welcome bonus loyalty points
        await awardLoyaltyPoints(result.rows[0].id, 100, 'Welcome bonus');
        
        // Send welcome message
        await sendPatientWelcome(result.rows[0]);
        
        res.json({
            success: true,
            patient: result.rows[0]
        });
    } catch (error) {
        console.error('Patient registration error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Schedule appointment
app.post('/api/appointments/schedule', async (req, res) => {
    try {
        const {
            patient_id, doctor_name, department,
            appointment_date, appointment_type, reason, duration_minutes
        } = req.body;
        
        const appointmentId = 'APT-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(`
            INSERT INTO crm.appointments
            (appointment_id, patient_id, doctor_name, department,
             appointment_date, appointment_type, reason, duration_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [appointmentId, patient_id, doctor_name, department,
            appointment_date, appointment_type, reason, duration_minutes || 30]);
        
        const appointment = result.rows[0];
        
        // Schedule reminders
        await scheduleAppointmentReminders(appointment);
        
        // Send confirmation
        await sendAppointmentConfirmation(appointment);
        
        res.json({
            success: true,
            appointment
        });
    } catch (error) {
        console.error('Schedule appointment error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get patient appointments
app.get('/api/patients/:patientId/appointments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM crm.appointments
            WHERE patient_id = $1
            ORDER BY appointment_date DESC
        `, [req.params.patientId]);
        
        res.json({
            success: true,
            appointments: result.rows
        });
    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit patient feedback
app.post('/api/feedback/submit', async (req, res) => {
    try {
        const feedbackData = req.body;
        
        const result = await pool.query(`
            INSERT INTO crm.patient_feedback
            (patient_id, appointment_id, feedback_type, overall_rating,
             doctor_rating, facility_rating, wait_time_rating, staff_rating,
             cleanliness_rating, comments, improvement_suggestions, would_recommend)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [feedbackData.patient_id, feedbackData.appointment_id,
            feedbackData.feedback_type, feedbackData.overall_rating,
            feedbackData.doctor_rating, feedbackData.facility_rating,
            feedbackData.wait_time_rating, feedbackData.staff_rating,
            feedbackData.cleanliness_rating, feedbackData.comments,
            feedbackData.improvement_suggestions, feedbackData.would_recommend]);
        
        // Award loyalty points for feedback
        await awardLoyaltyPoints(feedbackData.patient_id, 50, 'Feedback submission');
        
        res.json({
            success: true,
            feedback: result.rows[0],
            message: 'Thank you for your feedback! You earned 50 loyalty points.'
        });
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get patient loyalty status
app.get('/api/patients/:patientId/loyalty', async (req, res) => {
    try {
        const patient = await pool.query(
            'SELECT loyalty_points, loyalty_tier FROM crm.patients WHERE id = $1',
            [req.params.patientId]
        );
        
        const transactions = await pool.query(`
            SELECT * FROM crm.loyalty_transactions
            WHERE patient_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.params.patientId]);
        
        const availableRewards = await pool.query(`
            SELECT * FROM crm.loyalty_rewards
            WHERE active = true
            AND points_required <= $1
            ORDER BY points_required DESC
        `, [patient.rows[0]?.loyalty_points || 0]);
        
        res.json({
            success: true,
            loyalty: {
                points: patient.rows[0]?.loyalty_points || 0,
                tier: patient.rows[0]?.loyalty_tier || 'bronze',
                recent_transactions: transactions.rows,
                available_rewards: availableRewards.rows
            }
        });
    } catch (error) {
        console.error('Get loyalty status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Redeem loyalty reward
app.post('/api/loyalty/redeem', async (req, res) => {
    try {
        const { patient_id, reward_id } = req.body;
        
        // Check patient points
        const patient = await pool.query(
            'SELECT loyalty_points FROM crm.patients WHERE id = $1',
            [patient_id]
        );
        
        const reward = await pool.query(
            'SELECT * FROM crm.loyalty_rewards WHERE id = $1',
            [reward_id]
        );
        
        if (patient.rows[0].loyalty_points < reward.rows[0].points_required) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient loyalty points'
            });
        }
        
        const redemptionCode = 'RED-' + uuidv4().substring(0, 8).toUpperCase();
        
        // Create redemption
        const result = await pool.query(`
            INSERT INTO crm.reward_redemptions
            (patient_id, reward_id, redemption_code, points_used, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [patient_id, reward_id, redemptionCode,
            reward.rows[0].points_required,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]); // 30 days expiry
        
        // Deduct points
        await pool.query(`
            UPDATE crm.patients
            SET loyalty_points = loyalty_points - $1
            WHERE id = $2
        `, [reward.rows[0].points_required, patient_id]);
        
        // Log transaction
        await pool.query(`
            INSERT INTO crm.loyalty_transactions
            (patient_id, transaction_type, points, description, reference_id)
            VALUES ($1, 'redemption', $2, $3, $4)
        `, [patient_id, -reward.rows[0].points_required,
            `Redeemed: ${reward.rows[0].reward_name}`, redemptionCode]);
        
        res.json({
            success: true,
            redemption: result.rows[0],
            message: `Successfully redeemed ${reward.rows[0].reward_name}!`
        });
    } catch (error) {
        console.error('Redeem reward error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ===================== COMMUNICATION CAMPAIGNS =====================

// Create communication campaign
app.post('/api/campaigns/create', authenticateToken, async (req, res) => {
    try {
        const campaignData = req.body;
        const campaignId = 'CAM-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(`
            INSERT INTO crm.communication_campaigns
            (campaign_id, campaign_name, campaign_type, target_audience,
             channels, message_template, personalization_fields,
             scheduled_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [campaignId, campaignData.campaign_name, campaignData.campaign_type,
            campaignData.target_audience, campaignData.channels,
            campaignData.message_template, campaignData.personalization_fields,
            campaignData.scheduled_date, req.user.email]);
        
        res.json({
            success: true,
            campaign: result.rows[0]
        });
    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Send WhatsApp message
app.post('/api/messages/whatsapp', async (req, res) => {
    try {
        const { recipient_number, message, media_url } = req.body;
        const messageId = 'MSG-' + uuidv4().substring(0, 8).toUpperCase();
        
        // Queue message for sending
        await pool.query(`
            INSERT INTO crm.messaging_queue
            (message_id, recipient_number, channel, message_content, media_url)
            VALUES ($1, $2, 'whatsapp', $3, $4)
        `, [messageId, recipient_number, message, media_url]);
        
        // In production, integrate with WhatsApp Business API
        // For demo, simulate sending
        setTimeout(async () => {
            await pool.query(`
                UPDATE crm.messaging_queue
                SET status = 'sent', sent_at = CURRENT_TIMESTAMP
                WHERE message_id = $1
            `, [messageId]);
        }, 1000);
        
        res.json({
            success: true,
            messageId,
            message: 'WhatsApp message queued for delivery'
        });
    } catch (error) {
        console.error('Send WhatsApp error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Send SMS message
app.post('/api/messages/sms', async (req, res) => {
    try {
        const { recipient_number, message } = req.body;
        const messageId = 'SMS-' + uuidv4().substring(0, 8).toUpperCase();
        
        // Queue message for sending
        await pool.query(`
            INSERT INTO crm.messaging_queue
            (message_id, recipient_number, channel, message_content)
            VALUES ($1, $2, 'sms', $3)
        `, [messageId, recipient_number, message]);
        
        // In production, integrate with SMS gateway (Twilio, Termii, etc.)
        // For demo, simulate sending
        setTimeout(async () => {
            await pool.query(`
                UPDATE crm.messaging_queue
                SET status = 'sent', sent_at = CURRENT_TIMESTAMP
                WHERE message_id = $1
            `, [messageId]);
        }, 500);
        
        res.json({
            success: true,
            messageId,
            message: 'SMS queued for delivery'
        });
    } catch (error) {
        console.error('Send SMS error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Send Email
app.post('/api/messages/email', async (req, res) => {
    try {
        const { recipient_email, subject, body, html } = req.body;
        
        // In production, use configured email service
        const mailOptions = {
            from: 'noreply@grandpro.com',
            to: recipient_email,
            subject: subject,
            text: body,
            html: html || body
        };
        
        // For demo, simulate email sending
        const messageId = 'EML-' + uuidv4().substring(0, 8).toUpperCase();
        
        await pool.query(`
            INSERT INTO crm.messaging_queue
            (message_id, recipient_number, channel, message_content)
            VALUES ($1, $2, 'email', $3)
        `, [messageId, recipient_email, JSON.stringify({ subject, body })]);
        
        res.json({
            success: true,
            messageId,
            message: 'Email sent successfully'
        });
    } catch (error) {
        console.error('Send email error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Execute campaign
app.post('/api/campaigns/:campaignId/execute', authenticateToken, async (req, res) => {
    try {
        const campaign = await pool.query(
            'SELECT * FROM crm.communication_campaigns WHERE campaign_id = $1',
            [req.params.campaignId]
        );
        
        if (campaign.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        
        const campaignData = campaign.rows[0];
        
        // Get target recipients based on audience
        let recipients = [];
        if (campaignData.target_audience === 'all_patients') {
            const patients = await pool.query('SELECT * FROM crm.patients WHERE true');
            recipients = patients.rows;
        } else if (campaignData.target_audience === 'all_owners') {
            const owners = await pool.query('SELECT * FROM crm.hospital_owners WHERE status = \'active\'');
            recipients = owners.rows;
        }
        
        // Send messages to each recipient
        for (const recipient of recipients) {
            for (const channel of campaignData.channels) {
                if (channel === 'whatsapp' && recipient.whatsapp_number) {
                    await sendWhatsAppMessage(recipient.whatsapp_number, campaignData.message_template);
                } else if (channel === 'sms' && recipient.phone) {
                    await sendSMS(recipient.phone, campaignData.message_template);
                } else if (channel === 'email' && recipient.email) {
                    await sendEmail(recipient.email, campaignData.campaign_name, campaignData.message_template);
                }
            }
        }
        
        // Update campaign status
        await pool.query(`
            UPDATE crm.communication_campaigns
            SET status = 'executed', executed_at = CURRENT_TIMESTAMP, sent_count = $1
            WHERE campaign_id = $2
        `, [recipients.length, req.params.campaignId]);
        
        res.json({
            success: true,
            message: `Campaign executed successfully. Messages sent to ${recipients.length} recipients.`
        });
    } catch (error) {
        console.error('Execute campaign error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ===================== HELPER FUNCTIONS =====================

async function awardLoyaltyPoints(patientId, points, description) {
    await pool.query(`
        UPDATE crm.patients
        SET loyalty_points = loyalty_points + $1,
            loyalty_tier = CASE
                WHEN loyalty_points + $1 >= 5000 THEN 'platinum'
                WHEN loyalty_points + $1 >= 2000 THEN 'gold'
                WHEN loyalty_points + $1 >= 500 THEN 'silver'
                ELSE 'bronze'
            END
        WHERE id = $2
    `, [points, patientId]);
    
    await pool.query(`
        INSERT INTO crm.loyalty_transactions
        (patient_id, transaction_type, points, description)
        VALUES ($1, 'earned', $2, $3)
    `, [patientId, points, description]);
}

async function scheduleAppointmentReminders(appointment) {
    const appointmentDate = new Date(appointment.appointment_date);
    
    // 24 hours before
    const reminder24h = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
    await pool.query(`
        INSERT INTO crm.appointment_reminders
        (appointment_id, reminder_type, scheduled_time, channel, message)
        VALUES ($1, '24_hour', $2, 'sms', $3)
    `, [appointment.id, reminder24h,
        `Reminder: You have an appointment tomorrow at ${appointmentDate.toLocaleTimeString()}`]);
    
    // 2 hours before
    const reminder2h = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000);
    await pool.query(`
        INSERT INTO crm.appointment_reminders
        (appointment_id, reminder_type, scheduled_time, channel, message)
        VALUES ($1, '2_hour', $2, 'whatsapp', $3)
    `, [appointment.id, reminder2h,
        `Your appointment is in 2 hours. Please arrive 15 minutes early.`]);
}

async function sendPatientWelcome(patient) {
    const message = `Welcome to GrandPro Healthcare, ${patient.first_name}! 
    You've earned 100 loyalty points as a welcome bonus. 
    We look forward to serving your healthcare needs.`;
    
    if (patient.preferred_contact_method === 'whatsapp' && patient.whatsapp_number) {
        await sendWhatsAppMessage(patient.whatsapp_number, message);
    } else if (patient.preferred_contact_method === 'sms' && patient.phone) {
        await sendSMS(patient.phone, message);
    } else if (patient.email) {
        await sendEmail(patient.email, 'Welcome to GrandPro Healthcare', message);
    }
}

async function sendAppointmentConfirmation(appointment) {
    const patient = await pool.query(
        'SELECT * FROM crm.patients WHERE id = $1',
        [appointment.patient_id]
    );
    
    if (patient.rows.length > 0) {
        const p = patient.rows[0];
        const message = `Appointment confirmed for ${new Date(appointment.appointment_date).toLocaleString()}
        with ${appointment.doctor_name} in ${appointment.department}.
        Appointment ID: ${appointment.appointment_id}`;
        
        if (p.preferred_contact_method === 'whatsapp' && p.whatsapp_number) {
            await sendWhatsAppMessage(p.whatsapp_number, message);
        } else if (p.preferred_contact_method === 'sms' && p.phone) {
            await sendSMS(p.phone, message);
        }
    }
}

async function sendOwnerNotification(ownerId, subject, message) {
    const owner = await pool.query(
        'SELECT * FROM crm.hospital_owners WHERE id = $1',
        [ownerId]
    );
    
    if (owner.rows.length > 0) {
        const o = owner.rows[0];
        await pool.query(`
            INSERT INTO crm.owner_communications
            (owner_id, communication_type, channel, subject, message)
            VALUES ($1, 'notification', $2, $3, $4)
        `, [ownerId, o.preferred_contact_method, subject, message]);
        
        if (o.email) {
            await sendEmail(o.email, subject, message);
        }
    }
}

// Simulated message sending functions (replace with actual integrations)
async function sendWhatsAppMessage(number, message) {
    console.log(`WhatsApp to ${number}: ${message}`);
    // Integrate with WhatsApp Business API
}

async function sendSMS(number, message) {
    console.log(`SMS to ${number}: ${message}`);
    // Integrate with SMS gateway
}

async function sendEmail(email, subject, body) {
    console.log(`Email to ${email}: ${subject} - ${body}`);
    // Use nodemailer or other email service
}

// ===================== CRON JOBS =====================

// Send appointment reminders every minute
cron.schedule('* * * * *', async () => {
    try {
        const pendingReminders = await pool.query(`
            SELECT r.*, a.*, p.first_name, p.last_name, p.phone, p.whatsapp_number, p.email
            FROM crm.appointment_reminders r
            JOIN crm.appointments a ON r.appointment_id = a.id
            JOIN crm.patients p ON a.patient_id = p.id
            WHERE r.sent = false
            AND r.scheduled_time <= CURRENT_TIMESTAMP
        `);
        
        for (const reminder of pendingReminders.rows) {
            if (reminder.channel === 'whatsapp' && reminder.whatsapp_number) {
                await sendWhatsAppMessage(reminder.whatsapp_number, reminder.message);
            } else if (reminder.channel === 'sms' && reminder.phone) {
                await sendSMS(reminder.phone, reminder.message);
            } else if (reminder.channel === 'email' && reminder.email) {
                await sendEmail(reminder.email, 'Appointment Reminder', reminder.message);
            }
            
            await pool.query(`
                UPDATE crm.appointment_reminders
                SET sent = true, sent_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [reminder.id]);
        }
    } catch (error) {
        console.error('Reminder cron error:', error);
    }
});

// Process message queue every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
    try {
        const queuedMessages = await pool.query(`
            SELECT * FROM crm.messaging_queue
            WHERE status = 'queued'
            AND (scheduled_time IS NULL OR scheduled_time <= CURRENT_TIMESTAMP)
            ORDER BY priority DESC, created_at ASC
            LIMIT 10
        `);
        
        for (const msg of queuedMessages.rows) {
            // Process message based on channel
            if (msg.channel === 'whatsapp') {
                await sendWhatsAppMessage(msg.recipient_number, msg.message_content);
            } else if (msg.channel === 'sms') {
                await sendSMS(msg.recipient_number, msg.message_content);
            }
            
            await pool.query(`
                UPDATE crm.messaging_queue
                SET status = 'sent', sent_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [msg.id]);
        }
    } catch (error) {
        console.error('Message queue cron error:', error);
    }
});

// ===================== ANALYTICS & REPORTING =====================

// Get CRM dashboard stats
app.get('/api/crm/dashboard', authenticateToken, async (req, res) => {
    try {
        const stats = {};
        
        // Owner stats
        const ownerStats = await pool.query(`
            SELECT 
                COUNT(*) as total_owners,
                AVG(satisfaction_score) as avg_satisfaction,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_owners
            FROM crm.hospital_owners
        `);
        stats.owners = ownerStats.rows[0];
        
        // Contract stats
        const contractStats = await pool.query(`
            SELECT 
                COUNT(*) as total_contracts,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_contracts,
                SUM(monthly_fee) as total_monthly_revenue
            FROM crm.owner_contracts
        `);
        stats.contracts = contractStats.rows[0];
        
        // Patient stats
        const patientStats = await pool.query(`
            SELECT 
                COUNT(*) as total_patients,
                AVG(loyalty_points) as avg_loyalty_points,
                COUNT(CASE WHEN loyalty_tier = 'platinum' THEN 1 END) as platinum_members,
                COUNT(CASE WHEN loyalty_tier = 'gold' THEN 1 END) as gold_members
            FROM crm.patients
        `);
        stats.patients = patientStats.rows[0];
        
        // Appointment stats
        const appointmentStats = await pool.query(`
            SELECT 
                COUNT(*) as total_appointments,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as upcoming,
                COUNT(CASE WHEN no_show = true THEN 1 END) as no_shows
            FROM crm.appointments
            WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days'
        `);
        stats.appointments = appointmentStats.rows[0];
        
        // Feedback stats
        const feedbackStats = await pool.query(`
            SELECT 
                AVG(overall_rating) as avg_rating,
                COUNT(*) as total_feedback,
                COUNT(CASE WHEN would_recommend = true THEN 1 END) as would_recommend
            FROM crm.patient_feedback
        `);
        stats.feedback = feedbackStats.rows[0];
        
        // Campaign stats
        const campaignStats = await pool.query(`
            SELECT 
                COUNT(*) as total_campaigns,
                SUM(sent_count) as total_messages_sent,
                AVG(opened_count::float / NULLIF(sent_count, 0) * 100) as avg_open_rate
            FROM crm.communication_campaigns
            WHERE status = 'executed'
        `);
        stats.campaigns = campaignStats.rows[0];
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'CRM System',
        status: 'operational',
        features: {
            ownerCRM: true,
            patientCRM: true,
            appointments: true,
            loyaltyProgram: true,
            communicationCampaigns: true,
            whatsappIntegration: true,
            smsIntegration: true,
            emailIntegration: true,
            feedbackCollection: true,
            satisfactionMetrics: true
        }
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRM System running on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}`);
});
