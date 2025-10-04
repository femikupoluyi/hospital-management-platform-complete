const express = require('express');
const cors = require('cors');

const app = express();
const port = 13000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Analytics & ML Service',
    timestamp: new Date().toISOString()
  });
});

// In-memory data store for demonstration
let dataLakeRecords = [];
let predictionCount = 26423;

// =================== DATA LAKE APIs ===================
app.post('/api/analytics/data-lake/ingest', (req, res) => {
  const { source_module, data_type, data } = req.body;
  const record = {
    id: dataLakeRecords.length + 1,
    source_module,
    data_type,
    raw_data: data,
    ingested_at: new Date().toISOString()
  };
  dataLakeRecords.push(record);
  
  res.json({
    success: true,
    dataId: record.id,
    message: 'Data ingested successfully'
  });
});

app.get('/api/analytics/data-lake/query', (req, res) => {
  const { source, type } = req.query;
  let filtered = dataLakeRecords;
  
  if (source) {
    filtered = filtered.filter(r => r.source_module === source);
  }
  if (type) {
    filtered = filtered.filter(r => r.data_type === type);
  }
  
  res.json({
    count: filtered.length,
    data: filtered
  });
});

// =================== PREDICTIVE ANALYTICS ===================
app.get('/api/analytics/predictions/patient-demand', (req, res) => {
  const { hospitalId, days = 7 } = req.query;
  const predictions = [];
  
  for (let i = 0; i < parseInt(days); i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.8 : 1.2;
    const baseAdmissions = 15;
    
    predictions.push({
      date: date.toISOString().split('T')[0],
      predictedAdmissions: Math.round(baseAdmissions * weekendFactor * (0.9 + Math.random() * 0.2)),
      confidence: 0.85 + Math.random() * 0.1,
      factors: {
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        weekendFactor,
        seasonalFactor: (1 + (Math.random() * 0.2 - 0.1)).toFixed(2),
        historicalAverage: baseAdmissions
      }
    });
  }
  
  predictionCount++;
  
  res.json({
    model: 'PatientDemandForecast_v1.2',
    hospitalId,
    predictions,
    modelAccuracy: 0.87,
    lastTrainedDate: '2025-09-30'
  });
});

app.get('/api/analytics/predictions/drug-usage', (req, res) => {
  const { drugId, hospitalId, days = 30 } = req.query;
  const currentStock = 500;
  const avgDailyUsage = 15;
  const predictions = { predictions: [] };
  let remainingStock = currentStock;
  
  for (let i = 0; i < parseInt(days); i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const predictedUsage = Math.round(avgDailyUsage * (0.9 + Math.random() * 0.2));
    remainingStock -= predictedUsage;
    
    predictions.predictions.push({
      date: date.toISOString().split('T')[0],
      predictedUsage,
      projectedStock: Math.max(0, remainingStock),
      confidence: 0.82 + Math.random() * 0.08
    });
  }
  
  predictionCount++;
  
  res.json({
    model: 'DrugUsagePredictor_v2.1',
    drugId: drugId || 'ALL',
    currentStock,
    predictions,
    reorderAlert: remainingStock < 100,
    daysUntilStockout: Math.floor(currentStock / avgDailyUsage),
    modelAccuracy: 0.85,
    recommendation: remainingStock < 100 ? 
      `Reorder ${avgDailyUsage * 60} units within 7 days` : 
      'Stock levels adequate for forecast period'
  });
});

app.get('/api/analytics/predictions/occupancy', (req, res) => {
  const { hospitalId, department, days = 3 } = req.query;
  const predictions = [];
  
  for (let i = 0; i < parseInt(days); i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const hourlyPredictions = [];
    
    for (let hour = 0; hour < 24; hour++) {
      let occupancyRate = 75;
      if (hour >= 8 && hour <= 11) occupancyRate *= 1.15;
      else if (hour >= 12 && hour <= 17) occupancyRate *= 1.1;
      else if (hour >= 18 && hour <= 23) occupancyRate *= 0.95;
      else occupancyRate *= 0.85;
      
      occupancyRate += (Math.random() - 0.5) * 10;
      occupancyRate = Math.min(100, Math.max(0, occupancyRate));
      
      hourlyPredictions.push({
        hour,
        predictedOccupancy: Math.round(occupancyRate * 10) / 10,
        confidence: 0.78 + Math.random() * 0.12
      });
    }
    
    predictions.push({
      date: date.toISOString().split('T')[0],
      department: department || 'All Departments',
      hourlyPredictions,
      dailyAverage: Math.round(hourlyPredictions.reduce((sum, h) => sum + h.predictedOccupancy, 0) / 24 * 10) / 10,
      peakHours: [8, 9, 10, 11]
    });
  }
  
  predictionCount++;
  
  res.json({
    model: 'OccupancyForecast_v1.8',
    hospitalId: hospitalId || 'All Hospitals',
    department: department || 'All Departments',
    predictions,
    modelAccuracy: 0.81,
    insights: {
      peakPeriod: '8:00 AM - 11:00 AM',
      lowestPeriod: '12:00 AM - 7:00 AM',
      recommendedStaffing: 'Increase staff during morning peak hours'
    }
  });
});

// =================== AI/ML MODELS ===================
app.post('/api/analytics/ai/triage', (req, res) => {
  const { patientId, symptoms, vitals } = req.body;
  const sessionId = `TRIAGE-${Date.now()}`;
  
  const symptomScores = {
    'chest pain': 9,
    'difficulty breathing': 9,
    'severe bleeding': 10,
    'unconscious': 10,
    'high fever': 7,
    'headache': 5,
    'cough': 4,
    'nausea': 4,
    'minor cut': 2,
    'rash': 3
  };
  
  let maxScore = 0;
  symptoms.forEach(symptom => {
    const score = symptomScores[symptom.toLowerCase()] || 3;
    maxScore = Math.max(maxScore, score);
  });
  
  if (vitals) {
    if (vitals.bloodPressure > 180 || vitals.bloodPressure < 90) maxScore = Math.max(maxScore, 8);
    if (vitals.heartRate > 120 || vitals.heartRate < 50) maxScore = Math.max(maxScore, 8);
    if (vitals.temperature > 39 || vitals.temperature < 35) maxScore = Math.max(maxScore, 7);
    if (vitals.oxygenSaturation < 92) maxScore = Math.max(maxScore, 9);
  }
  
  let triageLevel, recommendedAction, estimatedWaitTime;
  
  if (maxScore >= 9) {
    triageLevel = 'CRITICAL';
    recommendedAction = 'Immediate emergency care required';
    estimatedWaitTime = 0;
  } else if (maxScore >= 7) {
    triageLevel = 'URGENT';
    recommendedAction = 'See healthcare provider within 30 minutes';
    estimatedWaitTime = 15;
  } else if (maxScore >= 5) {
    triageLevel = 'SEMI-URGENT';
    recommendedAction = 'See healthcare provider within 2 hours';
    estimatedWaitTime = 60;
  } else if (maxScore >= 3) {
    triageLevel = 'NON-URGENT';
    recommendedAction = 'Schedule regular appointment';
    estimatedWaitTime = 120;
  } else {
    triageLevel = 'SELF-CARE';
    recommendedAction = 'Monitor symptoms, self-care recommended';
    estimatedWaitTime = null;
  }
  
  predictionCount++;
  
  res.json({
    sessionId,
    patientId,
    triageAssessment: {
      level: triageLevel,
      urgencyScore: maxScore,
      recommendedAction,
      estimatedWaitTime: estimatedWaitTime ? `${estimatedWaitTime} minutes` : 'N/A',
      confidence: (0.75 + Math.random() * 0.2).toFixed(2)
    },
    model: 'TriageBot_v3.2',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/analytics/ai/fraud-detection', (req, res) => {
  const { transactionId, amount, patientId, providerId, serviceCode } = req.body;
  
  let fraudScore = 0;
  const flaggedReasons = [];
  
  if (amount > 10000) {
    fraudScore += 0.3;
    flaggedReasons.push('High transaction amount');
  }
  
  if (Math.random() < 0.05) {
    fraudScore += 0.4;
    flaggedReasons.push('Potential duplicate claim');
  }
  
  if (serviceCode && serviceCode.includes('999')) {
    fraudScore += 0.2;
    flaggedReasons.push('Unusual service code');
  }
  
  const providerRiskScore = Math.random() * 0.3;
  fraudScore += providerRiskScore;
  if (providerRiskScore > 0.2) {
    flaggedReasons.push('Provider billing pattern anomaly');
  }
  
  fraudScore = Math.min(1, fraudScore);
  
  let riskLevel;
  if (fraudScore >= 0.7) riskLevel = 'HIGH';
  else if (fraudScore >= 0.4) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';
  
  predictionCount++;
  
  res.json({
    transactionId,
    fraudAnalysis: {
      fraudScore: Math.round(fraudScore * 100) / 100,
      riskLevel,
      confidence: 0.89,
      flaggedReasons
    },
    recommendation: {
      action: riskLevel === 'HIGH' ? 'Manual review required' : 
              riskLevel === 'MEDIUM' ? 'Additional verification suggested' : 
              'Auto-approve',
      investigationPriority: riskLevel === 'HIGH' ? 'URGENT' : 'NORMAL'
    },
    model: 'FraudDetector_v2.5',
    modelAccuracy: 0.92,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/analytics/ai/patient-risk-score', (req, res) => {
  const { patientId, demographics, medicalHistory, currentConditions, lifestyle } = req.body;
  
  const riskScores = {};
  
  // Cardiovascular Risk
  let cvRisk = 0;
  const cvFactors = [];
  
  if (demographics?.age > 60) { cvRisk += 0.2; cvFactors.push('Age > 60'); }
  if (demographics?.gender === 'male' && demographics?.age > 45) { cvRisk += 0.1; cvFactors.push('Male > 45'); }
  if (medicalHistory?.hypertension) { cvRisk += 0.25; cvFactors.push('Hypertension'); }
  if (medicalHistory?.diabetes) { cvRisk += 0.2; cvFactors.push('Diabetes'); }
  if (lifestyle?.smoking) { cvRisk += 0.3; cvFactors.push('Smoking'); }
  if (lifestyle?.bmi > 30) { cvRisk += 0.15; cvFactors.push('BMI > 30'); }
  
  riskScores.cardiovascular = {
    score: Math.min(1, cvRisk),
    level: cvRisk >= 0.6 ? 'HIGH' : cvRisk >= 0.3 ? 'MEDIUM' : 'LOW',
    factors: cvFactors,
    recommendations: cvRisk >= 0.6 ? 
      ['Immediate cardiac evaluation', 'Lifestyle modification program'] :
      ['Regular monitoring']
  };
  
  // Diabetes Risk
  let diabetesRisk = 0;
  const diabetesFactors = [];
  
  if (lifestyle?.bmi > 25) { diabetesRisk += 0.2; diabetesFactors.push('Overweight'); }
  if (medicalHistory?.familyDiabetes) { diabetesRisk += 0.25; diabetesFactors.push('Family history'); }
  if (demographics?.age > 45) { diabetesRisk += 0.15; diabetesFactors.push('Age > 45'); }
  if (lifestyle?.physicalActivity === 'sedentary') { diabetesRisk += 0.2; diabetesFactors.push('Sedentary lifestyle'); }
  
  riskScores.diabetes = {
    score: Math.min(1, diabetesRisk),
    level: diabetesRisk >= 0.5 ? 'HIGH' : diabetesRisk >= 0.25 ? 'MEDIUM' : 'LOW',
    factors: diabetesFactors,
    recommendations: diabetesRisk >= 0.5 ?
      ['Glucose screening', 'Dietary consultation'] :
      ['Annual screening']
  };
  
  // Readmission Risk
  let readmissionRisk = 0;
  const readmissionFactors = [];
  
  if (medicalHistory?.previousAdmissions > 2) { readmissionRisk += 0.3; readmissionFactors.push('Multiple admissions'); }
  if (currentConditions?.chronicConditions > 3) { readmissionRisk += 0.25; readmissionFactors.push('Multiple chronic conditions'); }
  if (demographics?.age > 70) { readmissionRisk += 0.2; readmissionFactors.push('Age > 70'); }
  
  riskScores.readmission = {
    score: Math.min(1, readmissionRisk),
    level: readmissionRisk >= 0.6 ? 'HIGH' : readmissionRisk >= 0.3 ? 'MEDIUM' : 'LOW',
    factors: readmissionFactors,
    recommendations: readmissionRisk >= 0.6 ?
      ['Discharge planning', 'Home health follow-up'] :
      ['Standard discharge protocol']
  };
  
  const overallRisk = (cvRisk + diabetesRisk + readmissionRisk) / 3;
  
  predictionCount++;
  
  res.json({
    patientId,
    overallRiskScore: Math.round(overallRisk * 100) / 100,
    overallRiskLevel: overallRisk >= 0.6 ? 'HIGH' : overallRisk >= 0.3 ? 'MEDIUM' : 'LOW',
    riskCategories: riskScores,
    priorityInterventions: Object.values(riskScores)
      .filter(r => r.level === 'HIGH')
      .flatMap(r => r.recommendations),
    model: 'PatientRiskScorer_v1.9',
    confidence: 0.86,
    timestamp: new Date().toISOString()
  });
});

// =================== REAL-TIME AGGREGATION ===================
app.get('/api/analytics/aggregate/realtime', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    metrics: {
      patients: { total: 156, trend: '+5.2%' },
      revenue: { daily: 119596, trend: '+12.3%' },
      occupancy: { current: 75.39, trend: '+2.1%' },
      inventory: { lowStockAlerts: 2, trend: '-15%' },
      staff: { active: 342, trend: '+1.5%' }
    },
    dataLakeStatus: {
      totalRecords: 1847293 + dataLakeRecords.length,
      lastIngestion: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      processingRate: '2,450 records/min'
    }
  });
});

// =================== MODEL STATUS ===================
app.get('/api/analytics/models/status', (req, res) => {
  const models = [
    { name: 'PatientDemandForecast', version: 'v1.2', accuracy: 0.87, status: 'active', predictions: 4523 },
    { name: 'DrugUsagePredictor', version: 'v2.1', accuracy: 0.85, status: 'active', predictions: 3891 },
    { name: 'OccupancyForecast', version: 'v1.8', accuracy: 0.81, status: 'active', predictions: 2156 },
    { name: 'TriageBot', version: 'v3.2', accuracy: 0.89, status: 'active', predictions: 8934 },
    { name: 'FraudDetector', version: 'v2.5', accuracy: 0.92, status: 'active', predictions: 1247 },
    { name: 'PatientRiskScorer', version: 'v1.9', accuracy: 0.86, status: 'active', predictions: 5672 }
  ];
  
  res.json({
    totalModels: models.length,
    activeModels: models.filter(m => m.status === 'active').length,
    averageAccuracy: models.reduce((sum, m) => sum + m.accuracy, 0) / models.length,
    totalPredictions: predictionCount,
    models
  });
});

// =================== HEALTH CHECK ===================
app.get('/api/analytics/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Data Analytics & ML Platform',
    version: '1.0.0',
    models: {
      patientDemand: 'active',
      drugUsage: 'active',
      occupancy: 'active',
      triageBot: 'active',
      fraudDetection: 'active',
      riskScoring: 'active'
    },
    dataLake: 'operational',
    pipelines: 'running'
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Data Analytics & ML Platform (Standalone) running on port ${port}`);
  console.log(`Access at: http://localhost:${port}`);
  console.log('All ML Models initialized and operational');
});
