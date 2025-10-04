const express = require('express');
const path = require('path');

const app = express();
const PORT = 7001;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'crm-frontend-complete.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRM Frontend running on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}`);
});
