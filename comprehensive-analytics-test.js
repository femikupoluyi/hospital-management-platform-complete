const axios = require('axios');

const BASE_URL = 'http://localhost:13000';
const PUBLIC_URL = 'https://analytics-ml-api-morphvm-mkofwuzh.http.cloud.morph.so';

async function comprehensiveTest() {
  console.log('=========================================================');
  console.log('COMPREHENSIVE DATA ANALYTICS & ML VERIFICATION TEST');
  console.log('=========================================================\n');

  let successCount = 0;
  let totalTests = 0;
  const testResults = [];

  // TEST 1: Data Lake Ingestion Pipeline
  console.log('1. DATA LAKE INGESTION PIPELINE TEST');
  console.log('-------------------------------------');
  try {
    totalTests++;
    
    // Ingest sample patient data
    const patientData = await axios.post(`${BASE_URL}/api/analytics/data-lake/ingest`, {
      source_module: 'patient_management',
      data_type: 'admissions',
      data: {
        hospitalId: 'HOSP001',
        date: new Date().toISOString().split('T')[0],
        admissions: 45,
        discharges: 38,
        avgStayDays: 3.5,
        occupancyRate: 78.5
      }
    });
    
    // Ingest sample billing data
    const billingData = await axios.post(`${BASE_URL}/api/analytics/data-lake/ingest`, {
      source_module: 'billing_system',
      data_type: 'revenue',
      data: {
        date: new Date().toISOString().split('T')[0],
        totalRevenue: 125000,
        insuranceClaims: 85000,
        cashPayments: 40000,
        pendingClaims: 12
      }
    });
    
    // Ingest sample inventory data
    const inventoryData = await axios.post(`${BASE_URL}/api/analytics/data-lake/ingest`, {
      source_module: 'inventory_management',
      data_type: 'stock_levels',
      data: {
        drugId: 'D001',
        drugName: 'Paracetamol',
        currentStock: 450,
        usageRate: 15,
        reorderPoint: 100
      }
    });
    
    // Query the ingested data
    const queryResult = await axios.get(`${BASE_URL}/api/analytics/data-lake/query`);
    
    if (patientData.data.success && billingData.data.success && inventoryData.data.success) {
      console.log('✅ Data successfully ingested into data lake');
      console.log(`   - Patient data ID: ${patientData.data.dataId}`);
      console.log(`   - Billing data ID: ${billingData.data.dataId}`);
      console.log(`   - Inventory data ID: ${inventoryData.data.dataId}`);
      console.log(`   - Total records in lake: ${queryResult.data.count}`);
      successCount++;
      testResults.push({ test: 'Data Lake Ingestion', status: 'PASSED' });
    }
  } catch (error) {
    console.log('❌ Data ingestion pipeline failed:', error.message);
    testResults.push({ test: 'Data Lake Ingestion', status: 'FAILED', error: error.message });
  }

  // TEST 2: Patient Demand Forecasting
  console.log('\n2. PATIENT DEMAND FORECASTING TEST');
  console.log('-----------------------------------');
  try {
    totalTests++;
    
    const forecast = await axios.get(`${BASE_URL}/api/analytics/predictions/patient-demand`, {
      params: { hospitalId: 'HOSP001', days: 7 }
    });
    
    const predictions = forecast.data.predictions;
    const hasReasonablePredictions = predictions.every(p => 
      p.predictedAdmissions >= 5 && 
      p.predictedAdmissions <= 100 &&
      p.confidence >= 0.75 &&
      p.confidence <= 1.0
    );
    
    if (predictions.length === 7 && hasReasonablePredictions) {
      console.log('✅ Patient demand forecast produced reasonable predictions');
      console.log(`   - Model: ${forecast.data.model}`);
      console.log(`   - Accuracy: ${(forecast.data.modelAccuracy * 100).toFixed(0)}%`);
      console.log(`   - 7-day forecast generated`);
      console.log(`   - Sample: Day 1 = ${predictions[0].predictedAdmissions} admissions (${(predictions[0].confidence * 100).toFixed(0)}% confidence)`);
      console.log(`   - Weekend factor detected: ${predictions[0].factors.weekendFactor}`);
      successCount++;
      testResults.push({ test: 'Patient Demand Forecasting', status: 'PASSED' });
    } else {
      throw new Error('Predictions outside reasonable range');
    }
  } catch (error) {
    console.log('❌ Patient demand forecasting failed:', error.message);
    testResults.push({ test: 'Patient Demand Forecasting', status: 'FAILED', error: error.message });
  }

  // TEST 3: Drug Usage Prediction
  console.log('\n3. DRUG USAGE PREDICTION TEST');
  console.log('------------------------------');
  try {
    totalTests++;
    
    const drugForecast = await axios.get(`${BASE_URL}/api/analytics/predictions/drug-usage`, {
      params: { drugId: 'D001', hospitalId: 'HOSP001', days: 30 }
    });
    
    const drugPredictions = drugForecast.data.predictions.predictions;
    const hasValidPredictions = drugPredictions.every(p => 
      p.predictedUsage >= 0 && 
      p.predictedUsage <= 100 &&
      p.projectedStock >= 0
    );
    
    if (drugPredictions.length === 30 && hasValidPredictions && drugForecast.data.daysUntilStockout > 0) {
      console.log('✅ Drug usage prediction produced reasonable forecasts');
      console.log(`   - Model: ${drugForecast.data.model}`);
      console.log(`   - Current Stock: ${drugForecast.data.currentStock} units`);
      console.log(`   - Days Until Stockout: ${drugForecast.data.daysUntilStockout}`);
      console.log(`   - Reorder Alert: ${drugForecast.data.reorderAlert ? 'YES' : 'NO'}`);
      console.log(`   - 30-day usage pattern analyzed`);
      successCount++;
      testResults.push({ test: 'Drug Usage Prediction', status: 'PASSED' });
    } else {
      throw new Error('Drug predictions invalid');
    }
  } catch (error) {
    console.log('❌ Drug usage prediction failed:', error.message);
    testResults.push({ test: 'Drug Usage Prediction', status: 'FAILED', error: error.message });
  }

  // TEST 4: Occupancy Forecasting
  console.log('\n4. OCCUPANCY FORECASTING TEST');
  console.log('------------------------------');
  try {
    totalTests++;
    
    const occupancyForecast = await axios.get(`${BASE_URL}/api/analytics/predictions/occupancy`, {
      params: { hospitalId: 'HOSP001', department: 'Emergency', days: 3 }
    });
    
    const occupancyPreds = occupancyForecast.data.predictions;
    const hasValidOccupancy = occupancyPreds.every(day => 
      day.dailyAverage >= 0 && 
      day.dailyAverage <= 100 &&
      day.hourlyPredictions.length === 24
    );
    
    if (occupancyPreds.length === 3 && hasValidOccupancy) {
      console.log('✅ Occupancy forecast produced reasonable predictions');
      console.log(`   - Model: ${occupancyForecast.data.model}`);
      console.log(`   - Peak Period: ${occupancyForecast.data.insights.peakPeriod}`);
      console.log(`   - Lowest Period: ${occupancyForecast.data.insights.lowestPeriod}`);
      console.log(`   - Daily Average: ${occupancyPreds[0].dailyAverage.toFixed(1)}%`);
      console.log(`   - Staffing Recommendation: ${occupancyForecast.data.insights.recommendedStaffing}`);
      successCount++;
      testResults.push({ test: 'Occupancy Forecasting', status: 'PASSED' });
    } else {
      throw new Error('Occupancy predictions invalid');
    }
  } catch (error) {
    console.log('❌ Occupancy forecasting failed:', error.message);
    testResults.push({ test: 'Occupancy Forecasting', status: 'FAILED', error: error.message });
  }

  // TEST 5: AI Triage Bot with Sample Input
  console.log('\n5. AI TRIAGE BOT TEST');
  console.log('---------------------');
  try {
    totalTests++;
    
    // Test with critical symptoms
    const criticalTriage = await axios.post(`${BASE_URL}/api/analytics/ai/triage`, {
      patientId: 'P001',
      symptoms: ['chest pain', 'difficulty breathing', 'dizziness'],
      vitals: {
        bloodPressure: 180,
        heartRate: 120,
        temperature: 38.5,
        oxygenSaturation: 89
      }
    });
    
    // Test with non-urgent symptoms
    const nonUrgentTriage = await axios.post(`${BASE_URL}/api/analytics/ai/triage`, {
      patientId: 'P002',
      symptoms: ['headache', 'minor cut'],
      vitals: {
        bloodPressure: 120,
        heartRate: 75,
        temperature: 37.0,
        oxygenSaturation: 98
      }
    });
    
    const criticalAssess = criticalTriage.data.triageAssessment;
    const nonUrgentAssess = nonUrgentTriage.data.triageAssessment;
    
    if (criticalAssess.level === 'CRITICAL' && 
        ['NON-URGENT', 'SEMI-URGENT'].includes(nonUrgentAssess.level) &&
        criticalAssess.urgencyScore > nonUrgentAssess.urgencyScore) {
      console.log('✅ Triage bot correctly classified symptom severity');
      console.log(`   - Critical case: ${criticalAssess.level} (score: ${criticalAssess.urgencyScore}/10)`);
      console.log(`   - Action: ${criticalAssess.recommendedAction}`);
      console.log(`   - Non-urgent case: ${nonUrgentAssess.level} (score: ${nonUrgentAssess.urgencyScore}/10)`);
      console.log(`   - Model confidence: ${criticalAssess.confidence}`);
      successCount++;
      testResults.push({ test: 'AI Triage Bot', status: 'PASSED' });
    } else {
      throw new Error('Triage classification incorrect');
    }
  } catch (error) {
    console.log('❌ Triage bot test failed:', error.message);
    testResults.push({ test: 'AI Triage Bot', status: 'FAILED', error: error.message });
  }

  // TEST 6: Billing Fraud Detection with Sample Transactions
  console.log('\n6. BILLING FRAUD DETECTION TEST');
  console.log('--------------------------------');
  try {
    totalTests++;
    
    // Test high-risk transaction
    const highRiskTx = await axios.post(`${BASE_URL}/api/analytics/ai/fraud-detection`, {
      transactionId: 'TXN-HIGH-001',
      amount: 50000,
      patientId: 'P001',
      providerId: 'PROV999',
      serviceCode: 'SVC999',
      claimDetails: { type: 'emergency', duplicate: true }
    });
    
    // Test low-risk transaction
    const lowRiskTx = await axios.post(`${BASE_URL}/api/analytics/ai/fraud-detection`, {
      transactionId: 'TXN-LOW-001',
      amount: 500,
      patientId: 'P002',
      providerId: 'PROV001',
      serviceCode: 'SVC101',
      claimDetails: { type: 'routine', duplicate: false }
    });
    
    const highRiskAnalysis = highRiskTx.data.fraudAnalysis;
    const lowRiskAnalysis = lowRiskTx.data.fraudAnalysis;
    
    if (highRiskAnalysis.fraudScore > lowRiskAnalysis.fraudScore &&
        highRiskAnalysis.flaggedReasons.length > 0) {
      console.log('✅ Fraud detection correctly identified risk patterns');
      console.log(`   - High-risk transaction: ${highRiskAnalysis.riskLevel} (score: ${highRiskAnalysis.fraudScore})`);
      console.log(`   - Flags: ${highRiskAnalysis.flaggedReasons.join(', ')}`);
      console.log(`   - Low-risk transaction: ${lowRiskAnalysis.riskLevel} (score: ${lowRiskAnalysis.fraudScore})`);
      console.log(`   - Model accuracy: ${(highRiskTx.data.modelAccuracy * 100).toFixed(0)}%`);
      successCount++;
      testResults.push({ test: 'Billing Fraud Detection', status: 'PASSED' });
    } else {
      throw new Error('Fraud detection logic error');
    }
  } catch (error) {
    console.log('❌ Fraud detection test failed:', error.message);
    testResults.push({ test: 'Billing Fraud Detection', status: 'FAILED', error: error.message });
  }

  // TEST 7: Patient Risk Scoring with Sample Profiles
  console.log('\n7. PATIENT RISK SCORING TEST');
  console.log('-----------------------------');
  try {
    totalTests++;
    
    // Test high-risk patient
    const highRiskPatient = await axios.post(`${BASE_URL}/api/analytics/ai/patient-risk-score`, {
      patientId: 'P-HIGH-001',
      demographics: { age: 75, gender: 'male', hasCaregiver: false },
      medicalHistory: {
        hypertension: true,
        diabetes: true,
        familyDiabetes: true,
        previousAdmissions: 5
      },
      currentConditions: { chronicConditions: 4 },
      lifestyle: { smoking: true, bmi: 35, physicalActivity: 'sedentary' }
    });
    
    // Test low-risk patient
    const lowRiskPatient = await axios.post(`${BASE_URL}/api/analytics/ai/patient-risk-score`, {
      patientId: 'P-LOW-001',
      demographics: { age: 30, gender: 'female', hasCaregiver: true },
      medicalHistory: {
        hypertension: false,
        diabetes: false,
        familyDiabetes: false,
        previousAdmissions: 0
      },
      currentConditions: { chronicConditions: 0 },
      lifestyle: { smoking: false, bmi: 22, physicalActivity: 'active' }
    });
    
    const highRisk = highRiskPatient.data;
    const lowRisk = lowRiskPatient.data;
    
    if (highRisk.overallRiskScore > lowRisk.overallRiskScore &&
        highRisk.overallRiskLevel === 'HIGH' &&
        lowRisk.overallRiskLevel === 'LOW') {
      console.log('✅ Patient risk scoring correctly assessed health risks');
      console.log(`   - High-risk patient: Score ${highRisk.overallRiskScore} (${highRisk.overallRiskLevel})`);
      console.log(`   - CV Risk: ${highRisk.riskCategories.cardiovascular.level}`);
      console.log(`   - Diabetes Risk: ${highRisk.riskCategories.diabetes.level}`);
      console.log(`   - Low-risk patient: Score ${lowRisk.overallRiskScore} (${lowRisk.overallRiskLevel})`);
      console.log(`   - Interventions recommended: ${highRisk.priorityInterventions.length}`);
      successCount++;
      testResults.push({ test: 'Patient Risk Scoring', status: 'PASSED' });
    } else {
      throw new Error('Risk scoring logic error');
    }
  } catch (error) {
    console.log('❌ Risk scoring test failed:', error.message);
    testResults.push({ test: 'Patient Risk Scoring', status: 'FAILED', error: error.message });
  }

  // TEST 8: Real-time Data Aggregation
  console.log('\n8. REAL-TIME DATA AGGREGATION TEST');
  console.log('-----------------------------------');
  try {
    totalTests++;
    
    const aggregateData = await axios.get(`${BASE_URL}/api/analytics/aggregate/realtime`);
    
    const metrics = aggregateData.data.metrics;
    const dataLake = aggregateData.data.dataLakeStatus;
    
    if (metrics && dataLake && dataLake.totalRecords > 0) {
      console.log('✅ Real-time aggregation successfully pulling data');
      console.log(`   - Total Patients: ${metrics.patients.total}`);
      console.log(`   - Daily Revenue: ₵${metrics.revenue.daily || 0}`);
      console.log(`   - Current Occupancy: ${metrics.occupancy.current}%`);
      console.log(`   - Low Stock Alerts: ${metrics.inventory.lowStockAlerts}`);
      console.log(`   - Data Lake Records: ${dataLake.totalRecords}`);
      console.log(`   - Processing Rate: ${dataLake.processingRate}`);
      successCount++;
      testResults.push({ test: 'Real-time Data Aggregation', status: 'PASSED' });
    } else {
      throw new Error('Aggregation data missing');
    }
  } catch (error) {
    console.log('❌ Data aggregation test failed:', error.message);
    testResults.push({ test: 'Real-time Data Aggregation', status: 'FAILED', error: error.message });
  }

  // TEST 9: Public API Endpoint
  console.log('\n9. PUBLIC API ENDPOINT TEST');
  console.log('---------------------------');
  try {
    totalTests++;
    
    const publicHealth = await axios.get(`${PUBLIC_URL}/api/analytics/health`);
    const publicModels = await axios.get(`${PUBLIC_URL}/api/analytics/models/status`);
    
    if (publicHealth.data.status === 'healthy' && 
        publicModels.data.totalModels === 6) {
      console.log('✅ Public API endpoint accessible and functional');
      console.log(`   - Public URL: ${PUBLIC_URL}`);
      console.log(`   - Service Status: ${publicHealth.data.status}`);
      console.log(`   - Active Models: ${publicModels.data.activeModels}`);
      console.log(`   - Total Predictions: ${publicModels.data.totalPredictions}`);
      successCount++;
      testResults.push({ test: 'Public API Endpoint', status: 'PASSED' });
    } else {
      throw new Error('Public API not responding correctly');
    }
  } catch (error) {
    console.log('❌ Public API test failed:', error.message);
    testResults.push({ test: 'Public API Endpoint', status: 'FAILED', error: error.message });
  }

  // SUMMARY
  console.log('\n=========================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('=========================================================');
  console.log(`\nTests Passed: ${successCount}/${totalTests}`);
  console.log(`Success Rate: ${((successCount/totalTests) * 100).toFixed(1)}%`);
  
  console.log('\nTest Results:');
  testResults.forEach(result => {
    const icon = result.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.status}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  });
  
  if (successCount === totalTests) {
    console.log('\n✅ ALL VERIFICATION TESTS PASSED!');
    console.log('\nVerified Capabilities:');
    console.log('1. Data ingestion pipelines are successfully populating the data lake');
    console.log('2. Predictive models produce reasonable forecasts with valid ranges');
    console.log('3. AI/ML services correctly respond to sample inputs with expected outputs');
    console.log('4. Risk assessment logic properly differentiates between risk levels');
    console.log('5. Real-time aggregation successfully pulls data from all modules');
    console.log('6. Public API endpoints are accessible and functional');
    
    console.log('\n🎉 Data Analytics & ML Infrastructure: FULLY VERIFIED AND OPERATIONAL');
  } else {
    console.log(`\n⚠️ ${totalTests - successCount} test(s) failed verification`);
  }
  
  return successCount === totalTests;
}

// Run comprehensive verification
comprehensiveTest()
  .then(success => {
    if (success) {
      console.log('\n✅ VERIFICATION COMPLETE: All systems operational');
      process.exit(0);
    } else {
      console.log('\n⚠️ VERIFICATION INCOMPLETE: Some tests failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Verification error:', error);
    process.exit(1);
  });
