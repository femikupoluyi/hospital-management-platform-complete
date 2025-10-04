const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Database configuration
const dbConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// WebSocket connections
const wsClients = new Set();

// Alert thresholds
const ALERT_THRESHOLDS = {
    lowStock: 20,
    highOccupancy: 90,
    lowOccupancy: 30,
    patientWaitTime: 120, // minutes
    staffUtilization: 85,
    revenueTarget: 1000000, // daily target
    emergencyResponseTime: 15, // minutes
    equipmentDowntime: 60, // minutes
    patientSatisfaction: 70 // percentage
};

// Database helper
async function getDb() {
    const client = new Client(dbConfig);
    await client.connect();
    return client;
}

// WebSocket management
wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('New WebSocket connection - Total:', wsClients.size);
    
    // Send initial data
    sendInitialData(ws);
    
    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('WebSocket disconnected - Remaining:', wsClients.size);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Broadcast to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Send initial data to new connection
async function sendInitialData(ws) {
    try {
        const data = await getComprehensiveDashboardData();
        ws.send(JSON.stringify({ type: 'initial', data }));
    } catch (error) {
        console.error('Error sending initial data:', error);
    }
}

// Initialize database tables
async function initializeDatabase() {
    const client = await getDb();
    try {
        // Hospital metrics table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_hospital_metrics (
                id SERIAL PRIMARY KEY,
                hospital_id UUID,
                hospital_name VARCHAR(255),
                patient_inflow INTEGER DEFAULT 0,
                admissions INTEGER DEFAULT 0,
                discharges INTEGER DEFAULT 0,
                bed_occupancy DECIMAL(5,2) DEFAULT 0,
                emergency_visits INTEGER DEFAULT 0,
                average_wait_time INTEGER DEFAULT 0,
                staff_on_duty INTEGER DEFAULT 0,
                revenue_today DECIMAL(12,2) DEFAULT 0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Alerts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_alerts (
                id SERIAL PRIMARY KEY,
                alert_type VARCHAR(100),
                severity VARCHAR(20),
                hospital_id UUID,
                hospital_name VARCHAR(255),
                message TEXT,
                details JSONB,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                resolved_by VARCHAR(255)
            )
        `);

        // Staff KPIs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_staff_kpis (
                id SERIAL PRIMARY KEY,
                hospital_id UUID,
                department VARCHAR(100),
                total_staff INTEGER,
                present_today INTEGER,
                patients_per_staff DECIMAL(5,2),
                average_response_time INTEGER,
                satisfaction_score DECIMAL(5,2),
                productivity_score DECIMAL(5,2),
                date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Financial metrics table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_financial_metrics (
                id SERIAL PRIMARY KEY,
                hospital_id UUID,
                hospital_name VARCHAR(255),
                daily_revenue DECIMAL(12,2),
                monthly_revenue DECIMAL(12,2),
                pending_payments DECIMAL(12,2),
                insurance_claims DECIMAL(12,2),
                operational_costs DECIMAL(12,2),
                profit_margin DECIMAL(5,2),
                date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Projects table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_projects (
                id SERIAL PRIMARY KEY,
                project_name VARCHAR(255) NOT NULL,
                project_type VARCHAR(100),
                hospital_id UUID,
                hospital_name VARCHAR(255),
                status VARCHAR(50) DEFAULT 'planning',
                priority VARCHAR(20) DEFAULT 'medium',
                start_date DATE,
                end_date DATE,
                budget DECIMAL(12,2),
                spent DECIMAL(12,2) DEFAULT 0,
                progress INTEGER DEFAULT 0,
                project_manager VARCHAR(255),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Project tasks table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_project_tasks (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES occ_projects(id),
                task_name VARCHAR(255),
                assignee VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                priority VARCHAR(20),
                due_date DATE,
                completed_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Project milestones table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_project_milestones (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES occ_projects(id),
                milestone_name VARCHAR(255),
                target_date DATE,
                achieved_date DATE,
                status VARCHAR(50) DEFAULT 'pending',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Inventory alerts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_inventory_alerts (
                id SERIAL PRIMARY KEY,
                hospital_id UUID,
                item_name VARCHAR(255),
                current_stock INTEGER,
                reorder_level INTEGER,
                alert_type VARCHAR(50),
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Performance benchmarks table
        await client.query(`
            CREATE TABLE IF NOT EXISTS occ_performance_benchmarks (
                id SERIAL PRIMARY KEY,
                metric_name VARCHAR(255),
                target_value DECIMAL(10,2),
                unit VARCHAR(50),
                category VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert sample data if tables are empty
        await insertSampleData(client);

        console.log('✅ OCC Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        await client.end();
    }
}

// Insert sample data
async function insertSampleData(client) {
    try {
        // Check if we have data
        const metricsCheck = await client.query('SELECT COUNT(*) FROM occ_hospital_metrics');
        if (metricsCheck.rows[0].count > 0) return;

        // Sample hospitals
        const hospitals = [
            { id: 'hosp-001', name: 'Lagos General Hospital' },
            { id: 'hosp-002', name: 'Abuja Medical Center' },
            { id: 'hosp-003', name: 'Port Harcourt Specialist Hospital' },
            { id: 'hosp-004', name: 'Kano Teaching Hospital' },
            { id: 'hosp-005', name: 'Ibadan Central Hospital' }
        ];

        // Insert hospital metrics
        for (const hospital of hospitals) {
            await client.query(`
                INSERT INTO occ_hospital_metrics 
                (hospital_id, hospital_name, patient_inflow, admissions, discharges, 
                 bed_occupancy, emergency_visits, average_wait_time, staff_on_duty, revenue_today)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                hospital.id,
                hospital.name,
                Math.floor(Math.random() * 100) + 50,
                Math.floor(Math.random() * 30) + 10,
                Math.floor(Math.random() * 20) + 5,
                Math.random() * 30 + 60,
                Math.floor(Math.random() * 20) + 5,
                Math.floor(Math.random() * 60) + 30,
                Math.floor(Math.random() * 50) + 20,
                Math.random() * 500000 + 100000
            ]);

            // Insert financial metrics
            await client.query(`
                INSERT INTO occ_financial_metrics
                (hospital_id, hospital_name, daily_revenue, monthly_revenue, 
                 pending_payments, insurance_claims, operational_costs, profit_margin)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                hospital.id,
                hospital.name,
                Math.random() * 500000 + 100000,
                Math.random() * 15000000 + 3000000,
                Math.random() * 1000000 + 200000,
                Math.random() * 800000 + 100000,
                Math.random() * 300000 + 100000,
                Math.random() * 20 + 10
            ]);

            // Insert staff KPIs
            await client.query(`
                INSERT INTO occ_staff_kpis
                (hospital_id, department, total_staff, present_today, 
                 patients_per_staff, average_response_time, satisfaction_score, productivity_score)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                hospital.id,
                'General',
                Math.floor(Math.random() * 100) + 50,
                Math.floor(Math.random() * 90) + 40,
                Math.random() * 5 + 2,
                Math.floor(Math.random() * 30) + 10,
                Math.random() * 30 + 70,
                Math.random() * 20 + 75
            ]);
        }

        // Insert sample projects
        const projects = [
            {
                name: 'Emergency Ward Expansion - Lagos',
                type: 'expansion',
                hospital_id: 'hosp-001',
                hospital_name: 'Lagos General Hospital',
                status: 'in_progress',
                priority: 'high',
                budget: 25000000,
                spent: 12000000,
                progress: 48
            },
            {
                name: 'IT Infrastructure Upgrade - Abuja',
                type: 'it_upgrade',
                hospital_id: 'hosp-002',
                hospital_name: 'Abuja Medical Center',
                status: 'planning',
                priority: 'medium',
                budget: 5000000,
                spent: 500000,
                progress: 10
            },
            {
                name: 'Radiology Department Renovation',
                type: 'renovation',
                hospital_id: 'hosp-003',
                hospital_name: 'Port Harcourt Specialist Hospital',
                status: 'in_progress',
                priority: 'high',
                budget: 15000000,
                spent: 8000000,
                progress: 55
            }
        ];

        for (const project of projects) {
            const result = await client.query(`
                INSERT INTO occ_projects 
                (project_name, project_type, hospital_id, hospital_name, status, 
                 priority, budget, spent, progress, start_date, end_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months')
                RETURNING id
            `, [
                project.name, project.type, project.hospital_id, project.hospital_name,
                project.status, project.priority, project.budget, project.spent, project.progress
            ]);

            // Add sample tasks for each project
            const tasks = ['Planning', 'Procurement', 'Implementation', 'Testing', 'Deployment'];
            for (const task of tasks) {
                await client.query(`
                    INSERT INTO occ_project_tasks (project_id, task_name, status, priority)
                    VALUES ($1, $2, $3, $4)
                `, [result.rows[0].id, task, 'pending', 'medium']);
            }
        }

        // Insert sample alerts
        const alerts = [
            {
                type: 'low_stock',
                severity: 'high',
                hospital_id: 'hosp-001',
                hospital_name: 'Lagos General Hospital',
                message: 'Critical: Paracetamol stock below reorder level',
                details: { item: 'Paracetamol', current: 50, reorder_level: 100 }
            },
            {
                type: 'high_occupancy',
                severity: 'warning',
                hospital_id: 'hosp-002',
                hospital_name: 'Abuja Medical Center',
                message: 'ICU bed occupancy at 92%',
                details: { ward: 'ICU', occupancy: 92, threshold: 90 }
            },
            {
                type: 'staff_shortage',
                severity: 'medium',
                hospital_id: 'hosp-003',
                hospital_name: 'Port Harcourt Specialist Hospital',
                message: 'Emergency department understaffed',
                details: { department: 'Emergency', required: 15, available: 10 }
            }
        ];

        for (const alert of alerts) {
            await client.query(`
                INSERT INTO occ_alerts 
                (alert_type, severity, hospital_id, hospital_name, message, details)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [alert.type, alert.severity, alert.hospital_id, alert.hospital_name, 
                alert.message, JSON.stringify(alert.details)]);
        }

        console.log('✅ Sample data inserted successfully');
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
}

// ============= DASHBOARD ENDPOINTS =============

// Get comprehensive dashboard data
app.get('/api/dashboard/comprehensive', async (req, res) => {
    try {
        const data = await getComprehensiveDashboardData();
        res.json(data);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: error.message });
    }
});

async function getComprehensiveDashboardData() {
    const client = await getDb();
    try {
        // Get overall metrics
        const overallMetrics = await client.query(`
            SELECT 
                COUNT(DISTINCT hospital_id) as total_hospitals,
                SUM(patient_inflow) as total_patient_inflow,
                SUM(admissions) as total_admissions,
                SUM(discharges) as total_discharges,
                AVG(bed_occupancy) as avg_bed_occupancy,
                SUM(emergency_visits) as total_emergency_visits,
                AVG(average_wait_time) as avg_wait_time,
                SUM(staff_on_duty) as total_staff_on_duty,
                SUM(revenue_today) as total_revenue_today
            FROM occ_hospital_metrics
            WHERE DATE(timestamp) = CURRENT_DATE
        `);

        // Get hospital-wise metrics
        const hospitalMetrics = await client.query(`
            SELECT * FROM occ_hospital_metrics 
            ORDER BY timestamp DESC 
            LIMIT 10
        `);

        // Get active alerts
        const activeAlerts = await client.query(`
            SELECT * FROM occ_alerts 
            WHERE status = 'active' 
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                created_at DESC
        `);

        // Get financial summary
        const financialSummary = await client.query(`
            SELECT 
                SUM(daily_revenue) as total_daily_revenue,
                SUM(monthly_revenue) as total_monthly_revenue,
                SUM(pending_payments) as total_pending,
                SUM(insurance_claims) as total_claims,
                AVG(profit_margin) as avg_profit_margin
            FROM occ_financial_metrics
            WHERE date = CURRENT_DATE
        `);

        // Get staff KPIs
        const staffKPIs = await client.query(`
            SELECT 
                SUM(total_staff) as total_staff,
                SUM(present_today) as total_present,
                AVG(patients_per_staff) as avg_patients_per_staff,
                AVG(satisfaction_score) as avg_satisfaction,
                AVG(productivity_score) as avg_productivity
            FROM occ_staff_kpis
            WHERE date = CURRENT_DATE
        `);

        // Get active projects
        const activeProjects = await client.query(`
            SELECT * FROM occ_projects 
            WHERE status IN ('planning', 'in_progress') 
            ORDER BY priority, created_at DESC
        `);

        // Get recent inventory alerts
        const inventoryAlerts = await client.query(`
            SELECT * FROM occ_inventory_alerts 
            WHERE status = 'active' 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        return {
            overview: overallMetrics.rows[0],
            hospitals: hospitalMetrics.rows,
            alerts: activeAlerts.rows,
            financial: financialSummary.rows[0],
            staffKPIs: staffKPIs.rows[0],
            projects: activeProjects.rows,
            inventoryAlerts: inventoryAlerts.rows,
            timestamp: new Date()
        };
    } finally {
        await client.end();
    }
}

// Get real-time patient flow
app.get('/api/dashboard/patient-flow', async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT 
                hospital_name,
                patient_inflow,
                admissions,
                discharges,
                emergency_visits,
                average_wait_time,
                timestamp
            FROM occ_hospital_metrics
            WHERE DATE(timestamp) = CURRENT_DATE
            ORDER BY timestamp DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Get staff performance metrics
app.get('/api/dashboard/staff-kpis', async (req, res) => {
    const client = await getDb();
    try {
        const result = await client.query(`
            SELECT 
                h.hospital_name,
                s.*
            FROM occ_staff_kpis s
            LEFT JOIN (
                SELECT DISTINCT hospital_id, hospital_name 
                FROM occ_hospital_metrics
            ) h ON s.hospital_id = h.hospital_id
            WHERE s.date = CURRENT_DATE
            ORDER BY s.productivity_score DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Get financial metrics
app.get('/api/dashboard/financial', async (req, res) => {
    const client = await getDb();
    try {
        const { period = 'daily' } = req.query;
        
        let query = '';
        if (period === 'daily') {
            query = `
                SELECT * FROM occ_financial_metrics 
                WHERE date = CURRENT_DATE 
                ORDER BY daily_revenue DESC
            `;
        } else if (period === 'monthly') {
            query = `
                SELECT 
                    hospital_name,
                    SUM(daily_revenue) as monthly_revenue,
                    SUM(pending_payments) as total_pending,
                    SUM(insurance_claims) as total_claims,
                    AVG(profit_margin) as avg_margin
                FROM occ_financial_metrics
                WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
                GROUP BY hospital_name
                ORDER BY monthly_revenue DESC
            `;
        }
        
        const result = await client.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= ALERTS ENDPOINTS =============

// Get all alerts
app.get('/api/alerts', async (req, res) => {
    const client = await getDb();
    try {
        const { status = 'active', severity } = req.query;
        
        let query = 'SELECT * FROM occ_alerts WHERE 1=1';
        const params = [];
        
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        if (severity) {
            params.push(severity);
            query += ` AND severity = $${params.length}`;
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Create new alert
app.post('/api/alerts', async (req, res) => {
    const client = await getDb();
    try {
        const { alert_type, severity, hospital_id, hospital_name, message, details } = req.body;
        
        const result = await client.query(`
            INSERT INTO occ_alerts 
            (alert_type, severity, hospital_id, hospital_name, message, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [alert_type, severity, hospital_id, hospital_name, message, JSON.stringify(details)]);
        
        // Broadcast alert to all connected clients
        broadcast({
            type: 'new_alert',
            data: result.rows[0]
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Resolve alert
app.put('/api/alerts/:id/resolve', async (req, res) => {
    const client = await getDb();
    try {
        const { resolved_by } = req.body;
        
        const result = await client.query(`
            UPDATE occ_alerts 
            SET status = 'resolved', 
                resolved_at = CURRENT_TIMESTAMP,
                resolved_by = $1
            WHERE id = $2
            RETURNING *
        `, [resolved_by, req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        
        // Broadcast resolution
        broadcast({
            type: 'alert_resolved',
            data: result.rows[0]
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= PROJECT MANAGEMENT ENDPOINTS =============

// Get all projects
app.get('/api/projects', async (req, res) => {
    const client = await getDb();
    try {
        const { status, hospital_id } = req.query;
        
        let query = 'SELECT * FROM occ_projects WHERE 1=1';
        const params = [];
        
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        if (hospital_id) {
            params.push(hospital_id);
            query += ` AND hospital_id = $${params.length}`;
        }
        
        query += ' ORDER BY priority, created_at DESC';
        
        const result = await client.query(query, params);
        
        // Get tasks and milestones for each project
        for (const project of result.rows) {
            const tasks = await client.query(
                'SELECT * FROM occ_project_tasks WHERE project_id = $1',
                [project.id]
            );
            const milestones = await client.query(
                'SELECT * FROM occ_project_milestones WHERE project_id = $1',
                [project.id]
            );
            project.tasks = tasks.rows;
            project.milestones = milestones.rows;
        }
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Create new project
app.post('/api/projects', async (req, res) => {
    const client = await getDb();
    try {
        const {
            project_name, project_type, hospital_id, hospital_name,
            status, priority, start_date, end_date, budget,
            project_manager, description
        } = req.body;
        
        const result = await client.query(`
            INSERT INTO occ_projects 
            (project_name, project_type, hospital_id, hospital_name, status, 
             priority, start_date, end_date, budget, project_manager, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [project_name, project_type, hospital_id, hospital_name, 
            status || 'planning', priority || 'medium', start_date, end_date, 
            budget, project_manager, description]);
        
        // Broadcast new project
        broadcast({
            type: 'new_project',
            data: result.rows[0]
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Update project progress
app.put('/api/projects/:id/progress', async (req, res) => {
    const client = await getDb();
    try {
        const { progress, spent, status } = req.body;
        
        const result = await client.query(`
            UPDATE occ_projects 
            SET progress = $1, 
                spent = COALESCE($2, spent),
                status = COALESCE($3, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [progress, spent, status, req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Broadcast update
        broadcast({
            type: 'project_updated',
            data: result.rows[0]
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Add project task
app.post('/api/projects/:id/tasks', async (req, res) => {
    const client = await getDb();
    try {
        const { task_name, assignee, priority, due_date, notes } = req.body;
        
        const result = await client.query(`
            INSERT INTO occ_project_tasks 
            (project_id, task_name, assignee, priority, due_date, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, task_name, assignee, priority, due_date, notes]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Update task status
app.put('/api/tasks/:id/status', async (req, res) => {
    const client = await getDb();
    try {
        const { status } = req.body;
        
        const result = await client.query(`
            UPDATE occ_project_tasks 
            SET status = $1,
                completed_date = CASE 
                    WHEN $1 = 'completed' THEN CURRENT_DATE 
                    ELSE NULL 
                END
            WHERE id = $2
            RETURNING *
        `, [status, req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// ============= MONITORING & ANALYTICS =============

// Check thresholds and generate alerts
async function checkThresholdsAndGenerateAlerts() {
    const client = await getDb();
    try {
        // Check bed occupancy
        const occupancyResult = await client.query(`
            SELECT hospital_id, hospital_name, bed_occupancy
            FROM occ_hospital_metrics
            WHERE DATE(timestamp) = CURRENT_DATE
        `);
        
        for (const hospital of occupancyResult.rows) {
            if (hospital.bed_occupancy > ALERT_THRESHOLDS.highOccupancy) {
                await createAlert(client, {
                    alert_type: 'high_occupancy',
                    severity: 'high',
                    hospital_id: hospital.hospital_id,
                    hospital_name: hospital.hospital_name,
                    message: `High bed occupancy: ${hospital.bed_occupancy}%`,
                    details: { occupancy: hospital.bed_occupancy, threshold: ALERT_THRESHOLDS.highOccupancy }
                });
            }
        }
        
        // Check inventory levels
        const inventoryResult = await client.query(`
            SELECT DISTINCT hospital_id, item_name, current_stock, reorder_level
            FROM occ_inventory_alerts
            WHERE status = 'active' AND current_stock < reorder_level
        `);
        
        for (const item of inventoryResult.rows) {
            if (item.current_stock < ALERT_THRESHOLDS.lowStock) {
                await createAlert(client, {
                    alert_type: 'critical_low_stock',
                    severity: 'critical',
                    hospital_id: item.hospital_id,
                    hospital_name: 'Hospital',
                    message: `Critical stock level: ${item.item_name}`,
                    details: { item: item.item_name, current: item.current_stock, threshold: ALERT_THRESHOLDS.lowStock }
                });
            }
        }
        
    } catch (error) {
        console.error('Error checking thresholds:', error);
    } finally {
        await client.end();
    }
}

async function createAlert(client, alertData) {
    try {
        // Check if similar alert already exists
        const existing = await client.query(
            `SELECT id FROM occ_alerts 
             WHERE alert_type = $1 AND hospital_id = $2 AND status = 'active'
             AND created_at > NOW() - INTERVAL '1 hour'`,
            [alertData.alert_type, alertData.hospital_id]
        );
        
        if (existing.rows.length === 0) {
            const result = await client.query(`
                INSERT INTO occ_alerts 
                (alert_type, severity, hospital_id, hospital_name, message, details)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [alertData.alert_type, alertData.severity, alertData.hospital_id, 
                alertData.hospital_name, alertData.message, JSON.stringify(alertData.details)]);
            
            // Broadcast alert
            broadcast({
                type: 'new_alert',
                data: result.rows[0]
            });
        }
    } catch (error) {
        console.error('Error creating alert:', error);
    }
}

// Periodic monitoring
setInterval(async () => {
    await checkThresholdsAndGenerateAlerts();
}, 60000); // Check every minute

// Simulate real-time data updates
setInterval(async () => {
    const client = await getDb();
    try {
        // Update metrics with small random changes
        await client.query(`
            UPDATE occ_hospital_metrics
            SET patient_inflow = patient_inflow + (RANDOM() * 10 - 5)::INTEGER,
                admissions = admissions + (RANDOM() * 3)::INTEGER,
                bed_occupancy = LEAST(100, bed_occupancy + (RANDOM() * 5 - 2.5)),
                timestamp = CURRENT_TIMESTAMP
            WHERE DATE(timestamp) = CURRENT_DATE
        `);
        
        // Broadcast updated data
        const data = await getComprehensiveDashboardData();
        broadcast({
            type: 'metrics_update',
            data
        });
    } catch (error) {
        console.error('Error updating metrics:', error);
    } finally {
        await client.end();
    }
}, 30000); // Update every 30 seconds

// ============= REPORTS & EXPORTS =============

app.get('/api/reports/executive-summary', async (req, res) => {
    const client = await getDb();
    try {
        const summary = await client.query(`
            WITH hospital_summary AS (
                SELECT 
                    hospital_name,
                    SUM(patient_inflow) as total_patients,
                    SUM(revenue_today) as total_revenue,
                    AVG(bed_occupancy) as avg_occupancy
                FROM occ_hospital_metrics
                WHERE DATE(timestamp) = CURRENT_DATE
                GROUP BY hospital_name
            ),
            project_summary AS (
                SELECT 
                    COUNT(*) as total_projects,
                    SUM(budget) as total_budget,
                    SUM(spent) as total_spent,
                    AVG(progress) as avg_progress
                FROM occ_projects
                WHERE status IN ('planning', 'in_progress')
            ),
            alert_summary AS (
                SELECT 
                    COUNT(*) as total_alerts,
                    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
                    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts
                FROM occ_alerts
                WHERE status = 'active'
            )
            SELECT 
                (SELECT json_agg(row_to_json(h)) FROM hospital_summary h) as hospitals,
                (SELECT row_to_json(p) FROM project_summary p) as projects,
                (SELECT row_to_json(a) FROM alert_summary a) as alerts
        `);
        
        res.json(summary.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'OCC Command Centre',
        timestamp: new Date(),
        connections: wsClients.size
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'occ-dashboard.html'));
});

// Start server
const PORT = process.env.PORT || 9002;

async function startServer() {
    await initializeDatabase();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🏥 OCC Command Centre running on port ${PORT}`);
        console.log(`📡 WebSocket server ready`);
        console.log(`📊 Real-time monitoring active`);
        console.log(`🚨 Alert system enabled`);
        console.log(`📈 Dashboard: http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);
