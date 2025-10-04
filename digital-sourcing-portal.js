const express = require('express');
const app = express();
const PORT = 8090;
const pool = require('./db-config');

app.use(express.json());
app.use(express.static('public'));

// Serve the digital sourcing frontend
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Digital Sourcing Portal - GrandPro HMSO</title>
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
.gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.progress-step { transition: all 0.3s; }
.progress-step.active { background-color: #667eea; color: white; }
.progress-step.completed { background-color: #48bb78; color: white; }
</style>
</head>
<body class="bg-gray-50">

<!-- Header -->
<header class="gradient-bg shadow-lg">
  <div class="container mx-auto px-4 py-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <i class="fas fa-hospital text-white text-3xl"></i>
        <div>
          <h1 class="text-2xl font-bold text-white">Digital Sourcing Portal</h1>
          <p class="text-purple-100">Partner with GrandPro HMSO</p>
        </div>
      </div>
      <div class="text-right text-white">
        <p class="text-sm">24/7 Support</p>
        <p class="font-bold">+233 555 0123</p>
      </div>
    </div>
  </div>
</header>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
  <!-- Application Progress -->
  <div class="mb-8">
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Application Progress</h2>
      <div class="flex justify-between">
        <div class="progress-step completed rounded-full p-3 text-center">
          <i class="fas fa-check"></i>
          <p class="text-xs mt-2">Register</p>
        </div>
        <div class="progress-step active rounded-full p-3 text-center">
          <i class="fas fa-file-alt"></i>
          <p class="text-xs mt-2">Documents</p>
        </div>
        <div class="progress-step bg-gray-200 rounded-full p-3 text-center">
          <i class="fas fa-star"></i>
          <p class="text-xs mt-2">Evaluation</p>
        </div>
        <div class="progress-step bg-gray-200 rounded-full p-3 text-center">
          <i class="fas fa-signature"></i>
          <p class="text-xs mt-2">Contract</p>
        </div>
        <div class="progress-step bg-gray-200 rounded-full p-3 text-center">
          <i class="fas fa-handshake"></i>
          <p class="text-xs mt-2">Onboarded</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Application Form -->
  <div class="grid md:grid-cols-2 gap-8">
    <!-- Hospital Information -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">
        <i class="fas fa-hospital-alt text-purple-600 mr-2"></i>
        Hospital Information
      </h3>
      <form id="hospitalForm">
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Hospital Name</label>
          <input type="text" id="hospitalName" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Registration Number</label>
          <input type="text" id="regNumber" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Location</label>
          <input type="text" id="location" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Number of Beds</label>
          <input type="number" id="bedCount" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Specializations</label>
          <textarea id="specializations" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" rows="3"></textarea>
        </div>
      </form>
    </div>

    <!-- Owner Information -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">
        <i class="fas fa-user-tie text-purple-600 mr-2"></i>
        Owner Information
      </h3>
      <form id="ownerForm">
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Full Name</label>
          <input type="text" id="ownerName" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Email Address</label>
          <input type="email" id="ownerEmail" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Phone Number</label>
          <input type="tel" id="ownerPhone" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Years of Experience</label>
          <input type="number" id="experience" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
        </div>
      </form>
    </div>
  </div>

  <!-- Document Upload Section -->
  <div class="bg-white rounded-lg shadow-md p-6 mt-8">
    <h3 class="text-lg font-semibold mb-4">
      <i class="fas fa-file-upload text-purple-600 mr-2"></i>
      Required Documents
    </h3>
    <div class="grid md:grid-cols-3 gap-4">
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition">
        <i class="fas fa-certificate text-3xl text-gray-400 mb-2"></i>
        <p class="text-sm font-medium">Operating License</p>
        <button class="mt-2 text-purple-600 text-sm hover:underline">Upload PDF</button>
      </div>
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition">
        <i class="fas fa-file-invoice text-3xl text-gray-400 mb-2"></i>
        <p class="text-sm font-medium">Financial Statements</p>
        <button class="mt-2 text-purple-600 text-sm hover:underline">Upload PDF</button>
      </div>
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition">
        <i class="fas fa-shield-alt text-3xl text-gray-400 mb-2"></i>
        <p class="text-sm font-medium">Insurance Documents</p>
        <button class="mt-2 text-purple-600 text-sm hover:underline">Upload PDF</button>
      </div>
    </div>
  </div>

  <!-- Evaluation Criteria Preview -->
  <div class="bg-white rounded-lg shadow-md p-6 mt-8">
    <h3 class="text-lg font-semibold mb-4">
      <i class="fas fa-chart-line text-purple-600 mr-2"></i>
      Evaluation Criteria
    </h3>
    <div class="grid md:grid-cols-4 gap-4">
      <div class="text-center">
        <div class="bg-purple-100 rounded-full p-4 inline-block mb-2">
          <i class="fas fa-bed text-purple-600 text-2xl"></i>
        </div>
        <p class="text-sm font-medium">Bed Capacity</p>
        <p class="text-xs text-gray-500">Min 50 beds</p>
      </div>
      <div class="text-center">
        <div class="bg-green-100 rounded-full p-4 inline-block mb-2">
          <i class="fas fa-dollar-sign text-green-600 text-2xl"></i>
        </div>
        <p class="text-sm font-medium">Financial Health</p>
        <p class="text-xs text-gray-500">Stable revenue</p>
      </div>
      <div class="text-center">
        <div class="bg-blue-100 rounded-full p-4 inline-block mb-2">
          <i class="fas fa-user-md text-blue-600 text-2xl"></i>
        </div>
        <p class="text-sm font-medium">Staff Quality</p>
        <p class="text-xs text-gray-500">Qualified team</p>
      </div>
      <div class="text-center">
        <div class="bg-yellow-100 rounded-full p-4 inline-block mb-2">
          <i class="fas fa-star text-yellow-600 text-2xl"></i>
        </div>
        <p class="text-sm font-medium">Reputation</p>
        <p class="text-xs text-gray-500">Good standing</p>
      </div>
    </div>
  </div>

  <!-- Submit Section -->
  <div class="mt-8 text-center">
    <button onclick="submitApplication()" class="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transform hover:scale-105 transition">
      <i class="fas fa-paper-plane mr-2"></i>
      Submit Application
    </button>
    <p class="text-sm text-gray-500 mt-4">
      By submitting, you agree to our 
      <a href="#" class="text-purple-600 hover:underline">Terms & Conditions</a> and 
      <a href="#" class="text-purple-600 hover:underline">Privacy Policy</a>
    </p>
  </div>

  <!-- Recent Applications -->
  <div class="bg-white rounded-lg shadow-md p-6 mt-8">
    <h3 class="text-lg font-semibold mb-4">
      <i class="fas fa-clock text-purple-600 mr-2"></i>
      Recent Applications
    </h3>
    <div id="applicationsList" class="space-y-3">
      <!-- Applications will be loaded here -->
    </div>
  </div>
</main>

<!-- Footer -->
<footer class="gradient-bg mt-12 py-8">
  <div class="container mx-auto px-4 text-center text-white">
    <p>&copy; 2025 GrandPro HMSO - Digital Transformation in Healthcare</p>
    <div class="mt-4 space-x-4">
      <a href="#" class="hover:underline">About Us</a>
      <a href="#" class="hover:underline">Contact</a>
      <a href="#" class="hover:underline">Support</a>
      <a href="#" class="hover:underline">Partners</a>
    </div>
  </div>
</footer>

<script>
async function submitApplication() {
  const applicationData = {
    hospital_name: document.getElementById('hospitalName').value,
    registration_number: document.getElementById('regNumber').value,
    location: document.getElementById('location').value,
    bed_count: document.getElementById('bedCount').value,
    specializations: document.getElementById('specializations').value,
    owner_name: document.getElementById('ownerName').value,
    owner_email: document.getElementById('ownerEmail').value,
    owner_phone: document.getElementById('ownerPhone').value,
    years_experience: document.getElementById('experience').value
  };

  if (!applicationData.hospital_name || !applicationData.owner_email) {
    alert('Please fill in all required fields');
    return;
  }

  try {
    const response = await fetch('/api/applications/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applicationData)
    });

    const result = await response.json();
    if (result.success) {
      alert('Application submitted successfully! Application ID: ' + result.applicationId);
      loadApplications();
      // Clear form
      document.getElementById('hospitalForm').reset();
      document.getElementById('ownerForm').reset();
    } else {
      alert('Error submitting application: ' + result.message);
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function loadApplications() {
  try {
    const response = await fetch('/api/applications/recent');
    const applications = await response.json();
    
    const listHtml = applications.map(app => \`
      <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
        <div>
          <p class="font-medium">\${app.hospital_name}</p>
          <p class="text-sm text-gray-500">\${app.location} - \${app.bed_count} beds</p>
        </div>
        <div class="text-right">
          <span class="px-3 py-1 text-xs font-medium rounded-full \${
            app.status === 'approved' ? 'bg-green-100 text-green-800' :
            app.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }">
            \${app.status}
          </span>
          <p class="text-xs text-gray-500 mt-1">\${new Date(app.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    \`).join('');
    
    document.getElementById('applicationsList').innerHTML = listHtml || '<p class="text-gray-500">No applications yet</p>';
  } catch (error) {
    console.error('Error loading applications:', error);
  }
}

// Load applications on page load
loadApplications();
</script>

</body>
</html>
  `);
});

// API endpoints for digital sourcing
app.post('/api/applications/submit', async (req, res) => {
  try {
    const {
      hospital_name,
      registration_number,
      location,
      bed_count,
      specializations,
      owner_name,
      owner_email,
      owner_phone,
      years_experience
    } = req.body;

    // Insert application
    const applicationResult = await pool.query(`
      INSERT INTO onboarding.applications (
        hospital_name, registration_number, location, 
        bed_count, specializations, status, 
        submission_date, evaluation_score
      ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), 0)
      RETURNING id
    `, [hospital_name, registration_number, location, bed_count, specializations]);

    const applicationId = applicationResult.rows[0].id;

    // Insert owner information
    await pool.query(`
      INSERT INTO organization.hospital_owners (
        name, email, phone, application_id
      ) VALUES ($1, $2, $3, $4)
    `, [owner_name, owner_email, owner_phone, applicationId]);

    // Auto-evaluate based on criteria
    let score = 0;
    if (bed_count >= 50) score += 25;
    if (bed_count >= 100) score += 25;
    if (years_experience >= 5) score += 25;
    if (specializations && specializations.length > 0) score += 25;

    await pool.query(`
      UPDATE onboarding.applications 
      SET evaluation_score = $1,
          status = CASE WHEN $1 >= 70 THEN 'approved' ELSE 'under_review' END
      WHERE id = $2
    `, [score, applicationId]);

    res.json({ 
      success: true, 
      applicationId,
      score,
      status: score >= 70 ? 'approved' : 'under_review'
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/applications/recent', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.hospital_name,
        a.location,
        a.bed_count,
        a.status,
        a.submission_date as created_at,
        a.evaluation_score
      FROM onboarding.applications a
      ORDER BY a.submission_date DESC
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.json([]);
  }
});

app.get('/api/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        a.*,
        o.name as owner_name,
        o.email as owner_email
      FROM onboarding.applications a
      LEFT JOIN organization.hospital_owners o ON o.application_id = a.id
      WHERE a.id = $1
    `, [id]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    console.error('Error fetching application status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Contract generation endpoint
app.post('/api/applications/:id/generate-contract', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get application details
    const appResult = await pool.query(`
      SELECT a.*, o.name as owner_name, o.email as owner_email
      FROM onboarding.applications a
      LEFT JOIN organization.hospital_owners o ON o.application_id = a.id
      WHERE a.id = $1 AND a.status = 'approved'
    `, [id]);
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ message: 'Approved application not found' });
    }
    
    const app = appResult.rows[0];
    
    // Create contract
    const contractResult = await pool.query(`
      INSERT INTO onboarding.contracts (
        application_id, contract_terms, 
        start_date, end_date, status
      ) VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 year', 'pending_signature')
      RETURNING id
    `, [
      id,
      JSON.stringify({
        hospital: app.hospital_name,
        owner: app.owner_name,
        revenue_share: '80/20',
        term: '1 year',
        beds: app.bed_count
      })
    ]);
    
    res.json({
      success: true,
      contractId: contractResult.rows[0].id,
      message: 'Contract generated successfully'
    });
  } catch (error) {
    console.error('Error generating contract:', error);
    res.status(500).json({ message: error.message });
  }
});

// Dashboard tracking endpoint
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) as total
      FROM onboarding.applications
      WHERE submission_date > NOW() - INTERVAL '30 days'
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.json({ pending: 0, under_review: 0, approved: 0, rejected: 0, total: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`Digital Sourcing Portal running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
});
