const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const DATABASE_URL = 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const app = express();
const PORT = 8090;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Create directories
const uploadsDir = path.join(__dirname, 'uploads', 'onboarding');
const contractsDir = path.join(__dirname, 'contracts');

[uploadsDir, contractsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF and image files are allowed'));
        }
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS onboarding`);
        
        // Applications table with comprehensive fields
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onboarding.applications (
                id SERIAL PRIMARY KEY,
                application_id VARCHAR(50) UNIQUE NOT NULL,
                hospital_name VARCHAR(255) NOT NULL,
                registration_number VARCHAR(100),
                location VARCHAR(255),
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100) DEFAULT 'Nigeria',
                bed_count INTEGER,
                years_experience INTEGER,
                specializations TEXT[],
                owner_name VARCHAR(255),
                owner_email VARCHAR(255),
                owner_phone VARCHAR(50),
                financial_revenue DECIMAL(12,2),
                financial_profitability DECIMAL(12,2),
                service_quality_score INTEGER,
                compliance_certifications TEXT[],
                infrastructure_quality VARCHAR(50),
                status VARCHAR(50) DEFAULT 'pending',
                score INTEGER DEFAULT 0,
                evaluation_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Documents table for file uploads
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onboarding.documents (
                id SERIAL PRIMARY KEY,
                application_id INTEGER REFERENCES onboarding.applications(id) ON DELETE CASCADE,
                document_type VARCHAR(100),
                document_name VARCHAR(255),
                file_path TEXT,
                file_size INTEGER,
                mime_type VARCHAR(100),
                verification_status VARCHAR(50) DEFAULT 'pending',
                verified_by VARCHAR(255),
                verified_at TIMESTAMP,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Contracts table with digital signature support
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onboarding.contracts (
                id SERIAL PRIMARY KEY,
                application_id INTEGER REFERENCES onboarding.applications(id) ON DELETE CASCADE,
                contract_id VARCHAR(50) UNIQUE NOT NULL,
                contract_type VARCHAR(100) DEFAULT 'standard',
                contract_terms JSONB,
                pdf_path TEXT,
                signature_status VARCHAR(50) DEFAULT 'pending_signature',
                hospital_signature TEXT,
                hospital_signed_at TIMESTAMP,
                hospital_signature_ip VARCHAR(50),
                admin_signature TEXT,
                admin_signed_at TIMESTAMP,
                admin_signature_ip VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        `);

        // Evaluation criteria table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onboarding.evaluation_criteria (
                id SERIAL PRIMARY KEY,
                criterion_name VARCHAR(255) NOT NULL,
                weight DECIMAL(3,2),
                max_points INTEGER,
                description TEXT,
                active BOOLEAN DEFAULT true
            )
        `);

        // Evaluation results table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onboarding.evaluation_results (
                id SERIAL PRIMARY KEY,
                application_id INTEGER REFERENCES onboarding.applications(id) ON DELETE CASCADE,
                criterion_id INTEGER REFERENCES onboarding.evaluation_criteria(id),
                score INTEGER,
                notes TEXT,
                evaluated_by VARCHAR(255),
                evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Activity log for real-time tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onboarding.activity_log (
                id SERIAL PRIMARY KEY,
                application_id INTEGER REFERENCES onboarding.applications(id) ON DELETE CASCADE,
                activity_type VARCHAR(100),
                description TEXT,
                performed_by VARCHAR(255),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default evaluation criteria
        await pool.query(`
            INSERT INTO onboarding.evaluation_criteria (criterion_name, weight, max_points, description)
            VALUES 
                ('Bed Capacity', 0.20, 25, 'Hospital bed count and capacity'),
                ('Years of Experience', 0.15, 25, 'Years in healthcare operation'),
                ('Financial Viability', 0.25, 30, 'Revenue and profitability metrics'),
                ('Service Quality', 0.20, 25, 'Patient satisfaction and service quality'),
                ('Compliance & Certifications', 0.10, 20, 'Regulatory compliance and certifications'),
                ('Infrastructure Quality', 0.10, 20, 'Facility and equipment quality')
            ON CONFLICT DO NOTHING
        `);

        console.log('Digital Sourcing database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize on startup
initializeDatabase();

// ===================== SCORING ALGORITHM =====================

async function calculateComprehensiveScore(application) {
    let totalScore = 0;
    let evaluationDetails = [];

    // 1. Bed Capacity (max 25 points)
    let bedScore = 0;
    if (application.bed_count >= 200) bedScore = 25;
    else if (application.bed_count >= 150) bedScore = 20;
    else if (application.bed_count >= 100) bedScore = 15;
    else if (application.bed_count >= 50) bedScore = 10;
    else if (application.bed_count >= 20) bedScore = 5;
    
    totalScore += bedScore;
    evaluationDetails.push({ criterion: 'Bed Capacity', score: bedScore, max: 25 });

    // 2. Years of Experience (max 25 points)
    let experienceScore = Math.min(application.years_experience * 2.5, 25);
    totalScore += experienceScore;
    evaluationDetails.push({ criterion: 'Years of Experience', score: experienceScore, max: 25 });

    // 3. Financial Viability (max 30 points)
    let financialScore = 0;
    if (application.financial_revenue) {
        if (application.financial_revenue >= 10000000) financialScore += 15;
        else if (application.financial_revenue >= 5000000) financialScore += 10;
        else if (application.financial_revenue >= 1000000) financialScore += 5;
    }
    if (application.financial_profitability) {
        if (application.financial_profitability >= 20) financialScore += 15;
        else if (application.financial_profitability >= 10) financialScore += 10;
        else if (application.financial_profitability >= 5) financialScore += 5;
    }
    totalScore += financialScore;
    evaluationDetails.push({ criterion: 'Financial Viability', score: financialScore, max: 30 });

    // 4. Service Quality (max 25 points)
    let qualityScore = application.service_quality_score || 0;
    totalScore += qualityScore;
    evaluationDetails.push({ criterion: 'Service Quality', score: qualityScore, max: 25 });

    // 5. Specializations (max 10 points)
    let specializationScore = Math.min((application.specializations?.length || 0) * 2, 10);
    totalScore += specializationScore;
    evaluationDetails.push({ criterion: 'Specializations', score: specializationScore, max: 10 });

    // 6. Compliance & Certifications (max 10 points)
    let complianceScore = Math.min((application.compliance_certifications?.length || 0) * 2.5, 10);
    totalScore += complianceScore;
    evaluationDetails.push({ criterion: 'Compliance', score: complianceScore, max: 10 });

    // 7. Infrastructure Quality (max 5 points)
    let infrastructureScore = 0;
    switch(application.infrastructure_quality) {
        case 'excellent': infrastructureScore = 5; break;
        case 'good': infrastructureScore = 4; break;
        case 'average': infrastructureScore = 3; break;
        case 'fair': infrastructureScore = 2; break;
        default: infrastructureScore = 1;
    }
    totalScore += infrastructureScore;
    evaluationDetails.push({ criterion: 'Infrastructure', score: infrastructureScore, max: 5 });

    return {
        totalScore: Math.min(totalScore, 100),
        evaluationDetails,
        recommendation: totalScore >= 70 ? 'approve' : totalScore >= 50 ? 'review' : 'reject'
    };
}

// ===================== API ENDPOINTS =====================

// Submit application with documents
app.post('/api/applications/submit', upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'certification', maxCount: 5 },
    { name: 'financial_statement', maxCount: 3 },
    { name: 'facility_photos', maxCount: 10 }
]), async function(req, res) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const applicationId = 'APP-' + uuidv4().substring(0, 8).toUpperCase();
        const applicationData = JSON.parse(req.body.applicationData || '{}');
        
        // Calculate comprehensive score
        const scoring = await calculateComprehensiveScore(applicationData);
        
        // Insert application
        const appResult = await client.query(`
            INSERT INTO onboarding.applications (
                application_id, hospital_name, registration_number, location, address,
                city, state, bed_count, years_experience, specializations,
                owner_name, owner_email, owner_phone, financial_revenue,
                financial_profitability, service_quality_score, compliance_certifications,
                infrastructure_quality, score, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING *
        `, [
            applicationId,
            applicationData.hospital_name,
            applicationData.registration_number,
            applicationData.location,
            applicationData.address,
            applicationData.city,
            applicationData.state,
            applicationData.bed_count,
            applicationData.years_experience,
            applicationData.specializations || [],
            applicationData.owner_name,
            applicationData.owner_email,
            applicationData.owner_phone,
            applicationData.financial_revenue,
            applicationData.financial_profitability,
            applicationData.service_quality_score,
            applicationData.compliance_certifications || [],
            applicationData.infrastructure_quality,
            scoring.totalScore,
            scoring.recommendation === 'approve' ? 'approved' : 'pending'
        ]);
        
        const application = appResult.rows[0];
        
        // Save uploaded documents
        if (req.files) {
            for (const [fieldName, files] of Object.entries(req.files)) {
                for (const file of files) {
                    await client.query(`
                        INSERT INTO onboarding.documents (
                            application_id, document_type, document_name,
                            file_path, file_size, mime_type
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        application.id,
                        fieldName,
                        file.originalname,
                        file.path,
                        file.size,
                        file.mimetype
                    ]);
                }
            }
        }
        
        // Log activity
        await client.query(`
            INSERT INTO onboarding.activity_log (
                application_id, activity_type, description, metadata
            ) VALUES ($1, $2, $3, $4)
        `, [
            application.id,
            'application_submitted',
            `Application submitted with score ${scoring.totalScore}`,
            { score: scoring.totalScore, evaluation: scoring.evaluationDetails }
        ]);
        
        // Auto-generate contract if approved
        if (scoring.recommendation === 'approve') {
            const contractId = 'CON-' + uuidv4().substring(0, 8).toUpperCase();
            
            await client.query(`
                INSERT INTO onboarding.contracts (
                    application_id, contract_id, contract_terms, signature_status
                ) VALUES ($1, $2, $3, $4)
            `, [
                application.id,
                contractId,
                JSON.stringify({
                    hospital_name: applicationData.hospital_name,
                    start_date: new Date(),
                    duration: '3 years',
                    terms: 'Standard partnership terms apply'
                }),
                'pending_signature'
            ]);
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            applicationId: applicationId,
            score: scoring.totalScore,
            status: application.status,
            evaluationDetails: scoring.evaluationDetails,
            message: scoring.recommendation === 'approve' 
                ? 'Application approved! Contract generated.' 
                : 'Application submitted for review.'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Application submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get recent applications with real-time status
app.get('/api/applications/recent', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.*,
                COUNT(DISTINCT d.id) as document_count,
                c.contract_id,
                c.signature_status,
                (
                    SELECT json_agg(
                        json_build_object(
                            'activity', al.activity_type,
                            'description', al.description,
                            'timestamp', al.created_at
                        ) ORDER BY al.created_at DESC
                    )
                    FROM onboarding.activity_log al
                    WHERE al.application_id = a.id
                    LIMIT 5
                ) as recent_activities
            FROM onboarding.applications a
            LEFT JOIN onboarding.documents d ON d.application_id = a.id
            LEFT JOIN onboarding.contracts c ON c.application_id = a.id
            GROUP BY a.id, c.contract_id, c.signature_status
            ORDER BY a.created_at DESC
            LIMIT 20
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get application details
app.get('/api/applications/:id', async (req, res) => {
    try {
        const appResult = await pool.query(
            'SELECT * FROM onboarding.applications WHERE application_id = $1',
            [req.params.id]
        );
        
        if (appResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        
        const application = appResult.rows[0];
        
        // Get documents
        const docsResult = await pool.query(
            'SELECT * FROM onboarding.documents WHERE application_id = $1',
            [application.id]
        );
        
        // Get contract
        const contractResult = await pool.query(
            'SELECT * FROM onboarding.contracts WHERE application_id = $1',
            [application.id]
        );
        
        // Get activity log
        const activityResult = await pool.query(
            'SELECT * FROM onboarding.activity_log WHERE application_id = $1 ORDER BY created_at DESC',
            [application.id]
        );
        
        res.json({
            success: true,
            application,
            documents: docsResult.rows,
            contract: contractResult.rows[0],
            activities: activityResult.rows
        });
    } catch (error) {
        console.error('Get application details error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate contract PDF
app.post('/api/applications/:id/generate-contract', async (req, res) => {
    try {
        const appResult = await pool.query(
            'SELECT * FROM onboarding.applications WHERE application_id = $1',
            [req.params.id]
        );
        
        if (appResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        
        const application = appResult.rows[0];
        const contractId = 'CON-' + uuidv4().substring(0, 8).toUpperCase();
        
        // Create PDF
        const doc = new PDFDocument();
        const pdfPath = path.join(contractsDir, `${contractId}.pdf`);
        const writeStream = fs.createWriteStream(pdfPath);
        
        doc.pipe(writeStream);
        
        // Add contract content
        doc.fontSize(20).text('HOSPITAL PARTNERSHIP CONTRACT', 50, 50, { align: 'center' });
        doc.fontSize(12);
        doc.moveDown();
        
        doc.text(`Contract ID: ${contractId}`, 50, 120);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, 140);
        doc.moveDown();
        
        doc.fontSize(14).text('PARTIES:', 50, 180);
        doc.fontSize(12);
        doc.text(`1. GrandPro HMSO (The Company)`, 70, 200);
        doc.text(`2. ${application.hospital_name} (The Hospital)`, 70, 220);
        doc.moveDown();
        
        doc.fontSize(14).text('TERMS AND CONDITIONS:', 50, 260);
        doc.fontSize(12);
        doc.text('1. Duration: This agreement is valid for 3 years from the date of signing.', 70, 280);
        doc.text('2. Services: The Hospital agrees to operate under GrandPro HMSO management.', 70, 300);
        doc.text('3. Revenue Sharing: As per agreed terms in Schedule A.', 70, 320);
        doc.text('4. Quality Standards: Hospital must maintain minimum quality standards.', 70, 340);
        doc.text('5. Reporting: Monthly operational reports required.', 70, 360);
        
        doc.moveDown(2);
        doc.text('SIGNATURES:', 50, 420);
        doc.text('_______________________', 50, 460);
        doc.text('Hospital Representative', 50, 480);
        doc.text('_______________________', 250, 460);
        doc.text('GrandPro HMSO', 250, 480);
        
        doc.end();
        
        // Save contract to database
        const contractResult = await pool.query(`
            INSERT INTO onboarding.contracts (
                application_id, contract_id, contract_terms, pdf_path
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (application_id) 
            DO UPDATE SET 
                contract_id = $2,
                pdf_path = $4
            RETURNING *
        `, [
            application.id,
            contractId,
            JSON.stringify({
                hospital_name: application.hospital_name,
                duration: '3 years',
                start_date: new Date()
            }),
            pdfPath
        ]);
        
        // Log activity
        await pool.query(`
            INSERT INTO onboarding.activity_log (
                application_id, activity_type, description
            ) VALUES ($1, $2, $3)
        `, [
            application.id,
            'contract_generated',
            `Contract ${contractId} generated`
        ]);
        
        res.json({
            success: true,
            contractId,
            contract: contractResult.rows[0],
            pdfPath: `/api/contracts/${contractId}/download`
        });
        
    } catch (error) {
        console.error('Generate contract error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Digital signature endpoint
app.post('/api/contracts/:id/sign', async (req, res) => {
    try {
        const { signatureData, signerType, signerName, ipAddress } = req.body;
        
        const contractResult = await pool.query(
            'SELECT * FROM onboarding.contracts WHERE contract_id = $1',
            [req.params.id]
        );
        
        if (contractResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Contract not found' });
        }
        
        const contract = contractResult.rows[0];
        
        // Generate signature hash
        const signatureHash = crypto
            .createHash('sha256')
            .update(signatureData + signerName + new Date().toISOString())
            .digest('hex');
        
        // Update contract with signature
        let updateQuery, updateParams;
        
        if (signerType === 'hospital') {
            updateQuery = `
                UPDATE onboarding.contracts 
                SET hospital_signature = $1, 
                    hospital_signed_at = CURRENT_TIMESTAMP,
                    hospital_signature_ip = $2,
                    signature_status = CASE 
                        WHEN admin_signature IS NOT NULL THEN 'fully_signed'
                        ELSE 'partially_signed'
                    END
                WHERE contract_id = $3
                RETURNING *
            `;
            updateParams = [signatureHash, ipAddress, req.params.id];
        } else {
            updateQuery = `
                UPDATE onboarding.contracts 
                SET admin_signature = $1, 
                    admin_signed_at = CURRENT_TIMESTAMP,
                    admin_signature_ip = $2,
                    signature_status = CASE 
                        WHEN hospital_signature IS NOT NULL THEN 'fully_signed'
                        ELSE 'partially_signed'
                    END
                WHERE contract_id = $3
                RETURNING *
            `;
            updateParams = [signatureHash, ipAddress, req.params.id];
        }
        
        const result = await pool.query(updateQuery, updateParams);
        const updatedContract = result.rows[0];
        
        // Log activity
        await pool.query(`
            INSERT INTO onboarding.activity_log (
                application_id, activity_type, description, performed_by
            ) VALUES ($1, $2, $3, $4)
        `, [
            contract.application_id,
            'contract_signed',
            `Contract signed by ${signerType}`,
            signerName
        ]);
        
        // Update application status if fully signed
        if (updatedContract.signature_status === 'fully_signed') {
            await pool.query(
                `UPDATE onboarding.applications 
                SET status = 'onboarded' 
                WHERE id = $1`,
                [contract.application_id]
            );
        }
        
        res.json({
            success: true,
            contract: updatedContract,
            message: updatedContract.signature_status === 'fully_signed' 
                ? 'Contract fully signed! Onboarding complete.' 
                : 'Contract partially signed.'
        });
        
    } catch (error) {
        console.error('Sign contract error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = {};
        
        // Total applications
        const totalApps = await pool.query('SELECT COUNT(*) FROM onboarding.applications');
        stats.total = parseInt(totalApps.rows[0].count);
        
        // Applications by status
        const byStatus = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM onboarding.applications 
            GROUP BY status
        `);
        
        stats.byStatus = {};
        byStatus.rows.forEach(row => {
            stats.byStatus[row.status] = parseInt(row.count);
        });
        
        // Average score
        const avgScore = await pool.query('SELECT AVG(score) FROM onboarding.applications');
        stats.averageScore = Math.round(avgScore.rows[0].avg || 0);
        
        // Contracts status
        const contracts = await pool.query(`
            SELECT signature_status, COUNT(*) as count 
            FROM onboarding.contracts 
            GROUP BY signature_status
        `);
        
        stats.contracts = {};
        contracts.rows.forEach(row => {
            stats.contracts[row.signature_status] = parseInt(row.count);
        });
        
        // Recent activity
        const recentActivity = await pool.query(`
            SELECT 
                al.*, 
                a.hospital_name
            FROM onboarding.activity_log al
            JOIN onboarding.applications a ON al.application_id = a.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);
        
        stats.recentActivity = recentActivity.rows;
        
        res.json(stats);
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Real-time status updates endpoint (for WebSocket alternative)
app.get('/api/applications/:id/status', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.status,
                a.score,
                c.signature_status,
                (
                    SELECT json_agg(
                        json_build_object(
                            'type', d.document_type,
                            'status', d.verification_status
                        )
                    )
                    FROM onboarding.documents d
                    WHERE d.application_id = a.id
                ) as documents,
                (
                    SELECT json_agg(
                        json_build_object(
                            'activity', al.activity_type,
                            'timestamp', al.created_at
                        ) ORDER BY al.created_at DESC
                    )
                    FROM onboarding.activity_log al
                    WHERE al.application_id = a.id
                    LIMIT 5
                ) as recent_activities
            FROM onboarding.applications a
            LEFT JOIN onboarding.contracts c ON c.application_id = a.id
            WHERE a.application_id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        
        res.json({
            success: true,
            status: result.rows[0]
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify document
app.put('/api/documents/:id/verify', async (req, res) => {
    try {
        const { status, verifiedBy } = req.body;
        
        const result = await pool.query(`
            UPDATE onboarding.documents 
            SET verification_status = $1,
                verified_by = $2,
                verified_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [status, verifiedBy, req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }
        
        res.json({
            success: true,
            document: result.rows[0]
        });
    } catch (error) {
        console.error('Verify document error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download contract PDF
app.get('/api/contracts/:id/download', (req, res) => {
    const pdfPath = path.join(contractsDir, `${req.params.id}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ success: false, error: 'Contract PDF not found' });
    }
    
    res.download(pdfPath);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'Digital Sourcing Portal',
        status: 'operational',
        features: {
            documentUpload: true,
            scoringAlgorithm: true,
            contractGeneration: true,
            digitalSignature: true,
            realTimeTracking: true
        }
    });
});

// Static file serving for uploads
app.use('/uploads', express.static(uploadsDir));
app.use('/contracts', express.static(contractsDir));

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Sourcing Portal running on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}`);
});
