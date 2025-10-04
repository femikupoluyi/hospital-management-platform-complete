#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

// Database configuration
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });

// Store active connections
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New WebSocket client connected');
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast function for real-time updates
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Real-time metrics fetcher
async function fetchRealTimeMetrics() {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    // Patient flow metrics
    const patientFlow = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM crm.patients WHERE created_at >= CURRENT_DATE) as new_patients_today,
        (SELECT COUNT(*) FROM crm.appointments WHERE status = 'scheduled' AND appointment_date = CURRENT_DATE) as appointments_today,
        (SELECT COUNT(*) FROM emr.encounters WHERE DATE(admission_date) = CURRENT_DATE) as encounters_today,
        (SELECT COUNT(*) FROM crm.appointments WHERE status = 'in_progress') as patients_in_facility
    `);
    
    // Staff metrics
    const staffMetrics = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM hr.staff WHERE employment_status = 'active') as total_staff,
        (SELECT COUNT(*) FROM hr.staff_schedules WHERE schedule_date = CURRENT_DATE AND status = 'scheduled') as staff_on_duty,
        (SELECT AVG(overtime_hours) FROM hr.staff_schedules WHERE schedule_date >= CURRENT_DATE - INTERVAL '7 days') as avg_overtime
    `);
    
    // Financial metrics
    const financialMetrics = await client.query(`
      SELECT 
        (SELECT COALESCE(SUM(total_amount), 0) FROM billing.invoices WHERE invoice_date = CURRENT_DATE) as revenue_today,
        (SELECT COALESCE(SUM(total_amount), 0) FROM billing.invoices WHERE invoice_date >= CURRENT_DATE - INTERVAL '30 days') as revenue_month,
        (SELECT COUNT(*) FROM billing.invoices WHERE payment_status = 'pending') as pending_invoices,
        (SELECT COALESCE(SUM(amount), 0) FROM billing.payments WHERE payment_date = CURRENT_DATE) as collections_today
    `);
    
    // Operational metrics
    const operationalMetrics = await client.query(`
      SELECT 
        COALESCE(AVG(bed_occupancy_rate), 0) as avg_bed_occupancy,
        COALESCE(AVG(emergency_wait_time_minutes), 0) as avg_wait_time,
        COALESCE(AVG(staff_utilization_rate), 0) as staff_utilization
      FROM analytics.operational_metrics
      WHERE metric_date = CURRENT_DATE
    `);
    
    // Inventory alerts
    const inventoryAlerts = await client.query(`
      SELECT 
        i.item_name,
        sl.quantity_on_hand,
        sl.reorder_level
      FROM inventory.stock_levels sl
      JOIN inventory.items i ON i.item_id = sl.item_id
      WHERE sl.quantity_on_hand <= sl.reorder_level
      AND i.is_active = true
      LIMIT 5
    `);
    
    return {
      timestamp: new Date().toISOString(),
      patientFlow: patientFlow.rows[0],
      staffMetrics: staffMetrics.rows[0],
      financialMetrics: financialMetrics.rows[0],
      operationalMetrics: operationalMetrics.rows[0],
      inventoryAlerts: inventoryAlerts.rows
    };
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return null;
  } finally {
    await client.end();
  }
}

// Alert generation system
async function generateAlerts() {
  const client = new Client(DB_CONFIG);
  const alerts = [];
  
  try {
    await client.connect();
    
    // Check for low stock
    const lowStock = await client.query(`
      SELECT 
        i.item_name,
        sl.quantity_on_hand,
        sl.reorder_level
      FROM inventory.stock_levels sl
      JOIN inventory.items i ON i.item_id = sl.item_id
      WHERE sl.quantity_on_hand <= sl.reorder_level
      AND i.is_active = true
    `);
    
    lowStock.rows.forEach(item => {
      alerts.push({
        id: `stock-${item.item_name}`,
        type: 'inventory',
        severity: item.quantity_on_hand <= item.reorder_level * 0.5 ? 'critical' : 'warning',
        title: 'Low Stock Alert',
        message: `${item.item_name} is low (${item.quantity_on_hand} units remaining)`,
        timestamp: new Date().toISOString()
      });
    });
    
    // Check for high wait times
    const waitTime = await client.query(`
      SELECT emergency_wait_time_minutes
      FROM analytics.operational_metrics
      WHERE metric_date = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (waitTime.rows.length > 0 && waitTime.rows[0].emergency_wait_time_minutes > 60) {
      alerts.push({
        id: 'wait-time-high',
        type: 'operational',
        severity: 'warning',
        title: 'High Wait Time',
        message: `Emergency wait time is ${waitTime.rows[0].emergency_wait_time_minutes} minutes`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check for overdue invoices
    const overdueInvoices = await client.query(`
      SELECT COUNT(*) as count, SUM(total_amount) as total
      FROM billing.invoices
      WHERE payment_status = 'pending'
      AND due_date < CURRENT_DATE
    `);
    
    if (overdueInvoices.rows[0].count > 0) {
      alerts.push({
        id: 'overdue-invoices',
        type: 'financial',
        severity: 'warning',
        title: 'Overdue Invoices',
        message: `${overdueInvoices.rows[0].count} invoices overdue (Total: $${overdueInvoices.rows[0].total})`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check bed occupancy
    const occupancy = await client.query(`
      SELECT bed_occupancy_rate
      FROM analytics.operational_metrics
      WHERE metric_date = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (occupancy.rows.length > 0 && occupancy.rows[0].bed_occupancy_rate > 90) {
      alerts.push({
        id: 'high-occupancy',
        type: 'capacity',
        severity: 'critical',
        title: 'High Bed Occupancy',
        message: `Bed occupancy at ${occupancy.rows[0].bed_occupancy_rate}%`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Store alerts in database
    for (const alert of alerts) {
      await client.query(`
        INSERT INTO occ.alerts 
        (id, alert_type, severity, title, message, status, created_at)
        VALUES 
        (gen_random_uuid(), $1, $2, $3, $4, 'active', NOW())
        ON CONFLICT DO NOTHING
      `, [alert.type, alert.severity, alert.title, alert.message]);
    }
    
    return alerts;
  } catch (error) {
    console.error('Error generating alerts:', error);
    return alerts;
  } finally {
    await client.end();
  }
}

// API Endpoints

// Get real-time dashboard data
app.get('/api/occ/dashboard', async (req, res) => {
  const metrics = await fetchRealTimeMetrics();
  const alerts = await generateAlerts();
  
  res.json({
    success: true,
    data: {
      metrics,
      alerts,
      lastUpdated: new Date().toISOString()
    }
  });
});

// Get hospital overview
app.get('/api/occ/hospitals', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const hospitals = await client.query(`
      SELECT 
        h.id,
        h.name as hospital_name,
        h.city,
        h.state,
        h.bed_capacity,
        h.staff_count,
        h.status,
        COUNT(DISTINCT p.id) as patient_count
      FROM organization.hospitals h
      LEFT JOIN crm.patients p ON p.hospital_id = h.id
      GROUP BY h.id, h.name, h.city, h.state, h.bed_capacity, h.staff_count, h.status
      ORDER BY h.name
    `);
    
    res.json({ success: true, data: hospitals.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get project management data
app.get('/api/occ/projects', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const projects = await client.query(`
      SELECT * FROM occ.projects
      ORDER BY priority DESC, start_date ASC
    `);
    
    res.json({ success: true, data: projects.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Create new project
app.post('/api/occ/projects', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { 
      project_name, project_type, hospital_id, description,
      start_date, end_date, budget, priority 
    } = req.body;
    
    const result = await client.query(`
      INSERT INTO occ.projects 
      (id, project_name, project_type, hospital_id, description,
       start_date, end_date, budget, status, priority, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'planning', $8, NOW())
      RETURNING *
    `, [project_name, project_type, hospital_id, description,
        start_date, end_date, budget, priority || 'medium']);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Update project status
app.put('/api/occ/projects/:projectId', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { projectId } = req.params;
    const { status, progress_percentage, notes } = req.body;
    
    const result = await client.query(`
      UPDATE occ.projects 
      SET status = $1, progress_percentage = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, progress_percentage, projectId]);
    
    // Log project update
    if (notes) {
      await client.query(`
        INSERT INTO occ.project_updates 
        (id, project_id, update_type, description, created_at)
        VALUES 
        (gen_random_uuid(), $1, 'status_change', $2, NOW())
      `, [projectId, notes]);
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get alerts
app.get('/api/occ/alerts', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const alerts = await client.query(`
      SELECT * FROM occ.alerts
      WHERE status = 'active'
      ORDER BY severity DESC, created_at DESC
      LIMIT 50
    `);
    
    res.json({ success: true, data: alerts.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Acknowledge alert
app.post('/api/occ/alerts/:alertId/acknowledge', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    const { alertId } = req.params;
    const { acknowledged_by, notes } = req.body;
    
    await client.query(`
      UPDATE occ.alerts 
      SET status = 'acknowledged', 
          acknowledged_at = NOW(),
          acknowledged_by = $1,
          resolution_notes = $2
      WHERE id = $3
    `, [acknowledged_by || 'system', notes, alertId]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Get KPIs
app.get('/api/occ/kpis', async (req, res) => {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const kpis = await client.query(`
      SELECT 
        'Patient Satisfaction' as kpi_name,
        COALESCE(AVG(rating), 0) as value,
        'score' as unit
      FROM crm.patient_feedback
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      UNION ALL
      SELECT 
        'Average Wait Time' as kpi_name,
        COALESCE(AVG(emergency_wait_time_minutes), 0) as value,
        'minutes' as unit
      FROM analytics.operational_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
      UNION ALL
      SELECT 
        'Bed Occupancy Rate' as kpi_name,
        COALESCE(AVG(bed_occupancy_rate), 0) as value,
        'percent' as unit
      FROM analytics.operational_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
      UNION ALL
      SELECT 
        'Staff Utilization' as kpi_name,
        COALESCE(AVG(staff_utilization_rate), 0) as value,
        'percent' as unit
      FROM analytics.operational_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    res.json({ success: true, data: kpis.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.end();
  }
});

// Serve HTML dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/occ-dashboard.html');
});

// Start periodic updates
setInterval(async () => {
  const metrics = await fetchRealTimeMetrics();
  const alerts = await generateAlerts();
  
  if (metrics) {
    broadcast({
      type: 'metrics_update',
      data: { metrics, alerts }
    });
  }
}, 10000); // Update every 10 seconds

// Initialize database tables
async function initializeDatabase() {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    // Create OCC schema if not exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS occ`);
    
    // Create alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS occ.alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50),
        severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'critical')),
        title VARCHAR(200),
        message TEXT,
        status VARCHAR(20) DEFAULT 'active',
        acknowledged_at TIMESTAMP,
        acknowledged_by VARCHAR(100),
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS occ.projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_name VARCHAR(200) NOT NULL,
        project_type VARCHAR(50),
        hospital_id UUID REFERENCES organization.hospitals(id),
        description TEXT,
        start_date DATE,
        end_date DATE,
        budget DECIMAL(12,2),
        actual_cost DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'planning',
        priority VARCHAR(20) DEFAULT 'medium',
        progress_percentage INT DEFAULT 0,
        assigned_to VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create project updates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS occ.project_updates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES occ.projects(id),
        update_type VARCHAR(50),
        description TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create KPI targets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS occ.kpi_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kpi_name VARCHAR(100),
        target_value DECIMAL(10,2),
        current_value DECIMAL(10,2),
        unit VARCHAR(20),
        period VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await client.end();
  }
}

const PORT = process.env.PORT || 15000;

// Initialize database and start server
initializeDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`🏥 OCC Command Centre running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  });
});
