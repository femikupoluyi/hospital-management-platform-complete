const express = require('express');
const app = express();
const http = require('http').createServer(app);
const path = require('path');

const port = 10000;

// Middleware
app.use(express.json());
app.use(express.static('/root'));

// Serve OCC Dashboard
app.get('/', (req, res) => {
  res.sendFile('/root/occ-dashboard.html');
});

// OCC API Endpoints
app.get('/api/occ/metrics/realtime', (req, res) => {
  const currentTime = new Date();
  res.json({
    timestamp: currentTime.toISOString(),
    systemHealth: {
      overall: 99.9,
      servers: 100,
      network: 99.8,
      database: 100,
      applications: 99.9
    },
    patientFlow: {
      currentInPatients: 1247,
      todayAdmissions: 142,
      todayDischarges: 98,
      emergencyQueue: 23,
      averageWaitTime: 28,
      criticalPatients: 12
    },
    occupancy: {
      overall: 78.5,
      icu: 85,
      general: 76,
      maternity: 72,
      pediatric: 81,
      emergency: 92
    },
    staffing: {
      currentOnDuty: 342,
      doctors: 45,
      nurses: 186,
      technicians: 67,
      support: 44,
      utilization: 87.5
    },
    financial: {
      todayRevenue: 48700,
      pendingBills: 42,
      insuranceClaims: 23,
      cashCollected: 28500,
      insuranceReceived: 20200
    }
  });
});

app.get('/api/occ/hospitals/status', (req, res) => {
  res.json([
    {
      id: 'H001',
      name: 'Accra General Hospital',
      location: 'Accra',
      status: 'operational',
      occupancy: 82,
      staffLevel: 95,
      emergencyWait: 22,
      todayRevenue: 18200,
      alerts: []
    },
    {
      id: 'H002',
      name: 'Kumasi Medical Center',
      location: 'Kumasi',
      status: 'warning',
      occupancy: 91,
      staffLevel: 78,
      emergencyWait: 45,
      todayRevenue: 15800,
      alerts: ['High occupancy', 'Staff shortage']
    },
    {
      id: 'H003',
      name: 'Takoradi Health Facility',
      location: 'Takoradi',
      status: 'operational',
      occupancy: 68,
      staffLevel: 88,
      emergencyWait: 18,
      todayRevenue: 9300,
      alerts: []
    },
    {
      id: 'H004',
      name: 'Cape Coast Regional',
      location: 'Cape Coast',
      status: 'operational',
      occupancy: 74,
      staffLevel: 92,
      emergencyWait: 25,
      todayRevenue: 5400,
      alerts: []
    }
  ]);
});

app.get('/api/occ/alerts/active', (req, res) => {
  res.json([
    {
      id: 'ALT001',
      severity: 'critical',
      type: 'occupancy',
      hospital: 'Kumasi Medical Center',
      message: 'ER at 95% capacity',
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      acknowledged: false
    },
    {
      id: 'ALT002',
      severity: 'warning',
      type: 'inventory',
      hospital: 'Accra General Hospital',
      message: 'Paracetamol below reorder point',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      acknowledged: false
    },
    {
      id: 'ALT003',
      severity: 'critical',
      type: 'staffing',
      hospital: 'Kumasi Medical Center',
      message: 'Night shift understaffed - 3 nurses short',
      timestamp: new Date(Date.now() - 22 * 60000).toISOString(),
      acknowledged: true
    },
    {
      id: 'ALT004',
      severity: 'info',
      type: 'maintenance',
      hospital: 'Accra General Hospital',
      message: 'MRI scheduled maintenance in 2 hours',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      acknowledged: true
    },
    {
      id: 'ALT005',
      severity: 'warning',
      type: 'financial',
      hospital: 'Takoradi Health Facility',
      message: 'Revenue 12% below daily target',
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      acknowledged: false
    }
  ]);
});

app.get('/api/occ/projects', (req, res) => {
  res.json([
    {
      id: 'PRJ001',
      name: 'Kumasi ICU Expansion',
      type: 'infrastructure',
      status: 'in_progress',
      budget: 2500000,
      spent: 1625000,
      completion: 65,
      startDate: '2025-06-01',
      expectedEnd: '2025-12-31',
      milestones: [
        { name: 'Foundation', status: 'completed' },
        { name: 'Structure', status: 'completed' },
        { name: 'Equipment Installation', status: 'in_progress' },
        { name: 'Testing & Commissioning', status: 'pending' }
      ]
    },
    {
      id: 'PRJ002',
      name: 'EMR System Upgrade - All Locations',
      type: 'technology',
      status: 'in_progress',
      budget: 800000,
      spent: 320000,
      completion: 40,
      startDate: '2025-08-15',
      expectedEnd: '2026-01-31',
      milestones: [
        { name: 'Requirements Analysis', status: 'completed' },
        { name: 'Development', status: 'in_progress' },
        { name: 'Testing', status: 'pending' },
        { name: 'Deployment', status: 'pending' }
      ]
    },
    {
      id: 'PRJ003',
      name: 'Takoradi Maternity Wing',
      type: 'infrastructure',
      status: 'planning',
      budget: 1800000,
      spent: 270000,
      completion: 15,
      startDate: '2025-09-01',
      expectedEnd: '2026-03-31',
      milestones: [
        { name: 'Design', status: 'in_progress' },
        { name: 'Approvals', status: 'pending' },
        { name: 'Construction', status: 'pending' },
        { name: 'Equipment', status: 'pending' }
      ]
    }
  ]);
});

app.get('/api/occ/analytics/trends', (req, res) => {
  res.json({
    occupancyTrend: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      data: [72, 74, 78, 81, 79, 85, 78.5]
    },
    revenueTrend: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      data: [285000, 298000, 312000, 304000]
    },
    patientSatisfaction: {
      current: 4.2,
      previous: 4.1,
      target: 4.5
    },
    staffProductivity: {
      current: 87,
      previous: 85,
      target: 90
    }
  });
});

app.get('/api/occ/performance/kpis', (req, res) => {
  res.json({
    clinical: {
      mortalityRate: 1.2,
      infectionRate: 0.8,
      readmissionRate: 5.3,
      surgicalSuccessRate: 98.2
    },
    operational: {
      bedTurnoverRate: 4.2,
      averageLengthOfStay: 3.8,
      emergencyResponseTime: 12,
      equipmentUtilization: 78
    },
    financial: {
      revenuePerPatient: 450,
      costPerPatient: 380,
      profitMargin: 15.6,
      collectionEfficiency: 92
    },
    quality: {
      patientSatisfactionScore: 4.2,
      clinicalOutcomeScore: 8.5,
      safetyIncidents: 2,
      complianceScore: 95
    }
  });
});

app.post('/api/occ/alerts/acknowledge', (req, res) => {
  const { alertId } = req.body;
  res.json({
    success: true,
    alertId,
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: 'OCC Operator'
  });
});

app.get('/api/occ/activity/feed', (req, res) => {
  const activities = [
    { type: 'admission', icon: '🚑', message: 'Emergency admission at Accra General', hospital: 'Accra' },
    { type: 'discharge', icon: '🛏️', message: '3 patients discharged from General Ward', hospital: 'Kumasi' },
    { type: 'staff', icon: '👨‍⚕️', message: 'Dr. Asante completed surgery', hospital: 'Cape Coast' },
    { type: 'inventory', icon: '💊', message: 'Pharmacy restock completed', hospital: 'Takoradi' },
    { type: 'financial', icon: '💰', message: 'Insurance claim approved - ₵12,500', hospital: 'Accra' },
    { type: 'maintenance', icon: '🔧', message: 'X-ray machine maintenance completed', hospital: 'Kumasi' }
  ];
  
  const recentActivities = [];
  for (let i = 0; i < 10; i++) {
    const activity = activities[Math.floor(Math.random() * activities.length)];
    recentActivities.push({
      ...activity,
      timestamp: new Date(Date.now() - i * 5 * 60000).toISOString(),
      id: `ACT${String(i).padStart(3, '0')}`
    });
  }
  
  res.json(recentActivities);
});

// Anomaly detection endpoint
app.get('/api/occ/anomalies/detect', (req, res) => {
  res.json({
    detected: [
      {
        type: 'patient_flow',
        severity: 'medium',
        description: 'Unusual spike in ER admissions at Kumasi',
        metric: 'er_admissions',
        expected: 12,
        actual: 23,
        deviation: '+91.7%',
        recommendation: 'Consider activating surge protocol'
      },
      {
        type: 'revenue',
        severity: 'low',
        description: 'Below average revenue collection at Takoradi',
        metric: 'daily_revenue',
        expected: 10500,
        actual: 9300,
        deviation: '-11.4%',
        recommendation: 'Review billing and collection processes'
      },
      {
        type: 'equipment',
        severity: 'high',
        description: 'CT Scanner utilization above threshold',
        metric: 'equipment_usage',
        expected: 85,
        actual: 98,
        deviation: '+15.3%',
        recommendation: 'Schedule preventive maintenance'
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Resource optimization suggestions
app.get('/api/occ/optimization/suggestions', (req, res) => {
  res.json([
    {
      category: 'staffing',
      suggestion: 'Redistribute 2 nurses from Cape Coast to Kumasi night shift',
      impact: 'Reduce overtime costs by ₵3,200/month',
      priority: 'high'
    },
    {
      category: 'inventory',
      suggestion: 'Implement just-in-time ordering for non-critical supplies',
      impact: 'Reduce inventory holding costs by 15%',
      priority: 'medium'
    },
    {
      category: 'scheduling',
      suggestion: 'Optimize surgery scheduling to reduce OR idle time',
      impact: 'Increase OR utilization by 12%',
      priority: 'medium'
    },
    {
      category: 'bed_management',
      suggestion: 'Convert 5 general beds to day-care beds in Accra',
      impact: 'Increase patient throughput by 20%',
      priority: 'low'
    }
  ]);
});

// Start server
http.listen(port, '0.0.0.0', () => {
  console.log(`Operations Command Centre running on port ${port}`);
  console.log(`Access at: http://localhost:${port}`);
});
