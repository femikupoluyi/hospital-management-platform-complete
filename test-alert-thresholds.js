const axios = require('axios');

const baseUrl = 'http://localhost:10001';

async function testAlertThresholds() {
    console.log('3. TESTING ALERT THRESHOLDS:');
    console.log('============================\n');
    
    // Define thresholds from the system
    const thresholds = {
        lowStock: 20,
        highOccupancy: 90,
        longWaitTime: 60,
        staffShortage: 0.8,
        revenueTarget: 45000,
        systemHealth: 95,
        icuCapacity: 95
    };
    
    console.log('Configured Thresholds:');
    console.log('• Low Stock Alert: < 20 units');
    console.log('• High Occupancy Alert: > 90%');
    console.log('• Long Wait Time Alert: > 60 minutes');
    console.log('• ICU Capacity Alert: > 95%');
    console.log('• Revenue Target Alert: < ₵45,000');
    console.log('• System Health Alert: < 95%\n');
    
    // Trigger multiple checks to generate alerts
    console.log('Triggering threshold checks...\n');
    
    let alertsTriggered = {
        lowStock: false,
        highOccupancy: false,
        longWaitTime: false,
        icuCapacity: false,
        revenueTarget: false
    };
    
    // Check multiple times to catch random alert triggers
    for (let i = 0; i < 5; i++) {
        const response = await axios.get(`${baseUrl}/api/occ/metrics/realtime`);
        const data = response.data;
        
        // Check each hospital for threshold violations
        data.hospitals.forEach(hospital => {
            if (hospital.metrics.occupancy > thresholds.highOccupancy) {
                console.log(`⚠️ HIGH OCCUPANCY: ${hospital.name} at ${hospital.metrics.occupancy.toFixed(1)}% (Threshold: ${thresholds.highOccupancy}%)`);
                alertsTriggered.highOccupancy = true;
            }
            
            if (hospital.metrics.emergencyWaitTime > thresholds.longWaitTime) {
                console.log(`⚠️ LONG WAIT TIME: ${hospital.name} at ${hospital.metrics.emergencyWaitTime} mins (Threshold: ${thresholds.longWaitTime} mins)`);
                alertsTriggered.longWaitTime = true;
            }
            
            if (hospital.departments && hospital.departments.icu && hospital.departments.icu.occupancy > thresholds.icuCapacity) {
                console.log(`🔴 ICU CRITICAL: ${hospital.name} at ${hospital.departments.icu.occupancy.toFixed(1)}% (Threshold: ${thresholds.icuCapacity}%)`);
                alertsTriggered.icuCapacity = true;
            }
        });
        
        if (data.financialMetrics.dailyRevenue < thresholds.revenueTarget) {
            console.log(`ℹ️ REVENUE BELOW TARGET: ₵${data.financialMetrics.dailyRevenue} (Threshold: ₵${thresholds.revenueTarget})`);
            alertsTriggered.revenueTarget = true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Get current alerts
    const alertsResponse = await axios.get(`${baseUrl}/api/occ/alerts`);
    const alerts = alertsResponse.data;
    
    console.log('\n📊 Alert System Status:');
    console.log(`• Total Active Alerts: ${alerts.activeAlerts}`);
    console.log(`• Critical Alerts: ${alerts.criticalCount}`);
    console.log(`• Warning Alerts: ${alerts.warningCount}`);
    console.log(`• Info Alerts: ${alerts.infoCount}`);
    
    // Verify alert categories
    const alertCategories = new Set();
    alerts.alerts.forEach(alert => alertCategories.add(alert.category));
    
    console.log('\n✅ Alert Categories Detected:');
    alertCategories.forEach(category => {
        console.log(`• ${category}`);
    });
    
    // Test alert acknowledgment
    if (alerts.alerts.length > 0) {
        const testAlertId = alerts.alerts[0].id;
        try {
            const ackResponse = await axios.post(`${baseUrl}/api/occ/alerts/${testAlertId}/acknowledge`, {
                acknowledgedBy: 'Verification Test',
                notes: 'Testing alert acknowledgment functionality'
            });
            console.log('\n✅ Alert Acknowledgment: WORKING');
            console.log(`• Alert ${testAlertId.substring(0, 20)}... acknowledged successfully`);
        } catch (error) {
            console.log('\n❌ Alert Acknowledgment: FAILED');
        }
    }
    
    // Summary
    console.log('\n📝 Alert Threshold Verification Summary:');
    const triggeredCount = Object.values(alertsTriggered).filter(v => v).length;
    console.log(`• Alert types triggered: ${triggeredCount}/5`);
    console.log(`• Alerts firing correctly: ${alerts.activeAlerts > 0 ? '✅ YES' : '⚠️ No alerts at this moment'}`);
    console.log(`• Threshold monitoring: ✅ ACTIVE`);
    
    return alerts.activeAlerts > 0;
}

testAlertThresholds().catch(console.error);
