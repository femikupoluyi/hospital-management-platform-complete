const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

// Database configuration
const DATABASE_URL = 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const app = express();
const PORT = process.env.PORT || 6000;

// Create HTTP server for WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// WebSocket connections management
const wsClients = new Map(); // Map of client ID to WebSocket connection
const alertSubscribers = new Set(); // Clients subscribed to alerts

// Track metrics history
const metricsHistory = {
    patientFlow: [],
    admissions: [],
    financial: [],
    staffPerformance: [],
    inventoryStatus: []
};

// Alert thresholds
const alertThresholds = {
    lowStockPercentage: 20,
    highOccupancyPercentage: 90,
    lowStaffingRatio: 0.8,
    revenueVariance: 15,
    patientWaitTime: 120, // minutes
    criticalStockDays: 3
};

// Active alerts
const activeAlerts = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    wsClients.set(clientId, ws);
    
    console.log(`New WebSocket connection: ${clientId}`);
    
    // Send initial data
    ws.send(JSON.stringify({
        type: 'connection',
        clientId,
        timestamp: new Date().toISOString()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(clientId, data, ws);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        wsClients.delete(clientId);
        alertSubscribers.delete(ws);
        console.log(`WebSocket connection closed: ${clientId}`);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
    });
});

// Handle WebSocket messages
function handleWebSocketMessage(clientId, data, ws) {
    switch (data.type) {
        case 'subscribe_alerts':
            alertSubscribers.add(ws);
            ws.send(JSON.stringify({
                type: 'subscription_confirmed',
                alerts: Array.from(activeAlerts.values())
            }));
            break;
        case 'request_metrics':
            sendMetricsUpdate(ws, data.hospital_id);
            break;
        case 'acknowledge_alert':
            acknowledgeAlert(data.alert_id, clientId);
            break;
    }
}

// Broadcast to all clients
function broadcast(data) {
    const message = JSON.stringify(data);
    wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Broadcast alerts to subscribers
function broadcastAlert(alert) {
    const message = JSON.stringify({
        type: 'alert',
        alert
    });
    alertSubscribers.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Initialize database schema
async function initializeDatabase() {
    try {
        // Create command centre schema
        await pool.query(`CREATE SCHEMA IF NOT EXISTS command_centre`);
        
        // Hospitals table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.hospitals (
                id SERIAL PRIMARY KEY,
                hospital_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(200) NOT NULL,
                location VARCHAR(500),
                type VARCHAR(50),
                capacity INTEGER,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Real-time metrics table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.realtime_metrics (
                id SERIAL PRIMARY KEY,
                hospital_id VARCHAR(50),
                metric_type VARCHAR(50),
                metric_value JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Alerts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.alerts (
                id SERIAL PRIMARY KEY,
                alert_id VARCHAR(50) UNIQUE NOT NULL,
                hospital_id VARCHAR(50),
                alert_type VARCHAR(50),
                severity VARCHAR(20),
                message TEXT,
                details JSONB,
                status VARCHAR(50) DEFAULT 'active',
                acknowledged_by VARCHAR(100),
                acknowledged_at TIMESTAMP,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Projects table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.projects (
                id SERIAL PRIMARY KEY,
                project_id VARCHAR(50) UNIQUE NOT NULL,
                hospital_id VARCHAR(50),
                project_name VARCHAR(200),
                project_type VARCHAR(50),
                status VARCHAR(50),
                priority VARCHAR(20),
                start_date DATE,
                end_date DATE,
                budget DECIMAL(12, 2),
                spent DECIMAL(12, 2) DEFAULT 0,
                progress INTEGER DEFAULT 0,
                project_manager VARCHAR(200),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Project tasks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.project_tasks (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(50) UNIQUE NOT NULL,
                project_id VARCHAR(50),
                task_name VARCHAR(200),
                description TEXT,
                assigned_to VARCHAR(200),
                status VARCHAR(50),
                priority VARCHAR(20),
                due_date DATE,
                completed_date DATE,
                dependencies JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // KPI definitions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.kpi_definitions (
                id SERIAL PRIMARY KEY,
                kpi_code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(200),
                category VARCHAR(50),
                calculation_method TEXT,
                target_value DECIMAL(10, 2),
                unit VARCHAR(50),
                frequency VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // KPI tracking table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS command_centre.kpi_tracking (
                id SERIAL PRIMARY KEY,
                hospital_id VARCHAR(50),
                kpi_code VARCHAR(50),
                value DECIMAL(10, 2),
                target DECIMAL(10, 2),
                variance DECIMAL(10, 2),
                period_start DATE,
                period_end DATE,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Seed sample hospitals
        await pool.query(`
            INSERT INTO command_centre.hospitals (hospital_id, name, location, type, capacity)
            VALUES 
                ('HOSP-001', 'Central General Hospital', 'Downtown', 'General', 500),
                ('HOSP-002', 'North Medical Center', 'North District', 'Specialized', 300),
                ('HOSP-003', 'East Community Hospital', 'East Side', 'Community', 200)
            ON CONFLICT (hospital_id) DO NOTHING
        `);
        
        // Seed KPI definitions
        await pool.query(`
            INSERT INTO command_centre.kpi_definitions (kpi_code, name, category, target_value, unit)
            VALUES 
                ('PAT-FLOW', 'Patient Flow Rate', 'Operations', 85, 'percentage'),
                ('BED-OCC', 'Bed Occupancy Rate', 'Operations', 75, 'percentage'),
                ('AVG-WAIT', 'Average Wait Time', 'Patient Care', 30, 'minutes'),
                ('STAFF-RATIO', 'Staff to Patient Ratio', 'Staffing', 0.25, 'ratio'),
                ('REV-TARGET', 'Revenue vs Target', 'Financial', 100, 'percentage'),
                ('INV-TURN', 'Inventory Turnover', 'Inventory', 12, 'times/year')
            ON CONFLICT (kpi_code) DO NOTHING
        `);
        
        console.log('Command Centre database initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// ==================== REAL-TIME MONITORING ENDPOINTS ====================

// Get all hospitals overview
app.get('/api/command-centre/hospitals', async (req, res) => {
    try {
        const hospitals = await pool.query(`
            SELECT h.*, 
                   COUNT(DISTINCT p.id) as total_patients,
                   COUNT(DISTINCT CASE WHEN a.status = 'active' THEN a.id END) as active_admissions,
                   COUNT(DISTINCT b.id) as total_beds,
                   COUNT(DISTINCT CASE WHEN b.status = 'available' THEN b.id END) as available_beds
            FROM command_centre.hospitals h
            LEFT JOIN hms.patients p ON true
            LEFT JOIN hms.admissions a ON true
            LEFT JOIN hms.beds b ON true
            WHERE h.status = 'active'
            GROUP BY h.id
        `);
        
        res.json(hospitals.rows);
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        res.status(500).json({ error: 'Failed to fetch hospitals' });
    }
});

// Get real-time patient flow metrics
app.get('/api/command-centre/patient-flow', async (req, res) => {
    try {
        // Can filter by hospital_id from query params if needed
        const { hospital_id } = req.query;
        
        // Get current patient flow
        const patientFlow = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN id END) as new_patients,
                COUNT(DISTINCT CASE WHEN updated_at >= NOW() - INTERVAL '1 hour' THEN id END) as updated_patients
            FROM hms.patients
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `);
        
        // Get admission/discharge flow
        const admissionFlow = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', admission_date) as hour,
                COUNT(DISTINCT CASE WHEN admission_date >= NOW() - INTERVAL '1 hour' THEN id END) as admissions,
                COUNT(DISTINCT CASE WHEN actual_discharge >= NOW() - INTERVAL '1 hour' THEN id END) as discharges
            FROM hms.admissions
            WHERE admission_date >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour DESC
        `);
        
        const metrics = {
            patient_flow: patientFlow.rows,
            admission_flow: admissionFlow.rows,
            timestamp: new Date().toISOString()
        };
        
        // Store in metrics history
        metricsHistory.patientFlow.push(metrics);
        if (metricsHistory.patientFlow.length > 100) {
            metricsHistory.patientFlow.shift();
        }
        
        // Broadcast to WebSocket clients
        broadcast({
            type: 'patient_flow_update',
            data: metrics
        });
        
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching patient flow:', error);
        res.status(500).json({ error: 'Failed to fetch patient flow' });
    }
});

// Get staff KPIs
app.get('/api/command-centre/staff-kpis', async (req, res) => {
    try {
        const staffKPIs = await pool.query(`
            SELECT 
                s.department,
                COUNT(DISTINCT s.id) as total_staff,
                COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.staff_id END) as present_today,
                AVG(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) * 100 as attendance_rate,
                COUNT(DISTINCT sc.id) as scheduled_today,
                COUNT(DISTINCT mr.id) as patients_attended
            FROM hms.staff s
            LEFT JOIN hms.attendance a ON s.id = a.staff_id AND a.date = CURRENT_DATE
            LEFT JOIN hms.schedules sc ON s.id = sc.staff_id AND sc.date = CURRENT_DATE
            LEFT JOIN hms.medical_records mr ON mr.doctor_id = s.user_id AND DATE(mr.visit_date) = CURRENT_DATE
            GROUP BY s.department
        `);
        
        const performanceMetrics = await pool.query(`
            SELECT 
                AVG(EXTRACT(EPOCH FROM (mr.updated_at - mr.created_at))/60) as avg_consultation_time,
                COUNT(DISTINCT mr.id) as total_consultations,
                COUNT(DISTINCT p.id) as unique_patients
            FROM hms.medical_records mr
            JOIN hms.patients p ON mr.patient_id = p.id
            WHERE mr.visit_date >= NOW() - INTERVAL '7 days'
        `);
        
        res.json({
            department_kpis: staffKPIs.rows,
            performance: performanceMetrics.rows[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching staff KPIs:', error);
        res.status(500).json({ error: 'Failed to fetch staff KPIs' });
    }
});

// Get financial metrics
app.get('/api/command-centre/financial-metrics', async (req, res) => {
    try {
        const financialMetrics = await pool.query(`
            SELECT 
                DATE_TRUNC('day', billing_date) as date,
                COUNT(*) as invoice_count,
                SUM(total_amount) as total_billed,
                SUM(paid_amount) as total_collected,
                SUM(total_amount - paid_amount) as outstanding,
                AVG(total_amount) as avg_invoice_value
            FROM hms.invoices
            WHERE billing_date >= NOW() - INTERVAL '30 days'
            GROUP BY date
            ORDER BY date DESC
        `);
        
        const paymentAnalysis = await pool.query(`
            SELECT 
                payment_method,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount
            FROM hms.payments
            WHERE payment_date >= NOW() - INTERVAL '30 days'
            GROUP BY payment_method
        `);
        
        const insuranceMetrics = await pool.query(`
            SELECT 
                status,
                COUNT(*) as claim_count,
                SUM(claim_amount) as total_claimed,
                SUM(approved_amount) as total_approved,
                AVG(EXTRACT(EPOCH FROM (approval_date - submission_date))/86400) as avg_processing_days
            FROM hms.insurance_claims
            WHERE submission_date >= NOW() - INTERVAL '30 days'
            GROUP BY status
        `);
        
        res.json({
            daily_revenue: financialMetrics.rows,
            payment_methods: paymentAnalysis.rows,
            insurance_claims: insuranceMetrics.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching financial metrics:', error);
        res.status(500).json({ error: 'Failed to fetch financial metrics' });
    }
});

// ==================== ALERTING SYSTEM ====================

// Create alert
async function createAlert(type, severity, message, details, hospital_id = null) {
    try {
        const alertId = 'ALT-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(
            `INSERT INTO command_centre.alerts (alert_id, hospital_id, alert_type, severity, message, details)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [alertId, hospital_id, type, severity, message, details]
        );
        
        const alert = result.rows[0];
        activeAlerts.set(alertId, alert);
        
        // Broadcast alert
        broadcastAlert(alert);
        
        // Send email notification for critical alerts
        if (severity === 'critical') {
            // sendEmailAlert(alert);
            console.log('Critical alert:', alert);
        }
        
        return alert;
    } catch (error) {
        console.error('Error creating alert:', error);
    }
}

// Check for anomalies (runs every minute)
async function checkForAnomalies() {
    try {
        // Check low stock
        const lowStock = await pool.query(`
            SELECT * FROM hms.inventory_items
            WHERE (current_stock::float / NULLIF(maximum_stock, 1)) * 100 < $1
        `, [alertThresholds.lowStockPercentage]);
        
        if (lowStock.rows.length > 0) {
            for (const item of lowStock.rows) {
                const alertKey = `low_stock_${item.id}`;
                if (!activeAlerts.has(alertKey)) {
                    await createAlert(
                        'low_stock',
                        item.current_stock < item.minimum_stock ? 'critical' : 'warning',
                        `Low stock alert: ${item.name}`,
                        {
                            item_id: item.id,
                            item_name: item.name,
                            current_stock: item.current_stock,
                            minimum_stock: item.minimum_stock,
                            percentage: Math.round((item.current_stock / item.maximum_stock) * 100)
                        }
                    );
                }
            }
        }
        
        // Check high bed occupancy
        const occupancy = await pool.query(`
            SELECT 
                w.id,
                w.name,
                w.total_beds,
                w.occupied_beds,
                (w.occupied_beds::float / NULLIF(w.total_beds, 1)) * 100 as occupancy_rate
            FROM hms.wards w
            WHERE (w.occupied_beds::float / NULLIF(w.total_beds, 1)) * 100 > $1
        `, [alertThresholds.highOccupancyPercentage]);
        
        if (occupancy.rows.length > 0) {
            for (const ward of occupancy.rows) {
                await createAlert(
                    'high_occupancy',
                    'warning',
                    `High occupancy in ${ward.name}`,
                    {
                        ward_id: ward.id,
                        ward_name: ward.name,
                        occupancy_rate: Math.round(ward.occupancy_rate),
                        occupied: ward.occupied_beds,
                        total: ward.total_beds
                    }
                );
            }
        }
        
        // Check staff shortage
        const staffing = await pool.query(`
            SELECT 
                department,
                COUNT(DISTINCT s.id) as scheduled,
                COUNT(DISTINCT a.staff_id) as present,
                (COUNT(DISTINCT a.staff_id)::float / NULLIF(COUNT(DISTINCT s.id), 1)) as ratio
            FROM hms.schedules s
            LEFT JOIN hms.attendance a ON s.staff_id = a.staff_id AND s.date = a.date
            WHERE s.date = CURRENT_DATE
            GROUP BY department
            HAVING (COUNT(DISTINCT a.staff_id)::float / NULLIF(COUNT(DISTINCT s.id), 1)) < $1
        `, [alertThresholds.lowStaffingRatio]);
        
        if (staffing.rows.length > 0) {
            for (const dept of staffing.rows) {
                await createAlert(
                    'staff_shortage',
                    'warning',
                    `Staff shortage in ${dept.department}`,
                    {
                        department: dept.department,
                        scheduled: dept.scheduled,
                        present: dept.present,
                        shortage_percentage: Math.round((1 - dept.ratio) * 100)
                    }
                );
            }
        }
        
    } catch (error) {
        console.error('Error checking anomalies:', error);
    }
}

// Acknowledge alert
app.put('/api/command-centre/alerts/:alert_id/acknowledge', async (req, res) => {
    try {
        const { alert_id } = req.params;
        const { acknowledged_by } = req.body;
        
        const result = await pool.query(
            `UPDATE command_centre.alerts 
             SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
             WHERE alert_id = $2 RETURNING *`,
            [acknowledged_by, alert_id]
        );
        
        if (result.rows.length > 0) {
            activeAlerts.delete(alert_id);
            broadcast({
                type: 'alert_acknowledged',
                alert_id,
                acknowledged_by
            });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// Resolve alert
app.put('/api/command-centre/alerts/:alert_id/resolve', async (req, res) => {
    try {
        const { alert_id } = req.params;
        const { resolution_notes } = req.body;
        
        const result = await pool.query(
            `UPDATE command_centre.alerts 
             SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, details = details || $1
             WHERE alert_id = $2 RETURNING *`,
            [JSON.stringify({ resolution_notes }), alert_id]
        );
        
        activeAlerts.delete(alert_id);
        
        broadcast({
            type: 'alert_resolved',
            alert_id
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({ error: 'Failed to resolve alert' });
    }
});

// Get active alerts
app.get('/api/command-centre/alerts/active', async (req, res) => {
    try {
        const alerts = await pool.query(`
            SELECT * FROM command_centre.alerts 
            WHERE status IN ('active', 'acknowledged')
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                created_at DESC
        `);
        
        res.json(alerts.rows);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// ==================== PROJECT MANAGEMENT ====================

// Create project
app.post('/api/command-centre/projects', async (req, res) => {
    try {
        const projectData = req.body;
        const projectId = 'PRJ-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(
            `INSERT INTO command_centre.projects (
                project_id, hospital_id, project_name, project_type, status,
                priority, start_date, end_date, budget, project_manager, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                projectId, projectData.hospital_id, projectData.project_name,
                projectData.project_type, projectData.status || 'planning',
                projectData.priority, projectData.start_date, projectData.end_date,
                projectData.budget, projectData.project_manager, projectData.description
            ]
        );
        
        broadcast({
            type: 'project_created',
            project: result.rows[0]
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Get all projects
app.get('/api/command-centre/projects', async (req, res) => {
    try {
        const { status, hospital_id } = req.query;
        
        let query = `
            SELECT p.*, h.name as hospital_name,
                   COUNT(DISTINCT t.id) as total_tasks,
                   COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
            FROM command_centre.projects p
            LEFT JOIN command_centre.hospitals h ON p.hospital_id = h.hospital_id
            LEFT JOIN command_centre.project_tasks t ON p.project_id = t.project_id
            WHERE 1=1
        `;
        
        const params = [];
        if (status) {
            params.push(status);
            query += ` AND p.status = $${params.length}`;
        }
        if (hospital_id) {
            params.push(hospital_id);
            query += ` AND p.hospital_id = $${params.length}`;
        }
        
        query += ' GROUP BY p.id, h.name ORDER BY p.created_at DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Update project progress
app.put('/api/command-centre/projects/:project_id/progress', async (req, res) => {
    try {
        const { project_id } = req.params;
        const { progress, spent, status } = req.body;
        
        const result = await pool.query(
            `UPDATE command_centre.projects 
             SET progress = $1, spent = $2, status = $3, updated_at = CURRENT_TIMESTAMP
             WHERE project_id = $4 RETURNING *`,
            [progress, spent, status, project_id]
        );
        
        broadcast({
            type: 'project_updated',
            project: result.rows[0]
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Create project task
app.post('/api/command-centre/projects/:project_id/tasks', async (req, res) => {
    try {
        const { project_id } = req.params;
        const taskData = req.body;
        const taskId = 'TSK-' + uuidv4().substring(0, 8).toUpperCase();
        
        const result = await pool.query(
            `INSERT INTO command_centre.project_tasks (
                task_id, project_id, task_name, description, assigned_to,
                status, priority, due_date, dependencies
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                taskId, project_id, taskData.task_name, taskData.description,
                taskData.assigned_to, taskData.status || 'pending',
                taskData.priority, taskData.due_date, taskData.dependencies
            ]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Get project dashboard
app.get('/api/command-centre/projects/dashboard', async (req, res) => {
    try {
        const activeProjects = await pool.query(`
            SELECT 
                project_type,
                COUNT(*) as count,
                SUM(budget) as total_budget,
                SUM(spent) as total_spent,
                AVG(progress) as avg_progress
            FROM command_centre.projects
            WHERE status IN ('active', 'in_progress')
            GROUP BY project_type
        `);
        
        const upcomingMilestones = await pool.query(`
            SELECT * FROM command_centre.project_tasks
            WHERE status != 'completed' AND due_date <= CURRENT_DATE + INTERVAL '7 days'
            ORDER BY due_date
            LIMIT 10
        `);
        
        const projectTimeline = await pool.query(`
            SELECT 
                project_id,
                project_name,
                start_date,
                end_date,
                progress,
                status
            FROM command_centre.projects
            WHERE status != 'completed'
            ORDER BY end_date
        `);
        
        res.json({
            project_summary: activeProjects.rows,
            upcoming_milestones: upcomingMilestones.rows,
            project_timeline: projectTimeline.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching project dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch project dashboard' });
    }
});

// ==================== COMPREHENSIVE DASHBOARD ====================

app.get('/api/command-centre/dashboard', async (req, res) => {
    try {
        // Get all metrics in parallel
        const [
            hospitals,
            patientMetrics,
            financialSummary,
            activeAlerts,
            projectStatus,
            inventoryStatus
        ] = await Promise.all([
            // Hospital overview
            pool.query(`
                SELECT COUNT(*) as total_hospitals,
                       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_hospitals
                FROM command_centre.hospitals
            `),
            
            // Patient metrics
            pool.query(`
                SELECT 
                    COUNT(DISTINCT p.id) as total_patients,
                    COUNT(DISTINCT CASE WHEN p.created_at >= NOW() - INTERVAL '24 hours' THEN p.id END) as new_today,
                    COUNT(DISTINCT a.id) as total_admissions,
                    COUNT(DISTINCT CASE WHEN a.status = 'active' THEN a.id END) as current_admissions
                FROM hms.patients p
                LEFT JOIN hms.admissions a ON p.id = a.patient_id
            `),
            
            // Financial summary
            pool.query(`
                SELECT 
                    SUM(CASE WHEN DATE(billing_date) = CURRENT_DATE THEN total_amount END) as today_revenue,
                    SUM(CASE WHEN DATE(billing_date) >= CURRENT_DATE - INTERVAL '7 days' THEN total_amount END) as week_revenue,
                    SUM(CASE WHEN DATE(billing_date) >= CURRENT_DATE - INTERVAL '30 days' THEN total_amount END) as month_revenue,
                    SUM(total_amount - paid_amount) as total_outstanding
                FROM hms.invoices
            `),
            
            // Active alerts count
            pool.query(`
                SELECT 
                    severity,
                    COUNT(*) as count
                FROM command_centre.alerts
                WHERE status = 'active'
                GROUP BY severity
            `),
            
            // Project status
            pool.query(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(progress) as avg_progress
                FROM command_centre.projects
                GROUP BY status
            `),
            
            // Inventory status
            pool.query(`
                SELECT 
                    COUNT(*) as total_items,
                    COUNT(CASE WHEN current_stock <= reorder_level THEN 1 END) as low_stock_items,
                    COUNT(CASE WHEN current_stock <= minimum_stock THEN 1 END) as critical_items
                FROM hms.inventory_items
            `)
        ]);
        
        res.json({
            hospitals: hospitals.rows[0],
            patients: patientMetrics.rows[0],
            financial: financialSummary.rows[0],
            alerts: activeAlerts.rows,
            projects: projectStatus.rows,
            inventory: inventoryStatus.rows[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
});

// ==================== SCHEDULED TASKS ====================

// Schedule anomaly checking every minute
cron.schedule('* * * * *', () => {
    checkForAnomalies();
});

// Schedule metrics collection every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    try {
        // Collect and store real-time metrics
        const metrics = await collectRealTimeMetrics();
        
        // Store in database
        for (const [hospital_id, data] of Object.entries(metrics)) {
            await pool.query(
                `INSERT INTO command_centre.realtime_metrics (hospital_id, metric_type, metric_value)
                 VALUES ($1, $2, $3)`,
                [hospital_id, 'comprehensive', data]
            );
        }
        
        // Broadcast to connected clients
        broadcast({
            type: 'metrics_update',
            metrics
        });
    } catch (error) {
        console.error('Error collecting metrics:', error);
    }
});

// Collect real-time metrics
async function collectRealTimeMetrics() {
    const metrics = {};
    
    try {
        const hospitals = await pool.query('SELECT hospital_id FROM command_centre.hospitals WHERE status = \'active\'');
        
        for (const hospital of hospitals.rows) {
            const hospitalMetrics = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM hms.patients WHERE created_at >= NOW() - INTERVAL '1 hour') as hourly_patients,
                    (SELECT COUNT(*) FROM hms.admissions WHERE status = 'active') as current_admissions,
                    (SELECT COUNT(*) FROM hms.beds WHERE status = 'available') as available_beds,
                    (SELECT COUNT(*) FROM hms.staff s JOIN hms.attendance a ON s.id = a.staff_id WHERE a.date = CURRENT_DATE AND a.status = 'present') as staff_present,
                    (SELECT SUM(total_amount) FROM hms.invoices WHERE DATE(billing_date) = CURRENT_DATE) as today_revenue
            `);
            
            metrics[hospital.hospital_id] = hospitalMetrics.rows[0];
        }
    } catch (error) {
        console.error('Error collecting metrics:', error);
    }
    
    return metrics;
}

// Health check endpoint
app.get('/api/command-centre/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Command Centre',
        timestamp: new Date().toISOString(),
        websocket_clients: wsClients.size,
        active_alerts: activeAlerts.size,
        features: {
            real_time_monitoring: 'active',
            alerting: 'active',
            project_management: 'active',
            websocket: 'active',
            scheduled_tasks: 'active'
        }
    });
});

// Start server
async function startServer() {
    try {
        await initializeDatabase();
        
        server.listen(PORT, () => {
            console.log(`Command Centre running on port ${PORT}`);
            console.log(`WebSocket server ready on ws://localhost:${PORT}`);
            console.log('Anomaly detection scheduled');
            console.log('Real-time metrics collection active');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
