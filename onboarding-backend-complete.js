const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();

// Database connection
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = '/root/uploads/onboarding';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});

// ===================== API ENDPOINTS =====================

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Digital Sourcing & Partner Onboarding API',
        version: '2.0.0',
        status: 'operational',
        endpoints: {
            applications: '/api/applications',
            documents: '/api/documents',
            evaluation: '/api/evaluation',
            contracts: '/api/contracts',
            dashboard: '/api/dashboard'
        }
    });
});

// Submit application
app.post('/api/applications', async (req, res) => {
    try {
        const {
            hospitalName, regNumber, ownerName, email, phone,
            address, beds, doctors, specialties, city, state
        } = req.body;
        
        const applicationId = 'APP' + Date.now();
        
        const result = await pool.query(`
            INSERT INTO onboarding.applications 
            (application_id, hospital_name, registration_number, owner_name, 
             email, phone, address, city, state, bed_count, doctor_count, 
             specialties, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'submitted', NOW())
            RETURNING *
        `, [applicationId, hospitalName, regNumber, ownerName, email, 
            phone, address, city, state, beds, doctors, JSON.stringify(specialties)]);
        
        res.json({
            success: true,
            applicationId,
            data: result.rows[0],
            message: 'Application submitted successfully'
        });
    } catch (error) {
        console.error('Application submission error:', error);
        res.status(500).json({ error: 'Failed to submit application' });
    }
});

// Upload documents
app.post('/api/documents/upload/:applicationId', upload.array('documents', 10), async (req, res) => {
    try {
        const { applicationId } = req.params;
        const uploadedFiles = [];
        
        for (const file of req.files) {
            const result = await pool.query(`
                INSERT INTO onboarding.documents 
                (application_id, document_type, file_name, file_path, file_size, uploaded_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `, [applicationId, file.fieldname, file.originalname, file.path, file.size]);
            
            uploadedFiles.push(result.rows[0]);
        }
        
        // Update application status
        await pool.query(`
            UPDATE onboarding.applications 
            SET status = 'documents_uploaded', updated_at = NOW()
            WHERE application_id = $1
        `, [applicationId]);
        
        res.json({
            success: true,
            files: uploadedFiles,
            message: `${req.files.length} documents uploaded successfully`
        });
    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Failed to upload documents' });
    }
});

// Automated evaluation and scoring
app.post('/api/evaluation/score/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        // Fetch application data
        const appResult = await pool.query(
            'SELECT * FROM onboarding.applications WHERE application_id = $1',
            [applicationId]
        );
        
        if (appResult.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        const app = appResult.rows[0];
        
        // Scoring algorithm
        let score = 0;
        const scoreBreakdown = {};
        
        // Infrastructure score (max 30)
        if (app.bed_count > 100) {
            score += 30;
            scoreBreakdown.infrastructure = 30;
        } else if (app.bed_count > 50) {
            score += 20;
            scoreBreakdown.infrastructure = 20;
        } else {
            score += 10;
            scoreBreakdown.infrastructure = 10;
        }
        
        // Staffing score (max 25)
        if (app.doctor_count > 20) {
            score += 25;
            scoreBreakdown.staffing = 25;
        } else if (app.doctor_count > 10) {
            score += 15;
            scoreBreakdown.staffing = 15;
        } else {
            score += 10;
            scoreBreakdown.staffing = 10;
        }
        
        // Services score (max 20)
        const specialties = JSON.parse(app.specialties || '[]');
        const serviceScore = Math.min(20, specialties.length * 4);
        score += serviceScore;
        scoreBreakdown.services = serviceScore;
        
        // Documentation score (max 15)
        const docResult = await pool.query(
            'SELECT COUNT(*) as doc_count FROM onboarding.documents WHERE application_id = $1',
            [applicationId]
        );
        const docScore = Math.min(15, docResult.rows[0].doc_count * 3);
        score += docScore;
        scoreBreakdown.documentation = docScore;
        
        // Compliance score (max 10)
        const complianceScore = 5 + Math.random() * 5;
        score += complianceScore;
        scoreBreakdown.compliance = Math.round(complianceScore);
        
        const totalScore = Math.min(100, score);
        const recommendation = totalScore > 70 ? 'approved' : totalScore > 40 ? 'conditional' : 'review_required';
        
        // Store evaluation
        await pool.query(`
            INSERT INTO onboarding.evaluation_scores 
            (application_id, total_score, score_breakdown, recommendation, evaluated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (application_id) DO UPDATE
            SET total_score = $2, score_breakdown = $3, recommendation = $4, evaluated_at = NOW()
        `, [applicationId, totalScore, JSON.stringify(scoreBreakdown), recommendation]);
        
        // Update application status
        await pool.query(`
            UPDATE onboarding.applications 
            SET status = 'evaluated', updated_at = NOW()
            WHERE application_id = $1
        `, [applicationId]);
        
        res.json({
            success: true,
            applicationId,
            totalScore: Math.round(totalScore),
            scoreBreakdown,
            recommendation,
            message: 'Evaluation completed successfully'
        });
    } catch (error) {
        console.error('Evaluation error:', error);
        res.status(500).json({ error: 'Failed to evaluate application' });
    }
});

// Generate contract
app.post('/api/contracts/generate/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        // Check if application is approved
        const evalResult = await pool.query(
            'SELECT * FROM onboarding.evaluation_scores WHERE application_id = $1',
            [applicationId]
        );
        
        if (evalResult.rows.length === 0) {
            return res.status(400).json({ error: 'Application must be evaluated first' });
        }
        
        const evaluation = evalResult.rows[0];
        if (evaluation.total_score < 40) {
            return res.status(400).json({ error: 'Application score too low for contract generation' });
        }
        
        // Get application details
        const appResult = await pool.query(
            'SELECT * FROM onboarding.applications WHERE application_id = $1',
            [applicationId]
        );
        
        const app = appResult.rows[0];
        const contractId = 'CONTRACT-' + crypto.randomBytes(6).toString('hex').toUpperCase();
        
        // Generate contract content
        const contractContent = {
            contractId,
            hospitalName: app.hospital_name,
            ownerName: app.owner_name,
            date: new Date().toISOString(),
            terms: [
                'Maintain minimum service standards as per GrandPro HMSO guidelines',
                'Monthly reporting of operational metrics required',
                'Revenue sharing: 70% Hospital, 30% GrandPro HMSO',
                'Contract duration: 5 years with automatic renewal',
                'Quarterly quality assurance audits',
                'Mandatory technology platform usage',
                'HIPAA compliance and data security requirements',
                'Minimum insurance coverage: $5 million liability'
            ],
            sla: {
                uptime: '99.9%',
                support: '24/7',
                reviews: 'Monthly',
                training: 'Included'
            }
        };
        
        // Store contract
        const result = await pool.query(`
            INSERT INTO onboarding.contracts 
            (contract_id, application_id, contract_content, status, created_at)
            VALUES ($1, $2, $3, 'pending_signature', NOW())
            RETURNING *
        `, [contractId, applicationId, JSON.stringify(contractContent)]);
        
        // Update application status
        await pool.query(`
            UPDATE onboarding.applications 
            SET status = 'contract_generated', updated_at = NOW()
            WHERE application_id = $1
        `, [applicationId]);
        
        res.json({
            success: true,
            contractId,
            contract: contractContent,
            message: 'Contract generated successfully'
        });
    } catch (error) {
        console.error('Contract generation error:', error);
        res.status(500).json({ error: 'Failed to generate contract' });
    }
});

// Digital signing
app.post('/api/contracts/sign/:contractId', async (req, res) => {
    try {
        const { contractId } = req.params;
        const { signatureData, signerName, signerEmail } = req.body;
        
        // Update contract with signature
        await pool.query(`
            UPDATE onboarding.contracts 
            SET signature_data = $1, signer_name = $2, signer_email = $3,
                signed_at = NOW(), status = 'signed'
            WHERE contract_id = $4
        `, [signatureData, signerName, signerEmail, contractId]);
        
        // Get application ID
        const contractResult = await pool.query(
            'SELECT application_id FROM onboarding.contracts WHERE contract_id = $1',
            [contractId]
        );
        
        if (contractResult.rows.length > 0) {
            // Update application to onboarded
            await pool.query(`
                UPDATE onboarding.applications 
                SET status = 'onboarded', updated_at = NOW()
                WHERE application_id = $1
            `, [contractResult.rows[0].application_id]);
        }
        
        res.json({
            success: true,
            message: 'Contract signed successfully',
            contractId,
            signedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Contract signing error:', error);
        res.status(500).json({ error: 'Failed to sign contract' });
    }
});

// Dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_applications,
                COUNT(CASE WHEN status = 'submitted' THEN 1 END) as pending_review,
                COUNT(CASE WHEN status = 'evaluated' AND status != 'onboarded' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'onboarded' THEN 1 END) as onboarded
            FROM onboarding.applications
        `);
        
        res.json({
            success: true,
            stats: stats.rows[0]
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Get application progress
app.get('/api/dashboard/progress/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                a.*,
                e.total_score,
                e.recommendation,
                c.contract_id,
                c.status as contract_status,
                c.signed_at
            FROM onboarding.applications a
            LEFT JOIN onboarding.evaluation_scores e ON a.application_id = e.application_id
            LEFT JOIN onboarding.contracts c ON a.application_id = c.application_id
            WHERE a.application_id = $1
        `, [applicationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        const app = result.rows[0];
        
        // Determine progress steps
        const progress = {
            application: app.status !== 'draft',
            documents: app.status !== 'submitted' && app.status !== 'draft',
            evaluation: app.total_score !== null,
            contract: app.contract_id !== null,
            onboarded: app.status === 'onboarded'
        };
        
        res.json({
            success: true,
            applicationId,
            currentStatus: app.status,
            progress,
            details: app
        });
    } catch (error) {
        console.error('Progress tracking error:', error);
        res.status(500).json({ error: 'Failed to fetch application progress' });
    }
});

// Get recent applications
app.get('/api/applications/recent', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT application_id, hospital_name, owner_name, status, created_at
            FROM onboarding.applications
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            applications: result.rows
        });
    } catch (error) {
        console.error('Recent applications error:', error);
        res.status(500).json({ error: 'Failed to fetch recent applications' });
    }
});

// Error handling
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${error.message}` });
    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 11001;
app.listen(PORT, () => {
    console.log(`Onboarding Backend API running on port ${PORT}`);
    console.log('Features enabled:');
    console.log('- Hospital application submission');
    console.log('- Document upload with validation');
    console.log('- Automated scoring algorithm');
    console.log('- Contract auto-generation');
    console.log('- Digital signature support');
    console.log('- Real-time dashboard tracking');
});

module.exports = app;
