// Integrated Hospital Management System with Full Functionality and Security
// This is a comprehensive HMS implementation with all modules working

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// Security Configuration
const JWT_SECRET = crypto.randomBytes(64).toString('hex');
const ENCRYPTION_KEY = crypto.scryptSync('HMS-2024-Secure', 'salt', 32);

// Initialize Express App
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database Configuration
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/hms?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('/root/hospital-management-system'));

// Create Audit Directory
async function createAuditDir() {
    try {
        await fs.mkdir('/root/audit', { recursive: true });
        await fs.mkdir('/root/backups', { recursive: true });
    } catch (error) {
        console.error('Directory creation error:', error);
    }
}

// Audit Logging Function
async function auditLog(action, userId, details) {
    const log = {
        timestamp: new Date().toISOString(),
        action,
        userId,
        details
    };
    
    try {
        await fs.appendFile('/root/audit/audit.log', JSON.stringify(log) + '\n');
        
        // Also log to database
        await pool.query(`
            INSERT INTO audit_logs (timestamp, action, user_id, details)
            VALUES ($1, $2, $3, $4)
        `, [log.timestamp, action, userId, JSON.stringify(details)]);
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

// Database Setup
async function setupDatabase() {
    try {
        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                full_name VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Patients table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS patients (
                id SERIAL PRIMARY KEY,
                patient_id VARCHAR(20) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                date_of_birth DATE,
                gender VARCHAR(10),
                phone VARCHAR(20),
                email VARCHAR(100),
                address TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Medical Records table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS medical_records (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                record_type VARCHAR(50),
                chief_complaint TEXT,
                diagnosis TEXT,
                treatment TEXT,
                prescriptions JSONB,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Billing table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS billing (
                id SERIAL PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                patient_id INTEGER REFERENCES patients(id),
                items JSONB,
                total_amount DECIMAL(10,2),
                payment_method VARCHAR(50),
                status VARCHAR(20) DEFAULT 'pending',
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Inventory table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                item_name VARCHAR(200) NOT NULL,
                category VARCHAR(50),
                quantity INTEGER DEFAULT 0,
                minimum_stock INTEGER DEFAULT 10,
                unit_price DECIMAL(10,2),
                last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Staff Schedules table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS staff_schedules (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES users(id),
                shift_date DATE NOT NULL,
                shift_start TIME NOT NULL,
                shift_end TIME NOT NULL,
                department VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Beds table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS beds (
                id SERIAL PRIMARY KEY,
                ward_id INTEGER NOT NULL,
                ward_name VARCHAR(100),
                bed_number VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'available',
                patient_id INTEGER REFERENCES patients(id),
                UNIQUE(ward_id, bed_number)
            )
        `);
        
        // Audit Logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ NOT NULL,
                action VARCHAR(100) NOT NULL,
                user_id INTEGER,
                details JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create default admin user
        const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        if (adminCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin@HMS2024', 10);
            await pool.query(`
                INSERT INTO users (username, email, password_hash, role, full_name)
                VALUES ($1, $2, $3, $4, $5)
            `, ['admin', 'admin@hms.local', hashedPassword, 'admin', 'System Administrator']);
        }
        
        // Add sample data if tables are empty
        const patientsCount = await pool.query('SELECT COUNT(*) FROM patients');
        if (patientsCount.rows[0].count == 0) {
            await addSampleData();
        }
        
        console.log('Database setup completed');
    } catch (error) {
        console.error('Database setup error:', error);
    }
}

// Add Sample Data
async function addSampleData() {
    try {
        // Add sample patients
        await pool.query(`
            INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, gender, phone, email)
            VALUES 
                ('P001', 'John', 'Doe', '1980-05-15', 'Male', '08012345678', 'john@example.com'),
                ('P002', 'Jane', 'Smith', '1992-08-20', 'Female', '08023456789', 'jane@example.com'),
                ('P003', 'Bob', 'Johnson', '1975-03-10', 'Male', '08034567890', 'bob@example.com')
        `);
        
        // Add sample inventory
        await pool.query(`
            INSERT INTO inventory (item_name, category, quantity, minimum_stock, unit_price)
            VALUES 
                ('Paracetamol 500mg', 'medication', 500, 100, 50.00),
                ('Amoxicillin 250mg', 'medication', 200, 50, 150.00),
                ('Surgical Gloves', 'consumable', 1000, 200, 25.00),
                ('Syringes 5ml', 'consumable', 500, 100, 15.00),
                ('Blood Pressure Monitor', 'equipment', 10, 2, 15000.00)
        `);
        
        // Add sample beds
        await pool.query(`
            INSERT INTO beds (ward_id, ward_name, bed_number, status)
            VALUES 
                (1, 'General Ward', 'GW-01', 'available'),
                (1, 'General Ward', 'GW-02', 'available'),
                (1, 'General Ward', 'GW-03', 'occupied'),
                (2, 'ICU', 'ICU-01', 'available'),
                (2, 'ICU', 'ICU-02', 'occupied'),
                (3, 'Pediatric', 'PED-01', 'available')
        `);
        
        console.log('Sample data added');
    } catch (error) {
        console.error('Sample data error:', error);
    }
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// ============= API ENDPOINTS =============

// Authentication Endpoints
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        await auditLog('LOGIN', user.id, { username });
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                fullName: user.full_name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role, fullName } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(`
            INSERT INTO users (username, email, password_hash, role, full_name)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, username, email, role, full_name
        `, [username, email, hashedPassword, role || 'staff', fullName]);
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Medical Records Endpoints
app.post('/api/medical-records', authenticateToken, async (req, res) => {
    try {
        const { patientId, recordType, chiefComplaint, diagnosis, treatment, prescriptions } = req.body;
        
        // First check if patient exists
        const patientCheck = await pool.query('SELECT id FROM patients WHERE patient_id = $1', [patientId]);
        if (patientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        const result = await pool.query(`
            INSERT INTO medical_records 
            (patient_id, record_type, chief_complaint, diagnosis, treatment, prescriptions, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [patientCheck.rows[0].id, recordType, chiefComplaint, diagnosis, treatment, 
            JSON.stringify(prescriptions), req.user.id]);
        
        await auditLog('MEDICAL_RECORD_CREATED', req.user.id, { patientId, recordId: result.rows[0].id });
        
        res.json({ success: true, recordId: result.rows[0].id });
    } catch (error) {
        console.error('Medical record error:', error);
        res.status(500).json({ error: 'Failed to create medical record' });
    }
});

app.get('/api/medical-records/:patientId', authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        
        const result = await pool.query(`
            SELECT mr.*, u.full_name as created_by_name
            FROM medical_records mr
            JOIN patients p ON mr.patient_id = p.id
            LEFT JOIN users u ON mr.created_by = u.id
            WHERE p.patient_id = $1
            ORDER BY mr.created_at DESC
        `, [patientId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch records error:', error);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// Billing Endpoints
app.post('/api/billing/invoices', authenticateToken, async (req, res) => {
    try {
        const { patientId, items, totalAmount, paymentMethod } = req.body;
        
        // Check patient exists
        const patientCheck = await pool.query('SELECT id FROM patients WHERE patient_id = $1', [patientId]);
        if (patientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        const invoiceNumber = 'INV-' + Date.now();
        
        const result = await pool.query(`
            INSERT INTO billing (invoice_number, patient_id, items, total_amount, payment_method, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, invoice_number
        `, [invoiceNumber, patientCheck.rows[0].id, JSON.stringify(items), totalAmount, paymentMethod, req.user.id]);
        
        await auditLog('INVOICE_CREATED', req.user.id, { invoiceNumber, amount: totalAmount });
        
        res.json({ success: true, invoice: result.rows[0] });
    } catch (error) {
        console.error('Billing error:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

app.get('/api/billing/invoices', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, p.patient_id, p.first_name, p.last_name
            FROM billing b
            JOIN patients p ON b.patient_id = p.id
            ORDER BY b.created_at DESC
            LIMIT 50
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Inventory Endpoints
app.post('/api/inventory/stock', authenticateToken, async (req, res) => {
    try {
        const { itemName, category, quantity, minimumStock, unitPrice } = req.body;
        
        const result = await pool.query(`
            INSERT INTO inventory (item_name, category, quantity, minimum_stock, unit_price)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [itemName, category, quantity, minimumStock, unitPrice]);
        
        await auditLog('INVENTORY_ADDED', req.user.id, { itemName, quantity });
        
        res.json({ success: true, itemId: result.rows[0].id });
    } catch (error) {
        console.error('Inventory error:', error);
        res.status(500).json({ error: 'Failed to add inventory' });
    }
});

app.get('/api/inventory/low-stock', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM inventory 
            WHERE quantity <= minimum_stock
            ORDER BY (quantity::float / NULLIF(minimum_stock, 0)) ASC
        `);
        
        // Broadcast alert if items are low
        if (result.rows.length > 0) {
            broadcast({
                type: 'LOW_STOCK_ALERT',
                items: result.rows,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json(result.rows);
    } catch (error) {
        console.error('Low stock error:', error);
        res.status(500).json({ error: 'Failed to check stock' });
    }
});

app.get('/api/inventory', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory ORDER BY item_name');
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// Staff Management Endpoints
app.post('/api/staff/schedule', authenticateToken, async (req, res) => {
    try {
        const { staffId, shiftDate, shiftStart, shiftEnd, department } = req.body;
        
        const result = await pool.query(`
            INSERT INTO staff_schedules (staff_id, shift_date, shift_start, shift_end, department)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [staffId, shiftDate, shiftStart, shiftEnd, department]);
        
        await auditLog('SCHEDULE_CREATED', req.user.id, { scheduleId: result.rows[0].id });
        
        res.json({ success: true, scheduleId: result.rows[0].id });
    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

app.get('/api/staff/roster/:date', authenticateToken, async (req, res) => {
    try {
        const { date } = req.params;
        
        const result = await pool.query(`
            SELECT ss.*, u.full_name, u.role
            FROM staff_schedules ss
            JOIN users u ON ss.staff_id = u.id
            WHERE ss.shift_date = $1
            ORDER BY ss.department, ss.shift_start
        `, [date]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Roster error:', error);
        res.status(500).json({ error: 'Failed to fetch roster' });
    }
});

// Bed Management Endpoints
app.post('/api/beds/admission', authenticateToken, async (req, res) => {
    try {
        const { patientId, wardId, bedNumber, admissionReason } = req.body;
        
        // Check patient
        const patientCheck = await pool.query('SELECT id FROM patients WHERE patient_id = $1', [patientId]);
        if (patientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        // Update bed status
        await pool.query(
            'UPDATE beds SET status = $1, patient_id = $2 WHERE ward_id = $3 AND bed_number = $4',
            ['occupied', patientCheck.rows[0].id, wardId, bedNumber]
        );
        
        await auditLog('ADMISSION_CREATED', req.user.id, { patientId, wardId, bedNumber });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Admission error:', error);
        res.status(500).json({ error: 'Failed to create admission' });
    }
});

app.get('/api/beds/available', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM beds 
            WHERE status = 'available'
            ORDER BY ward_id, bed_number
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Available beds error:', error);
        res.status(500).json({ error: 'Failed to fetch beds' });
    }
});

app.post('/api/beds/discharge', authenticateToken, async (req, res) => {
    try {
        const { bedId } = req.body;
        
        await pool.query(
            'UPDATE beds SET status = $1, patient_id = NULL WHERE id = $2',
            ['available', bedId]
        );
        
        await auditLog('DISCHARGE_PROCESSED', req.user.id, { bedId });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Discharge error:', error);
        res.status(500).json({ error: 'Failed to process discharge' });
    }
});

// Analytics Dashboard
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        const stats = {};
        
        // Patient statistics
        const patientStats = await pool.query(`
            SELECT 
                COUNT(*) as total_patients,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_patients
            FROM patients
        `);
        stats.patients = patientStats.rows[0];
        
        // Revenue statistics
        const revenueStats = await pool.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN total_amount END), 0) as monthly_revenue,
                COUNT(*) as total_invoices
            FROM billing
            WHERE status = 'paid'
        `);
        stats.revenue = revenueStats.rows[0];
        
        // Bed statistics
        const bedStats = await pool.query(`
            SELECT 
                COUNT(*) as total_beds,
                COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_beds
            FROM beds
        `);
        stats.beds = bedStats.rows[0];
        stats.beds.occupancy_rate = stats.beds.total_beds > 0 
            ? ((stats.beds.occupied_beds / stats.beds.total_beds) * 100).toFixed(2) + '%'
            : '0%';
        
        // Staff on duty today
        const staffStats = await pool.query(`
            SELECT COUNT(DISTINCT staff_id) as on_duty_today
            FROM staff_schedules
            WHERE shift_date = CURRENT_DATE
        `);
        stats.staff = staffStats.rows[0];
        
        res.json(stats);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Patient Management
app.post('/api/patients', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, dateOfBirth, gender, phone, email, address } = req.body;
        
        const patientId = 'P' + Date.now().toString().slice(-6);
        
        const result = await pool.query(`
            INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, gender, phone, email, address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [patientId, firstName, lastName, dateOfBirth, gender, phone, email, address]);
        
        await auditLog('PATIENT_REGISTERED', req.user.id, { patientId });
        
        res.json({ success: true, patient: result.rows[0] });
    } catch (error) {
        console.error('Patient registration error:', error);
        res.status(500).json({ error: 'Failed to register patient' });
    }
});

app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM patients ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch patients error:', error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'HMS-Integrated',
        timestamp: new Date().toISOString(),
        features: {
            authentication: true,
            medical_records: true,
            billing: true,
            inventory: true,
            staff_management: true,
            bed_management: true,
            analytics: true,
            audit_logging: true
        }
    });
});

// WebSocket broadcast function
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile('/root/hospital-management-system/hms-frontend.html');
});

// Initialize server
async function initialize() {
    try {
        await createAuditDir();
        await setupDatabase();
        
        const PORT = process.env.PORT || 5801;
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`\n========================================`);
            console.log(`HMS Integrated System Started`);
            console.log(`========================================`);
            console.log(`Backend API: http://localhost:${PORT}`);
            console.log(`Frontend: http://localhost:${PORT}`);
            console.log(`WebSocket: ws://localhost:${PORT}`);
            console.log(`\nDefault Login: admin / admin@HMS2024`);
            console.log(`\nFeatures Enabled:`);
            console.log(`✓ JWT Authentication`);
            console.log(`✓ Medical Records Management`);
            console.log(`✓ Billing & Invoicing`);
            console.log(`✓ Inventory Management`);
            console.log(`✓ Staff Scheduling`);
            console.log(`✓ Bed Management`);
            console.log(`✓ Analytics Dashboard`);
            console.log(`✓ Audit Logging`);
            console.log(`✓ Real-time Updates (WebSocket)`);
            console.log(`========================================\n`);
        });
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        pool.end(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});

initialize();
