#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5800;

// Serve static files
app.use(express.static('/root'));

// Main route
app.get('/', (req, res) => {
    res.sendFile('/root/hms-frontend-complete.html');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'HMS Frontend Server', port: PORT });
});

app.listen(PORT, () => {
    console.log(`HMS Frontend Server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
});
