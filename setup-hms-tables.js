const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:3ifO2knhQgc4@ep-summer-block-a5aem4nh.us-east-2.aws.neon.tech/hospital_management_platform?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function setupHMSTables() {
  try {
    console.log('Setting up HMS tables...');
    
    const sql = fs.readFileSync('/root/create-hms-tables.sql', 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ HMS tables created successfully!');
    
    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'hms'
      ORDER BY table_name;
    `);
    
    console.log('\nCreated HMS tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Insert sample data
    console.log('\nInserting sample data...');
    
    // Add inventory categories
    await pool.query(`
      INSERT INTO hms.inventory_categories (category_name, category_type, description)
      VALUES 
        ('Medications', 'drugs', 'Pharmaceutical products'),
        ('Medical Supplies', 'supplies', 'Consumable medical supplies'),
        ('Equipment', 'equipment', 'Medical equipment and devices')
      ON CONFLICT DO NOTHING;
    `);
    
    // Add wards
    await pool.query(`
      INSERT INTO hms.wards (ward_name, ward_type, total_beds, occupied_beds, floor_number, building)
      VALUES 
        ('General Ward A', 'general', 30, 22, 1, 'Main Building'),
        ('ICU', 'intensive', 10, 7, 2, 'Main Building'),
        ('Maternity Ward', 'maternity', 20, 15, 3, 'Main Building'),
        ('Pediatric Ward', 'pediatric', 25, 18, 1, 'West Wing'),
        ('Emergency Ward', 'emergency', 15, 10, 0, 'Emergency Building')
      ON CONFLICT DO NOTHING;
    `);
    
    // Add some staff members
    await pool.query(`
      INSERT INTO hms.staff (staff_id, employee_number, first_name, last_name, email, phone, department, position, specialization, hire_date, employment_status, salary)
      VALUES 
        ('STF-001', 'EMP001', 'Dr. John', 'Mensah', 'john.mensah@hospital.com', '0244123456', 'Medicine', 'Senior Physician', 'Internal Medicine', '2020-01-15', 'active', 15000),
        ('STF-002', 'EMP002', 'Dr. Akua', 'Asante', 'akua.asante@hospital.com', '0244123457', 'Surgery', 'Surgeon', 'General Surgery', '2019-03-20', 'active', 18000),
        ('STF-003', 'EMP003', 'Nurse Mary', 'Owusu', 'mary.owusu@hospital.com', '0244123458', 'Nursing', 'Head Nurse', 'Critical Care', '2018-06-10', 'active', 8000),
        ('STF-004', 'EMP004', 'Dr. Kofi', 'Appiah', 'kofi.appiah@hospital.com', '0244123459', 'Emergency', 'Emergency Physician', 'Emergency Medicine', '2021-02-01', 'active', 14000),
        ('STF-005', 'EMP005', 'Nurse Ama', 'Boateng', 'ama.boateng@hospital.com', '0244123460', 'Maternity', 'Midwife', 'Obstetrics', '2020-09-15', 'active', 7000)
      ON CONFLICT DO NOTHING;
    `);
    
    // Add beds to wards
    const wardsResult = await pool.query('SELECT ward_id, ward_name, total_beds FROM hms.wards');
    
    for (const ward of wardsResult.rows) {
      for (let i = 1; i <= Math.min(ward.total_beds, 5); i++) {
        const bedNumber = `${ward.ward_name.substring(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`;
        await pool.query(`
          INSERT INTO hms.beds (bed_number, ward_id, bed_type, status, daily_rate)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (bed_number) DO NOTHING
        `, [
          bedNumber,
          ward.ward_id,
          ward.ward_name.includes('ICU') ? 'ICU' : 'standard',
          i <= 3 ? 'occupied' : 'available',
          ward.ward_name.includes('ICU') ? 500 : 200
        ]);
      }
    }
    
    console.log('✅ Sample data inserted successfully!');
    
    // Get statistics
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM hms.wards) as total_wards,
        (SELECT COUNT(*) FROM hms.beds) as total_beds,
        (SELECT COUNT(*) FROM hms.staff) as total_staff,
        (SELECT COUNT(*) FROM hms.beds WHERE status = 'occupied') as occupied_beds
    `);
    
    console.log('\nHMS Module Statistics:');
    console.log(`  - Total Wards: ${stats.rows[0].total_wards}`);
    console.log(`  - Total Beds: ${stats.rows[0].total_beds}`);
    console.log(`  - Total Staff: ${stats.rows[0].total_staff}`);
    console.log(`  - Occupied Beds: ${stats.rows[0].occupied_beds}`);
    
  } catch (error) {
    console.error('Error setting up HMS tables:', error);
  } finally {
    await pool.end();
  }
}

setupHMSTables();
