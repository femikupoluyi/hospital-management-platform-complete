const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const dbConfig = {
    connectionString: 'postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

async function fixAdminPassword() {
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        // Update admin user password
        const result = await client.query(
            "UPDATE users SET password = $1 WHERE email = 'admin@hospital.com'",
            [hashedPassword]
        );
        
        console.log('Admin password updated:', result.rowCount, 'rows affected');
        
        // Verify the update
        const check = await client.query(
            "SELECT id, email, password IS NOT NULL as has_password FROM users WHERE email = 'admin@hospital.com'"
        );
        
        console.log('Verification:', check.rows[0]);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

fixAdminPassword();
