const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database configuration - using Neon
const dbConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'hms-secret-key-2024';

// WebSocket connections
const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('New WebSocket connection');
    
    ws.on('close', () => {
        wsClients.delete(ws);
    });
});

// Broadcast function
function broadcast(data) {
    const message = JSON.stringify(data);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Database helper
async function getDb() {
    const client = new Client(dbConfig);
    await client.connect();
    return client;
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
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
};

// Initialize database tables if they don't exist
async function initializeDatabase() {
    const client = await getDb();
    try {
        // Create HMS schema if not exists
        await client.query(`CREATE SCHEMA IF NOT EXISTS hms`);
        
        // Fix patients table
        await client.query(`
            ALTER TABLE hms.patients 
            ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20),
            ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(100),
            ADD COLUMN IF NOT EXISTS insurance_number VARCHAR(50)
        `);
        
        // Fix medical_records table
        await client.query(`
            ALTER TABLE hms.medical_records 
            ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
            ADD COLUMN IF NOT EXISTS vital_signs JSONB,
            ADD COLUMN IF NOT EXISTS follow_up_date DATE
        `);
        
        // Fix inventory table (rename inventory_items to inventory if needed)
        await client.query(`
            CREATE TABLE IF NOT EXISTS hms.inventory (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                category VARCHAR(50),
                quantity INTEGER DEFAULT 0,
                unit VARCHAR(20),
                min_stock INTEGER DEFAULT 10,
                price DECIMAL(10,2),
                expiry_date DATE,
                supplier VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create appointments table with proper structure
        await client.query(`
            CREATE TABLE IF NOT EXISTS hms.appointments (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES hms.patients(id),
                doctor_id INTEGER REFERENCES hms.staff(id),
                appointment_date TIMESTAMP,
                type VARCHAR(50) DEFAULT 'General',
                status VARCHAR(20) DEFAULT 'scheduled',
                reason TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Fix lab_results table
        await client.query(`
            ALTER TABLE hms.lab_results 
            ADD COLUMN IF NOT EXISTS technician VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ordered_by INTEGER,
            ADD COLUMN IF NOT EXISTS test_type VARCHAR(50)
        `);
        
        // Create billing tables if not exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS hms.billing (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES hms.patients(id),
                total_amount DECIMAL(10,2),
                paid_amount DECIMAL(10,2) DEFAULT 0,
                payment_status VARCHAR(20) DEFAULT 'pending',
                payment_method VARCHAR(50),
                insurance_claim_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Database schema updated successfully');
    } catch (error) {
        console.error('Error updating database schema:', error.message);
    } finally {
        await client.end();
    }
}

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'HMS Backend',
        timestamp: new Date().toISOString(),
        modules: {
            authentication: 'active',
            patients: 'active',
            medical_records: 'active',
            billing: 'active',
            inventory: 'active',
            staff: 'active',
            beds: 'active',
            analytics: 'active',
            prescriptions: 'active',
            appointments: 'active',
            lab_results: 'active',
            websocket: 'active'
        }
    });
});

// ============= AUTHENTICATION =============
app.post('/api/auth/register', async (req, res) => {
    const client = await getDb();
    try {
        const { username, password, email, role = 'staff' } = req.body;
        
        // Check if user exists
        const existingUser = await client.query(
            'SELECT id FROM hms.users WHERE username = $1 OR email = $2',
            [username, email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await client.query(
            'INSERT INTO hms.users (username, password, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
            [username, hashedPassword, email, role]
        );
        
        const token = jwt.sign({ id: result.rows[0].id, username, role }, JWT_SECRET);
        
        res.json({
            message: 'User created successfully',
            user: result.rows[0],
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/auth/login', async (req, res) => {
    const client = await getDb();
    try {
        const { username, password } = req.body;
        
        // Get user
        const result = await client.query(
            'SELECT id, username, password, email, role FROM hms.users WHERE username = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            // Create default admin user if no users exist
            if (username === 'admin') {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                const newUser = await client.query(
                    'INSERT INTO hms.users (username, password, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
                    ['admin', hashedPassword, 'admin@hms.com', 'admin']
                );
                
                const token = jwt.sign({ 
                    id: newUser.rows[0].id, 
                    username: newUser.rows[0].username, 
                    role: newUser.rows[0].role 
                }, JWT_SECRET);
                
                return res.json({
                    message: 'Login successful',
                    user: newUser.rows[0],
                    token
                });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
        
        res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username, email: user.email, role: user.role },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= PATIENTS =============
app.get('/api/patients', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query('SELECT * FROM hms.patients ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { name, dob, gender, contact, email, address, emergency_phone, insurance_provider, insurance_number } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.patients (name, date_of_birth, gender, contact_number, email, address, emergency_phone, insurance_provider, insurance_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, dob, gender, contact, email, address, emergency_phone || contact, insurance_provider || '', insurance_number || '']
        );
        
        broadcast({ type: 'patient_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query('SELECT * FROM hms.patients WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= MEDICAL RECORDS =============
app.get('/api/medical-records', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT mr.*, p.name as patient_name 
            FROM hms.medical_records mr
            LEFT JOIN hms.patients p ON mr.patient_id = p.id
            ORDER BY mr.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/medical-records', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { patient_id, diagnosis, symptoms, treatment, notes, visit_date, chief_complaint, vital_signs } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.medical_records (patient_id, diagnosis, symptoms, treatment, notes, visit_date, chief_complaint, vital_signs, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [patient_id, diagnosis, symptoms, treatment, notes, visit_date || new Date(), chief_complaint || symptoms, vital_signs || {}, req.user.id]
        );
        
        broadcast({ type: 'medical_record_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= BILLING =============
app.get('/api/billing/invoices', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT i.*, p.name as patient_name 
            FROM hms.invoices i
            LEFT JOIN hms.patients p ON i.patient_id = p.id
            ORDER BY i.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/billing/invoices', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { patient_id, total_amount, items, payment_method } = req.body;
        
        // Create invoice
        const invoiceResult = await client.query(
            `INSERT INTO hms.invoices (patient_id, total_amount, status, created_by) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [patient_id, total_amount, 'pending', req.user.id]
        );
        
        const invoice = invoiceResult.rows[0];
        
        // Add invoice items
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO hms.invoice_items (invoice_id, description, amount, quantity) 
                     VALUES ($1, $2, $3, $4)`,
                    [invoice.id, item.description, item.amount, item.quantity || 1]
                );
            }
        }
        
        // Also create a billing record
        await client.query(
            `INSERT INTO hms.billing (patient_id, total_amount, payment_method) 
             VALUES ($1, $2, $3)`,
            [patient_id, total_amount, payment_method || 'cash']
        );
        
        broadcast({ type: 'invoice_created', data: invoice });
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/billing/revenue/stats', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT 
                COUNT(*) as total_invoices,
                SUM(total_amount) as total_revenue,
                SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
                SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue
            FROM hms.invoices
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= INVENTORY =============
app.get('/api/inventory', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        // Try both tables
        let result;
        try {
            result = await client.query('SELECT * FROM hms.inventory ORDER BY name');
        } catch (e) {
            // Fallback to inventory_items
            result = await client.query(`
                SELECT 
                    id,
                    item_name as name,
                    category,
                    current_stock as quantity,
                    unit,
                    minimum_stock as min_stock,
                    unit_price as price,
                    expiry_date,
                    supplier_id as supplier,
                    created_at,
                    updated_at
                FROM hms.inventory_items 
                ORDER BY item_name
            `);
        }
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { name, category, quantity, unit, min_stock, price } = req.body;
        
        // Try to insert into inventory table first
        let result;
        try {
            result = await client.query(
                `INSERT INTO hms.inventory (name, category, quantity, unit, min_stock, price) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [name, category, quantity, unit, min_stock, price]
            );
        } catch (e) {
            // Fallback to inventory_items
            result = await client.query(
                `INSERT INTO hms.inventory_items (item_name, category, current_stock, unit, minimum_stock, unit_price) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING 
                 id, item_name as name, category, current_stock as quantity, unit, minimum_stock as min_stock, unit_price as price`,
                [name, category || 'medication', quantity, unit, min_stock || 10, price]
            );
        }
        
        broadcast({ type: 'inventory_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/inventory/low-stock', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        let result;
        try {
            result = await client.query(
                'SELECT * FROM hms.inventory WHERE quantity < min_stock ORDER BY quantity'
            );
        } catch (e) {
            // Fallback to inventory_items
            result = await client.query(`
                SELECT 
                    id,
                    item_name as name,
                    category,
                    current_stock as quantity,
                    unit,
                    minimum_stock as min_stock,
                    unit_price as price
                FROM hms.inventory_items 
                WHERE current_stock < minimum_stock 
                ORDER BY current_stock
            `);
        }
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= STAFF =============
app.get('/api/staff', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query('SELECT * FROM hms.staff ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { name, role, department, email, phone, specialization, license_number } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.staff (name, role, department, email, contact_number, specialization, license_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, role, department, email, phone, specialization || '', license_number || '']
        );
        
        broadcast({ type: 'staff_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/staff/schedules', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT s.*, st.name as staff_name 
            FROM hms.schedules s
            LEFT JOIN hms.staff st ON s.staff_id = st.id
            WHERE s.date >= CURRENT_DATE
            ORDER BY s.date, s.shift
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= BEDS =============
app.get('/api/beds', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT b.*, w.name as ward_name 
            FROM hms.beds b
            LEFT JOIN hms.wards w ON b.ward_id = w.id
            ORDER BY w.name, b.bed_number
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/beds', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { ward, bed_number, status } = req.body;
        
        // Get or create ward
        let wardResult = await client.query('SELECT id FROM hms.wards WHERE name = $1', [ward]);
        let ward_id;
        
        if (wardResult.rows.length === 0) {
            const newWard = await client.query(
                'INSERT INTO hms.wards (name, capacity) VALUES ($1, $2) RETURNING id',
                [ward, 20]
            );
            ward_id = newWard.rows[0].id;
        } else {
            ward_id = wardResult.rows[0].id;
        }
        
        const result = await client.query(
            'INSERT INTO hms.beds (ward_id, bed_number, status) VALUES ($1, $2, $3) RETURNING *',
            [ward_id, bed_number, status || 'available']
        );
        
        broadcast({ type: 'bed_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/beds/available', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT b.*, w.name as ward_name 
            FROM hms.beds b
            LEFT JOIN hms.wards w ON b.ward_id = w.id
            WHERE b.status = 'available'
            ORDER BY w.name, b.bed_number
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= ANALYTICS =============
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        // Get various stats
        const patientsCount = await client.query('SELECT COUNT(*) as count FROM hms.patients');
        const staffCount = await client.query('SELECT COUNT(*) as count FROM hms.staff');
        const bedsCount = await client.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'available\' THEN 1 END) as available FROM hms.beds');
        const revenue = await client.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_revenue
            FROM hms.invoices
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);
        
        res.json({
            patients: parseInt(patientsCount.rows[0].count),
            staff: parseInt(staffCount.rows[0].count),
            beds: {
                total: parseInt(bedsCount.rows[0].total),
                available: parseInt(bedsCount.rows[0].available),
                occupied: parseInt(bedsCount.rows[0].total) - parseInt(bedsCount.rows[0].available)
            },
            revenue: {
                total: parseFloat(revenue.rows[0].total_revenue),
                paid: parseFloat(revenue.rows[0].paid_revenue)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/analytics/occupancy', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as admissions
            FROM hms.admissions
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date
        `);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= APPOINTMENTS =============
app.get('/api/appointments', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT a.*, 
                   p.name as patient_name, 
                   s.name as doctor_name 
            FROM hms.appointments a
            LEFT JOIN hms.patients p ON a.patient_id = p.id
            LEFT JOIN hms.staff s ON a.doctor_id = s.id
            WHERE a.appointment_date >= NOW() - INTERVAL '7 days'
            ORDER BY a.appointment_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { patient_id, doctor_id, appointment_date, reason, type, notes } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.appointments (patient_id, doctor_id, appointment_date, reason, type, notes) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [patient_id, doctor_id, appointment_date, reason, type || 'General', notes || '']
        );
        
        broadcast({ type: 'appointment_created', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= PRESCRIPTIONS =============
app.get('/api/prescriptions', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT pr.*, 
                   p.name as patient_name,
                   s.name as doctor_name
            FROM hms.prescriptions pr
            LEFT JOIN hms.patients p ON pr.patient_id = p.id
            LEFT JOIN hms.staff s ON pr.doctor_id = s.id
            ORDER BY pr.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/prescriptions', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { patient_id, doctor_id, medications, notes } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.prescriptions (patient_id, doctor_id, medications, notes) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [patient_id, doctor_id || req.user.id, JSON.stringify(medications), notes || '']
        );
        
        broadcast({ type: 'prescription_created', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= LAB RESULTS =============
app.get('/api/lab-results', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT lr.*, 
                   p.name as patient_name
            FROM hms.lab_results lr
            LEFT JOIN hms.patients p ON lr.patient_id = p.id
            ORDER BY lr.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/lab-results', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { patient_id, test_name, results, status, technician } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.lab_results (patient_id, test_name, results, status, technician, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [patient_id, test_name, JSON.stringify(results), status || 'pending', technician || req.user.username, req.user.id]
        );
        
        broadcast({ type: 'lab_result_created', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Static file serving
app.use('/uploads', express.static('uploads'));

// Initialize and start server
async function startServer() {
    await initializeDatabase();
    
    const PORT = process.env.PORT || 5801;
    server.listen(PORT, () => {
        console.log(`HMS Backend running on port ${PORT}`);
        console.log(`WebSocket server ready`);
        console.log(`API endpoints available at http://localhost:${PORT}/api`);
    });
}

startServer().catch(console.error);

module.exports = app;
