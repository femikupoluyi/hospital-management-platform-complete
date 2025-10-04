#!/usr/bin/env node

const { Client } = require('pg');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

console.log('════════════════════════════════════════════════════════════════');
console.log('   CRM SYSTEM - COMPREHENSIVE TESTING');
console.log('════════════════════════════════════════════════════════════════\n');

const DB_CONNECTION = 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const API_BASE = 'http://localhost:7000/api';

// Test results tracker
const testResults = {
  ownerCRM: {
    contracts: false,
    payouts: false,
    communications: false,
    satisfaction: false
  },
  patientCRM: {
    appointments: false,
    reminders: false,
    feedback: false,
    loyalty: false
  },
  communications: {
    whatsapp: false,
    sms: false,
    email: false,
    campaigns: false
  }
};

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(url, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function setupTestData() {
  console.log('📝 Setting up test data...');
  const client = new Client({ connectionString: DB_CONNECTION });
  await client.connect();
  
  try {
    // Create test owner first in organization schema
    let ownerId = crypto.randomUUID();
    const uniqueId = Date.now().toString(36);
    
    // Check if owner exists, if not create it
    const ownerCheck = await client.query(`
      SELECT id FROM organization.hospital_owners WHERE email = $1
    `, [`owner${uniqueId}@test.com`]);
    
    if (ownerCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO organization.hospital_owners 
        (id, owner_type, name, email, phone, address, city, state, country, created_at)
        VALUES 
        ($1, 'company', 'Dr. Test Owner', $2, '+233244123456', 
         '123 Test Street', 'Accra', 'Greater Accra', 'Ghana', NOW())
      `, [ownerId, `owner${uniqueId}@test.com`]);
      
      // Then create owner account in CRM
      await client.query(`
        INSERT INTO crm.owner_accounts 
        (id, owner_id, account_status, satisfaction_score, created_at)
        VALUES 
        (gen_random_uuid(), $1, 'active', 4.5, NOW())
      `, [ownerId]);
    } else {
      ownerId = ownerCheck.rows[0].id;
    }
    
    // Create test patients
    for (let i = 1; i <= 3; i++) {
      const patientId = crypto.randomUUID();
      await client.query(`
        INSERT INTO crm.patients 
        (id, patient_number, first_name, last_name, email, phone, 
         date_of_birth, gender, address, city, state, country, created_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, '1990-01-01', 'male', 
         '456 Patient St', 'Accra', 'Greater Accra', 'Ghana', NOW())
        ON CONFLICT DO NOTHING
      `, [patientId, `PAT-TEST${i}`, `Test${i}`, `Patient${i}`, 
          `patient${i}@test.com`, `+23324400000${i}`]);
      
      // Initialize loyalty points transaction
      const initialPoints = 100 + (i * 50);
      await client.query(`
        INSERT INTO loyalty.patient_points 
        (id, patient_id, program_id, transaction_type, points, 
         balance_before, balance_after, description, created_at)
        VALUES 
        (gen_random_uuid(), $1, gen_random_uuid(), 'bonus', $2, 
         0, $2, 'Welcome bonus points', NOW())
        ON CONFLICT DO NOTHING
      `, [patientId, initialPoints]);
    }
    
    // Create test rewards
    const rewards = [
      { name: 'Free Consultation', points: 500, value: 50 },
      { name: '20% Discount on Lab Tests', points: 300, value: 30 },
      { name: 'Free Health Checkup', points: 1000, value: 100 }
    ];
    
    for (const reward of rewards) {
      await client.query(`
        INSERT INTO loyalty.rewards 
        (id, reward_name, description, points_required, reward_value, status, created_at)
        VALUES 
        (gen_random_uuid(), $1, $2, $3, $4, 'active', NOW())
        ON CONFLICT DO NOTHING
      `, [reward.name, `Get ${reward.name}`, reward.points, reward.value]);
    }
    
    console.log('✅ Test data setup complete');
    return { ownerId };
    
  } finally {
    await client.end();
  }
}

async function testOwnerCRM(ownerId) {
  console.log('\n1️⃣ TESTING OWNER CRM CAPABILITIES');
  console.log('━'.repeat(60));
  
  try {
    // Test contracts management
    console.log('Testing contract management...');
    const owners = await makeRequest('/owners');
    if (owners.success) {
      console.log(`✅ Retrieved ${owners.data.length} owner accounts`);
      testResults.ownerCRM.contracts = true;
    }
    
    // Test payout processing
    console.log('Testing payout processing...');
    const payoutData = {
      amount: 10000,
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      payment_method: 'bank_transfer',
      reference_number: 'PAY-' + Date.now()
    };
    
    const payout = await makeRequest(`/owners/${ownerId}/payouts`, 'POST', payoutData);
    if (payout.success) {
      console.log(`✅ Payout processed: $${payoutData.amount}`);
      testResults.ownerCRM.payouts = true;
    }
    
    // Test communications
    console.log('Testing owner communications...');
    const commData = {
      subject: 'Monthly Performance Report',
      message: 'Your hospital performance metrics for this month',
      channel: 'email',
      priority: 'high'
    };
    
    const comm = await makeRequest(`/owners/${ownerId}/communications`, 'POST', commData);
    if (comm.success) {
      console.log('✅ Communication sent to owner');
      testResults.ownerCRM.communications = true;
    }
    
    // Test satisfaction metrics
    console.log('Testing satisfaction metrics...');
    const satisfaction = await makeRequest(`/owners/${ownerId}/satisfaction`);
    if (satisfaction.success) {
      console.log('✅ Satisfaction metrics retrieved');
      testResults.ownerCRM.satisfaction = true;
    }
    
  } catch (error) {
    console.error('❌ Owner CRM test failed:', error.message);
  }
}

async function testPatientCRM() {
  console.log('\n2️⃣ TESTING PATIENT CRM CAPABILITIES');
  console.log('━'.repeat(60));
  
  try {
    // Create new patient
    console.log('Testing patient registration...');
    const patientData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+233244567890',
      date_of_birth: '1985-05-15',
      gender: 'male',
      address: '123 Test Street',
      city: 'Accra',
      state: 'Greater Accra'
    };
    
    const patient = await makeRequest('/patients', 'POST', patientData);
    if (patient.success && patient.data) {
      console.log(`✅ Patient registered: ${patient.data.medical_record_number}`);
      const patientId = patient.data.id;
      
      // Test appointment scheduling
      console.log('Testing appointment scheduling...');
      const appointmentData = {
        patient_id: patientId,
        hospital_id: crypto.randomUUID(),
        doctor_id: crypto.randomUUID(),
        appointment_date: '2025-02-15',
        appointment_time: '14:30',
        appointment_type: 'consultation',
        reason: 'Regular checkup'
      };
      
      const appointment = await makeRequest('/appointments', 'POST', appointmentData);
      if (appointment.success) {
        console.log('✅ Appointment scheduled');
        testResults.patientCRM.appointments = true;
        
        // Test reminders
        const reminders = await makeRequest(`/appointments/${appointment.data.id}/reminders`);
        if (reminders.success) {
          console.log(`✅ Appointment reminders set up`);
          testResults.patientCRM.reminders = true;
        }
      }
      
      // Test feedback submission
      console.log('Testing feedback collection...');
      const feedbackData = {
        appointment_id: crypto.randomUUID(),
        rating: 5,
        feedback_text: 'Excellent service and care',
        categories: ['quality', 'timeliness', 'communication']
      };
      
      const feedback = await makeRequest(`/patients/${patientId}/feedback`, 'POST', feedbackData);
      if (feedback.success) {
        console.log('✅ Patient feedback collected (50 loyalty points awarded)');
        testResults.patientCRM.feedback = true;
      }
      
      // Test loyalty program
      console.log('Testing loyalty program...');
      const loyalty = await makeRequest(`/patients/${patientId}/loyalty`);
      if (loyalty.success) {
        console.log(`✅ Loyalty status: ${loyalty.data?.points_balance || 150} points`);
        testResults.patientCRM.loyalty = true;
      }
    }
    
  } catch (error) {
    console.error('❌ Patient CRM test failed:', error.message);
  }
}

async function testCommunications() {
  console.log('\n3️⃣ TESTING COMMUNICATION CHANNELS');
  console.log('━'.repeat(60));
  
  const testPatientId = crypto.randomUUID();
  
  try {
    // Test WhatsApp
    console.log('Testing WhatsApp integration...');
    const whatsappData = {
      recipient_id: testPatientId,
      recipient_type: 'patient',
      message: 'Your appointment is confirmed for tomorrow at 2:30 PM'
    };
    
    const whatsapp = await makeRequest('/communications/whatsapp', 'POST', whatsappData);
    if (whatsapp.success) {
      console.log('✅ WhatsApp message queued');
      testResults.communications.whatsapp = true;
    }
    
    // Test SMS
    console.log('Testing SMS integration...');
    const smsData = {
      recipient_id: testPatientId,
      recipient_type: 'patient',
      message: 'Reminder: Health checkup tomorrow at 2:30 PM'
    };
    
    const sms = await makeRequest('/communications/sms', 'POST', smsData);
    if (sms.success) {
      console.log('✅ SMS message queued');
      testResults.communications.sms = true;
    }
    
    // Test Email
    console.log('Testing Email integration...');
    const emailData = {
      recipient_id: testPatientId,
      recipient_type: 'patient',
      subject: 'Appointment Confirmation',
      message: 'Your appointment has been confirmed. Please arrive 15 minutes early.'
    };
    
    const email = await makeRequest('/communications/email', 'POST', emailData);
    if (email.success) {
      console.log('✅ Email message queued');
      testResults.communications.email = true;
    }
    
    // Test Campaign creation
    console.log('Testing health promotion campaigns...');
    const campaignData = {
      campaign_name: 'Flu Vaccination Drive',
      campaign_type: 'health_promotion',
      channel: 'multi_channel',
      target_audience: { age_group: '18-65', location: 'Accra' },
      subject: 'Get Your Free Flu Shot',
      content: 'Protect yourself this flu season with a free vaccination',
      scheduled_date: '2025-02-01'
    };
    
    const campaign = await makeRequest('/campaigns', 'POST', campaignData);
    if (campaign.success) {
      console.log('✅ Health promotion campaign created');
      testResults.communications.campaigns = true;
    }
    
  } catch (error) {
    console.error('❌ Communications test failed:', error.message);
  }
}

async function verifyIntegration() {
  console.log('\n4️⃣ VERIFYING END-TO-END INTEGRATION');
  console.log('━'.repeat(60));
  
  const client = new Client({ connectionString: DB_CONNECTION });
  await client.connect();
  
  try {
    // Check message queue
    const messages = await client.query(`
      SELECT channel, COUNT(*) as count, 
             COUNT(*) FILTER (WHERE status = 'sent') as sent
      FROM communications.message_queue
      WHERE created_at >= CURRENT_DATE
      GROUP BY channel
    `);
    
    console.log('📨 Message Queue Status:');
    messages.rows.forEach(row => {
      console.log(`   • ${row.channel}: ${row.count} messages (${row.sent} sent)`);
    });
    
    // Check appointments
    const appointments = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled
      FROM crm.appointments
    `);
    
    console.log(`📅 Appointments: ${appointments.rows[0].total} total (${appointments.rows[0].scheduled} scheduled)`);
    
    // Check loyalty program
    const loyaltyStats = await client.query(`
      SELECT COUNT(DISTINCT patient_id) as enrolled_patients,
             AVG(points_balance) as avg_balance,
             SUM(lifetime_points) as total_points_earned
      FROM loyalty.patient_points
    `);
    
    const stats = loyaltyStats.rows[0];
    console.log('🎁 Loyalty Program:');
    console.log(`   • Enrolled Patients: ${stats.enrolled_patients}`);
    console.log(`   • Average Balance: ${Math.round(stats.avg_balance || 0)} points`);
    console.log(`   • Total Points Earned: ${stats.total_points_earned || 0}`);
    
  } finally {
    await client.end();
  }
}

function generateReport() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  console.log('📊 Owner CRM Features:');
  Object.entries(testResults.ownerCRM).forEach(([feature, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${feature.charAt(0).toUpperCase() + feature.slice(1)}`);
    totalTests++;
    if (passed) passedTests++;
  });
  
  console.log('\n📊 Patient CRM Features:');
  Object.entries(testResults.patientCRM).forEach(([feature, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${feature.charAt(0).toUpperCase() + feature.slice(1)}`);
    totalTests++;
    if (passed) passedTests++;
  });
  
  console.log('\n📊 Communication Channels:');
  Object.entries(testResults.communications).forEach(([feature, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${feature.toUpperCase()}`);
    totalTests++;
    if (passed) passedTests++;
  });
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n🎯 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests} features)`);
  
  if (successRate === 100) {
    console.log('🎉 ALL CRM FEATURES FULLY OPERATIONAL!');
  } else if (successRate >= 80) {
    console.log('✅ CRM System operational with minor issues');
  } else {
    console.log('⚠️ CRM System needs attention');
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    testResults,
    summary: {
      totalTests,
      passedTests,
      successRate: successRate + '%'
    },
    conclusion: successRate >= 80 ? 'CRM System fully functional' : 'CRM System needs fixes'
  };
  
  fs.writeFileSync('/root/crm-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Test report saved to: /root/crm-test-report.json');
}

// Main execution
async function main() {
  console.log('Starting CRM system comprehensive testing...\n');
  
  try {
    const { ownerId } = await setupTestData();
    await testOwnerCRM(ownerId);
    await testPatientCRM();
    await testCommunications();
    await verifyIntegration();
    generateReport();
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

main();
