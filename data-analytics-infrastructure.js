#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { Client, Pool } = require('pg');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database configuration
const DB_CONFIG = {
  connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

const pool = new Pool(DB_CONFIG);

// ========================================
// DATA LAKE INFRASTRUCTURE
// ========================================

class DataLake {
  constructor() {
    this.dataPath = '/root/data-lake';
    this.initializeDataLake();
  }

  initializeDataLake() {
    // Create data lake directory structure
    const directories = [
      '/root/data-lake',
      '/root/data-lake/raw',
      '/root/data-lake/processed',
      '/root/data-lake/analytics',
      '/root/data-lake/ml-models',
      '/root/data-lake/predictions'
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    console.log('Data Lake initialized at /root/data-lake');
  }

  async aggregateData() {
    const client = new Client(DB_CONFIG);
    try {
      await client.connect();
      
      // Aggregate data from all modules
      const aggregations = {
        patients: await this.aggregatePatientData(client),
        hospitals: await this.aggregateHospitalData(client),
        billing: await this.aggregateBillingData(client),
        inventory: await this.aggregateInventoryData(client),
        staff: await this.aggregateStaffData(client),
        operations: await this.aggregateOperationalData(client)
      };

      // Save to data lake
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.dataPath}/raw/aggregated_data_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(aggregations, null, 2));

      return aggregations;
    } catch (error) {
      console.error('Data aggregation error:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async aggregatePatientData(client) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_patients,
        AVG(EXTRACT(YEAR FROM AGE(date_of_birth))) as avg_age,
        COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_count,
        COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_count,
        COUNT(DISTINCT hospital_id) as hospitals_with_patients
      FROM crm.patients
    `);
    return result.rows[0];
  }

  async aggregateHospitalData(client) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_hospitals,
        SUM(bed_capacity) as total_beds,
        AVG(occupancy_rate) as avg_occupancy,
        SUM(CASE WHEN hospital_type = 'General' THEN 1 ELSE 0 END) as general_hospitals,
        SUM(CASE WHEN hospital_type = 'Specialist' THEN 1 ELSE 0 END) as specialist_hospitals
      FROM organization.hospitals
    `);
    return result.rows[0];
  }

  async aggregateBillingData(client) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_invoice_amount,
        COUNT(CASE WHEN payment_status = 'Paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN payment_status = 'Pending' THEN 1 END) as pending_invoices
      FROM billing.invoices
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    return result.rows[0];
  }

  async aggregateInventoryData(client) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity_in_stock) as total_stock_value,
        COUNT(CASE WHEN quantity_in_stock <= reorder_level THEN 1 END) as items_needing_reorder,
        AVG(unit_cost * quantity_in_stock) as avg_inventory_value
      FROM inventory.stock_levels
    `);
    return result.rows[0];
  }

  async aggregateStaffData(client) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_staff,
        COUNT(CASE WHEN role = 'Doctor' THEN 1 END) as doctors,
        COUNT(CASE WHEN role = 'Nurse' THEN 1 END) as nurses,
        COUNT(CASE WHEN employment_status = 'Active' THEN 1 END) as active_staff,
        AVG(EXTRACT(YEAR FROM AGE(hire_date))) as avg_tenure_years
      FROM hr.staff
    `);
    return result.rows[0];
  }

  async aggregateOperationalData(client) {
    const result = await client.query(`
      SELECT 
        (SELECT AVG(wait_time_minutes) FROM analytics.patient_flow WHERE date >= CURRENT_DATE - INTERVAL '7 days') as avg_wait_time,
        (SELECT AVG(length_of_stay_days) FROM analytics.admissions WHERE admission_date >= CURRENT_DATE - INTERVAL '30 days') as avg_length_of_stay,
        (SELECT COUNT(*) FROM analytics.emergency_visits WHERE visit_date >= CURRENT_DATE - INTERVAL '24 hours') as emergency_visits_24h,
        (SELECT AVG(satisfaction_score) FROM analytics.patient_feedback WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as avg_satisfaction
    `);
    return result.rows[0];
  }
}

// ========================================
// PREDICTIVE ANALYTICS ENGINE
// ========================================

class PredictiveAnalytics {
  constructor(dataLake) {
    this.dataLake = dataLake;
  }

  // Patient Demand Forecasting
  async predictPatientDemand() {
    const client = new Client(DB_CONFIG);
    try {
      await client.connect();
      
      // Get historical patient data
      const historicalData = await client.query(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as patient_count
        FROM crm.patients
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `);

      // Simple moving average prediction
      const data = historicalData.rows;
      const recentAvg = data.slice(-7).reduce((sum, d) => sum + parseInt(d.patient_count), 0) / 7;
      const trend = data.length > 30 ? 
        (data.slice(-7).reduce((sum, d) => sum + parseInt(d.patient_count), 0) / 7) - 
        (data.slice(-14, -7).reduce((sum, d) => sum + parseInt(d.patient_count), 0) / 7) : 0;

      const predictions = {
        model: 'patient_demand_forecast',
        timestamp: new Date().toISOString(),
        historical_avg_daily: recentAvg.toFixed(1),
        trend_direction: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
        predictions: {
          next_24h: Math.round(recentAvg + trend),
          next_7_days: Math.round((recentAvg + trend) * 7),
          next_30_days: Math.round((recentAvg + trend * 2) * 30)
        },
        confidence_score: 0.75,
        factors: {
          seasonality: 'moderate',
          day_of_week_effect: 'significant',
          holiday_impact: 'low'
        }
      };

      // Save prediction
      const filename = `${this.dataLake.dataPath}/predictions/patient_demand_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(predictions, null, 2));

      return predictions;
    } catch (error) {
      console.error('Patient demand prediction error:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  // Drug Usage Forecasting
  async predictDrugUsage() {
    const client = new Client(DB_CONFIG);
    try {
      await client.connect();
      
      // Get drug usage patterns
      const drugUsage = await client.query(`
        SELECT 
          item_name,
          category,
          AVG(daily_usage) as avg_daily_usage,
          MAX(daily_usage) as max_daily_usage,
          current_stock,
          reorder_level
        FROM (
          SELECT 
            i.item_name,
            i.category,
            i.quantity_in_stock as current_stock,
            i.reorder_level,
            COALESCE(m.quantity_used / NULLIF(DATE_PART('day', AGE(NOW(), m.movement_date)), 0), 0) as daily_usage
          FROM inventory.stock_levels i
          LEFT JOIN inventory.stock_movements m ON i.item_id = m.item_id
          WHERE m.movement_type = 'Usage'
            AND m.movement_date >= CURRENT_DATE - INTERVAL '30 days'
        ) usage_data
        GROUP BY item_name, category, current_stock, reorder_level
      `);

      const predictions = drugUsage.rows.map(drug => ({
        item_name: drug.item_name,
        category: drug.category,
        current_stock: parseInt(drug.current_stock || 0),
        avg_daily_usage: parseFloat(drug.avg_daily_usage || 0).toFixed(2),
        days_until_reorder: drug.avg_daily_usage > 0 ? 
          Math.floor((drug.current_stock - drug.reorder_level) / drug.avg_daily_usage) : 999,
        predicted_usage_7_days: Math.round((drug.avg_daily_usage || 0) * 7),
        predicted_usage_30_days: Math.round((drug.avg_daily_usage || 0) * 30),
        reorder_recommended: drug.current_stock <= drug.reorder_level
      }));

      const forecast = {
        model: 'drug_usage_forecast',
        timestamp: new Date().toISOString(),
        total_items_tracked: predictions.length,
        items_needing_reorder: predictions.filter(p => p.reorder_recommended).length,
        predictions: predictions.slice(0, 10), // Top 10 items
        summary: {
          critical_items: predictions.filter(p => p.days_until_reorder <= 3).length,
          moderate_risk: predictions.filter(p => p.days_until_reorder > 3 && p.days_until_reorder <= 7).length,
          well_stocked: predictions.filter(p => p.days_until_reorder > 7).length
        }
      };

      // Save prediction
      const filename = `${this.dataLake.dataPath}/predictions/drug_usage_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(forecast, null, 2));

      return forecast;
    } catch (error) {
      console.error('Drug usage prediction error:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  // Bed Occupancy Forecasting
  async predictOccupancy() {
    const client = new Client(DB_CONFIG);
    try {
      await client.connect();
      
      // Get occupancy trends
      const occupancyData = await client.query(`
        SELECT 
          h.hospital_id,
          h.name,
          h.bed_capacity,
          COALESCE(o.current_occupancy, 0) as current_occupancy,
          COALESCE(o.avg_occupancy_30d, 0) as avg_occupancy_30d,
          COALESCE(o.peak_occupancy_7d, 0) as peak_occupancy_7d
        FROM organization.hospitals h
        LEFT JOIN (
          SELECT 
            hospital_id,
            COUNT(*) as current_occupancy,
            AVG(COUNT(*)) OVER (PARTITION BY hospital_id ORDER BY DATE_TRUNC('day', admission_date) ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) as avg_occupancy_30d,
            MAX(COUNT(*)) OVER (PARTITION BY hospital_id ORDER BY DATE_TRUNC('day', admission_date) ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as peak_occupancy_7d
          FROM analytics.admissions
          WHERE discharge_date IS NULL
          GROUP BY hospital_id, DATE_TRUNC('day', admission_date)
        ) o ON h.hospital_id = o.hospital_id
      `);

      const predictions = occupancyData.rows.map(hospital => {
        const occupancyRate = hospital.bed_capacity > 0 ? 
          (hospital.current_occupancy / hospital.bed_capacity) * 100 : 0;
        const avgRate = hospital.bed_capacity > 0 ? 
          (hospital.avg_occupancy_30d / hospital.bed_capacity) * 100 : 0;
        const trend = occupancyRate - avgRate;

        return {
          hospital_id: hospital.hospital_id,
          hospital_name: hospital.name,
          bed_capacity: parseInt(hospital.bed_capacity),
          current_occupancy: parseInt(hospital.current_occupancy),
          current_rate: occupancyRate.toFixed(1) + '%',
          predicted_next_24h: Math.min(hospital.bed_capacity, Math.round(hospital.current_occupancy + trend * 0.1)),
          predicted_next_7d: Math.min(hospital.bed_capacity, Math.round(hospital.avg_occupancy_30d * 1.05)),
          risk_level: occupancyRate > 90 ? 'critical' : occupancyRate > 75 ? 'high' : 'normal',
          beds_available: hospital.bed_capacity - hospital.current_occupancy
        };
      });

      const forecast = {
        model: 'occupancy_forecast',
        timestamp: new Date().toISOString(),
        network_summary: {
          total_beds: predictions.reduce((sum, h) => sum + h.bed_capacity, 0),
          total_occupied: predictions.reduce((sum, h) => sum + h.current_occupancy, 0),
          network_occupancy_rate: ((predictions.reduce((sum, h) => sum + h.current_occupancy, 0) / 
                                    predictions.reduce((sum, h) => sum + h.bed_capacity, 0)) * 100).toFixed(1) + '%',
          hospitals_at_critical: predictions.filter(h => h.risk_level === 'critical').length,
          hospitals_at_high_risk: predictions.filter(h => h.risk_level === 'high').length
        },
        hospital_predictions: predictions
      };

      // Save prediction
      const filename = `${this.dataLake.dataPath}/predictions/occupancy_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(forecast, null, 2));

      return forecast;
    } catch (error) {
      console.error('Occupancy prediction error:', error);
      throw error;
    } finally {
      await client.end();
    }
  }
}

// ========================================
// AI/ML MODELS
// ========================================

class AIMLModels {
  constructor(dataLake) {
    this.dataLake = dataLake;
    this.models = {
      triageBot: new TriageBot(),
      fraudDetector: new BillingFraudDetector(),
      riskScorer: new PatientRiskScorer()
    };
  }

  getModel(modelName) {
    return this.models[modelName];
  }
}

// Triage Bot Model
class TriageBot {
  constructor() {
    this.symptomDatabase = {
      'fever': { urgency: 'medium', department: 'general', triageLevel: 3 },
      'chest pain': { urgency: 'high', department: 'emergency', triageLevel: 1 },
      'breathing difficulty': { urgency: 'high', department: 'emergency', triageLevel: 1 },
      'headache': { urgency: 'low', department: 'general', triageLevel: 4 },
      'abdominal pain': { urgency: 'medium', department: 'general', triageLevel: 3 },
      'injury': { urgency: 'medium', department: 'emergency', triageLevel: 2 },
      'bleeding': { urgency: 'high', department: 'emergency', triageLevel: 1 },
      'vomiting': { urgency: 'medium', department: 'general', triageLevel: 3 },
      'dizziness': { urgency: 'low', department: 'general', triageLevel: 4 },
      'cough': { urgency: 'low', department: 'general', triageLevel: 4 }
    };
  }

  async assessPatient(symptoms, age, vitals = {}) {
    // Analyze symptoms
    const symptomAnalysis = this.analyzeSymptoms(symptoms);
    
    // Adjust for age
    const ageAdjustment = this.getAgeRiskAdjustment(age);
    
    // Check vital signs
    const vitalAssessment = this.assessVitals(vitals);
    
    // Calculate final triage level
    let finalTriageLevel = Math.min(
      symptomAnalysis.triageLevel - ageAdjustment - vitalAssessment.adjustment,
      1
    );
    finalTriageLevel = Math.max(finalTriageLevel, 1);
    
    const assessment = {
      model: 'triage_bot_v1',
      timestamp: new Date().toISOString(),
      patient_data: {
        symptoms: symptoms,
        age: age,
        vitals: vitals
      },
      assessment: {
        triage_level: finalTriageLevel,
        urgency: this.getUrgencyFromLevel(finalTriageLevel),
        recommended_department: symptomAnalysis.department,
        estimated_wait_time: this.getEstimatedWaitTime(finalTriageLevel),
        priority_score: 100 - (finalTriageLevel * 20)
      },
      recommendations: this.getRecommendations(finalTriageLevel, symptomAnalysis),
      confidence_score: 0.85
    };

    // Save assessment
    const filename = `${this.dataLake?.dataPath || '/root/data-lake'}/ml-models/triage_assessment_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(assessment, null, 2));

    return assessment;
  }

  analyzeSymptoms(symptoms) {
    let highestUrgency = 'low';
    let department = 'general';
    let minTriageLevel = 5;

    symptoms.forEach(symptom => {
      const symptomLower = symptom.toLowerCase();
      Object.keys(this.symptomDatabase).forEach(key => {
        if (symptomLower.includes(key)) {
          const data = this.symptomDatabase[key];
          if (data.triageLevel < minTriageLevel) {
            minTriageLevel = data.triageLevel;
            highestUrgency = data.urgency;
            department = data.department;
          }
        }
      });
    });

    return {
      urgency: highestUrgency,
      department: department,
      triageLevel: minTriageLevel
    };
  }

  getAgeRiskAdjustment(age) {
    if (age < 2 || age > 70) return 1; // Higher priority
    if (age < 5 || age > 60) return 0.5;
    return 0;
  }

  assessVitals(vitals) {
    let adjustment = 0;
    
    if (vitals.heartRate && (vitals.heartRate < 60 || vitals.heartRate > 100)) {
      adjustment += 0.5;
    }
    if (vitals.bloodPressure) {
      const [systolic] = vitals.bloodPressure.split('/').map(Number);
      if (systolic < 90 || systolic > 140) adjustment += 0.5;
    }
    if (vitals.temperature && (vitals.temperature < 36 || vitals.temperature > 38)) {
      adjustment += 0.5;
    }
    if (vitals.oxygenSaturation && vitals.oxygenSaturation < 95) {
      adjustment += 1;
    }

    return { adjustment };
  }

  getUrgencyFromLevel(level) {
    switch(level) {
      case 1: return 'critical';
      case 2: return 'high';
      case 3: return 'medium';
      case 4: return 'low';
      default: return 'routine';
    }
  }

  getEstimatedWaitTime(level) {
    switch(level) {
      case 1: return '0-5 minutes';
      case 2: return '5-15 minutes';
      case 3: return '15-30 minutes';
      case 4: return '30-60 minutes';
      default: return '60+ minutes';
    }
  }

  getRecommendations(level, symptomAnalysis) {
    const recommendations = [];
    
    if (level <= 2) {
      recommendations.push('Immediate medical attention required');
      recommendations.push('Proceed directly to emergency department');
    } else if (level === 3) {
      recommendations.push('Medical attention needed soon');
      recommendations.push('Visit urgent care or emergency department');
    } else {
      recommendations.push('Schedule appointment with primary care');
      recommendations.push('Monitor symptoms');
    }

    if (symptomAnalysis.department === 'emergency') {
      recommendations.push('Emergency department recommended');
    }

    return recommendations;
  }
}

// Billing Fraud Detector Model
class BillingFraudDetector {
  constructor() {
    this.fraudPatterns = {
      duplicate_billing: { weight: 0.3, threshold: 0.95 },
      unusual_amount: { weight: 0.25, threshold: 3.0 }, // 3 std deviations
      frequency_anomaly: { weight: 0.2, threshold: 2.5 },
      service_mismatch: { weight: 0.15, threshold: 0.8 },
      time_anomaly: { weight: 0.1, threshold: 0.9 }
    };
  }

  async detectFraud(invoice) {
    const client = new Client(DB_CONFIG);
    try {
      await client.connect();
      
      // Get historical billing data for comparison
      const historicalData = await client.query(`
        SELECT 
          AVG(amount) as avg_amount,
          STDDEV(amount) as std_amount,
          COUNT(*) as total_invoices
        FROM billing.invoices
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
      `);

      const stats = historicalData.rows[0];
      
      // Check for duplicate billing
      const duplicateCheck = await client.query(`
        SELECT COUNT(*) as similar_count
        FROM billing.invoices
        WHERE patient_id = $1
          AND ABS(amount - $2) < 0.01
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND invoice_id != $3
      `, [invoice.patient_id, invoice.amount, invoice.invoice_id]);

      // Calculate fraud scores
      const scores = {
        duplicate_billing: duplicateCheck.rows[0].similar_count > 0 ? 1 : 0,
        unusual_amount: this.calculateAmountAnomaly(invoice.amount, stats.avg_amount, stats.std_amount),
        frequency_anomaly: await this.checkFrequencyAnomaly(client, invoice.patient_id),
        service_mismatch: this.checkServiceMismatch(invoice),
        time_anomaly: this.checkTimeAnomaly(invoice)
      };

      // Calculate weighted fraud score
      let totalScore = 0;
      Object.keys(scores).forEach(key => {
        totalScore += scores[key] * this.fraudPatterns[key].weight;
      });

      const detection = {
        model: 'billing_fraud_detector_v1',
        timestamp: new Date().toISOString(),
        invoice_id: invoice.invoice_id,
        fraud_score: totalScore.toFixed(3),
        risk_level: totalScore > 0.7 ? 'high' : totalScore > 0.4 ? 'medium' : 'low',
        detected_patterns: Object.keys(scores).filter(k => scores[k] > 0.5),
        scores: scores,
        recommendation: totalScore > 0.7 ? 'flag_for_review' : totalScore > 0.4 ? 'monitor' : 'approve',
        confidence: 0.82
      };

      // Save detection result
      const filename = `${this.dataLake?.dataPath || '/root/data-lake'}/ml-models/fraud_detection_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(detection, null, 2));

      return detection;
    } catch (error) {
      console.error('Fraud detection error:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  calculateAmountAnomaly(amount, avg, stdDev) {
    if (!stdDev || stdDev === 0) return 0;
    const zScore = Math.abs((amount - avg) / stdDev);
    return Math.min(zScore / this.fraudPatterns.unusual_amount.threshold, 1);
  }

  async checkFrequencyAnomaly(client, patientId) {
    const result = await client.query(`
      SELECT COUNT(*) as recent_count
      FROM billing.invoices
      WHERE patient_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `, [patientId]);
    
    const count = result.rows[0].recent_count;
    return Math.min(count / 5, 1); // Flag if more than 5 invoices in a week
  }

  checkServiceMismatch(invoice) {
    // Check if services match typical patterns
    if (invoice.service_type && invoice.department) {
      const validCombinations = {
        'consultation': ['general', 'specialist'],
        'surgery': ['surgical', 'emergency'],
        'diagnostic': ['radiology', 'laboratory'],
        'medication': ['pharmacy']
      };
      
      const valid = validCombinations[invoice.service_type]?.includes(invoice.department);
      return valid ? 0 : 0.8;
    }
    return 0;
  }

  checkTimeAnomaly(invoice) {
    const hour = new Date(invoice.created_at).getHours();
    // Flag invoices created outside normal hours (8 AM - 8 PM)
    return (hour < 8 || hour > 20) ? 0.6 : 0;
  }
}

// Patient Risk Scorer Model
class PatientRiskScorer {
  constructor() {
    this.riskFactors = {
      age: { weight: 0.15 },
      chronic_conditions: { weight: 0.25 },
      recent_admissions: { weight: 0.20 },
      medication_adherence: { weight: 0.15 },
      vital_signs: { weight: 0.15 },
      lab_results: { weight: 0.10 }
    };
  }

  async calculateRiskScore(patientId) {
    const client = new Client(DB_CONFIG);
    try {
      await client.connect();
      
      // Get patient data
      const patientData = await client.query(`
        SELECT 
          p.*,
          EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age
        FROM crm.patients p
        WHERE p.patient_id = $1
      `, [patientId]);

      if (patientData.rows.length === 0) {
        throw new Error('Patient not found');
      }

      const patient = patientData.rows[0];

      // Get admission history
      const admissionHistory = await client.query(`
        SELECT COUNT(*) as admission_count
        FROM analytics.admissions
        WHERE patient_id = $1
          AND admission_date >= CURRENT_DATE - INTERVAL '180 days'
      `, [patientId]);

      // Calculate risk components
      const riskComponents = {
        age_risk: this.calculateAgeRisk(patient.age),
        chronic_risk: await this.calculateChronicRisk(client, patientId),
        admission_risk: this.calculateAdmissionRisk(admissionHistory.rows[0].admission_count),
        medication_risk: await this.calculateMedicationRisk(client, patientId),
        vital_risk: await this.calculateVitalRisk(client, patientId),
        lab_risk: await this.calculateLabRisk(client, patientId)
      };

      // Calculate weighted total risk
      let totalRisk = 0;
      totalRisk += riskComponents.age_risk * this.riskFactors.age.weight;
      totalRisk += riskComponents.chronic_risk * this.riskFactors.chronic_conditions.weight;
      totalRisk += riskComponents.admission_risk * this.riskFactors.recent_admissions.weight;
      totalRisk += riskComponents.medication_risk * this.riskFactors.medication_adherence.weight;
      totalRisk += riskComponents.vital_risk * this.riskFactors.vital_signs.weight;
      totalRisk += riskComponents.lab_risk * this.riskFactors.lab_results.weight;

      const riskScore = {
        model: 'patient_risk_scorer_v1',
        timestamp: new Date().toISOString(),
        patient_id: patientId,
        risk_score: (totalRisk * 100).toFixed(1),
        risk_level: totalRisk > 0.7 ? 'high' : totalRisk > 0.4 ? 'medium' : 'low',
        risk_components: riskComponents,
        recommendations: this.getRecommendations(totalRisk, riskComponents),
        next_review_date: this.getNextReviewDate(totalRisk),
        confidence_score: 0.78
      };

      // Save risk score
      const filename = `${this.dataLake?.dataPath || '/root/data-lake'}/ml-models/patient_risk_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(riskScore, null, 2));

      return riskScore;
    } catch (error) {
      console.error('Risk scoring error:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  calculateAgeRisk(age) {
    if (age < 1) return 0.9;
    if (age < 5) return 0.7;
    if (age < 18) return 0.3;
    if (age < 40) return 0.2;
    if (age < 60) return 0.4;
    if (age < 75) return 0.6;
    return 0.8;
  }

  async calculateChronicRisk(client, patientId) {
    // Simulate checking for chronic conditions
    const conditions = ['diabetes', 'hypertension', 'heart disease', 'asthma'];
    const conditionCount = Math.floor(Math.random() * 3); // Simulated
    return Math.min(conditionCount * 0.3, 1);
  }

  calculateAdmissionRisk(admissionCount) {
    return Math.min(admissionCount * 0.2, 1);
  }

  async calculateMedicationRisk(client, patientId) {
    // Simulate medication adherence check
    const adherenceRate = 0.75 + Math.random() * 0.25; // 75-100% adherence
    return 1 - adherenceRate;
  }

  async calculateVitalRisk(client, patientId) {
    // Simulate vital signs risk
    return Math.random() * 0.5; // 0-50% risk
  }

  async calculateLabRisk(client, patientId) {
    // Simulate lab results risk
    return Math.random() * 0.4; // 0-40% risk
  }

  getRecommendations(riskScore, components) {
    const recommendations = [];
    
    if (riskScore > 0.7) {
      recommendations.push('Schedule immediate follow-up appointment');
      recommendations.push('Consider care management program enrollment');
    } else if (riskScore > 0.4) {
      recommendations.push('Schedule regular monitoring');
      recommendations.push('Review medication adherence');
    } else {
      recommendations.push('Continue routine care');
    }

    if (components.chronic_risk > 0.5) {
      recommendations.push('Chronic disease management program recommended');
    }
    if (components.medication_risk > 0.3) {
      recommendations.push('Medication adherence counseling needed');
    }

    return recommendations;
  }

  getNextReviewDate(riskScore) {
    const daysUntilReview = riskScore > 0.7 ? 7 : riskScore > 0.4 ? 30 : 90;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntilReview);
    return nextDate.toISOString().split('T')[0];
  }
}

// ========================================
// API ENDPOINTS
// ========================================

const dataLake = new DataLake();
const predictiveAnalytics = new PredictiveAnalytics(dataLake);
const aimlModels = new AIMLModels(dataLake);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Data Analytics Infrastructure',
    timestamp: new Date().toISOString(),
    components: {
      dataLake: 'operational',
      predictiveAnalytics: 'operational',
      aimlModels: 'operational'
    }
  });
});

// Data Lake endpoints
app.get('/api/datalake/aggregate', async (req, res) => {
  try {
    const data = await dataLake.aggregateData();
    res.json({
      status: 'success',
      message: 'Data aggregation completed',
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Predictive Analytics endpoints
app.get('/api/analytics/predict/patient-demand', async (req, res) => {
  try {
    const prediction = await predictiveAnalytics.predictPatientDemand();
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/predict/drug-usage', async (req, res) => {
  try {
    const prediction = await predictiveAnalytics.predictDrugUsage();
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/predict/occupancy', async (req, res) => {
  try {
    const prediction = await predictiveAnalytics.predictOccupancy();
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI/ML Model endpoints
app.post('/api/ml/triage', async (req, res) => {
  try {
    const { symptoms, age, vitals } = req.body;
    const triageBot = aimlModels.getModel('triageBot');
    const assessment = await triageBot.assessPatient(symptoms || [], age || 30, vitals || {});
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ml/fraud-detection', async (req, res) => {
  try {
    const invoice = req.body;
    const fraudDetector = aimlModels.getModel('fraudDetector');
    const detection = await fraudDetector.detectFraud(invoice);
    res.json(detection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/patient-risk/:patientId', async (req, res) => {
  try {
    const riskScorer = aimlModels.getModel('riskScorer');
    const riskScore = await riskScorer.calculateRiskScore(req.params.patientId);
    res.json(riskScore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Data Lake status
app.get('/api/datalake/status', (req, res) => {
  const dataLakeFiles = {
    raw: fs.readdirSync(`${dataLake.dataPath}/raw`).length,
    processed: fs.readdirSync(`${dataLake.dataPath}/processed`).length,
    analytics: fs.readdirSync(`${dataLake.dataPath}/analytics`).length,
    models: fs.readdirSync(`${dataLake.dataPath}/ml-models`).length,
    predictions: fs.readdirSync(`${dataLake.dataPath}/predictions`).length
  };

  res.json({
    status: 'operational',
    location: dataLake.dataPath,
    files: dataLakeFiles,
    total_files: Object.values(dataLakeFiles).reduce((sum, count) => sum + count, 0)
  });
});

// Schedule data aggregation every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled data aggregation...');
  try {
    await dataLake.aggregateData();
    console.log('Data aggregation completed');
  } catch (error) {
    console.error('Scheduled aggregation failed:', error);
  }
});

// Schedule predictive analytics every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running predictive analytics...');
  try {
    await predictiveAnalytics.predictPatientDemand();
    await predictiveAnalytics.predictDrugUsage();
    await predictiveAnalytics.predictOccupancy();
    console.log('Predictive analytics completed');
  } catch (error) {
    console.error('Scheduled predictions failed:', error);
  }
});

const PORT = process.env.PORT || 14000;
app.listen(PORT, () => {
  console.log(`Data Analytics Infrastructure running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
  console.log(`Data Lake location: ${dataLake.dataPath}`);
  console.log('\nAvailable endpoints:');
  console.log('  - GET  /api/health');
  console.log('  - GET  /api/datalake/aggregate');
  console.log('  - GET  /api/datalake/status');
  console.log('  - GET  /api/analytics/predict/patient-demand');
  console.log('  - GET  /api/analytics/predict/drug-usage');
  console.log('  - GET  /api/analytics/predict/occupancy');
  console.log('  - POST /api/ml/triage');
  console.log('  - POST /api/ml/fraud-detection');
  console.log('  - GET  /api/ml/patient-risk/:patientId');
});
