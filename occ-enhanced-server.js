const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { Pool } = require('pg');
const path = require('path');

const port = 10001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:3ifO2knhQgc4@ep-summer-block-a5aem4nh.us-east-2.aws.neon.tech/hospital_management_platform?sslmode=require',
});

// Middleware
app.use(express.json());
app.use(express.static('/root'));

// Alert thresholds
const ALERT_THRESHOLDS = {
  lowStock: 20,
  highOccupancy: 90,
  longWaitTime: 60,
  staffShortage: 0.8,
  revenueTarget: 45000,
  systemHealth: 95
};

// Active alerts storage
let activeAlerts = new Map();

// Project management data
let projectManagement = {
  projects: [
    {
      id: 'PROJ-001',
      name: 'West Wing Expansion',
      hospital: 'Central Hospital',
      type: 'expansion',
      status: 'in_progress',
      progress: 65,
      startDate: '2025-01-15',
      endDate: '2025-12-31',
      budget: 5000000,
      spent: 3250000,
      milestones: [
        { name: 'Foundation', status: 'completed', date: '2025-03-01' },
        { name: 'Structure', status: 'completed', date: '2025-06-01' },
        { name: 'Interior', status: 'in_progress', date: '2025-09-01' },
        { name: 'Equipment', status: 'pending', date: '2025-11-01' }
      ]
    },
    {
      id: 'PROJ-002',
      name: 'IT System Upgrade',
      hospital: 'All Hospitals',
      type: 'it_upgrade',
      status: 'in_progress',
      progress: 45,
      startDate: '2025-08-01',
      endDate: '2025-10-31',
      budget: 500000,
      spent: 225000,
      milestones: [
        { name: 'Server Migration', status: 'completed', date: '2025-08-15' },
        { name: 'Software Deployment', status: 'in_progress', date: '2025-09-15' },
        { name: 'Training', status: 'pending', date: '2025-10-15' }
      ]
    },
    {
      id: 'PROJ-003',
      name: 'Emergency Department Renovation',
      hospital: 'North Hospital',
      type: 'renovation',
      status: 'planning',
      progress: 15,
      startDate: '2025-10-01',
      endDate: '2026-03-31',
      budget: 2000000,
      spent: 50000,
      milestones: [
        { name: 'Design Approval', status: 'in_progress', date: '2025-10-15' },
        { name: 'Contractor Selection', status: 'pending', date: '2025-11-01' },
        { name: 'Construction', status: 'pending', date: '2026-01-01' }
      ]
    }
  ]
};

// Serve Enhanced OCC Dashboard
app.get('/', (req, res) => {
  res.sendFile('/root/occ-enhanced-dashboard.html');
});

// Real-time monitoring data generator
function generateRealTimeData() {
  const now = new Date();
  const hour = now.getHours();
  
  // Simulate realistic patterns based on time of day
  const rushHourFactor = (hour >= 8 && hour <= 11) || (hour >= 16 && hour <= 19) ? 1.3 : 1;
  const nightFactor = hour >= 22 || hour <= 6 ? 0.7 : 1;
  
  return {
    timestamp: now.toISOString(),
    hospitals: [
      {
        id: 'HOSP-001',
        name: 'Central Hospital',
        status: 'operational',
        metrics: {
          patientInflow: Math.floor(15 * rushHourFactor + Math.random() * 5),
          admissions: Math.floor(8 + Math.random() * 4),
          discharges: Math.floor(6 + Math.random() * 3),
          occupancy: 78 + Math.random() * 10,
          emergencyWaitTime: Math.floor(25 * rushHourFactor + Math.random() * 15),
          staffOnDuty: Math.floor(125 * nightFactor + Math.random() * 10),
          dailyRevenue: Math.floor(48700 + Math.random() * 5000)
        },
        departments: {
          emergency: { occupancy: 85 + Math.random() * 10, waitTime: 35 },
          icu: { occupancy: 90 + Math.random() * 8, ventilators: 8 },
          general: { occupancy: 75 + Math.random() * 10, beds: 120 },
          pediatric: { occupancy: 70 + Math.random() * 15, beds: 30 }
        }
      },
      {
        id: 'HOSP-002',
        name: 'North Hospital',
        status: 'operational',
        metrics: {
          patientInflow: Math.floor(12 * rushHourFactor + Math.random() * 4),
          admissions: Math.floor(6 + Math.random() * 3),
          discharges: Math.floor(5 + Math.random() * 2),
          occupancy: 72 + Math.random() * 8,
          emergencyWaitTime: Math.floor(20 * rushHourFactor + Math.random() * 10),
          staffOnDuty: Math.floor(95 * nightFactor + Math.random() * 8),
          dailyRevenue: Math.floor(35000 + Math.random() * 3000)
        }
      },
      {
        id: 'HOSP-003',
        name: 'South Hospital',
        status: 'operational',
        metrics: {
          patientInflow: Math.floor(10 * rushHourFactor + Math.random() * 3),
          admissions: Math.floor(5 + Math.random() * 2),
          discharges: Math.floor(4 + Math.random() * 2),
          occupancy: 68 + Math.random() * 7,
          emergencyWaitTime: Math.floor(18 * rushHourFactor + Math.random() * 8),
          staffOnDuty: Math.floor(80 * nightFactor + Math.random() * 5),
          dailyRevenue: Math.floor(28000 + Math.random() * 2500)
        }
      }
    ],
    aggregated: {
      totalPatientInflow: 0,
      totalAdmissions: 0,
      totalDischarges: 0,
      averageOccupancy: 0,
      totalStaff: 0,
      totalDailyRevenue: 0,
      systemHealth: 98 + Math.random() * 2
    },
    staffKPIs: {
      averagePatientSatisfaction: 4.2 + Math.random() * 0.3,
      staffUtilization: 82 + Math.random() * 8,
      overtimeHours: Math.floor(45 + Math.random() * 15),
      absenteeismRate: 2.5 + Math.random() * 1.5,
      trainingCompliance: 88 + Math.random() * 7
    },
    financialMetrics: {
      dailyRevenue: 0,
      monthlyRevenue: 1461000 + Math.random() * 50000,
      quarterlyRevenue: 4383000 + Math.random() * 150000,
      collectionRate: 73 + Math.random() * 5,
      averageBillValue: 450 + Math.random() * 50,
      insuranceClaims: {
        pending: Math.floor(45 + Math.random() * 10),
        approved: Math.floor(120 + Math.random() * 15),
        rejected: Math.floor(8 + Math.random() * 3)
      }
    }
  };
}

// Check for alerts
function checkAlerts(data) {
  const alerts = [];
  
  data.hospitals.forEach(hospital => {
    // High occupancy alert
    if (hospital.metrics.occupancy > ALERT_THRESHOLDS.highOccupancy) {
      alerts.push({
        id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'critical',
        category: 'occupancy',
        hospital: hospital.name,
        message: `High occupancy alert: ${hospital.name} at ${hospital.metrics.occupancy.toFixed(1)}%`,
        value: hospital.metrics.occupancy,
        threshold: ALERT_THRESHOLDS.highOccupancy,
        timestamp: new Date().toISOString()
      });
    }
    
    // Long wait time alert
    if (hospital.metrics.emergencyWaitTime > ALERT_THRESHOLDS.longWaitTime) {
      alerts.push({
        id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'warning',
        category: 'wait_time',
        hospital: hospital.name,
        message: `Long emergency wait time: ${hospital.metrics.emergencyWaitTime} minutes at ${hospital.name}`,
        value: hospital.metrics.emergencyWaitTime,
        threshold: ALERT_THRESHOLDS.longWaitTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check department-specific alerts
    if (hospital.departments && hospital.departments.icu.occupancy > 95) {
      alerts.push({
        id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'critical',
        category: 'icu',
        hospital: hospital.name,
        message: `ICU critical capacity: ${hospital.departments.icu.occupancy.toFixed(1)}% at ${hospital.name}`,
        value: hospital.departments.icu.occupancy,
        threshold: 95,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Low stock alert simulation (random)
  if (Math.random() < 0.05) {
    alerts.push({
      id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'warning',
      category: 'inventory',
      hospital: 'Central Hospital',
      message: 'Low stock alert: Paracetamol 500mg below reorder point',
      value: 18,
      threshold: ALERT_THRESHOLDS.lowStock,
      timestamp: new Date().toISOString()
    });
  }
  
  // Revenue target alert
  if (data.financialMetrics.dailyRevenue < ALERT_THRESHOLDS.revenueTarget) {
    alerts.push({
      id: `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'info',
      category: 'financial',
      hospital: 'All Hospitals',
      message: `Daily revenue below target: ₵${data.financialMetrics.dailyRevenue.toFixed(0)}`,
      value: data.financialMetrics.dailyRevenue,
      threshold: ALERT_THRESHOLDS.revenueTarget,
      timestamp: new Date().toISOString()
    });
  }
  
  return alerts;
}

// API Endpoints

// Get real-time metrics
app.get('/api/occ/metrics/realtime', (req, res) => {
  const data = generateRealTimeData();
  
  // Calculate aggregated metrics
  data.hospitals.forEach(hospital => {
    data.aggregated.totalPatientInflow += hospital.metrics.patientInflow;
    data.aggregated.totalAdmissions += hospital.metrics.admissions;
    data.aggregated.totalDischarges += hospital.metrics.discharges;
    data.aggregated.totalStaff += hospital.metrics.staffOnDuty;
    data.aggregated.totalDailyRevenue += hospital.metrics.dailyRevenue;
  });
  
  data.aggregated.averageOccupancy = 
    data.hospitals.reduce((sum, h) => sum + h.metrics.occupancy, 0) / data.hospitals.length;
  
  data.financialMetrics.dailyRevenue = data.aggregated.totalDailyRevenue;
  
  // Check for alerts
  const newAlerts = checkAlerts(data);
  newAlerts.forEach(alert => {
    activeAlerts.set(alert.id, alert);
  });
  
  res.json(data);
});

// Get all hospitals overview
app.get('/api/occ/hospitals', (req, res) => {
  const data = generateRealTimeData();
  res.json({
    hospitals: data.hospitals,
    totalHospitals: data.hospitals.length,
    operationalCount: data.hospitals.filter(h => h.status === 'operational').length
  });
});

// Get active alerts
app.get('/api/occ/alerts', (req, res) => {
  const alerts = Array.from(activeAlerts.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 50); // Return last 50 alerts
  
  res.json({
    activeAlerts: alerts.length,
    criticalCount: alerts.filter(a => a.type === 'critical').length,
    warningCount: alerts.filter(a => a.type === 'warning').length,
    infoCount: alerts.filter(a => a.type === 'info').length,
    alerts: alerts
  });
});

// Acknowledge alert
app.post('/api/occ/alerts/:alertId/acknowledge', (req, res) => {
  const { alertId } = req.params;
  const { acknowledgedBy, notes } = req.body;
  
  if (activeAlerts.has(alertId)) {
    const alert = activeAlerts.get(alertId);
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date().toISOString();
    alert.notes = notes;
    activeAlerts.set(alertId, alert);
    res.json({ success: true, alert });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

// Project Management Endpoints

// Get all projects
app.get('/api/occ/projects', (req, res) => {
  res.json({
    totalProjects: projectManagement.projects.length,
    inProgress: projectManagement.projects.filter(p => p.status === 'in_progress').length,
    planning: projectManagement.projects.filter(p => p.status === 'planning').length,
    completed: projectManagement.projects.filter(p => p.status === 'completed').length,
    totalBudget: projectManagement.projects.reduce((sum, p) => sum + p.budget, 0),
    totalSpent: projectManagement.projects.reduce((sum, p) => sum + p.spent, 0),
    projects: projectManagement.projects
  });
});

// Get project by ID
app.get('/api/occ/projects/:projectId', (req, res) => {
  const project = projectManagement.projects.find(p => p.id === req.params.projectId);
  if (project) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Create new project
app.post('/api/occ/projects', (req, res) => {
  const newProject = {
    id: `PROJ-${Date.now().toString().slice(-3)}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  projectManagement.projects.push(newProject);
  res.status(201).json(newProject);
});

// Update project
app.put('/api/occ/projects/:projectId', (req, res) => {
  const projectIndex = projectManagement.projects.findIndex(p => p.id === req.params.projectId);
  if (projectIndex !== -1) {
    projectManagement.projects[projectIndex] = {
      ...projectManagement.projects[projectIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    res.json(projectManagement.projects[projectIndex]);
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Update project milestone
app.post('/api/occ/projects/:projectId/milestones', (req, res) => {
  const project = projectManagement.projects.find(p => p.id === req.params.projectId);
  if (project) {
    const { milestoneName, status } = req.body;
    const milestone = project.milestones.find(m => m.name === milestoneName);
    if (milestone) {
      milestone.status = status;
      milestone.updatedAt = new Date().toISOString();
      res.json(project);
    } else {
      res.status(404).json({ error: 'Milestone not found' });
    }
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Staff KPIs endpoint
app.get('/api/occ/staff/kpis', async (req, res) => {
  try {
    const kpis = {
      overall: {
        totalStaff: 342,
        activeShifts: 125,
        averagePatientLoad: 8.5,
        satisfactionScore: 4.3,
        efficiency: 87
      },
      byDepartment: [
        { department: 'Emergency', staff: 45, utilization: 92, satisfaction: 4.1 },
        { department: 'ICU', staff: 38, utilization: 88, satisfaction: 4.4 },
        { department: 'General', staff: 125, utilization: 85, satisfaction: 4.3 },
        { department: 'Surgery', staff: 42, utilization: 78, satisfaction: 4.5 },
        { department: 'Pediatric', staff: 35, utilization: 80, satisfaction: 4.6 }
      ],
      performance: {
        topPerformers: [
          { name: 'Dr. John Mensah', department: 'Surgery', score: 95 },
          { name: 'Nurse Mary Owusu', department: 'ICU', score: 93 },
          { name: 'Dr. Kofi Appiah', department: 'Emergency', score: 91 }
        ],
        needsImprovement: 3,
        onProbation: 1
      }
    };
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Financial metrics detailed endpoint
app.get('/api/occ/financial/detailed', (req, res) => {
  const financial = {
    revenue: {
      today: 111700,
      week: 781900,
      month: 1461000,
      quarter: 4383000,
      year: 17532000
    },
    breakdown: {
      cash: { amount: 33510, percentage: 30 },
      insurance: { amount: 44680, percentage: 40 },
      nhis: { amount: 22340, percentage: 20 },
      hmo: { amount: 11170, percentage: 10 }
    },
    trends: {
      daily: [45000, 48700, 52000, 49500, 47800, 51200, 111700],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    projections: {
      nextMonth: 1510000,
      nextQuarter: 4530000,
      confidence: 85
    }
  };
  res.json(financial);
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('OCC Dashboard client connected');
  
  // Send initial data
  socket.emit('initial', {
    message: 'Connected to OCC Command Centre',
    timestamp: new Date().toISOString()
  });
  
  // Send real-time updates every 5 seconds
  const interval = setInterval(() => {
    const data = generateRealTimeData();
    
    // Calculate aggregated metrics
    data.hospitals.forEach(hospital => {
      data.aggregated.totalPatientInflow += hospital.metrics.patientInflow;
      data.aggregated.totalAdmissions += hospital.metrics.admissions;
      data.aggregated.totalDischarges += hospital.metrics.discharges;
      data.aggregated.totalStaff += hospital.metrics.staffOnDuty;
      data.aggregated.totalDailyRevenue += hospital.metrics.dailyRevenue;
    });
    
    data.aggregated.averageOccupancy = 
      data.hospitals.reduce((sum, h) => sum + h.metrics.occupancy, 0) / data.hospitals.length;
    
    // Check for new alerts
    const newAlerts = checkAlerts(data);
    if (newAlerts.length > 0) {
      newAlerts.forEach(alert => activeAlerts.set(alert.id, alert));
      socket.emit('alerts', newAlerts);
    }
    
    socket.emit('metrics', data);
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('OCC Dashboard client disconnected');
    clearInterval(interval);
  });
});

// Start server
http.listen(port, () => {
  console.log(`Enhanced OCC Command Centre running on port ${port}`);
  console.log(`Real-time monitoring active`);
  console.log(`Alert system initialized`);
  console.log(`Project management module ready`);
});
