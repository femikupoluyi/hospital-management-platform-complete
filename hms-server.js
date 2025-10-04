const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 9000;

// Middleware
app.use(express.json());
app.use(express.static('/root'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'HMS Module Server',
    timestamp: new Date().toISOString()
  });
});

// Serve HMS frontend
app.get('/', (req, res) => {
  res.sendFile('/root/hms-frontend.html');
});

// HMS API endpoints (mock data for demonstration)
app.get('/api/hms/stats', (req, res) => {
  res.json({
    totalBeds: 300,
    occupiedBeds: 226,
    occupancyRate: 75.5,
    activeStaff: 165,
    doctors: 45,
    nurses: 120,
    todayRevenue: 12450,
    pendingBills: 42,
    lowStockItems: 5
  });
});

app.get('/api/hms/recent-admissions', (req, res) => {
  res.json([
    {
      patientId: 'PT-001',
      patientName: 'Kwame Asante',
      ward: 'General Ward A',
      bed: 'GEN-001',
      admissionDate: '2025-09-30',
      doctor: 'Dr. John Mensah',
      status: 'Admitted'
    },
    {
      patientId: 'PT-002',
      patientName: 'Ama Boateng',
      ward: 'Maternity Ward',
      bed: 'MAT-003',
      admissionDate: '2025-09-30',
      doctor: 'Dr. Akua Asante',
      status: 'Admitted'
    },
    {
      patientId: 'PT-003',
      patientName: 'Kofi Mensah',
      ward: 'ICU',
      bed: 'ICU-002',
      admissionDate: '2025-09-29',
      doctor: 'Dr. Kofi Appiah',
      status: 'Critical'
    }
  ]);
});

app.get('/api/hms/staff-on-duty', (req, res) => {
  res.json([
    {
      staffId: 'STF-001',
      name: 'Dr. John Mensah',
      department: 'Medicine',
      position: 'Senior Physician',
      shift: '08:00 - 16:00',
      status: 'On Duty'
    },
    {
      staffId: 'STF-003',
      name: 'Nurse Mary Owusu',
      department: 'Nursing',
      position: 'Head Nurse',
      shift: '08:00 - 20:00',
      status: 'On Duty'
    },
    {
      staffId: 'STF-004',
      name: 'Dr. Kofi Appiah',
      department: 'Emergency',
      position: 'Emergency Physician',
      shift: '12:00 - 00:00',
      status: 'On Duty'
    }
  ]);
});

app.get('/api/hms/inventory/low-stock', (req, res) => {
  res.json([
    { itemName: 'Paracetamol', currentStock: 50, reorderPoint: 100 },
    { itemName: 'Surgical Gloves', currentStock: 20, reorderPoint: 50 },
    { itemName: 'Bandages', currentStock: 30, reorderPoint: 40 },
    { itemName: 'Syringes', currentStock: 100, reorderPoint: 200 },
    { itemName: 'IV Fluids', currentStock: 15, reorderPoint: 30 }
  ]);
});

app.get('/api/hms/wards', (req, res) => {
  res.json([
    { wardName: 'General Ward A', wardType: 'general', totalBeds: 30, occupiedBeds: 22 },
    { wardName: 'ICU', wardType: 'intensive', totalBeds: 10, occupiedBeds: 7 },
    { wardName: 'Maternity Ward', wardType: 'maternity', totalBeds: 20, occupiedBeds: 15 },
    { wardName: 'Pediatric Ward', wardType: 'pediatric', totalBeds: 25, occupiedBeds: 18 },
    { wardName: 'Emergency Ward', wardType: 'emergency', totalBeds: 15, occupiedBeds: 10 }
  ]);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`HMS Server running on port ${port}`);
  console.log(`Access at: http://localhost:${port}`);
});
