#!/usr/bin/env node

/**
 * Comprehensive Module Validation Script
 * Tests all modules and submodules of the GrandPro HMSO Hospital Management Platform
 * 
 * Modules:
 * 1. Digital Sourcing & Partner Onboarding
 * 2. CRM & Relationship Management
 * 3. Hospital Management SaaS (Core Operations)
 * 4. Centralized Operations & Development Management
 * 5. Partner & Ecosystem Integrations
 * 6. Data & Analytics
 * 7. Security & Compliance
 */

const http = require('http');
const https = require('https');
const { Pool } = require('pg');
const fs = require('fs').promises;

// Database connection
const connectionString = 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });

// Service endpoints
const SERVICES = {
  ONBOARDING: {
    backend: 'http://localhost:6000',
    frontend: 'http://localhost:6001',
    exposed: 'http://morphvm:6001'
  },
  CRM: {
    backend: 'http://localhost:7002',
    frontend: 'http://localhost:7001',
    exposed: 'http://morphvm:7001'
  },
  HMS: {
    backend: 'http://localhost:5801',
    frontend: 'http://localhost:5800',
    exposed: 'http://morphvm:5800'
  },
  OCC: {
    backend: 'http://localhost:8080',
    frontend: 'http://localhost:8081',
    exposed: 'http://morphvm:8081'
  },
  PARTNER: {
    backend: 'http://localhost:9000',
    exposed: 'http://morphvm:9000'
  },
  ANALYTICS: {
    backend: 'http://localhost:9500',
    ml: 'http://localhost:9501',
    exposed: 'http://morphvm:9500'
  }
};

// Validation results
const validationResults = {
  timestamp: new Date().toISOString(),
  modules: {},
  database: {},
  exposedUrls: {},
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  issues: []
};

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || { 'Content-Type': 'application/json' },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Module 1: Digital Sourcing & Partner Onboarding
async function validateOnboardingModule() {
  console.log('\n=== MODULE 1: DIGITAL SOURCING & PARTNER ONBOARDING ===');
  const results = {
    portal: false,
    applicationSubmit: false,
    scoring: false,
    contractGeneration: false,
    dashboard: false,
    exposedUrl: false
  };

  try {
    // Test portal availability
    const portal = await makeRequest(`${SERVICES.ONBOARDING.frontend}/`);
    results.portal = portal.status === 200;
    console.log(`✓ Portal Available: ${results.portal}`);

    // Test application submission endpoint
    const submitApp = await makeRequest(`${SERVICES.ONBOARDING.backend}/api/applications`, {
      method: 'POST',
      body: {
        hospitalName: 'Test Hospital',
        ownerName: 'Test Owner',
        location: 'Test City',
        beds: 50,
        services: ['Emergency', 'Surgery'],
        documents: []
      }
    });
    results.applicationSubmit = submitApp.status === 200 || submitApp.status === 201;
    console.log(`✓ Application Submission: ${results.applicationSubmit}`);

    // Test scoring system
    const scoring = await makeRequest(`${SERVICES.ONBOARDING.backend}/api/applications/score/test123`);
    results.scoring = scoring.status === 200 || scoring.status === 404;
    console.log(`✓ Scoring System: ${results.scoring}`);

    // Test contract generation
    const contract = await makeRequest(`${SERVICES.ONBOARDING.backend}/api/contracts/generate`, {
      method: 'POST',
      body: { applicationId: 'test123' }
    });
    results.contractGeneration = contract.status === 200 || contract.status === 201;
    console.log(`✓ Contract Generation: ${results.contractGeneration}`);

    // Test dashboard
    const dashboard = await makeRequest(`${SERVICES.ONBOARDING.backend}/api/dashboard`);
    results.dashboard = dashboard.status === 200;
    console.log(`✓ Dashboard API: ${results.dashboard}`);

    // Test exposed URL
    const exposedPortal = await makeRequest(SERVICES.ONBOARDING.exposed);
    results.exposedUrl = exposedPortal.status === 200;
    console.log(`✓ Exposed URL (${SERVICES.ONBOARDING.exposed}): ${results.exposedUrl}`);

  } catch (error) {
    console.error('Onboarding validation error:', error.message);
    validationResults.issues.push(`Onboarding: ${error.message}`);
  }

  validationResults.modules.onboarding = results;
  return results;
}

// Module 2: CRM & Relationship Management
async function validateCRMModule() {
  console.log('\n=== MODULE 2: CRM & RELATIONSHIP MANAGEMENT ===');
  const results = {
    ownerCRM: false,
    patientCRM: false,
    appointments: false,
    reminders: false,
    campaigns: false,
    loyalty: false,
    exposedUrl: false
  };

  try {
    // Test Owner CRM
    const owners = await makeRequest(`${SERVICES.CRM.backend}/api/owners`);
    results.ownerCRM = owners.status === 200;
    console.log(`✓ Owner CRM: ${results.ownerCRM}`);

    // Test Patient CRM
    const patients = await makeRequest(`${SERVICES.CRM.backend}/api/patients`);
    results.patientCRM = patients.status === 200;
    console.log(`✓ Patient CRM: ${results.patientCRM}`);

    // Test Appointments
    const appointments = await makeRequest(`${SERVICES.CRM.backend}/api/appointments`);
    results.appointments = appointments.status === 200;
    console.log(`✓ Appointments: ${results.appointments}`);

    // Test Reminders
    const reminders = await makeRequest(`${SERVICES.CRM.backend}/api/appointments/reminders/pending`);
    results.reminders = reminders.status === 200;
    console.log(`✓ Reminders: ${results.reminders}`);

    // Test Campaigns
    const campaigns = await makeRequest(`${SERVICES.CRM.backend}/api/campaigns`);
    results.campaigns = campaigns.status === 200;
    console.log(`✓ Campaigns: ${results.campaigns}`);

    // Test Loyalty Program
    const loyalty = await makeRequest(`${SERVICES.CRM.backend}/api/loyalty/points/PAT001`);
    results.loyalty = loyalty.status === 200 || loyalty.status === 404;
    console.log(`✓ Loyalty Program: ${results.loyalty}`);

    // Test exposed URL
    const exposedCRM = await makeRequest(SERVICES.CRM.exposed);
    results.exposedUrl = exposedCRM.status === 200;
    console.log(`✓ Exposed URL (${SERVICES.CRM.exposed}): ${results.exposedUrl}`);

  } catch (error) {
    console.error('CRM validation error:', error.message);
    validationResults.issues.push(`CRM: ${error.message}`);
  }

  validationResults.modules.crm = results;
  return results;
}

// Module 3: Hospital Management SaaS
async function validateHMSModule() {
  console.log('\n=== MODULE 3: HOSPITAL MANAGEMENT SAAS ===');
  const results = {
    emr: false,
    billing: false,
    inventory: false,
    staffManagement: false,
    bedManagement: false,
    analytics: false,
    exposedUrl: false
  };

  try {
    // Test EMR
    const emr = await makeRequest(`${SERVICES.HMS.backend}/api/medical-records`);
    results.emr = emr.status === 200;
    console.log(`✓ Electronic Medical Records: ${results.emr}`);

    // Test Billing
    const billing = await makeRequest(`${SERVICES.HMS.backend}/api/billing`);
    results.billing = billing.status === 200;
    console.log(`✓ Billing & Revenue: ${results.billing}`);

    // Test Inventory
    const inventory = await makeRequest(`${SERVICES.HMS.backend}/api/inventory`);
    results.inventory = inventory.status === 200;
    console.log(`✓ Inventory Management: ${results.inventory}`);

    // Test Staff Management
    const staff = await makeRequest(`${SERVICES.HMS.backend}/api/staff`);
    results.staffManagement = staff.status === 200;
    console.log(`✓ Staff Management: ${results.staffManagement}`);

    // Test Bed Management
    const beds = await makeRequest(`${SERVICES.HMS.backend}/api/beds/available`);
    results.bedManagement = beds.status === 200;
    console.log(`✓ Bed Management: ${results.bedManagement}`);

    // Test Analytics Dashboard
    const analytics = await makeRequest(`${SERVICES.HMS.backend}/api/analytics/dashboard`);
    results.analytics = analytics.status === 200;
    console.log(`✓ Analytics Dashboard: ${results.analytics}`);

    // Test exposed URL
    const exposedHMS = await makeRequest(SERVICES.HMS.exposed);
    results.exposedUrl = exposedHMS.status === 200;
    console.log(`✓ Exposed URL (${SERVICES.HMS.exposed}): ${results.exposedUrl}`);

  } catch (error) {
    console.error('HMS validation error:', error.message);
    validationResults.issues.push(`HMS: ${error.message}`);
  }

  validationResults.modules.hms = results;
  return results;
}

// Module 4: Centralized Operations Command Centre
async function validateOCCModule() {
  console.log('\n=== MODULE 4: OPERATIONS COMMAND CENTRE ===');
  const results = {
    monitoring: false,
    dashboards: false,
    alerts: false,
    projectManagement: false,
    exposedUrl: false
  };

  try {
    // Test Real-time Monitoring
    const monitoring = await makeRequest(`${SERVICES.OCC.backend}/api/monitoring/status`);
    results.monitoring = monitoring.status === 200;
    console.log(`✓ Real-time Monitoring: ${results.monitoring}`);

    // Test Dashboards
    const dashboards = await makeRequest(`${SERVICES.OCC.backend}/api/dashboards/metrics`);
    results.dashboards = dashboards.status === 200;
    console.log(`✓ Dashboards: ${results.dashboards}`);

    // Test Alert System
    const alerts = await makeRequest(`${SERVICES.OCC.backend}/api/alerts`);
    results.alerts = alerts.status === 200;
    console.log(`✓ Alert System: ${results.alerts}`);

    // Test Project Management
    const projects = await makeRequest(`${SERVICES.OCC.backend}/api/projects`);
    results.projectManagement = projects.status === 200;
    console.log(`✓ Project Management: ${results.projectManagement}`);

    // Test exposed URL
    const exposedOCC = await makeRequest(SERVICES.OCC.exposed);
    results.exposedUrl = exposedOCC.status === 200;
    console.log(`✓ Exposed URL (${SERVICES.OCC.exposed}): ${results.exposedUrl}`);

  } catch (error) {
    console.error('OCC validation error:', error.message);
    validationResults.issues.push(`OCC: ${error.message}`);
  }

  validationResults.modules.occ = results;
  return results;
}

// Module 5: Partner & Ecosystem Integrations
async function validatePartnerModule() {
  console.log('\n=== MODULE 5: PARTNER INTEGRATIONS ===');
  const results = {
    insurance: false,
    pharmacy: false,
    telemedicine: false,
    compliance: false,
    exposedUrl: false
  };

  try {
    // Test Insurance Integration
    const insurance = await makeRequest(`${SERVICES.PARTNER.backend}/api/insurance/claims`);
    results.insurance = insurance.status === 200;
    console.log(`✓ Insurance Integration: ${results.insurance}`);

    // Test Pharmacy Integration
    const pharmacy = await makeRequest(`${SERVICES.PARTNER.backend}/api/pharmacy/orders`);
    results.pharmacy = pharmacy.status === 200;
    console.log(`✓ Pharmacy Integration: ${results.pharmacy}`);

    // Test Telemedicine
    const telemedicine = await makeRequest(`${SERVICES.PARTNER.backend}/api/telemedicine/sessions`);
    results.telemedicine = telemedicine.status === 200;
    console.log(`✓ Telemedicine: ${results.telemedicine}`);

    // Test Compliance Reporting
    const compliance = await makeRequest(`${SERVICES.PARTNER.backend}/api/compliance/reports`);
    results.compliance = compliance.status === 200;
    console.log(`✓ Compliance Reporting: ${results.compliance}`);

    // Test exposed URL
    const exposedPartner = await makeRequest(SERVICES.PARTNER.exposed);
    results.exposedUrl = exposedPartner.status === 200;
    console.log(`✓ Exposed URL (${SERVICES.PARTNER.exposed}): ${results.exposedUrl}`);

  } catch (error) {
    console.error('Partner validation error:', error.message);
    validationResults.issues.push(`Partner: ${error.message}`);
  }

  validationResults.modules.partner = results;
  return results;
}

// Module 6: Data & Analytics
async function validateAnalyticsModule() {
  console.log('\n=== MODULE 6: DATA & ANALYTICS ===');
  const results = {
    dataLake: false,
    predictiveAnalytics: false,
    mlModels: false,
    exposedUrl: false
  };

  try {
    // Test Data Lake
    const dataLake = await makeRequest(`${SERVICES.ANALYTICS.backend}/api/data-lake/status`);
    results.dataLake = dataLake.status === 200;
    console.log(`✓ Data Lake: ${results.dataLake}`);

    // Test Predictive Analytics
    const predictive = await makeRequest(`${SERVICES.ANALYTICS.backend}/api/analytics/predictions`);
    results.predictiveAnalytics = predictive.status === 200;
    console.log(`✓ Predictive Analytics: ${results.predictiveAnalytics}`);

    // Test ML Models
    const ml = await makeRequest(`${SERVICES.ANALYTICS.ml}/api/ml/triage`);
    results.mlModels = ml.status === 200;
    console.log(`✓ ML Models: ${results.mlModels}`);

    // Test exposed URL
    const exposedAnalytics = await makeRequest(SERVICES.ANALYTICS.exposed);
    results.exposedUrl = exposedAnalytics.status === 200;
    console.log(`✓ Exposed URL (${SERVICES.ANALYTICS.exposed}): ${results.exposedUrl}`);

  } catch (error) {
    console.error('Analytics validation error:', error.message);
    validationResults.issues.push(`Analytics: ${error.message}`);
  }

  validationResults.modules.analytics = results;
  return results;
}

// Database validation
async function validateDatabase() {
  console.log('\n=== DATABASE VALIDATION ===');
  const results = {
    connection: false,
    schemas: {},
    tables: {}
  };

  try {
    // Test connection
    const testQuery = await pool.query('SELECT NOW()');
    results.connection = true;
    console.log('✓ Database connection successful');

    // Check schemas
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('onboarding', 'crm', 'hms', 'occ', 'partners', 'analytics', 'security', 'loyalty', 'communications')
    `);
    
    for (const row of schemas.rows) {
      results.schemas[row.schema_name] = true;
      console.log(`✓ Schema exists: ${row.schema_name}`);
    }

    // Check key tables
    const keyTables = [
      'onboarding.applications',
      'crm.patients',
      'hms.medical_records',
      'occ.alerts',
      'partners.insurance_providers',
      'analytics.predictions'
    ];

    for (const tableName of keyTables) {
      const [schema, table] = tableName.split('.');
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = $2
        )
      `, [schema, table]);
      
      results.tables[tableName] = tableExists.rows[0].exists;
      console.log(`✓ Table ${tableName}: ${tableExists.rows[0].exists}`);
    }

  } catch (error) {
    console.error('Database validation error:', error.message);
    validationResults.issues.push(`Database: ${error.message}`);
  }

  validationResults.database = results;
  return results;
}

// Test exposed URLs
async function testExposedUrls() {
  console.log('\n=== TESTING EXPOSED URLS ===');
  const exposedUrls = {
    'Onboarding Portal': 'http://morphvm:6001',
    'CRM Portal': 'http://morphvm:7001',
    'HMS Portal': 'http://morphvm:5800',
    'OCC Dashboard': 'http://morphvm:8081',
    'Partner API': 'http://morphvm:9000',
    'Analytics Dashboard': 'http://morphvm:9500',
    'Unified Frontend': 'http://morphvm:8082',
    'API Documentation': 'http://morphvm:3001'
  };

  for (const [name, url] of Object.entries(exposedUrls)) {
    try {
      const response = await makeRequest(url);
      validationResults.exposedUrls[name] = {
        url,
        status: response.status === 200 ? 'WORKING' : `ERROR (${response.status})`,
        accessible: response.status === 200
      };
      console.log(`${response.status === 200 ? '✓' : '✗'} ${name}: ${url} - ${response.status}`);
    } catch (error) {
      validationResults.exposedUrls[name] = {
        url,
        status: 'UNREACHABLE',
        accessible: false,
        error: error.message
      };
      console.log(`✗ ${name}: ${url} - ${error.message}`);
    }
  }
}

// Calculate statistics
function calculateStats() {
  let totalTests = 0;
  let passedTests = 0;
  
  // Count module tests
  for (const [moduleName, tests] of Object.entries(validationResults.modules)) {
    for (const [testName, result] of Object.entries(tests)) {
      totalTests++;
      if (result) passedTests++;
    }
  }
  
  // Count database tests
  if (validationResults.database.connection) {
    totalTests++;
    passedTests++;
  }
  
  for (const schemaExists of Object.values(validationResults.database.schemas || {})) {
    totalTests++;
    if (schemaExists) passedTests++;
  }
  
  for (const tableExists of Object.values(validationResults.database.tables || {})) {
    totalTests++;
    if (tableExists) passedTests++;
  }
  
  // Count exposed URL tests
  for (const urlTest of Object.values(validationResults.exposedUrls)) {
    totalTests++;
    if (urlTest.accessible) passedTests++;
  }
  
  validationResults.totalTests = totalTests;
  validationResults.passedTests = passedTests;
  validationResults.failedTests = totalTests - passedTests;
  validationResults.successRate = ((passedTests / totalTests) * 100).toFixed(2) + '%';
}

// Generate report
async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY REPORT');
  console.log('='.repeat(80));
  
  console.log(`\nTotal Tests: ${validationResults.totalTests}`);
  console.log(`Passed: ${validationResults.passedTests}`);
  console.log(`Failed: ${validationResults.failedTests}`);
  console.log(`Success Rate: ${validationResults.successRate}`);
  
  console.log('\n--- MODULE STATUS ---');
  for (const [module, tests] of Object.entries(validationResults.modules)) {
    const passed = Object.values(tests).filter(t => t).length;
    const total = Object.values(tests).length;
    console.log(`${module.toUpperCase()}: ${passed}/${total} tests passed`);
  }
  
  console.log('\n--- EXPOSED URLS STATUS ---');
  for (const [name, info] of Object.entries(validationResults.exposedUrls)) {
    console.log(`${info.accessible ? '✓' : '✗'} ${name}: ${info.url} - ${info.status}`);
  }
  
  if (validationResults.issues.length > 0) {
    console.log('\n--- ISSUES FOUND ---');
    validationResults.issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }
  
  // Save report to file
  await fs.writeFile('/root/VALIDATION_REPORT.json', JSON.stringify(validationResults, null, 2));
  console.log('\n✓ Report saved to /root/VALIDATION_REPORT.json');
}

// Main execution
async function main() {
  console.log('🔍 COMPREHENSIVE MODULE VALIDATION STARTING...');
  console.log('=' .repeat(80));
  
  try {
    // Validate all modules
    await validateOnboardingModule();
    await validateCRMModule();
    await validateHMSModule();
    await validateOCCModule();
    await validatePartnerModule();
    await validateAnalyticsModule();
    
    // Validate database
    await validateDatabase();
    
    // Test exposed URLs
    await testExposedUrls();
    
    // Calculate statistics
    calculateStats();
    
    // Generate report
    await generateReport();
    
  } catch (error) {
    console.error('Fatal error:', error);
    validationResults.fatalError = error.message;
  } finally {
    await pool.end();
  }
  
  process.exit(validationResults.failedTests > 0 ? 1 : 0);
}

// Run validation
main().catch(console.error);
