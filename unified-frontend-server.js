const express = require('express');
const path = require('path');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3002;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.dirname(__filename)));

// Main route - serve the unified frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'unified-frontend.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'GrandPro HMSO Unified Frontend',
        timestamp: new Date().toISOString(),
        modules: {
            hms: 'https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so',
            occ: 'https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so',
            analytics: 'https://analytics-ml-api-morphvm-mkofwuzh.http.cloud.morph.so',
            partner: 'https://partner-api-morphvm-mkofwuzh.http.cloud.morph.so'
        }
    });
});

// API proxy endpoints to avoid CORS issues
app.use('/api/hms', createProxyMiddleware({
    target: 'http://localhost:9000',
    changeOrigin: true,
    pathRewrite: {'^/api/hms': '/api/hms'}
}));

app.use('/api/occ', createProxyMiddleware({
    target: 'http://localhost:10001',
    changeOrigin: true,
    pathRewrite: {'^/api/occ': '/api/occ'}
}));

app.use('/api/analytics', createProxyMiddleware({
    target: 'http://localhost:13000',
    changeOrigin: true,
    pathRewrite: {'^/api/analytics': '/api/analytics'}
}));

app.use('/api/partner', createProxyMiddleware({
    target: 'http://localhost:11000',
    changeOrigin: true,
    pathRewrite: {'^/api/partner': '/api/partner'}
}));

// System status endpoint
app.get('/api/status', async (req, res) => {
    const axios = require('axios');
    const services = [
        { name: 'HMS Module', url: 'http://localhost:9000/api/hms/dashboard' },
        { name: 'OCC Dashboard', url: 'http://localhost:10001/api/occ/metrics/realtime' },
        { name: 'Analytics API', url: 'http://localhost:13000/api/analytics/models/status' },
        { name: 'Partner API', url: 'http://localhost:11000/api/partners/health' }
    ];

    const statuses = await Promise.all(
        services.map(async (service) => {
            try {
                const response = await axios.get(service.url, { timeout: 3000 });
                return {
                    name: service.name,
                    status: 'online',
                    responseTime: response.headers['x-response-time'] || 'N/A'
                };
            } catch (error) {
                return {
                    name: service.name,
                    status: 'offline',
                    error: error.message
                };
            }
        })
    );

    res.json({
        timestamp: new Date().toISOString(),
        services: statuses,
        overall: statuses.every(s => s.status === 'online') ? 'healthy' : 'degraded'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 GrandPro HMSO Unified Frontend Server');
    console.log('='.repeat(60));
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`🌐 External URL: https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so`);
    console.log('='.repeat(60));
    console.log('Available Modules:');
    console.log('  • HMS Module: Port 9000');
    console.log('  • OCC Dashboard: Port 10001');
    console.log('  • Analytics API: Port 13000');
    console.log('  • Partner API: Port 11000');
    console.log('='.repeat(60));
});
