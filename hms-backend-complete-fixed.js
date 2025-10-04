const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = 5801;
const JWT_SECRET = process.env.JWT_SECRET || 'hms-secret-key-2024';

// WebSocket setup
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('New WebSocket connection');
    
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
    
    ws.on('close', () => {
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/hms?channel_binding=require&sslmode=require';

const client = new Client({
    connectionString: DATABASE_URL
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// ==================== AUTHENTICATION ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await client.query(
            'SELECT * FROM hms.users WHERE username = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ==================== ELECTRONIC MEDICAL RECORDS ====================
app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM hms.patients';
        let countQuery = 'SELECT COUNT(*) FROM hms.patients';
        let params = [];
        
        if (search) {
            query += ' WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1';
            countQuery += ' WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1';
            params = [`%${search}%`];
        }
        
        query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const [patientsResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params)
        ]);
        
        res.json({
            patients: patientsResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
    try {
        const { name, date_of_birth, gender, blood_group, phone, email, address, emergency_contact } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.patients (name, date_of_birth, gender, blood_group, phone, email, address, emergency_contact, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING *`,
            [name, date_of_birth, gender, blood_group, phone, email, address, JSON.stringify(emergency_contact)]
        );
        
        broadcastUpdate('patient_created', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating patient:', error);
        res.status(500).json({ error: 'Failed to create patient' });
    }
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const result = await client.query(
            'SELECT * FROM hms.patients WHERE id = $1',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({ error: 'Failed to fetch patient' });
    }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { name, date_of_birth, gender, blood_group, phone, email, address, emergency_contact } = req.body;
        
        const result = await client.query(
            `UPDATE hms.patients 
             SET name = $2, date_of_birth = $3, gender = $4, blood_group = $5, 
                 phone = $6, email = $7, address = $8, emergency_contact = $9
             WHERE id = $1
             RETURNING *`,
            [req.params.id, name, date_of_birth, gender, blood_group, phone, email, address, JSON.stringify(emergency_contact)]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        broadcastUpdate('patient_updated', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Failed to update patient' });
    }
});

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const result = await client.query(
            'DELETE FROM hms.patients WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        broadcastUpdate('patient_deleted', { id: req.params.id });
        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

// Medical Records
app.get('/api/medical-records', authenticateToken, async (req, res) => {
    try {
        const { patient_id, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT mr.*, p.name as patient_name, d.name as doctor_name
            FROM hms.medical_records mr
            JOIN hms.patients p ON mr.patient_id = p.id
            LEFT JOIN hms.staff d ON mr.doctor_id = d.id
        `;
        
        let countQuery = 'SELECT COUNT(*) FROM hms.medical_records mr';
        let params = [];
        
        if (patient_id) {
            query += ' WHERE mr.patient_id = $1';
            countQuery += ' WHERE patient_id = $1';
            params = [patient_id];
        }
        
        query += ` ORDER BY mr.visit_date DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const [recordsResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params)
        ]);
        
        res.json({
            records: recordsResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        console.error('Error fetching medical records:', error);
        res.status(500).json({ error: 'Failed to fetch medical records' });
    }
});

app.post('/api/medical-records', authenticateToken, async (req, res) => {
    try {
        const { patient_id, doctor_id, visit_type, chief_complaint, diagnosis, treatment_plan, notes } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.medical_records (patient_id, doctor_id, visit_date, visit_type, chief_complaint, diagnosis, treatment_plan, notes)
             VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
             RETURNING *`,
            [patient_id, doctor_id, visit_type, chief_complaint, diagnosis, treatment_plan, notes]
        );
        
        broadcastUpdate('medical_record_created', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating medical record:', error);
        res.status(500).json({ error: 'Failed to create medical record' });
    }
});

// ==================== BILLING & REVENUE ====================
app.get('/api/billing/invoices', authenticateToken, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT i.*, p.name as patient_name
            FROM hms.invoices i
            JOIN hms.patients p ON i.patient_id = p.id
        `;
        
        let countQuery = 'SELECT COUNT(*) FROM hms.invoices';
        let params = [];
        
        if (status) {
            query += ' WHERE i.status = $1';
            countQuery += ' WHERE status = $1';
            params = [status];
        }
        
        query += ` ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const [invoicesResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params)
        ]);
        
        res.json({
            invoices: invoicesResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

app.post('/api/billing/invoices', authenticateToken, async (req, res) => {
    try {
        const { patient_id, items, payment_method, insurance_id } = req.body;
        
        // Calculate total
        const total = items.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
        
        const result = await client.query(
            `INSERT INTO hms.invoices (patient_id, invoice_number, items, total, payment_method, insurance_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
             RETURNING *`,
            [patient_id, `INV-${Date.now()}`, JSON.stringify(items), total, payment_method, insurance_id]
        );
        
        broadcastUpdate('invoice_created', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

app.put('/api/billing/invoices/:id/payment', authenticateToken, async (req, res) => {
    try {
        const { amount_paid, payment_date, payment_reference } = req.body;
        
        const result = await client.query(
            `UPDATE hms.invoices 
             SET status = 'paid', amount_paid = $2, payment_date = $3, payment_reference = $4
             WHERE id = $1
             RETURNING *`,
            [req.params.id, amount_paid, payment_date, payment_reference]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        broadcastUpdate('invoice_paid', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
});

app.get('/api/billing/revenue-summary', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as total_revenue,
                SUM(CASE WHEN status = 'pending' THEN total ELSE 0 END) as pending_amount,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices
            FROM hms.invoices
        `;
        
        let params = [];
        if (start_date && end_date) {
            query += ' WHERE created_at BETWEEN $1 AND $2';
            params = [start_date, end_date];
        }
        
        const result = await client.query(query, params);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching revenue summary:', error);
        res.status(500).json({ error: 'Failed to fetch revenue summary' });
    }
});

// ==================== INVENTORY MANAGEMENT ====================
app.get('/api/inventory', authenticateToken, async (req, res) => {
    try {
        const { category, low_stock, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM hms.inventory_items';
        let countQuery = 'SELECT COUNT(*) FROM hms.inventory_items';
        let conditions = [];
        let params = [];
        
        if (category) {
            conditions.push(`category = $${params.length + 1}`);
            params.push(category);
        }
        
        if (low_stock === 'true') {
            conditions.push('quantity <= reorder_level');
        }
        
        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }
        
        query += ` ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
        
        const [itemsResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params)
        ]);
        
        res.json({
            items: itemsResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
    try {
        const { name, category, quantity, unit, unit_price, reorder_level, supplier_id } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.inventory_items (name, category, quantity, unit, unit_price, reorder_level, supplier_id, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING *`,
            [name, category, quantity, unit, unit_price, reorder_level, supplier_id]
        );
        
        // Check if low stock alert needed
        if (quantity <= reorder_level) {
            broadcastUpdate('low_stock_alert', result.rows[0]);
        }
        
        broadcastUpdate('inventory_updated', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding inventory item:', error);
        res.status(500).json({ error: 'Failed to add inventory item' });
    }
});

app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
    try {
        const { quantity, action } = req.body;
        
        let updateQuery;
        if (action === 'add') {
            updateQuery = `
                UPDATE hms.inventory_items 
                SET quantity = quantity + $2, last_updated = NOW()
                WHERE id = $1
                RETURNING *
            `;
        } else if (action === 'remove') {
            updateQuery = `
                UPDATE hms.inventory_items 
                SET quantity = quantity - $2, last_updated = NOW()
                WHERE id = $1 AND quantity >= $2
                RETURNING *
            `;
        } else {
            updateQuery = `
                UPDATE hms.inventory_items 
                SET quantity = $2, last_updated = NOW()
                WHERE id = $1
                RETURNING *
            `;
        }
        
        const result = await client.query(updateQuery, [req.params.id, quantity]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Unable to update inventory' });
        }
        
        const item = result.rows[0];
        if (item.quantity <= item.reorder_level) {
            broadcastUpdate('low_stock_alert', item);
        }
        
        broadcastUpdate('inventory_updated', item);
        res.json(item);
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

app.get('/api/inventory/low-stock', authenticateToken, async (req, res) => {
    try {
        const result = await client.query(
            'SELECT * FROM hms.inventory_items WHERE quantity <= reorder_level ORDER BY (quantity::float / reorder_level::float) ASC'
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching low stock items:', error);
        res.status(500).json({ error: 'Failed to fetch low stock items' });
    }
});

// ==================== STAFF MANAGEMENT ====================
app.get('/api/staff', authenticateToken, async (req, res) => {
    try {
        const { department, role, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM hms.staff';
        let countQuery = 'SELECT COUNT(*) FROM hms.staff';
        let conditions = [];
        let params = [];
        
        if (department) {
            conditions.push(`department = $${params.length + 1}`);
            params.push(department);
        }
        
        if (role) {
            conditions.push(`role = $${params.length + 1}`);
            params.push(role);
        }
        
        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }
        
        query += ` ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
        
        const [staffResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params)
        ]);
        
        res.json({
            staff: staffResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
    try {
        const { name, role, department, email, phone, qualification, shift_timing } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.staff (name, role, department, email, phone, qualification, shift_timing, status, joined_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
             RETURNING *`,
            [name, role, department, email, phone, qualification, shift_timing]
        );
        
        broadcastUpdate('staff_added', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding staff:', error);
        res.status(500).json({ error: 'Failed to add staff' });
    }
});

app.get('/api/staff/schedules', authenticateToken, async (req, res) => {
    try {
        const { date, staff_id } = req.query;
        
        let query = `
            SELECT ss.*, s.name as staff_name, s.department
            FROM hms.staff_schedules ss
            JOIN hms.staff s ON ss.staff_id = s.id
        `;
        
        let conditions = [];
        let params = [];
        
        if (date) {
            conditions.push(`ss.schedule_date = $${params.length + 1}`);
            params.push(date);
        }
        
        if (staff_id) {
            conditions.push(`ss.staff_id = $${params.length + 1}`);
            params.push(staff_id);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY ss.schedule_date, ss.shift_start';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

app.post('/api/staff/schedules', authenticateToken, async (req, res) => {
    try {
        const { staff_id, schedule_date, shift_start, shift_end, duty_type } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.staff_schedules (staff_id, schedule_date, shift_start, shift_end, duty_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [staff_id, schedule_date, shift_start, shift_end, duty_type]
        );
        
        broadcastUpdate('schedule_added', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

// ==================== BED MANAGEMENT ====================
app.get('/api/beds', authenticateToken, async (req, res) => {
    try {
        const { ward, status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM hms.beds';
        let countQuery = 'SELECT COUNT(*) FROM hms.beds';
        let conditions = [];
        let params = [];
        
        if (ward) {
            conditions.push(`ward = $${params.length + 1}`);
            params.push(ward);
        }
        
        if (status) {
            conditions.push(`status = $${params.length + 1}`);
            params.push(status);
        }
        
        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }
        
        query += ` ORDER BY ward, bed_number LIMIT ${limit} OFFSET ${offset}`;
        
        const [bedsResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params)
        ]);
        
        res.json({
            beds: bedsResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        console.error('Error fetching beds:', error);
        res.status(500).json({ error: 'Failed to fetch beds' });
    }
});

app.post('/api/beds/admission', authenticateToken, async (req, res) => {
    try {
        const { bed_id, patient_id, admission_date, expected_discharge } = req.body;
        
        // Start transaction
        await client.query('BEGIN');
        
        // Update bed status
        const bedResult = await client.query(
            `UPDATE hms.beds 
             SET status = 'occupied', patient_id = $2, last_updated = NOW()
             WHERE id = $1 AND status = 'available'
             RETURNING *`,
            [bed_id, patient_id]
        );
        
        if (bedResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Bed not available' });
        }
        
        // Create admission record
        const admissionResult = await client.query(
            `INSERT INTO hms.admissions (patient_id, bed_id, admission_date, expected_discharge, status)
             VALUES ($1, $2, $3, $4, 'active')
             RETURNING *`,
            [patient_id, bed_id, admission_date, expected_discharge]
        );
        
        await client.query('COMMIT');
        
        broadcastUpdate('admission_created', {
            bed: bedResult.rows[0],
            admission: admissionResult.rows[0]
        });
        
        res.status(201).json({
            bed: bedResult.rows[0],
            admission: admissionResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating admission:', error);
        res.status(500).json({ error: 'Failed to create admission' });
    }
});

app.post('/api/beds/discharge', authenticateToken, async (req, res) => {
    try {
        const { bed_id, discharge_date, discharge_notes } = req.body;
        
        // Start transaction
        await client.query('BEGIN');
        
        // Get bed info
        const bedInfo = await client.query(
            'SELECT * FROM hms.beds WHERE id = $1',
            [bed_id]
        );
        
        if (bedInfo.rows.length === 0 || bedInfo.rows[0].status !== 'occupied') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid bed or bed not occupied' });
        }
        
        // Update admission record
        await client.query(
            `UPDATE hms.admissions 
             SET discharge_date = $1, discharge_notes = $2, status = 'discharged'
             WHERE bed_id = $3 AND status = 'active'`,
            [discharge_date, discharge_notes, bed_id]
        );
        
        // Update bed status
        const bedResult = await client.query(
            `UPDATE hms.beds 
             SET status = 'available', patient_id = NULL, last_updated = NOW()
             WHERE id = $1
             RETURNING *`,
            [bed_id]
        );
        
        await client.query('COMMIT');
        
        broadcastUpdate('patient_discharged', bedResult.rows[0]);
        res.json({ message: 'Patient discharged successfully', bed: bedResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing discharge:', error);
        res.status(500).json({ error: 'Failed to process discharge' });
    }
});

app.get('/api/beds/occupancy', authenticateToken, async (req, res) => {
    try {
        const result = await client.query(`
            SELECT 
                ward,
                COUNT(*) as total_beds,
                COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
                COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
                ROUND(COUNT(CASE WHEN status = 'occupied' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as occupancy_rate
            FROM hms.beds
            GROUP BY ward
            ORDER BY ward
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching occupancy:', error);
        res.status(500).json({ error: 'Failed to fetch occupancy data' });
    }
});

// ==================== ANALYTICS DASHBOARD ====================
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        const [
            patientsCount,
            todayAppointments,
            occupancyRate,
            monthlyRevenue,
            lowStockItems,
            activeStaff
        ] = await Promise.all([
            client.query('SELECT COUNT(*) FROM hms.patients'),
            client.query("SELECT COUNT(*) FROM hms.appointments WHERE appointment_date::date = CURRENT_DATE"),
            client.query("SELECT ROUND(COUNT(CASE WHEN status = 'occupied' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as rate FROM hms.beds"),
            client.query("SELECT SUM(total) FROM hms.invoices WHERE status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)"),
            client.query('SELECT COUNT(*) FROM hms.inventory_items WHERE quantity <= reorder_level'),
            client.query("SELECT COUNT(*) FROM hms.staff WHERE status = 'active'")
        ]);
        
        res.json({
            totalPatients: parseInt(patientsCount.rows[0].count),
            todayAppointments: parseInt(todayAppointments.rows[0].count),
            bedOccupancy: parseFloat(occupancyRate.rows[0].rate) || 0,
            monthlyRevenue: parseFloat(monthlyRevenue.rows[0].sum) || 0,
            lowStockAlerts: parseInt(lowStockItems.rows[0].count),
            activeStaff: parseInt(activeStaff.rows[0].count),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

app.get('/api/analytics/trends', authenticateToken, async (req, res) => {
    try {
        const { period = '7days' } = req.query;
        
        let dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
        if (period === '30days') {
            dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
        } else if (period === '90days') {
            dateFilter = "created_at >= CURRENT_DATE - INTERVAL '90 days'";
        }
        
        const [patientTrend, revenueTrend, admissionTrend] = await Promise.all([
            client.query(`
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM hms.patients
                WHERE ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `),
            client.query(`
                SELECT DATE(created_at) as date, SUM(total) as revenue
                FROM hms.invoices
                WHERE status = 'paid' AND ${dateFilter}
                GROUP BY DATE(created_at)
                ORDER BY date
            `),
            client.query(`
                SELECT DATE(admission_date) as date, COUNT(*) as count
                FROM hms.admissions
                WHERE admission_date::date >= CURRENT_DATE - INTERVAL '${period === '7days' ? '7 days' : period === '30days' ? '30 days' : '90 days'}'
                GROUP BY DATE(admission_date)
                ORDER BY date
            `)
        ]);
        
        res.json({
            patients: patientTrend.rows,
            revenue: revenueTrend.rows,
            admissions: admissionTrend.rows
        });
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({ error: 'Failed to fetch trends data' });
    }
});

app.post('/api/analytics/export', authenticateToken, async (req, res) => {
    try {
        const { type, start_date, end_date } = req.body;
        
        let data = [];
        
        if (type === 'patients') {
            const result = await client.query(
                'SELECT * FROM hms.patients WHERE created_at BETWEEN $1 AND $2',
                [start_date, end_date]
            );
            data = result.rows;
        } else if (type === 'revenue') {
            const result = await client.query(
                'SELECT * FROM hms.invoices WHERE created_at BETWEEN $1 AND $2',
                [start_date, end_date]
            );
            data = result.rows;
        } else if (type === 'inventory') {
            const result = await client.query('SELECT * FROM hms.inventory_items');
            data = result.rows;
        }
        
        res.json({
            type,
            period: { start: start_date, end: end_date },
            data,
            exported_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// ==================== APPOINTMENTS ====================
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const { date, doctor_id, patient_id, status } = req.query;
        
        let query = `
            SELECT a.*, p.name as patient_name, d.name as doctor_name
            FROM hms.appointments a
            JOIN hms.patients p ON a.patient_id = p.id
            JOIN hms.staff d ON a.doctor_id = d.id
        `;
        
        let conditions = [];
        let params = [];
        
        if (date) {
            conditions.push(`a.appointment_date::date = $${params.length + 1}`);
            params.push(date);
        }
        
        if (doctor_id) {
            conditions.push(`a.doctor_id = $${params.length + 1}`);
            params.push(doctor_id);
        }
        
        if (patient_id) {
            conditions.push(`a.patient_id = $${params.length + 1}`);
            params.push(patient_id);
        }
        
        if (status) {
            conditions.push(`a.status = $${params.length + 1}`);
            params.push(status);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY a.appointment_date, a.appointment_time';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const { patient_id, doctor_id, appointment_date, appointment_time, type, notes } = req.body;
        
        const result = await client.query(
            `INSERT INTO hms.appointments (patient_id, doctor_id, appointment_date, appointment_time, type, notes, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
             RETURNING *`,
            [patient_id, doctor_id, appointment_date, appointment_time, type, notes]
        );
        
        broadcastUpdate('appointment_created', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
});

// ==================== HEALTH CHECK ====================
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
            appointments: 'active',
            websocket: 'active'
        }
    });
});

// Initialize database and start server
async function initializeDatabase() {
    try {
        await client.connect();
        console.log('Connected to Neon database');
        
        // Ensure schema exists
        await client.query('CREATE SCHEMA IF NOT EXISTS hms');
        
        // Create tables if they don't exist
        const createTables = `
            -- Users table
            CREATE TABLE IF NOT EXISTS hms.users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Patients table
            CREATE TABLE IF NOT EXISTS hms.patients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                date_of_birth DATE,
                gender VARCHAR(20),
                blood_group VARCHAR(10),
                phone VARCHAR(20),
                email VARCHAR(100),
                address TEXT,
                emergency_contact JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Staff table
            CREATE TABLE IF NOT EXISTS hms.staff (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                role VARCHAR(100),
                department VARCHAR(100),
                email VARCHAR(100),
                phone VARCHAR(20),
                qualification TEXT,
                shift_timing VARCHAR(50),
                status VARCHAR(20) DEFAULT 'active',
                joined_date DATE DEFAULT CURRENT_DATE
            );
            
            -- Medical Records table
            CREATE TABLE IF NOT EXISTS hms.medical_records (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES hms.patients(id),
                doctor_id INTEGER REFERENCES hms.staff(id),
                visit_date TIMESTAMP DEFAULT NOW(),
                visit_type VARCHAR(50),
                chief_complaint TEXT,
                diagnosis TEXT,
                treatment_plan TEXT,
                notes TEXT
            );
            
            -- Invoices table
            CREATE TABLE IF NOT EXISTS hms.invoices (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES hms.patients(id),
                invoice_number VARCHAR(50) UNIQUE,
                items JSONB,
                total DECIMAL(10,2),
                payment_method VARCHAR(50),
                insurance_id VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pending',
                amount_paid DECIMAL(10,2),
                payment_date DATE,
                payment_reference VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Inventory Items table
            CREATE TABLE IF NOT EXISTS hms.inventory_items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                category VARCHAR(100),
                quantity INTEGER DEFAULT 0,
                unit VARCHAR(50),
                unit_price DECIMAL(10,2),
                reorder_level INTEGER DEFAULT 10,
                supplier_id VARCHAR(100),
                last_updated TIMESTAMP DEFAULT NOW()
            );
            
            -- Beds table
            CREATE TABLE IF NOT EXISTS hms.beds (
                id SERIAL PRIMARY KEY,
                bed_number VARCHAR(20) NOT NULL,
                ward VARCHAR(100),
                type VARCHAR(50),
                status VARCHAR(20) DEFAULT 'available',
                patient_id INTEGER REFERENCES hms.patients(id),
                last_updated TIMESTAMP DEFAULT NOW()
            );
            
            -- Admissions table
            CREATE TABLE IF NOT EXISTS hms.admissions (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES hms.patients(id),
                bed_id INTEGER REFERENCES hms.beds(id),
                admission_date DATE,
                expected_discharge DATE,
                discharge_date DATE,
                discharge_notes TEXT,
                status VARCHAR(20) DEFAULT 'active'
            );
            
            -- Staff Schedules table
            CREATE TABLE IF NOT EXISTS hms.staff_schedules (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES hms.staff(id),
                schedule_date DATE,
                shift_start TIME,
                shift_end TIME,
                duty_type VARCHAR(50)
            );
            
            -- Appointments table
            CREATE TABLE IF NOT EXISTS hms.appointments (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES hms.patients(id),
                doctor_id INTEGER REFERENCES hms.staff(id),
                appointment_date DATE,
                appointment_time TIME,
                type VARCHAR(50),
                notes TEXT,
                status VARCHAR(20) DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        
        await client.query(createTables);
        
        // Create default admin user if not exists
        const checkAdmin = await client.query(
            'SELECT * FROM hms.users WHERE username = $1',
            ['admin']
        );
        
        if (checkAdmin.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await client.query(
                'INSERT INTO hms.users (username, password_hash, role) VALUES ($1, $2, $3)',
                ['admin', hashedPassword, 'admin']
            );
            console.log('Default admin user created (username: admin, password: admin123)');
        }
        
        // Add sample data if tables are empty
        const patientCount = await client.query('SELECT COUNT(*) FROM hms.patients');
        if (patientCount.rows[0].count === '0') {
            await addSampleData();
        }
        
        console.log('Database initialization complete');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

async function addSampleData() {
    try {
        // Add sample patients
        await client.query(`
            INSERT INTO hms.patients (name, date_of_birth, gender, blood_group, phone, email, address)
            VALUES 
            ('John Doe', '1985-05-15', 'Male', 'O+', '0201234567', 'john.doe@email.com', '123 Main St, Accra'),
            ('Jane Smith', '1990-08-22', 'Female', 'A+', '0209876543', 'jane.smith@email.com', '456 Oak Ave, Tema'),
            ('Robert Johnson', '1978-03-10', 'Male', 'B+', '0245678901', 'robert.j@email.com', '789 Pine Rd, Kumasi')
        `);
        
        // Add sample staff
        await client.query(`
            INSERT INTO hms.staff (name, role, department, email, phone, qualification, shift_timing)
            VALUES 
            ('Dr. Sarah Wilson', 'Doctor', 'General Medicine', 'sarah.wilson@hospital.com', '0201111111', 'MD, MBBS', 'Morning'),
            ('Dr. Michael Brown', 'Doctor', 'Surgery', 'michael.brown@hospital.com', '0202222222', 'MS, MBBS', 'Morning'),
            ('Nurse Mary Johnson', 'Nurse', 'General Ward', 'mary.j@hospital.com', '0203333333', 'BSN, RN', 'Morning')
        `);
        
        // Add sample inventory
        await client.query(`
            INSERT INTO hms.inventory_items (name, category, quantity, unit, unit_price, reorder_level)
            VALUES 
            ('Paracetamol 500mg', 'Medicine', 500, 'Tablets', 0.5, 100),
            ('Surgical Gloves', 'Supplies', 1000, 'Pairs', 2.0, 200),
            ('Bandages', 'Supplies', 300, 'Rolls', 5.0, 50),
            ('Insulin', 'Medicine', 100, 'Vials', 25.0, 20),
            ('Syringes', 'Supplies', 500, 'Units', 1.0, 100)
        `);
        
        // Add sample beds
        await client.query(`
            INSERT INTO hms.beds (bed_number, ward, type, status)
            VALUES 
            ('ICU-001', 'ICU', 'ICU', 'available'),
            ('ICU-002', 'ICU', 'ICU', 'occupied'),
            ('GEN-001', 'General Ward', 'General', 'available'),
            ('GEN-002', 'General Ward', 'General', 'available'),
            ('GEN-003', 'General Ward', 'General', 'occupied'),
            ('PED-001', 'Pediatric', 'Pediatric', 'available'),
            ('MAT-001', 'Maternity', 'Maternity', 'available')
        `);
        
        console.log('Sample data added successfully');
    } catch (error) {
        console.error('Error adding sample data:', error);
    }
}

// Start server
async function startServer() {
    try {
        await initializeDatabase();
        
        server.listen(PORT, () => {
            console.log(`HMS Backend running on port ${PORT}`);
            console.log('WebSocket server ready for connections');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
