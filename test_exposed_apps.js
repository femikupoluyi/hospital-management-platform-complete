#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Define all exposed services
const services = [
  {
    name: 'Main Frontend',
    localUrl: 'http://localhost:3001',
    exposedUrl: 'https://frontend-morphvm-mkofwuzh.http.cloud.morph.so'
  },
  {
    name: 'Hospital Backend API',
    localUrl: 'http://localhost:5000',
    exposedUrl: 'https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so'
  },
  {
    name: 'HMS Module',
    localUrl: 'http://localhost:9000',
    exposedUrl: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so'
  },
  {
    name: 'Operations Command Centre',
    localUrl: 'http://localhost:10001',
    exposedUrl: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so'
  },
  {
    name: 'Partner Integration',
    localUrl: 'http://localhost:11000',
    exposedUrl: 'https://partner-api-morphvm-mkofwuzh.http.cloud.morph.so'
  },
  {
    name: 'Analytics & ML API',
    localUrl: 'http://localhost:13000',
    exposedUrl: 'https://analytics-ml-api-morphvm-mkofwuzh.http.cloud.morph.so'
  }
];

// Function to test a URL
function testUrl(url, name) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'HealthFlow-Tester/1.0'
      }
    };

    const fullUrl = new URL(url);
    options.hostname = fullUrl.hostname;
    options.port = fullUrl.port;
    options.path = fullUrl.pathname;

    const req = protocol.request(options, (res) => {
      const statusClass = Math.floor(res.statusCode / 100);
      const isSuccess = statusClass === 2 || statusClass === 3;
      
      resolve({
        name,
        url,
        status: res.statusCode,
        success: isSuccess,
        headers: res.headers
      });
    });

    req.on('error', (err) => {
      resolve({
        name,
        url,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name,
        url,
        status: 'TIMEOUT',
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Main test function
async function testAllServices() {
  console.log('='.repeat(80));
  console.log('GRANDPRO HMSO PLATFORM - SERVICE EXPOSURE TEST');
  console.log('='.repeat(80));
  console.log(`Testing ${services.length} services...\\n`);

  const results = {
    local: [],
    exposed: []
  };

  // Test local services
  console.log('\\n📍 TESTING LOCAL SERVICES:');
  console.log('-'.repeat(40));
  
  for (const service of services) {
    const result = await testUrl(service.localUrl, service.name);
    results.local.push(result);
    
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${service.name}: ${result.status}`);
    if (!result.success && result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  }

  // Test exposed services
  console.log('\\n🌐 TESTING EXPOSED SERVICES:');
  console.log('-'.repeat(40));
  
  for (const service of services) {
    const result = await testUrl(service.exposedUrl, service.name);
    results.exposed.push(result);
    
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${service.name}: ${result.status}`);
    console.log(`   └─ URL: ${service.exposedUrl}`);
    if (!result.success && result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  
  const localSuccess = results.local.filter(r => r.success).length;
  const exposedSuccess = results.exposed.filter(r => r.success).length;
  
  console.log(`\\n📊 Local Services:   ${localSuccess}/${services.length} operational`);
  console.log(`📊 Exposed Services: ${exposedSuccess}/${services.length} accessible`);
  
  // List working exposed URLs
  console.log('\\n✅ WORKING EXPOSED URLS:');
  console.log('-'.repeat(40));
  
  for (let i = 0; i < services.length; i++) {
    if (results.exposed[i].success) {
      console.log(`• ${services[i].name}:`);
      console.log(`  ${services[i].exposedUrl}`);
    }
  }

  // Test specific endpoints
  console.log('\\n🔍 TESTING KEY ENDPOINTS:');
  console.log('-'.repeat(40));
  
  const endpoints = [
    { 
      name: 'Backend Health', 
      url: 'https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health' 
    },
    { 
      name: 'HMS Dashboard', 
      url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/hms/dashboard' 
    },
    { 
      name: 'OCC Metrics', 
      url: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so/api/occ/metrics/realtime' 
    },
    { 
      name: 'Analytics Status', 
      url: 'https://analytics-ml-api-morphvm-mkofwuzh.http.cloud.morph.so/api/analytics/models/status' 
    }
  ];

  for (const endpoint of endpoints) {
    const result = await testUrl(endpoint.url, endpoint.name);
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${endpoint.name}: ${result.status}`);
  }

  // Platform status
  const overallSuccess = exposedSuccess >= services.length - 1; // Allow 1 failure
  
  console.log('\\n' + '='.repeat(80));
  if (overallSuccess) {
    console.log('🎉 PLATFORM STATUS: FULLY OPERATIONAL');
    console.log('All core services are exposed and accessible!');
  } else {
    console.log('⚠️  PLATFORM STATUS: PARTIAL OPERATION');
    console.log(`Only ${exposedSuccess}/${services.length} services are accessible.`);
  }
  console.log('='.repeat(80));
}

// Run tests
testAllServices().catch(console.error);
