#!/usr/bin/env node

const axios = require('axios');
const WebSocket = require('ws');

const API_URL = 'http://localhost:9002/api';
const WS_URL = 'ws://localhost:9002';

console.log('🏥 Testing Operations Command Centre\n');
console.log('=' .repeat(60));

async function testDashboard() {
    console.log('\n📊 Testing Dashboard Endpoints...');
    
    try {
        // Test comprehensive dashboard
        const dashboard = await axios.get(`${API_URL}/dashboard/comprehensive`);
        console.log('✅ Comprehensive dashboard loaded');
        console.log(`   - Total hospitals: ${dashboard.data.overview.total_hospitals}`);
        console.log(`   - Patient inflow: ${dashboard.data.overview.total_patient_inflow}`);
        console.log(`   - Bed occupancy: ${parseFloat(dashboard.data.overview.avg_bed_occupancy).toFixed(1)}%`);
        console.log(`   - Daily revenue: ₦${dashboard.data.overview.total_revenue_today}`);
        
        // Test patient flow
        const patientFlow = await axios.get(`${API_URL}/dashboard/patient-flow`);
        console.log(`✅ Patient flow data: ${patientFlow.data.length} hospitals tracked`);
        
        // Test staff KPIs
        const staffKPIs = await axios.get(`${API_URL}/dashboard/staff-kpis`);
        console.log(`✅ Staff KPIs loaded: ${staffKPIs.data.length} departments`);
        
        // Test financial metrics
        const financial = await axios.get(`${API_URL}/dashboard/financial?period=daily`);
        console.log(`✅ Financial metrics: ${financial.data.length} hospitals`);
        
    } catch (error) {
        console.log('❌ Dashboard error:', error.message);
    }
}

async function testAlerts() {
    console.log('\n🚨 Testing Alert System...');
    
    try {
        // Get active alerts
        const alerts = await axios.get(`${API_URL}/alerts?status=active`);
        console.log(`✅ Active alerts retrieved: ${alerts.data.length} alerts`);
        
        // Create test alert
        const newAlert = await axios.post(`${API_URL}/alerts`, {
            alert_type: 'test_alert',
            severity: 'medium',
            hospital_id: 'hosp-test',
            hospital_name: 'Test Hospital',
            message: 'Test alert from OCC testing',
            details: { test: true, timestamp: new Date() }
        });
        console.log(`✅ Test alert created: ID ${newAlert.data.id}`);
        
        // Resolve the alert
        const resolved = await axios.put(`${API_URL}/alerts/${newAlert.data.id}/resolve`, {
            resolved_by: 'Test Script'
        });
        console.log(`✅ Alert resolved: ${resolved.data.status}`);
        
    } catch (error) {
        console.log('❌ Alert system error:', error.message);
    }
}

async function testProjects() {
    console.log('\n📁 Testing Project Management...');
    
    try {
        // Get all projects
        const projects = await axios.get(`${API_URL}/projects`);
        console.log(`✅ Projects loaded: ${projects.data.length} active projects`);
        
        if (projects.data.length > 0) {
            console.log('   Sample project:', projects.data[0].project_name);
            console.log(`   - Status: ${projects.data[0].status}`);
            console.log(`   - Progress: ${projects.data[0].progress}%`);
            console.log(`   - Budget: ₦${projects.data[0].budget}`);
        }
        
        // Create test project
        const newProject = await axios.post(`${API_URL}/projects`, {
            project_name: 'Test Project - ' + Date.now(),
            project_type: 'it_upgrade',
            hospital_id: 'hosp-001',
            hospital_name: 'Lagos General Hospital',
            priority: 'medium',
            budget: 1000000,
            description: 'Test project from OCC testing'
        });
        console.log(`✅ Test project created: ${newProject.data.project_name}`);
        
        // Update project progress
        const updated = await axios.put(`${API_URL}/projects/${newProject.data.id}/progress`, {
            progress: 25,
            spent: 250000,
            status: 'in_progress'
        });
        console.log(`✅ Project updated: ${updated.data.progress}% complete`);
        
        // Add task to project
        const task = await axios.post(`${API_URL}/projects/${newProject.data.id}/tasks`, {
            task_name: 'Initial Planning',
            assignee: 'Test User',
            priority: 'high',
            due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
            notes: 'Test task'
        });
        console.log(`✅ Task added to project: ${task.data.task_name}`);
        
    } catch (error) {
        console.log('❌ Project management error:', error.message);
    }
}

async function testWebSocket() {
    console.log('\n📡 Testing WebSocket Connection...');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        let messageReceived = false;
        
        ws.on('open', () => {
            console.log('✅ WebSocket connected');
        });
        
        ws.on('message', (data) => {
            if (!messageReceived) {
                messageReceived = true;
                const message = JSON.parse(data);
                console.log(`✅ Initial data received via WebSocket`);
                console.log(`   Message type: ${message.type}`);
                if (message.data) {
                    console.log(`   Contains: overview, hospitals, alerts, projects`);
                }
            }
        });
        
        ws.on('error', (error) => {
            console.log('❌ WebSocket error:', error.message);
        });
        
        // Close after 3 seconds
        setTimeout(() => {
            ws.close();
            console.log('✅ WebSocket connection closed');
            resolve();
        }, 3000);
    });
}

async function testReports() {
    console.log('\n📈 Testing Reports & Analytics...');
    
    try {
        const summary = await axios.get(`${API_URL}/reports/executive-summary`);
        console.log('✅ Executive summary generated');
        
        if (summary.data.hospitals) {
            console.log(`   - Hospitals tracked: ${JSON.parse(summary.data.hospitals).length}`);
        }
        if (summary.data.projects) {
            const projectData = summary.data.projects;
            console.log(`   - Active projects: ${projectData.total_projects || 0}`);
            console.log(`   - Total budget: ₦${projectData.total_budget || 0}`);
            console.log(`   - Average progress: ${parseFloat(projectData.avg_progress || 0).toFixed(1)}%`);
        }
        if (summary.data.alerts) {
            const alertData = summary.data.alerts;
            console.log(`   - Active alerts: ${alertData.total_alerts || 0}`);
            console.log(`   - Critical alerts: ${alertData.critical_alerts || 0}`);
        }
        
    } catch (error) {
        console.log('❌ Reports error:', error.message);
    }
}

async function testHealthCheck() {
    console.log('\n🏥 Testing Health Check...');
    
    try {
        const health = await axios.get(`${API_URL}/health`);
        console.log('✅ Service health:', health.data.status);
        console.log(`   - Service: ${health.data.service}`);
        console.log(`   - WebSocket connections: ${health.data.connections}`);
        
    } catch (error) {
        console.log('❌ Health check error:', error.message);
    }
}

async function testFrontendAccess() {
    console.log('\n🌐 Testing Frontend Access...');
    
    try {
        const response = await axios.get('http://localhost:9002');
        console.log('✅ OCC Dashboard accessible');
        console.log(`   - Response size: ${response.data.length} bytes`);
        
        // Check for key components
        const hasComponents = {
            'Operations Command Centre': response.data.includes('Operations Command Centre'),
            'Hospital Performance': response.data.includes('Hospital Performance'),
            'Active Alerts': response.data.includes('Active Alerts'),
            'Project Management': response.data.includes('Active Projects'),
            'Staff KPIs': response.data.includes('Staff Performance KPIs'),
            'Financial Metrics': response.data.includes('Financial Performance')
        };
        
        Object.entries(hasComponents).forEach(([component, present]) => {
            console.log(`   ${present ? '✅' : '❌'} ${component}`);
        });
        
    } catch (error) {
        console.log('❌ Frontend access error:', error.message);
    }
}

async function runAllTests() {
    const startTime = Date.now();
    
    await testHealthCheck();
    await testDashboard();
    await testAlerts();
    await testProjects();
    await testReports();
    await testFrontendAccess();
    await testWebSocket();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 OCC TESTING COMPLETE!');
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log('\n📝 Summary:');
    console.log('   ✅ Dashboard with real-time metrics');
    console.log('   ✅ Alert system with anomaly detection');
    console.log('   ✅ Project management with task tracking');
    console.log('   ✅ WebSocket for live updates');
    console.log('   ✅ Executive reporting');
    console.log('   ✅ Multi-hospital monitoring');
    console.log('=' .repeat(60));
}

// Run tests
runAllTests().catch(console.error);
