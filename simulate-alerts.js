// Script to simulate various alerts for demonstration
const axios = require('axios');

const baseUrl = 'http://localhost:10001';

async function simulateAlerts() {
    console.log('Simulating OCC Alerts...\n');
    
    // Fetch real-time data multiple times to trigger alerts
    for (let i = 0; i < 10; i++) {
        try {
            const response = await axios.get(`${baseUrl}/api/occ/metrics/realtime`);
            console.log(`Iteration ${i + 1}: Checked metrics at ${new Date().toISOString()}`);
            
            // Check if any alerts were generated
            const alertsResponse = await axios.get(`${baseUrl}/api/occ/alerts`);
            if (alertsResponse.data.activeAlerts > 0) {
                console.log(`  ⚠️  Active Alerts: ${alertsResponse.data.activeAlerts}`);
                console.log(`  🔴 Critical: ${alertsResponse.data.criticalCount}`);
                console.log(`  🟡 Warning: ${alertsResponse.data.warningCount}`);
                console.log(`  ℹ️  Info: ${alertsResponse.data.infoCount}`);
                
                // Display first alert
                if (alertsResponse.data.alerts[0]) {
                    const alert = alertsResponse.data.alerts[0];
                    console.log(`\n  Latest Alert:`);
                    console.log(`  - Type: ${alert.type}`);
                    console.log(`  - Category: ${alert.category}`);
                    console.log(`  - Message: ${alert.message}`);
                    console.log(`  - Hospital: ${alert.hospital}`);
                    console.log(`  - Value: ${alert.value}`);
                    console.log(`  - Threshold: ${alert.threshold}\n`);
                }
            }
            
            // Wait 2 seconds between iterations
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
    
    // Final alerts summary
    try {
        const finalAlerts = await axios.get(`${baseUrl}/api/occ/alerts`);
        console.log('\n=== FINAL ALERTS SUMMARY ===');
        console.log(`Total Active Alerts: ${finalAlerts.data.activeAlerts}`);
        console.log(`Critical: ${finalAlerts.data.criticalCount}`);
        console.log(`Warning: ${finalAlerts.data.warningCount}`);
        console.log(`Info: ${finalAlerts.data.infoCount}`);
        
        if (finalAlerts.data.alerts.length > 0) {
            console.log('\nRecent Alerts:');
            finalAlerts.data.alerts.slice(0, 5).forEach((alert, idx) => {
                console.log(`${idx + 1}. [${alert.type.toUpperCase()}] ${alert.message}`);
            });
        }
    } catch (error) {
        console.error('Error fetching final alerts:', error.message);
    }
}

simulateAlerts();
