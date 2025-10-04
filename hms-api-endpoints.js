const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// This will be added to our backend server
const hmsEndpoints = (pool) => {
  
  // EMR Endpoints
  router.post('/api/hms/medical-records', async (req, res) => {
    try {
      const { 
        patient_id, visit_type, chief_complaint, 
        history_of_present_illness, vital_signs, physical_examination,
        assessment_plan, created_by 
      } = req.body;
      
      const result = await pool.query(`
        INSERT INTO hms.medical_records 
        (patient_id, visit_date, visit_type, chief_complaint, 
         history_of_present_illness, vital_signs, physical_examination, 
         assessment_plan, created_by)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        patient_id, visit_type, chief_complaint, 
        history_of_present_illness, vital_signs, physical_examination,
        assessment_plan, created_by
      ]);
      
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/api/hms/medical-records/:patientId', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT mr.*, 
               array_agg(DISTINCT d.*) as diagnoses,
               array_agg(DISTINCT p.*) as prescriptions
        FROM hms.medical_records mr
        LEFT JOIN hms.diagnoses d ON mr.record_id = d.record_id
        LEFT JOIN hms.prescriptions p ON mr.record_id = p.record_id
        WHERE mr.patient_id = $1
        GROUP BY mr.record_id
        ORDER BY mr.visit_date DESC
      `, [req.params.patientId]);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Prescription endpoints
  router.post('/api/hms/prescriptions', async (req, res) => {
    try {
      const { 
        record_id, patient_id, medication_name, dosage, 
        frequency, duration, instructions, prescribed_by 
      } = req.body;
      
      const result = await pool.query(`
        INSERT INTO hms.prescriptions 
        (record_id, patient_id, medication_name, dosage, frequency, 
         duration, instructions, prescribed_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        record_id, patient_id, medication_name, dosage, 
        frequency, duration, instructions, prescribed_by
      ]);
      
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Billing endpoints
  router.post('/api/hms/invoices', async (req, res) => {
    try {
      const { 
        patient_id, items, payment_method, account_id 
      } = req.body;
      
      const invoice_id = 'INV-' + Date.now();
      const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      // Create invoice
      const invoiceResult = await pool.query(`
        INSERT INTO hms.invoices 
        (invoice_id, patient_id, account_id, invoice_date, due_date, 
         total_amount, payment_method, payment_status)
        VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 
                $4, $5, 'pending')
        RETURNING *
      `, [invoice_id, patient_id, account_id, total_amount, payment_method]);
      
      // Add invoice items
      for (const item of items) {
        await pool.query(`
          INSERT INTO hms.invoice_items 
          (invoice_id, service_code, service_description, quantity, 
           unit_price, total_price, category)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          invoice_id, item.service_code, item.service_description, 
          item.quantity, item.unit_price, item.quantity * item.unit_price, 
          item.category
        ]);
      }
      
      res.json(invoiceResult.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/api/hms/invoices/:patientId', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT i.*, 
               array_agg(ii.*) as items
        FROM hms.invoices i
        LEFT JOIN hms.invoice_items ii ON i.invoice_id = ii.invoice_id
        WHERE i.patient_id = $1
        GROUP BY i.invoice_id
        ORDER BY i.invoice_date DESC
      `, [req.params.patientId]);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/api/hms/invoices/:invoiceId/payment', async (req, res) => {
    try {
      const { amount, payment_method } = req.body;
      
      const result = await pool.query(`
        UPDATE hms.invoices 
        SET paid_amount = paid_amount + $1,
            payment_status = CASE 
              WHEN paid_amount + $1 >= total_amount THEN 'paid'
              WHEN paid_amount + $1 > 0 THEN 'partial'
              ELSE 'pending'
            END,
            payment_method = $2
        WHERE invoice_id = $3
        RETURNING *
      `, [amount, payment_method, req.params.invoiceId]);
      
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Inventory endpoints
  router.get('/api/hms/inventory', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT i.*, c.category_name 
        FROM hms.inventory_items i
        LEFT JOIN hms.inventory_categories c ON i.category_id = c.category_id
        ORDER BY i.item_name
      `);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/api/hms/inventory/low-stock', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT i.*, c.category_name 
        FROM hms.inventory_items i
        LEFT JOIN hms.inventory_categories c ON i.category_id = c.category_id
        WHERE i.current_stock <= i.reorder_point
        ORDER BY i.current_stock ASC
      `);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/api/hms/inventory/transaction', async (req, res) => {
    try {
      const { 
        item_id, transaction_type, quantity, 
        reference_number, performed_by, notes 
      } = req.body;
      
      // Record transaction
      const transResult = await pool.query(`
        INSERT INTO hms.stock_transactions 
        (item_id, transaction_type, quantity, reference_number, 
         performed_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [item_id, transaction_type, quantity, reference_number, performed_by, notes]);
      
      // Update stock level
      const stockChange = transaction_type === 'receipt' ? quantity : -quantity;
      await pool.query(`
        UPDATE hms.inventory_items 
        SET current_stock = current_stock + $1,
            last_restocked = CASE WHEN $2 = 'receipt' THEN CURRENT_TIMESTAMP ELSE last_restocked END
        WHERE item_id = $3
      `, [stockChange, transaction_type, item_id]);
      
      res.json(transResult.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Staff Management endpoints
  router.get('/api/hms/staff', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM hms.staff 
        WHERE employment_status = 'active'
        ORDER BY department, last_name
      `);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/api/hms/staff/schedules', async (req, res) => {
    try {
      const { date = new Date().toISOString().split('T')[0] } = req.query;
      
      const result = await pool.query(`
        SELECT ss.*, s.first_name, s.last_name, s.position
        FROM hms.staff_schedules ss
        JOIN hms.staff s ON ss.staff_id = s.staff_id
        WHERE ss.shift_date = $1
        ORDER BY ss.department, ss.shift_start
      `, [date]);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/api/hms/staff/schedules', async (req, res) => {
    try {
      const { 
        staff_id, shift_date, shift_start, 
        shift_end, department 
      } = req.body;
      
      const result = await pool.query(`
        INSERT INTO hms.staff_schedules 
        (staff_id, shift_date, shift_start, shift_end, department)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [staff_id, shift_date, shift_start, shift_end, department]);
      
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/api/hms/staff/attendance', async (req, res) => {
    try {
      const { staff_id, schedule_id, action } = req.body;
      
      if (action === 'check_in') {
        const result = await pool.query(`
          INSERT INTO hms.attendance 
          (staff_id, schedule_id, check_in_time, status)
          VALUES ($1, $2, CURRENT_TIMESTAMP, 'present')
          RETURNING *
        `, [staff_id, schedule_id]);
        res.json(result.rows[0]);
      } else if (action === 'check_out') {
        const result = await pool.query(`
          UPDATE hms.attendance 
          SET check_out_time = CURRENT_TIMESTAMP,
              overtime_hours = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in_time)) / 3600 - 8
          WHERE staff_id = $1 AND schedule_id = $2
          RETURNING *
        `, [staff_id, schedule_id]);
        res.json(result.rows[0]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Bed Management endpoints
  router.get('/api/hms/beds', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT b.*, w.ward_name, w.ward_type
        FROM hms.beds b
        JOIN hms.wards w ON b.ward_id = w.ward_id
        ORDER BY w.ward_name, b.bed_number
      `);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/api/hms/beds/available', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT b.*, w.ward_name, w.ward_type
        FROM hms.beds b
        JOIN hms.wards w ON b.ward_id = w.ward_id
        WHERE b.status = 'available'
        ORDER BY w.ward_name, b.bed_number
      `);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/api/hms/admissions', async (req, res) => {
    try {
      const { 
        patient_id, bed_id, admission_type, 
        admitting_doctor, diagnosis, expected_discharge 
      } = req.body;
      
      // Create admission
      const admissionResult = await pool.query(`
        INSERT INTO hms.admissions 
        (patient_id, bed_id, admission_type, admitting_doctor, 
         diagnosis, expected_discharge)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [patient_id, bed_id, admission_type, admitting_doctor, diagnosis, expected_discharge]);
      
      // Update bed status
      await pool.query(`
        UPDATE hms.beds 
        SET status = 'occupied', current_patient_id = $1
        WHERE bed_id = $2
      `, [patient_id, bed_id]);
      
      // Update ward occupancy
      await pool.query(`
        UPDATE hms.wards 
        SET occupied_beds = occupied_beds + 1
        WHERE ward_id = (SELECT ward_id FROM hms.beds WHERE bed_id = $1)
      `, [bed_id]);
      
      res.json(admissionResult.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/api/hms/admissions/:admissionId/discharge', async (req, res) => {
    try {
      const { discharge_notes } = req.body;
      
      // Get admission details
      const admission = await pool.query(`
        SELECT * FROM hms.admissions WHERE admission_id = $1
      `, [req.params.admissionId]);
      
      if (admission.rows.length === 0) {
        return res.status(404).json({ error: 'Admission not found' });
      }
      
      const { patient_id, bed_id } = admission.rows[0];
      
      // Update admission
      const result = await pool.query(`
        UPDATE hms.admissions 
        SET actual_discharge = CURRENT_TIMESTAMP,
            status = 'discharged'
        WHERE admission_id = $1
        RETURNING *
      `, [req.params.admissionId]);
      
      // Update bed status
      await pool.query(`
        UPDATE hms.beds 
        SET status = 'available', current_patient_id = NULL
        WHERE bed_id = $1
      `, [bed_id]);
      
      // Update ward occupancy
      await pool.query(`
        UPDATE hms.wards 
        SET occupied_beds = occupied_beds - 1
        WHERE ward_id = (SELECT ward_id FROM hms.beds WHERE bed_id = $1)
      `, [bed_id]);
      
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Analytics endpoints
  router.get('/api/hms/analytics/overview', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM hms.beds) as total_beds,
          (SELECT COUNT(*) FROM hms.beds WHERE status = 'occupied') as occupied_beds,
          (SELECT COUNT(*) FROM hms.admissions WHERE status = 'admitted') as current_admissions,
          (SELECT COUNT(*) FROM hms.staff WHERE employment_status = 'active') as active_staff,
          (SELECT COUNT(*) FROM hms.inventory_items WHERE current_stock <= reorder_point) as low_stock_items,
          (SELECT SUM(total_amount - paid_amount) FROM hms.invoices WHERE payment_status != 'paid') as pending_revenue,
          (SELECT COUNT(*) FROM hms.prescriptions WHERE status = 'active' AND prescribed_at >= CURRENT_DATE - INTERVAL '7 days') as recent_prescriptions
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get('/api/hms/analytics/occupancy-trend', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          w.ward_name,
          w.total_beds,
          w.occupied_beds,
          ROUND((w.occupied_beds::numeric / w.total_beds) * 100, 2) as occupancy_rate
        FROM hms.wards w
        ORDER BY occupancy_rate DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
};

module.exports = hmsEndpoints;
