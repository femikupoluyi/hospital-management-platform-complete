const express = require('express');
const path = require('path');

const app = express();
const PORT = 8091;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'digital-sourcing-frontend.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Sourcing Frontend running on port ${PORT}`);
});
