const express = require('express');
const app = express();
const port = 11000;

// Middleware
app.use(express.json());
app.use(express.static('/root'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Partner Integration API',
    timestamp: new Date().toISOString()
  });
});

// Serve Partner Integration Portal
app.get('/', (req, res) => {
  res.sendFile('/root/partner-integration-portal.html');
});

// Insurance Integration APIs
app.get('/api/partners/insurance/nhis/status', (req, res) => {
  res.json({
    status: 'active',
    connected: true,
    lastSync: new Date(Date.now() - 5 * 60000).toISOString(),
    statistics: {
      todayClaims: 423,
      approvalRate: 87,
      pendingClaims: 52,
      todayRevenue: 125000,
      averageProcessingTime: '2.5 hours'
    }
  });
});

app.post('/api/partners/insurance/nhis/claim', (req, res) => {
  const { patientId, serviceDate, services, totalAmount } = req.body;
  res.json({
    claimId: `NHIS-${Date.now()}`,
    status: 'submitted',
    patientId,
    serviceDate,
    totalAmount,
    estimatedApproval: '24-48 hours',
    trackingNumber: `TRK${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  });
});

app.post('/api/partners/insurance/verify-eligibility', (req, res) => {
  const { insuranceId, providerId, patientId } = req.body;
  res.json({
    eligible: true,
    coverage: {
      percentage: 80,
      deductible: 500,
      deductibleMet: 350,
      outOfPocketMax: 5000,
      outOfPocketMet: 1200
    },
    benefits: {
      consultation: 'covered',
      diagnostics: 'covered',
      medications: 'partial',
      surgery: 'pre-auth required'
    }
  });
});

app.get('/api/partners/insurance/claims', (req, res) => {
  res.json([
    {
      claimId: 'CLM-2025-001',
      patientName: 'Kwame Asante',
      provider: 'NHIS',
      amount: 2500,
      status: 'approved',
      submittedDate: '2025-09-28',
      approvedDate: '2025-09-30'
    },
    {
      claimId: 'CLM-2025-002',
      patientName: 'Ama Boateng',
      provider: 'Prudential',
      amount: 3200,
      status: 'pending',
      submittedDate: '2025-09-29'
    },
    {
      claimId: 'CLM-2025-003',
      patientName: 'John Mensah',
      provider: 'NHIS',
      amount: 1800,
      status: 'approved',
      submittedDate: '2025-09-27',
      approvedDate: '2025-09-29'
    }
  ]);
});

// Pharmacy & Supplier Integration APIs
app.get('/api/partners/suppliers', (req, res) => {
  res.json([
    {
      supplierId: 'SUP001',
      name: 'MedSupply Ghana Ltd',
      category: 'Pharmaceuticals',
      rating: 5,
      activeOrders: 12,
      nextDelivery: 'Tomorrow',
      catalog: 2847
    },
    {
      supplierId: 'SUP002',
      name: 'HealthEquip Solutions',
      category: 'Medical Equipment',
      rating: 4,
      activeOrders: 3,
      nextDelivery: 'Oct 5, 2025',
      catalog: 523
    },
    {
      supplierId: 'SUP003',
      name: 'PharmaCare Wholesale',
      category: 'Generic Drugs',
      rating: 5,
      activeOrders: 8,
      nextDelivery: 'Oct 3, 2025',
      catalog: 1876
    }
  ]);
});

app.post('/api/partners/suppliers/order', (req, res) => {
  const { supplierId, items, urgency } = req.body;
  res.json({
    orderId: `ORD-${Date.now()}`,
    supplierId,
    status: 'confirmed',
    estimatedDelivery: urgency === 'urgent' ? 'Within 24 hours' : '2-3 business days',
    totalAmount: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    trackingUrl: `https://track.supplier.com/${Date.now()}`
  });
});

app.get('/api/partners/suppliers/catalog/:supplierId', (req, res) => {
  res.json({
    supplierId: req.params.supplierId,
    categories: [
      {
        name: 'Antibiotics',
        items: 234
      },
      {
        name: 'Pain Management',
        items: 156
      },
      {
        name: 'Cardiovascular',
        items: 189
      },
      {
        name: 'Diabetes Care',
        items: 98
      }
    ],
    featured: [
      {
        itemId: 'MED001',
        name: 'Paracetamol 500mg',
        unitPrice: 0.5,
        inStock: true,
        minOrder: 100
      },
      {
        itemId: 'MED002',
        name: 'Amoxicillin 250mg',
        unitPrice: 1.2,
        inStock: true,
        minOrder: 50
      }
    ]
  });
});

app.get('/api/partners/inventory/reorder-suggestions', (req, res) => {
  res.json([
    {
      item: 'Paracetamol 500mg',
      currentStock: 120,
      reorderPoint: 200,
      suggestedQuantity: 500,
      supplier: 'MedSupply Ghana Ltd',
      estimatedCost: 250
    },
    {
      item: 'Surgical Gloves (M)',
      currentStock: 50,
      reorderPoint: 100,
      suggestedQuantity: 300,
      supplier: 'HealthEquip Solutions',
      estimatedCost: 180
    },
    {
      item: 'Insulin Syringes',
      currentStock: 200,
      reorderPoint: 300,
      suggestedQuantity: 600,
      supplier: 'PharmaCare Wholesale',
      estimatedCost: 420
    }
  ]);
});

// Telemedicine Integration APIs
app.get('/api/partners/telemedicine/consultations', (req, res) => {
  res.json([
    {
      consultationId: 'TEL001',
      patient: 'Sarah Johnson',
      doctor: 'Dr. Mensah',
      specialty: 'Cardiology',
      scheduledTime: '2025-09-30T14:00:00',
      type: 'follow-up',
      status: 'scheduled',
      roomUrl: 'https://meet.telemedicine.com/room/tel001'
    },
    {
      consultationId: 'TEL002',
      patient: 'Kwame Asante',
      doctor: 'Dr. Owusu',
      specialty: 'General Medicine',
      scheduledTime: '2025-09-30T15:30:00',
      type: 'initial',
      status: 'scheduled',
      roomUrl: 'https://meet.telemedicine.com/room/tel002'
    },
    {
      consultationId: 'TEL003',
      patient: 'Ama Boateng',
      doctor: 'Dr. Appiah',
      specialty: 'Pediatrics',
      scheduledTime: '2025-10-01T10:00:00',
      type: 'routine',
      status: 'scheduled',
      roomUrl: 'https://meet.telemedicine.com/room/tel003'
    }
  ]);
});

app.post('/api/partners/telemedicine/schedule', (req, res) => {
  const { patientId, doctorId, dateTime, type, reason } = req.body;
  res.json({
    consultationId: `TEL${Date.now()}`,
    patientId,
    doctorId,
    scheduledTime: dateTime,
    type,
    status: 'confirmed',
    roomUrl: `https://meet.telemedicine.com/room/tel${Date.now()}`,
    instructions: 'Join 5 minutes before scheduled time. Ensure stable internet connection.',
    estimatedDuration: '20-30 minutes'
  });
});

app.get('/api/partners/telemedicine/statistics', (req, res) => {
  res.json({
    today: {
      totalConsultations: 24,
      completed: 18,
      ongoing: 2,
      upcoming: 4
    },
    averages: {
      duration: '18 minutes',
      satisfactionScore: 4.7,
      noShowRate: '3%'
    },
    prescriptions: {
      ePrescriptions: 87,
      sentToPharmacy: 82,
      fulfilled: 76
    }
  });
});

app.post('/api/partners/telemedicine/prescription', (req, res) => {
  const { consultationId, patientId, medications } = req.body;
  res.json({
    prescriptionId: `RX-${Date.now()}`,
    consultationId,
    patientId,
    medications,
    status: 'sent',
    pharmacy: 'Partner Pharmacy Network',
    estimatedFulfillment: '2-4 hours',
    digitalSignature: `SIG${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  });
});

// Government & NGO Reporting APIs
app.get('/api/partners/reporting/submissions', (req, res) => {
  res.json([
    {
      reportId: 'REP001',
      name: 'Monthly Disease Surveillance Report',
      recipient: 'Ghana Health Service',
      submittedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: 'submitted',
      type: 'regulatory'
    },
    {
      reportId: 'REP002',
      name: 'NHIS Claims Summary - September',
      recipient: 'National Health Insurance',
      submittedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      status: 'accepted',
      type: 'financial'
    },
    {
      reportId: 'REP003',
      name: 'WHO Health Statistics Quarterly',
      recipient: 'World Health Organization',
      dueDate: '2025-10-15',
      status: 'in_progress',
      type: 'international'
    },
    {
      reportId: 'REP004',
      name: 'Maternal Health Indicators',
      recipient: 'UNICEF Ghana',
      submittedAt: '2025-09-28',
      status: 'verified',
      type: 'ngo'
    },
    {
      reportId: 'REP005',
      name: 'COVID-19 Vaccination Update',
      recipient: 'Ministry of Health',
      frequency: 'daily',
      status: 'automated',
      type: 'public_health'
    }
  ]);
});

app.post('/api/partners/reporting/submit', (req, res) => {
  const { reportType, recipient, data } = req.body;
  res.json({
    reportId: `REP${Date.now()}`,
    reportType,
    recipient,
    submittedAt: new Date().toISOString(),
    status: 'submitted',
    confirmationNumber: `CONF${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    nextSubmission: reportType === 'daily' ? 'Tomorrow' : 'Next month'
  });
});

app.get('/api/partners/reporting/compliance', (req, res) => {
  res.json({
    overallCompliance: 98.5,
    categories: {
      regulatory: 100,
      financial: 97,
      publicHealth: 99,
      international: 98,
      ngo: 97
    },
    upcoming: [
      {
        report: 'Quarterly Financial Audit',
        dueDate: '2025-10-31',
        daysRemaining: 31
      },
      {
        report: 'Annual Health Statistics',
        dueDate: '2025-12-31',
        daysRemaining: 92
      }
    ],
    recentSubmissions: 15,
    pendingReports: 3
  });
});

// Partner Integration Statistics
app.get('/api/partners/statistics', (req, res) => {
  res.json({
    activePartners: 12,
    integrations: {
      insurance: 3,
      suppliers: 4,
      telemedicine: 2,
      government: 2,
      ngo: 1
    },
    transactions: {
      today: 847,
      thisWeek: 4523,
      thisMonth: 18947
    },
    performance: {
      averageResponseTime: '245ms',
      uptime: '99.98%',
      successRate: '98.5%',
      failedTransactions: 12
    },
    revenue: {
      insuranceClaims: 274000,
      supplierOrders: 45600,
      telemedicineConsultations: 8900
    }
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Partner Integration API running on port ${port}`);
  console.log(`Access at: http://localhost:${port}`);
});
