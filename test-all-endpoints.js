#!/usr/bin/env node

const http = require('http');
const https = require('https');

// List of all endpoints to test
const endpoints = [
  // Local endpoints
  { name: 'Hospital Onboarding (Next.js)', url: 'http://localhost:3000', type: 'local' },
  { name: 'Backend API', url: 'http://localhost:3001', type: 'local' },
  { name: 'HMS Module', url: 'http://localhost:3002', type: 'local' },
  { name: 'API Documentation', url: 'http://localhost:5000', type: 'local' },
  { name: 'OCC Dashboard', url: 'http://localhost:8080', type: 'local' },
  { name: 'Partner Integration', url: 'http://localhost:9000', type: 'local' },
  { name: 'CRM System', url: 'http://localhost:10001', type: 'local' },
  { name: 'Analytics ML', url: 'http://localhost:11000', type: 'local' },
  { name: 'Unified Frontend', url: 'http://localhost:12000', type: 'local' },
  { name: 'Main Frontend (old)', url: 'http://localhost:13000', type: 'local' },
  
  // Potential external URLs (Morph platform)
  { name: 'External Hospital App', url: 'https://hospital-app-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External Backend API', url: 'https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External HMS', url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External API Docs', url: 'https://api-docs-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External OCC', url: 'https://occ-enhanced-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External Partner API', url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External Analytics', url: 'https://analytics-ml-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External Unified Frontend', url: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' },
  { name: 'External Main Frontend', url: 'https://main-frontend-morphvm-mkofwuzh.http.cloud.morph.so', type: 'external' }
];

// Function to test a single endpoint
function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false // For self-signed certificates
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ...endpoint,
          status: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 400,
          headers: res.headers,
          bodySnippet: data.substring(0, 100)
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        ...endpoint,
        status: 0,
        success: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        ...endpoint,
        status: 0,
        success: false,
        error: 'Request timeout'
      });
    });
    
    req.end();
  });
}

// Main function
async function main() {
  console.log('='.repeat(80));
  console.log('TESTING ALL ENDPOINTS - ' + new Date().toISOString());
  console.log('='.repeat(80));
  
  const results = {
    local: { success: [], failed: [] },
    external: { success: [], failed: [] }
  };
  
  // Test all endpoints
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    
    const category = result.type;
    if (result.success) {
      results[category].success.push(result);
      console.log(`✅ ${result.name}: ${result.url} (Status: ${result.status})`);
    } else {
      results[category].failed.push(result);
      console.log(`❌ ${result.name}: ${result.url} (Error: ${result.error || 'Status ' + result.status})`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n📍 LOCAL ENDPOINTS:');
  console.log(`  Success: ${results.local.success.length}`);
  console.log(`  Failed: ${results.local.failed.length}`);
  
  if (results.local.success.length > 0) {
    console.log('\n  Working Local Services:');
    results.local.success.forEach(e => {
      console.log(`    - ${e.name} (${e.url})`);
    });
  }
  
  console.log('\n🌐 EXTERNAL ENDPOINTS:');
  console.log(`  Success: ${results.external.success.length}`);
  console.log(`  Failed: ${results.external.failed.length}`);
  
  if (results.external.success.length > 0) {
    console.log('\n  Working External Services:');
    results.external.success.forEach(e => {
      console.log(`    - ${e.name} (${e.url})`);
    });
  }
  
  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  if (results.external.failed.length > 0) {
    console.log('\n⚠️  Need to expose the following services:');
    const notExposed = results.local.success.filter(local => {
      const externalName = local.name.replace(' (old)', '');
      return !results.external.success.find(ext => ext.name.includes(externalName));
    });
    
    notExposed.forEach(service => {
      console.log(`  - ${service.name} on port ${new URL(service.url).port}`);
    });
  }
  
  // Write results to file
  require('fs').writeFileSync('/root/endpoint-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n📄 Results saved to: /root/endpoint-test-results.json');
}

// Run the tests
main().catch(console.error);
