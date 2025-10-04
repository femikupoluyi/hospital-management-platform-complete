#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

console.log('════════════════════════════════════════════════════════════════');
console.log('   CRM SYSTEM - SIMPLIFIED VERIFICATION TEST');
console.log('════════════════════════════════════════════════════════════════\n');

const API_BASE = 'http://localhost:7000/api';

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
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  const results = {
    ownerCRM: false,
    patientCRM: false,
    appointments: false,
    communications: false,
    loyalty: false,
    campaigns: false
  };
  
  try {
    console.log('1️⃣ TESTING OWNER CRM');
    console.log('━'.repeat(60));
    
    // Test owner endpoints
    const owners = await makeRequest('/owners');
    if (owners.status === 200) {
      console.log(`✅ Owner accounts endpoint working`);
      results.ownerCRM = true;
    }
    
    console.log('\n2️⃣ TESTING PATIENT CRM');
    console.log('━'.repeat(60));
    
    // Create a test patient
    const patientData = {
      first_name: 'Test',
      last_name: 'Patient',
      email: `test${Date.now()}@example.com`,
      phone: '+233244' + Math.floor(Math.random() * 1000000),
      date_of_birth: '1990-01-01',
      gender: 'male',
      address: '123 Test St',
      city: 'Accra',
      state: 'Greater Accra'
    };
    
    const patient = await makeRequest('/patients', 'POST', patientData);
    if (patient.status === 200 && patient.data.success) {
      console.log(`✅ Patient created: ${patient.data.data.patient_number}`);
      results.patientCRM = true;
      
      // Test appointment scheduling
      const appointmentData = {
        patient_id: patient.data.data.id,
        hospital_id: '00000000-0000-0000-0000-000000000000',
        doctor_id: '00000000-0000-0000-0000-000000000001',
        appointment_date: '2025-02-15',
        appointment_time: '14:30',
        appointment_type: 'consultation',
        reason: 'Checkup'
      };
      
      const appointment = await makeRequest('/appointments', 'POST', appointmentData);
      if (appointment.status === 200) {
        console.log('✅ Appointment scheduled successfully');
        results.appointments = true;
      }
    }
    
    console.log('\n3️⃣ TESTING COMMUNICATIONS');
    console.log('━'.repeat(60));
    
    // Test WhatsApp
    const whatsappMsg = {
      recipient_id: '00000000-0000-0000-0000-000000000000',
      recipient_type: 'patient',
      message: 'Test WhatsApp message'
    };
    
    const whatsapp = await makeRequest('/communications/whatsapp', 'POST', whatsappMsg);
    if (whatsapp.status === 200) {
      console.log('✅ WhatsApp message sent');
    }
    
    // Test SMS
    const smsMsg = {
      recipient_id: '00000000-0000-0000-0000-000000000000',
      recipient_type: 'patient',
      message: 'Test SMS message'
    };
    
    const sms = await makeRequest('/communications/sms', 'POST', smsMsg);
    if (sms.status === 200) {
      console.log('✅ SMS message sent');
    }
    
    // Test Email
    const emailMsg = {
      recipient_id: '00000000-0000-0000-0000-000000000000',
      recipient_type: 'patient',
      subject: 'Test Email',
      message: 'Test email message body'
    };
    
    const email = await makeRequest('/communications/email', 'POST', emailMsg);
    if (email.status === 200) {
      console.log('✅ Email message sent');
      results.communications = true;
    }
    
    console.log('\n4️⃣ TESTING LOYALTY PROGRAM');
    console.log('━'.repeat(60));
    
    const rewards = await makeRequest('/loyalty/rewards');
    if (rewards.status === 200) {
      console.log(`✅ Loyalty rewards accessible`);
      results.loyalty = true;
    }
    
    console.log('\n5️⃣ TESTING CAMPAIGNS');
    console.log('━'.repeat(60));
    
    const campaignData = {
      campaign_name: 'Test Health Campaign',
      campaign_type: 'health_promotion',
      channel: 'email',
      target_audience: { all: true },
      subject: 'Health Tips',
      content: 'Stay healthy!',
      scheduled_date: '2025-02-01'
    };
    
    const campaign = await makeRequest('/campaigns', 'POST', campaignData);
    if (campaign.status === 200) {
      console.log('✅ Campaign created successfully');
      results.campaigns = true;
    }
    
    console.log('\n6️⃣ TESTING CRM METRICS');
    console.log('━'.repeat(60));
    
    const metrics = await makeRequest('/crm/metrics');
    if (metrics.status === 200 && metrics.data.success) {
      const m = metrics.data.data;
      console.log('📊 CRM Metrics:');
      console.log(`   • Total Patients: ${m.total_patients || 0}`);
      console.log(`   • Total Owners: ${m.total_owners || 0}`);
      console.log(`   • Upcoming Appointments: ${m.upcoming_appointments || 0}`);
      console.log(`   • Active Campaigns: ${m.active_campaigns || 0}`);
    }
    
    // Test external URLs
    console.log('\n7️⃣ TESTING EXTERNAL ACCESS');
    console.log('━'.repeat(60));
    
    const https = require('https');
    const externalURLs = [
      'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health',
      'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so/'
    ];
    
    for (const url of externalURLs) {
      await new Promise((resolve) => {
        https.get(url, (res) => {
          if (res.statusCode === 200) {
            console.log(`✅ External URL accessible: ${url.split('.')[0].split('//')[1]}`);
          }
          resolve();
        }).on('error', () => resolve());
      });
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
  
  // Generate summary
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('                    VERIFICATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  const features = Object.entries(results);
  const passed = features.filter(([_, v]) => v).length;
  const total = features.length;
  
  console.log('✅ Features Verified:');
  features.forEach(([feature, status]) => {
    console.log(`   ${status ? '✅' : '❌'} ${feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, ' $1')}`);
  });
  
  const successRate = Math.round((passed / total) * 100);
  console.log(`\n🎯 Success Rate: ${successRate}% (${passed}/${total})`);
  
  if (successRate >= 80) {
    console.log('✅ CRM SYSTEM VERIFIED AND OPERATIONAL!');
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    results,
    successRate: successRate + '%',
    externalURLs: {
      backend: 'https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so',
      frontend: 'https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so'
    }
  };
  
  fs.writeFileSync('/root/crm-verification.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Verification report saved: /root/crm-verification.json');
}

runTests();
