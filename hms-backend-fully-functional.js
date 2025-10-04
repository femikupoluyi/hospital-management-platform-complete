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

// Database configuration
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

// Optional authentication middleware (for endpoints that can work with or without auth)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
};

// Initialize database tables
async function initializeDatabase() {
    const client = await getDb();
    try {
        // Check if users table exists with correct schema
        const tableCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        
        if (tableCheck.rows.length === 0) {
            // Create new users table if it doesn't exist
            await client.query(`
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    name VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'STAFF',
                    department VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }

        // Patients table
        await client.query(`
            CREATE TABLE IF NOT EXISTS patients (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                date_of_birth DATE,
                gender VARCHAR(20),
                phone VARCHAR(20),
                email VARCHAR(255),
                address TEXT,
                emergency_contact VARCHAR(255),
                emergency_phone VARCHAR(20),
                blood_group VARCHAR(10),
                allergies TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Medical records table
        await client.query(`
            CREATE TABLE IF NOT EXISTS medical_records (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                chief_complaint TEXT,
                diagnosis TEXT,
                treatment TEXT,
                prescription TEXT,
                lab_results TEXT,
                doctor_name VARCHAR(255),
                doctor_id UUID REFERENCES users(id),
                follow_up_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Invoices table
        await client.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                invoice_number VARCHAR(50) UNIQUE,
                items JSONB,
                total_amount DECIMAL(10,2),
                payment_method VARCHAR(50),
                payment_status VARCHAR(50) DEFAULT 'pending',
                insurance_claim VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP,
                due_date DATE
            )
        `);

        // Payments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER REFERENCES invoices(id),
                amount DECIMAL(10,2),
                payment_method VARCHAR(50),
                transaction_id VARCHAR(100),
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'completed',
                notes TEXT
            )
        `);

        // Inventory table
        await client.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                quantity INTEGER DEFAULT 0,
                unit VARCHAR(50),
                reorder_level INTEGER DEFAULT 10,
                price DECIMAL(10,2),
                supplier VARCHAR(255),
                expiry_date DATE,
                batch_number VARCHAR(100),
                location VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Stock movements table
        await client.query(`
            CREATE TABLE IF NOT EXISTS stock_movements (
                id SERIAL PRIMARY KEY,
                inventory_id INTEGER REFERENCES inventory(id),
                movement_type VARCHAR(50), -- 'in' or 'out'
                quantity INTEGER,
                reason VARCHAR(255),
                reference_number VARCHAR(100),
                performed_by UUID REFERENCES users(id),
                movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Staff table
        await client.query(`
            CREATE TABLE IF NOT EXISTS staff (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                employee_id VARCHAR(50) UNIQUE,
                department VARCHAR(100),
                position VARCHAR(100),
                specialization VARCHAR(100),
                license_number VARCHAR(100),
                phone VARCHAR(20),
                address TEXT,
                hire_date DATE,
                status VARCHAR(50) DEFAULT 'active'
            )
        `);

        // Schedules table
        await client.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES staff(id),
                staff_name VARCHAR(255),
                department VARCHAR(100),
                shift_start TIMESTAMP,
                shift_end TIMESTAMP,
                status VARCHAR(50) DEFAULT 'scheduled',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Wards table
        await client.query(`
            CREATE TABLE IF NOT EXISTS wards (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50),
                capacity INTEGER,
                floor VARCHAR(20),
                status VARCHAR(50) DEFAULT 'active'
            )
        `);

        // Beds table
        await client.query(`
            CREATE TABLE IF NOT EXISTS beds (
                id SERIAL PRIMARY KEY,
                ward_id INTEGER REFERENCES wards(id),
                bed_number VARCHAR(20) NOT NULL,
                status VARCHAR(50) DEFAULT 'available',
                patient_id INTEGER REFERENCES patients(id),
                last_cleaned TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Admissions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS admissions (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                ward_id INTEGER REFERENCES wards(id),
                bed_id INTEGER REFERENCES beds(id),
                admission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                discharge_date TIMESTAMP,
                diagnosis TEXT,
                admitting_doctor VARCHAR(255),
                attending_doctor VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                notes TEXT
            )
        `);

        // Appointments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                doctor_id UUID REFERENCES users(id),
                appointment_date TIMESTAMP,
                duration INTEGER DEFAULT 30,
                type VARCHAR(100),
                status VARCHAR(50) DEFAULT 'scheduled',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Lab results table
        await client.query(`
            CREATE TABLE IF NOT EXISTS lab_results (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                test_name VARCHAR(255),
                test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                results TEXT,
                normal_range VARCHAR(100),
                status VARCHAR(50),
                technician VARCHAR(255),
                doctor_id UUID REFERENCES users(id),
                notes TEXT
            )
        `);

        // Prescriptions table  
        await client.query(`
            CREATE TABLE IF NOT EXISTS prescriptions (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES patients(id),
                doctor_id UUID REFERENCES users(id),
                medication VARCHAR(255),
                dosage VARCHAR(100),
                frequency VARCHAR(100),
                duration VARCHAR(100),
                instructions TEXT,
                prescribed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'active'
            )
        `);

        // Insert or update default admin user
        const userCheck = await client.query('SELECT * FROM users WHERE email = $1', ['admin@hospital.com']);
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        if (userCheck.rows.length === 0) {
            await client.query(
                'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
                ['admin@hospital.com', hashedPassword, 'Admin User', 'ADMIN']
            );
        } else {
            // Update password if user exists
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE email = $2',
                [hashedPassword, 'admin@hospital.com']
            );
        }

        // Insert sample wards if none exist
        const wardCheck = await client.query('SELECT COUNT(*) FROM wards');
        if (wardCheck.rows[0].count === '0') {
            await client.query(`
                INSERT INTO wards (name, type, capacity, floor) VALUES
                ('General Ward A', 'General', 20, 'Ground'),
                ('ICU', 'Intensive Care', 10, 'First'),
                ('Pediatric Ward', 'Pediatric', 15, 'Second'),
                ('Maternity Ward', 'Maternity', 12, 'Second'),
                ('Emergency Ward', 'Emergency', 8, 'Ground')
            `);

            // Add beds for each ward
            const wards = await client.query('SELECT id, capacity FROM wards');
            for (const ward of wards.rows) {
                for (let i = 1; i <= ward.capacity; i++) {
                    await client.query(
                        'INSERT INTO beds (ward_id, bed_number) VALUES ($1, $2)',
                        [ward.id, `${ward.id}-${i.toString().padStart(2, '0')}`]
                    );
                }
            }
        }

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        await client.end();
    }
}

// ============= AUTH ENDPOINTS =============

app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, role, department } = req.body;
    const client = await getDb();
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await client.query(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
            [email, hashedPassword, name, role || 'STAFF']
        );
        
        const token = jwt.sign(
            { id: result.rows[0].id, email, role: result.rows[0].role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ success: true, token, user: result.rows[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const client = await getDb();
    
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= PATIENT ENDPOINTS =============

app.get('/api/patients', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query('SELECT * FROM patients ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/patients/:id', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
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

app.post('/api/patients', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { firstName, lastName, dateOfBirth, gender, phone, email, address, emergencyContact, emergencyPhone, bloodGroup, allergies } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, emergency_phone, blood_group, allergies)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [firstName, lastName, dateOfBirth, gender, phone, email, address, emergencyContact, emergencyPhone, bloodGroup, allergies]
        );
        
        broadcast({ type: 'patient_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
    const client = await getDb();
    const { firstName, lastName, dateOfBirth, gender, phone, email, address, emergencyContact, emergencyPhone, bloodGroup, allergies } = req.body;
    
    try {
        const result = await client.query(
            `UPDATE patients SET first_name=$1, last_name=$2, date_of_birth=$3, gender=$4, phone=$5, 
             email=$6, address=$7, emergency_contact=$8, emergency_phone=$9, blood_group=$10, 
             allergies=$11, updated_at=CURRENT_TIMESTAMP WHERE id=$12 RETURNING *`,
            [firstName, lastName, dateOfBirth, gender, phone, email, address, emergencyContact, emergencyPhone, bloodGroup, allergies, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        broadcast({ type: 'patient_updated', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= MEDICAL RECORDS ENDPOINTS =============

app.get('/api/medical-records', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const { patientId } = req.query;
        let query = 'SELECT * FROM medical_records';
        let params = [];
        
        if (patientId) {
            query += ' WHERE patient_id = $1';
            params = [patientId];
        }
        
        query += ' ORDER BY visit_date DESC';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/medical-records', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { patientId, chiefComplaint, diagnosis, treatment, prescription, labResults, doctorName, doctorId, followUpDate, notes } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO medical_records (patient_id, chief_complaint, diagnosis, treatment, prescription, 
             lab_results, doctor_name, doctor_id, follow_up_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [patientId, chiefComplaint, diagnosis, treatment, prescription, labResults, doctorName, doctorId || req.user?.id, followUpDate, notes]
        );
        
        broadcast({ type: 'medical_record_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= BILLING & INVOICE ENDPOINTS =============

app.get('/api/invoices', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT i.*, p.first_name, p.last_name 
            FROM invoices i
            LEFT JOIN patients p ON i.patient_id = p.id
            ORDER BY i.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/invoices', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { patientId, items, paymentMethod, status, insuranceClaim, dueDate } = req.body;
    
    try {
        // Calculate total
        const totalAmount = items.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
        
        // Generate invoice number
        const invoiceNumber = 'INV-' + Date.now();
        
        const result = await client.query(
            `INSERT INTO invoices (patient_id, invoice_number, items, total_amount, payment_method, 
             payment_status, insurance_claim, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [patientId, invoiceNumber, JSON.stringify(items), totalAmount, paymentMethod, status || 'pending', insuranceClaim, dueDate]
        );
        
        broadcast({ type: 'invoice_created', data: result.rows[0] });
        res.json({ ...result.rows[0], totalAmount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/payments', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { invoiceId, amount, method, transactionId, notes } = req.body;
    
    try {
        // Start transaction
        await client.query('BEGIN');
        
        // Record payment
        const paymentResult = await client.query(
            `INSERT INTO payments (invoice_id, amount, payment_method, transaction_id, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [invoiceId, amount, method, transactionId, notes]
        );
        
        // Update invoice status
        await client.query(
            'UPDATE invoices SET payment_status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['paid', invoiceId]
        );
        
        await client.query('COMMIT');
        
        broadcast({ type: 'payment_processed', data: paymentResult.rows[0] });
        res.json(paymentResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= INVENTORY ENDPOINTS =============

app.get('/api/inventory', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query('SELECT * FROM inventory ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/inventory/low-stock', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(
            'SELECT * FROM inventory WHERE quantity <= reorder_level ORDER BY quantity ASC'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/inventory', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { name, category, quantity, unit, reorderLevel, price, supplier, expiryDate, batchNumber, location } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO inventory (name, category, quantity, unit, reorder_level, price, supplier, 
             expiry_date, batch_number, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [name, category, quantity, unit, reorderLevel, price, supplier, expiryDate, batchNumber, location]
        );
        
        // Record stock movement
        await client.query(
            'INSERT INTO stock_movements (inventory_id, movement_type, quantity, reason) VALUES ($1, $2, $3, $4)',
            [result.rows[0].id, 'in', quantity, 'Initial stock']
        );
        
        broadcast({ type: 'inventory_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.put('/api/inventory/:id/stock', authenticateToken, async (req, res) => {
    const client = await getDb();
    const { quantity, type, reason } = req.body;
    
    try {
        await client.query('BEGIN');
        
        // Get current stock
        const current = await client.query('SELECT quantity FROM inventory WHERE id = $1', [req.params.id]);
        if (current.rows.length === 0) {
            throw new Error('Item not found');
        }
        
        const newQuantity = type === 'in' 
            ? current.rows[0].quantity + quantity
            : current.rows[0].quantity - quantity;
        
        if (newQuantity < 0) {
            throw new Error('Insufficient stock');
        }
        
        // Update inventory
        const result = await client.query(
            'UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [newQuantity, req.params.id]
        );
        
        // Record movement
        await client.query(
            'INSERT INTO stock_movements (inventory_id, movement_type, quantity, reason, performed_by) VALUES ($1, $2, $3, $4, $5)',
            [req.params.id, type, quantity, reason, req.user.id]
        );
        
        await client.query('COMMIT');
        
        // Check if low stock alert needed
        if (result.rows[0].quantity <= result.rows[0].reorder_level) {
            broadcast({ type: 'low_stock_alert', data: result.rows[0] });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= STAFF MANAGEMENT ENDPOINTS =============

app.get('/api/staff', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT s.*, u.name, u.email, u.role 
            FROM staff s
            JOIN users u ON s.user_id = u.id
            WHERE s.status = 'active'
            ORDER BY u.name
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
    const client = await getDb();
    const { userId, employeeId, department, position, specialization, licenseNumber, phone, address, hireDate } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO staff (user_id, employee_id, department, position, specialization, 
             license_number, phone, address, hire_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [userId, employeeId, department, position, specialization, licenseNumber, phone, address, hireDate]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/schedules', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const { date, department } = req.query;
        let query = 'SELECT * FROM schedules WHERE 1=1';
        let params = [];
        
        if (date) {
            params.push(date);
            query += ` AND DATE(shift_start) = $${params.length}`;
        }
        
        if (department) {
            params.push(department);
            query += ` AND department = $${params.length}`;
        }
        
        query += ' ORDER BY shift_start DESC';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/schedules', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { staffId, staffName, department, shiftStart, shiftEnd, notes } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO schedules (staff_id, staff_name, department, shift_start, shift_end, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [staffId, staffName, department, shiftStart, shiftEnd, notes]
        );
        
        broadcast({ type: 'schedule_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= BED MANAGEMENT ENDPOINTS =============

app.get('/api/beds/available', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT b.*, w.name as ward_name, w.type as ward_type, w.floor
            FROM beds b
            JOIN wards w ON b.ward_id = w.id
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

app.get('/api/wards/occupancy', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT 
                w.id, w.name, w.type, w.capacity,
                COUNT(CASE WHEN b.status = 'occupied' THEN 1 END) as occupied,
                COUNT(CASE WHEN b.status = 'available' THEN 1 END) as available,
                ROUND(COUNT(CASE WHEN b.status = 'occupied' THEN 1 END)::numeric / w.capacity * 100, 2) as occupancy_rate
            FROM wards w
            LEFT JOIN beds b ON w.id = b.ward_id
            GROUP BY w.id, w.name, w.type, w.capacity
            ORDER BY w.name
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/admissions', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { patientId, wardId, bedId, diagnosis, admittingDoctor, attendingDoctor, notes } = req.body;
    
    try {
        await client.query('BEGIN');
        
        // Create admission
        const result = await client.query(
            `INSERT INTO admissions (patient_id, ward_id, bed_id, diagnosis, admitting_doctor, 
             attending_doctor, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [patientId, wardId, bedId, diagnosis, admittingDoctor, attendingDoctor, notes]
        );
        
        // Update bed status
        await client.query(
            'UPDATE beds SET status = $1, patient_id = $2 WHERE id = $3',
            ['occupied', patientId, bedId]
        );
        
        await client.query('COMMIT');
        
        broadcast({ type: 'admission_created', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/admissions/:id/discharge', authenticateToken, async (req, res) => {
    const client = await getDb();
    const { notes } = req.body;
    
    try {
        await client.query('BEGIN');
        
        // Get admission details
        const admission = await client.query(
            'SELECT * FROM admissions WHERE id = $1 AND status = $2',
            [req.params.id, 'active']
        );
        
        if (admission.rows.length === 0) {
            throw new Error('Active admission not found');
        }
        
        // Update admission
        const result = await client.query(
            `UPDATE admissions SET status = $1, discharge_date = CURRENT_TIMESTAMP, 
             notes = COALESCE(notes, '') || E'\\n' || $2 WHERE id = $3 RETURNING *`,
            ['discharged', notes, req.params.id]
        );
        
        // Free the bed
        await client.query(
            'UPDATE beds SET status = $1, patient_id = NULL WHERE id = $2',
            ['available', admission.rows[0].bed_id]
        );
        
        await client.query('COMMIT');
        
        broadcast({ type: 'patient_discharged', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= APPOINTMENTS ENDPOINTS =============

app.get('/api/appointments', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const { date, doctorId, patientId } = req.query;
        let query = `
            SELECT a.*, p.first_name, p.last_name, u.name as doctor_name
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN users u ON a.doctor_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (date) {
            params.push(date);
            query += ` AND DATE(a.appointment_date) = $${params.length}`;
        }
        
        if (doctorId) {
            params.push(doctorId);
            query += ` AND a.doctor_id = $${params.length}`;
        }
        
        if (patientId) {
            params.push(patientId);
            query += ` AND a.patient_id = $${params.length}`;
        }
        
        query += ' ORDER BY a.appointment_date ASC';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/appointments', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { patientId, doctorId, appointmentDate, duration, type, notes } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO appointments (patient_id, doctor_id, appointment_date, duration, type, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [patientId, doctorId, appointmentDate, duration || 30, type, notes]
        );
        
        broadcast({ type: 'appointment_scheduled', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= LAB RESULTS ENDPOINTS =============

app.get('/api/lab-results', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const { patientId } = req.query;
        let query = 'SELECT * FROM lab_results';
        let params = [];
        
        if (patientId) {
            query += ' WHERE patient_id = $1';
            params = [patientId];
        }
        
        query += ' ORDER BY test_date DESC';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/lab-results', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { patientId, testName, results, normalRange, status, technician, doctorId, notes } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO lab_results (patient_id, test_name, results, normal_range, status, 
             technician, doctor_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [patientId, testName, results, normalRange, status, technician, doctorId, notes]
        );
        
        broadcast({ type: 'lab_result_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= PRESCRIPTIONS ENDPOINTS =============

app.get('/api/prescriptions', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const { patientId } = req.query;
        let query = `
            SELECT p.*, u.name as doctor_name
            FROM prescriptions p
            LEFT JOIN users u ON p.doctor_id = u.id
        `;
        let params = [];
        
        if (patientId) {
            query += ' WHERE p.patient_id = $1';
            params = [patientId];
        }
        
        query += ' ORDER BY p.prescribed_date DESC';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.post('/api/prescriptions', optionalAuth, async (req, res) => {
    const client = await getDb();
    const { patientId, doctorId, medication, dosage, frequency, duration, instructions } = req.body;
    
    try {
        const result = await client.query(
            `INSERT INTO prescriptions (patient_id, doctor_id, medication, dosage, frequency, 
             duration, instructions)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [patientId, doctorId || req.user?.id, medication, dosage, frequency, duration, instructions]
        );
        
        broadcast({ type: 'prescription_added', data: result.rows[0] });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= ANALYTICS ENDPOINTS =============

app.get('/api/analytics/dashboard', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        // Get multiple metrics in parallel
        const [patients, revenue, admissions, appointments, inventory] = await Promise.all([
            client.query('SELECT COUNT(*) as total FROM patients'),
            client.query("SELECT SUM(total_amount) as total FROM invoices WHERE payment_status = 'paid'"),
            client.query("SELECT COUNT(*) as active FROM admissions WHERE status = 'active'"),
            client.query("SELECT COUNT(*) as upcoming FROM appointments WHERE appointment_date > NOW() AND status = 'scheduled'"),
            client.query('SELECT COUNT(*) as low_stock FROM inventory WHERE quantity <= reorder_level')
        ]);
        
        // Get occupancy rate
        const occupancy = await client.query(`
            SELECT 
                COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
                COUNT(*) as total
            FROM beds
        `);
        
        const occupancyRate = occupancy.rows[0].total > 0 
            ? Math.round((occupancy.rows[0].occupied / occupancy.rows[0].total) * 100)
            : 0;
        
        res.json({
            totalPatients: parseInt(patients.rows[0].total),
            totalRevenue: parseFloat(revenue.rows[0].total || 0),
            activeAdmissions: parseInt(admissions.rows[0].active),
            upcomingAppointments: parseInt(appointments.rows[0].upcoming),
            lowStockItems: parseInt(inventory.rows[0].low_stock),
            occupancyRate,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/analytics/occupancy-trends', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT 
                DATE(admission_date) as date,
                COUNT(*) as admissions,
                COUNT(CASE WHEN discharge_date IS NOT NULL THEN 1 END) as discharges
            FROM admissions
            WHERE admission_date >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(admission_date)
            ORDER BY date ASC
        `);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/analytics/revenue', optionalAuth, async (req, res) => {
    const client = await getDb();
    try {
        const { period = '30' } = req.query;
        
        const result = await client.query(`
            SELECT 
                DATE(created_at) as date,
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid,
                SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending,
                COUNT(*) as invoice_count
            FROM invoices
            WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        
        const total = await client.query(`
            SELECT 
                SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as total_pending
            FROM invoices
            WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'
        `);
        
        res.json({
            daily: result.rows,
            total: parseFloat(total.rows[0].total_paid || 0),
            pending: parseFloat(total.rows[0].total_pending || 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

app.get('/api/analytics/export', authenticateToken, async (req, res) => {
    const client = await getDb();
    try {
        const { type = 'summary' } = req.query;
        
        // Generate report based on type
        let data = {};
        
        if (type === 'summary' || type === 'full') {
            const [patients, revenue, inventory, admissions] = await Promise.all([
                client.query('SELECT COUNT(*) as total, COUNT(DISTINCT DATE(created_at)) as days FROM patients'),
                client.query("SELECT SUM(total_amount) as total, COUNT(*) as count FROM invoices WHERE payment_status = 'paid'"),
                client.query('SELECT COUNT(*) as total, COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low FROM inventory'),
                client.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM admissions")
            ]);
            
            data.summary = {
                patients: patients.rows[0],
                revenue: revenue.rows[0],
                inventory: inventory.rows[0],
                admissions: admissions.rows[0],
                generatedAt: new Date()
            };
        }
        
        if (type === 'detailed' || type === 'full') {
            const [recentPatients, recentInvoices, lowStock] = await Promise.all([
                client.query('SELECT * FROM patients ORDER BY created_at DESC LIMIT 10'),
                client.query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 10'),
                client.query('SELECT * FROM inventory WHERE quantity <= reorder_level')
            ]);
            
            data.detailed = {
                recentPatients: recentPatients.rows,
                recentInvoices: recentInvoices.rows,
                lowStockItems: lowStock.rows
            };
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= HEALTH CHECK =============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'HMS Backend',
        timestamp: new Date(),
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

// Start server
const PORT = process.env.PORT || 5801;

async function startServer() {
    await initializeDatabase();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🏥 HMS Backend running on port ${PORT}`);
        console.log(`📡 WebSocket server ready`);
        console.log(`🔐 Authentication enabled`);
        console.log(`✅ All modules active`);
    });
}

startServer().catch(console.error);
