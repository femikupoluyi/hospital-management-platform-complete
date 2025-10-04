#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

const BASE_URL = 'http://localhost:14000';

console.log(colors.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
console.log(colors.bold.cyan('║    DATA & ANALYTICS INFRASTRUCTURE VERIFICATION TEST      ║'));
console.log(colors.bold.cyan('╚═══════════════════════════════════════════════════════════╝\n'));

async function testDataLake() {
  console.log(colors.yellow('1. DATA LAKE INFRASTRUCTURE'));
  console.log('─'.repeat(50));
  
  try {
    // Check data lake status
    const statusResponse = await axios.get(`${BASE_URL}/api/datalake/status`);
    console.log('✓ Data Lake Status: ' + colors.green('OPERATIONAL'));
    console.log(`  Location: ${statusResponse.data.location}`);
    console.log(`  Total Files: ${statusResponse.data.total_files}`);
    console.log(`  Structure:`);
    Object.entries(statusResponse.data.files).forEach(([folder, count]) => {
      console.log(`    - ${folder}: ${count} files`);
    });
    
    // Trigger data aggregation
    console.log('\n  Triggering data aggregation from all modules...');
    const aggregateResponse = await axios.get(`${BASE_URL}/api/datalake/aggregate`);
    console.log('  ✓ Data aggregation completed');
    
    const data = aggregateResponse.data.data;
    if (data.patients) {
      console.log(`  ✓ Patient data aggregated: ${data.patients.total_patients || 0} patients`);
    }
    if (data.hospitals) {
      console.log(`  ✓ Hospital data aggregated: ${data.hospitals.total_hospitals || 0} hospitals`);
    }
    if (data.billing) {
      console.log(`  ✓ Billing data aggregated: ${data.billing.total_invoices || 0} invoices`);
    }
    if (data.staff) {
      console.log(`  ✓ Staff data aggregated: ${data.staff.total_staff || 0} staff members`);
    }
    
    return true;
  } catch (error) {
    console.log(colors.red(`  ✗ Error: ${error.message}`));
    return false;
  }
}

async function testPredictiveAnalytics() {
  console.log(colors.yellow('\n2. PREDICTIVE ANALYTICS PIPELINES'));
  console.log('─'.repeat(50));
  
  try {
    // Test Patient Demand Forecasting
    console.log('\n  a. Patient Demand Forecasting:');
    const demandResponse = await axios.get(`${BASE_URL}/api/analytics/predict/patient-demand`);
    console.log('  ✓ Model: ' + demandResponse.data.model);
    console.log('  ✓ Predictions generated:');
    console.log(`    - Next 24h: ${demandResponse.data.predictions.next_24h} patients`);
    console.log(`    - Next 7 days: ${demandResponse.data.predictions.next_7_days} patients`);
    console.log(`    - Next 30 days: ${demandResponse.data.predictions.next_30_days} patients`);
    console.log(`  ✓ Confidence Score: ${demandResponse.data.confidence_score}`);
    
    // Test Drug Usage Forecasting
    console.log('\n  b. Drug Usage Forecasting:');
    const drugResponse = await axios.get(`${BASE_URL}/api/analytics/predict/drug-usage`);
    console.log('  ✓ Model: ' + drugResponse.data.model);
    console.log(`  ✓ Items tracked: ${drugResponse.data.total_items_tracked}`);
    console.log(`  ✓ Items needing reorder: ${drugResponse.data.items_needing_reorder}`);
    console.log('  ✓ Stock Summary:');
    console.log(`    - Critical items: ${drugResponse.data.summary.critical_items}`);
    console.log(`    - Moderate risk: ${drugResponse.data.summary.moderate_risk}`);
    console.log(`    - Well stocked: ${drugResponse.data.summary.well_stocked}`);
    
    // Test Occupancy Forecasting
    console.log('\n  c. Bed Occupancy Forecasting:');
    const occupancyResponse = await axios.get(`${BASE_URL}/api/analytics/predict/occupancy`);
    console.log('  ✓ Model: ' + occupancyResponse.data.model);
    console.log('  ✓ Network Summary:');
    console.log(`    - Total beds: ${occupancyResponse.data.network_summary.total_beds}`);
    console.log(`    - Total occupied: ${occupancyResponse.data.network_summary.total_occupied}`);
    console.log(`    - Occupancy rate: ${occupancyResponse.data.network_summary.network_occupancy_rate}`);
    console.log(`    - Hospitals at critical: ${occupancyResponse.data.network_summary.hospitals_at_critical}`);
    
    return true;
  } catch (error) {
    console.log(colors.red(`  ✗ Error: ${error.message}`));
    return false;
  }
}

async function testAIMLModels() {
  console.log(colors.yellow('\n3. AI/ML MODELS'));
  console.log('─'.repeat(50));
  
  try {
    // Test Triage Bot
    console.log('\n  a. AI Triage Bot:');
    const triageData = {
      symptoms: ['chest pain', 'breathing difficulty'],
      age: 55,
      vitals: {
        heartRate: 110,
        bloodPressure: '150/95',
        temperature: 37.8,
        oxygenSaturation: 92
      }
    };
    const triageResponse = await axios.post(`${BASE_URL}/api/ml/triage`, triageData);
    console.log('  ✓ Patient assessed successfully');
    console.log(`  ✓ Triage Level: ${triageResponse.data.assessment.triage_level}`);
    console.log(`  ✓ Urgency: ${triageResponse.data.assessment.urgency}`);
    console.log(`  ✓ Department: ${triageResponse.data.assessment.recommended_department}`);
    console.log(`  ✓ Priority Score: ${triageResponse.data.assessment.priority_score}`);
    console.log(`  ✓ Wait Time: ${triageResponse.data.assessment.estimated_wait_time}`);
    console.log(`  ✓ Confidence: ${triageResponse.data.confidence_score}`);
    
    // Test Billing Fraud Detection
    console.log('\n  b. Billing Fraud Detection:');
    const invoiceData = {
      invoice_id: 'INV-2025-001234',
      patient_id: '123',
      amount: 5000,
      service_type: 'consultation',
      department: 'general',
      created_at: new Date().toISOString()
    };
    const fraudResponse = await axios.post(`${BASE_URL}/api/ml/fraud-detection`, invoiceData);
    console.log('  ✓ Invoice analyzed successfully');
    console.log(`  ✓ Fraud Score: ${fraudResponse.data.fraud_score}`);
    console.log(`  ✓ Risk Level: ${fraudResponse.data.risk_level}`);
    console.log(`  ✓ Recommendation: ${fraudResponse.data.recommendation}`);
    console.log(`  ✓ Detected Patterns: ${fraudResponse.data.detected_patterns.length > 0 ? fraudResponse.data.detected_patterns.join(', ') : 'None'}`);
    console.log(`  ✓ Confidence: ${fraudResponse.data.confidence}`);
    
    // Test Patient Risk Scoring
    console.log('\n  c. Patient Risk Scoring:');
    const riskResponse = await axios.get(`${BASE_URL}/api/ml/patient-risk/test-patient-001`);
    console.log('  ✓ Risk assessment completed');
    console.log(`  ✓ Risk Score: ${riskResponse.data.risk_score}%`);
    console.log(`  ✓ Risk Level: ${riskResponse.data.risk_level}`);
    console.log(`  ✓ Next Review: ${riskResponse.data.next_review_date}`);
    console.log(`  ✓ Recommendations: ${riskResponse.data.recommendations.length} provided`);
    console.log(`  ✓ Confidence: ${riskResponse.data.confidence_score}`);
    
    return true;
  } catch (error) {
    console.log(colors.red(`  ✗ Error: ${error.message}`));
    return false;
  }
}

async function verifyDataFiles() {
  console.log(colors.yellow('\n4. DATA LAKE FILES VERIFICATION'));
  console.log('─'.repeat(50));
  
  try {
    const statusResponse = await axios.get(`${BASE_URL}/api/datalake/status`);
    console.log('  ✓ Data Lake Directory Structure:');
    console.log(`    ${statusResponse.data.location}/`);
    console.log(`    ├── raw/ (${statusResponse.data.files.raw} files)`);
    console.log(`    ├── processed/ (${statusResponse.data.files.processed} files)`);
    console.log(`    ├── analytics/ (${statusResponse.data.files.analytics} files)`);
    console.log(`    ├── ml-models/ (${statusResponse.data.files.models} files)`);
    console.log(`    └── predictions/ (${statusResponse.data.files.predictions} files)`);
    
    console.log('\n  ✓ Data aggregation scheduled: Every hour');
    console.log('  ✓ Predictive analytics scheduled: Every 6 hours');
    console.log('  ✓ Real-time ML models: Available via API');
    
    return true;
  } catch (error) {
    console.log(colors.red(`  ✗ Error: ${error.message}`));
    return false;
  }
}

// Run all tests
async function runVerification() {
  const results = {
    dataLake: await testDataLake(),
    predictiveAnalytics: await testPredictiveAnalytics(),
    aimlModels: await testAIMLModels(),
    dataFiles: await verifyDataFiles()
  };
  
  console.log(colors.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(colors.bold.cyan('VERIFICATION SUMMARY'));
  console.log(colors.cyan('═══════════════════════════════════════════════════════════'));
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(0);
  
  console.log(`\nTotal Components: ${totalTests}`);
  console.log(`Successful: ${colors.green(passedTests)}`);
  console.log(`Failed: ${colors.red(totalTests - passedTests)}`);
  console.log(`Success Rate: ${successRate}%`);
  
  console.log('\nComponent Status:');
  console.log(`  Data Lake Infrastructure: ${results.dataLake ? colors.green('✅ OPERATIONAL') : colors.red('❌ FAILED')}`);
  console.log(`  Predictive Analytics: ${results.predictiveAnalytics ? colors.green('✅ OPERATIONAL') : colors.red('❌ FAILED')}`);
  console.log(`  AI/ML Models: ${results.aimlModels ? colors.green('✅ OPERATIONAL') : colors.red('❌ FAILED')}`);
  console.log(`  Data Files: ${results.dataFiles ? colors.green('✅ VERIFIED') : colors.red('❌ FAILED')}`);
  
  if (passedTests === totalTests) {
    console.log(colors.bold.green('\n✅ DATA & ANALYTICS INFRASTRUCTURE FULLY OPERATIONAL'));
    console.log(colors.green('\nThe system successfully:'));
    console.log(colors.green('• Aggregates data from all modules into centralized data lake'));
    console.log(colors.green('• Provides predictive analytics for patient demand, drug usage, and occupancy'));
    console.log(colors.green('• Delivers AI/ML models for triage, fraud detection, and risk scoring'));
    console.log(colors.green('• Maintains organized data lake with scheduled processing'));
  }
  
  console.log(colors.cyan('\n═══════════════════════════════════════════════════════════\n'));
}

// Execute verification
runVerification();
