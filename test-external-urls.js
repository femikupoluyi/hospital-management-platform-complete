#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// List of known exposed URLs
const externalUrls = [
  { name: 'Hospital App', url: 'https://hospital-app-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Hospital Backend', url: 'https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'HMS Module', url: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'API Documentation', url: 'https://api-documentation-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'OCC Dashboard', url: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'OCC Enhanced', url: 'https://occ-enhanced-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Partner Integration', url: 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Analytics ML', url: 'https://analytics-ml-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Analytics API', url: 'https://analytics-api-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Unified Frontend', url: 'https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Main Frontend', url: 'https://main-frontend-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'API Docs', url: 'https://api-docs-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'CRM System', url: 'https://crm-system-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Backend API', url: 'https://backend-api-morphvm-mkofwuzh.http.cloud.morph.so' },
  { name: 'Onboarding App', url: 'https://onboarding-app-morphvm-mkofwuzh.http.cloud.morph.so' }
];

// Function to test a URL
function testUrl(entry) {
  return new Promise((resolve) => {
    const url = new URL(entry.url);
    
    https.get({
      hostname: url.hostname,
      path: url.pathname,
      timeout: 10000,
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const isHtml = res.headers['content-type'] && res.headers['content-type'].includes('html');
        const isJson = res.headers['content-type'] && res.headers['content-type'].includes('json');
        const hasTitle = data.includes('<title>') && data.includes('</title>');
        
        let title = '';
        if (hasTitle) {
          const titleMatch = data.match(/<title>(.*?)<\/title>/);
          if (titleMatch) title = titleMatch[1];
        }
        
        resolve({
          ...entry,
          status: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 400,
          contentType: res.headers['content-type'],
          isHtml,
          isJson,
          title,
          bodySize: data.length
        });
      });
    }).on('error', (err) => {
      resolve({
        ...entry,
        status: 0,
        success: false,
        error: err.message
      });
    }).on('timeout', () => {
      resolve({
        ...entry,
        status: 0,
        success: false,
        error: 'Timeout'
      });
    });
  });
}

// Main function
async function main() {
  console.log('='.repeat(80));
  console.log('EXTERNAL URL TESTING - ' + new Date().toISOString());
  console.log('='.repeat(80));
  console.log();
  
  const results = {
    working: [],
    notWorking: [],
    total: externalUrls.length
  };
  
  // Test all URLs
  for (const url of externalUrls) {
    process.stdout.write(`Testing ${url.name}... `);
    const result = await testUrl(url);
    
    if (result.success) {
      console.log(`✅ Working (Status: ${result.status})`);
      if (result.title) console.log(`   Title: ${result.title}`);
      results.working.push(result);
    } else {
      console.log(`❌ Not Working (${result.error || 'Status: ' + result.status})`);
      results.notWorking.push(result);
    }
  }
  
  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`✅ Working: ${results.working.length}/${results.total}`);
  console.log(`❌ Not Working: ${results.notWorking.length}/${results.total}`);
  
  if (results.working.length > 0) {
    console.log('\n🌐 ACCESSIBLE EXTERNAL URLS:');
    console.log('─'.repeat(80));
    results.working.forEach(url => {
      console.log(`\n📍 ${url.name}`);
      console.log(`   URL: ${url.url}`);
      console.log(`   Status: ${url.status}`);
      console.log(`   Content-Type: ${url.contentType || 'N/A'}`);
      if (url.title) console.log(`   Title: ${url.title}`);
      console.log(`   Size: ${url.bodySize} bytes`);
    });
  }
  
  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      working: results.working.length,
      notWorking: results.notWorking.length
    },
    workingUrls: results.working,
    failedUrls: results.notWorking
  };
  
  fs.writeFileSync('/root/external-urls-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Report saved to: /root/external-urls-report.json');
  
  // Create markdown report
  let markdown = `# External URLs Report\n\n`;
  markdown += `Generated: ${report.timestamp}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Total URLs Tested: ${report.summary.total}\n`;
  markdown += `- Working: ${report.summary.working}\n`;
  markdown += `- Not Working: ${report.summary.notWorking}\n\n`;
  
  if (results.working.length > 0) {
    markdown += `## Working URLs\n\n`;
    results.working.forEach(url => {
      markdown += `### ${url.name}\n`;
      markdown += `- **URL**: ${url.url}\n`;
      markdown += `- **Status**: ${url.status}\n`;
      if (url.title) markdown += `- **Title**: ${url.title}\n`;
      markdown += `\n`;
    });
  }
  
  fs.writeFileSync('/root/EXTERNAL_URLS_REPORT.md', markdown);
  console.log('📄 Markdown report saved to: /root/EXTERNAL_URLS_REPORT.md');
}

// Run the test
main().catch(console.error);
