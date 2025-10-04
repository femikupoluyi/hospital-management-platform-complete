const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8084;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static('.'));

// Main route - serve the HMS frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'hms-frontend-complete-fixed.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'HMS Frontend Server' });
});

app.listen(PORT, () => {
    console.log(`HMS Frontend Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
