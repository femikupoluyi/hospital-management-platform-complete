const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrandPro HMSO API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 1.2em;
      opacity: 0.9;
    }
    .status-bar {
      background: #f7fafc;
      padding: 20px 40px;
      display: flex;
      justify-content: space-around;
      border-bottom: 2px solid #e2e8f0;
    }
    .status-item {
      text-align: center;
    }
    .status-item .label {
      color: #718096;
      font-size: 0.9em;
      margin-bottom: 5px;
    }
    .status-item .value {
      font-size: 1.5em;
      font-weight: bold;
      color: #2d3748;
    }
    .status-item.online .value {
      color: #48bb78;
    }
    .content {
      padding: 40px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #2d3748;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .endpoint-group {
      margin-bottom: 30px;
    }
    .endpoint-group h3 {
      color: #4a5568;
      margin-bottom: 15px;
      font-size: 1.3em;
    }
    .endpoint {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 5px;
      font-family: 'Courier New', monospace;
    }
    .endpoint .method {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-weight: bold;
      margin-right: 10px;
      font-size: 0.9em;
    }
    .endpoint .method.get { background: #48bb78; color: white; }
    .endpoint .method.post { background: #4299e1; color: white; }
    .endpoint .path {
      color: #2d3748;
      font-size: 1.1em;
    }
    .endpoint .description {
      color: #718096;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .urls {
      background: #edf2f7;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .urls h3 {
      color: #2d3748;
      margin-bottom: 15px;
    }
    .url-item {
      background: white;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .url-item a {
      color: #667eea;
      text-decoration: none;
      font-weight: bold;
      word-break: break-all;
    }
    .url-item a:hover {
      text-decoration: underline;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
    }
    .badge.live { background: #c6f6d5; color: #22543d; }
    .try-btn {
      background: #667eea;
      color: white;
      padding: 8px 16px;
      border-radius: 5px;
      text-decoration: none;
      font-size: 0.9em;
      margin-left: 10px;
    }
    .try-btn:hover {
      background: #5a67d8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 GrandPro HMSO Platform</h1>
      <p>Hospital Management System API Documentation</p>
    </div>
    
    <div class="status-bar">
      <div class="status-item">
        <div class="label">API Version</div>
        <div class="value">1.0.0</div>
      </div>
      <div class="status-item online">
        <div class="label">Status</div>
        <div class="value">● Online</div>
      </div>
      <div class="status-item">
        <div class="label">Endpoints</div>
        <div class="value">20+</div>
      </div>
      <div class="status-item">
        <div class="label">Modules</div>
        <div class="value">6</div>
      </div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2>🌐 Live Application URLs</h2>
        <div class="urls">
          <div class="url-item">
            <div>
              <strong>Frontend Application</strong>
              <span class="badge live">LIVE</span><br>
              <a href="https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so" target="_blank">
                https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so
              </a>
            </div>
            <a href="https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so" target="_blank" class="try-btn">Open →</a>
          </div>
          <div class="url-item">
            <div>
              <strong>Backend API</strong>
              <span class="badge live">LIVE</span><br>
              <a href="https://backend-morphvm-mkofwuzh.http.cloud.morph.so/health" target="_blank">
                https://backend-morphvm-mkofwuzh.http.cloud.morph.so
              </a>
            </div>
            <a href="https://backend-morphvm-mkofwuzh.http.cloud.morph.so/health" target="_blank" class="try-btn">Test →</a>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>📡 API Endpoints</h2>
        
        <div class="endpoint-group">
          <h3>Core Endpoints</h3>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/health</span>
            <div class="description">Health check endpoint - returns service status</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api</span>
            <div class="description">API information and available modules</div>
          </div>
        </div>

        <div class="endpoint-group">
          <h3>CRM Module</h3>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/crm/overview</span>
            <div class="description">CRM dashboard statistics and metrics</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/crm/owners</span>
            <div class="description">List all hospital owners</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/crm/owners/payouts</span>
            <div class="description">View pending payouts for owners</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/api/crm/owners/satisfaction</span>
            <div class="description">Submit owner satisfaction survey</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/crm/patients</span>
            <div class="description">List all registered patients</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/api/crm/patients</span>
            <div class="description">Register a new patient</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/crm/appointments</span>
            <div class="description">List all appointments</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/api/crm/appointments</span>
            <div class="description">Schedule a new appointment</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/api/crm/feedback</span>
            <div class="description">Submit patient feedback</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/api/crm/reminders</span>
            <div class="description">Set appointment reminders</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/crm/campaigns</span>
            <div class="description">List communication campaigns</div>
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/api/crm/campaigns</span>
            <div class="description">Create new communication campaign</div>
          </div>
        </div>

        <div class="endpoint-group">
          <h3>Onboarding Module</h3>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/onboarding/hospitals</span>
            <div class="description">List all registered hospitals</div>
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/onboarding/applications</span>
            <div class="description">View hospital applications</div>
          </div>
        </div>

        <div class="endpoint-group">
          <h3>Hospital Management System</h3>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/hms/overview</span>
            <div class="description">Hospital management dashboard metrics</div>
          </div>
        </div>

        <div class="endpoint-group">
          <h3>Operations Command Centre</h3>
          <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/api/occ/metrics</span>
            <div class="description">Real-time operational metrics and alerts</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>📊 Current System Metrics</h2>
        <div class="urls">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 2em; color: #667eea; font-weight: bold;">156</div>
              <div style="color: #718096;">Total Patients</div>
            </div>
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 2em; color: #667eea; font-weight: bold;">18</div>
              <div style="color: #718096;">Today's Appointments</div>
            </div>
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 2em; color: #667eea; font-weight: bold;">75.5%</div>
              <div style="color: #718096;">Bed Occupancy</div>
            </div>
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 2em; color: #667eea; font-weight: bold;">GH₵450K</div>
              <div style="color: #718096;">Monthly Revenue</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `);
});

const port = 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`API Documentation server running on port ${port}`);
});
