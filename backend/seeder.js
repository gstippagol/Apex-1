const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB...');

        const superAdminEmail = 'gopalst2005@gmail.com';
        
        // Delete any existing conflicting admin to ensure fresh state with new fields
        await User.deleteMany({ email: superAdminEmail });
        console.log('Clearing existing admin conflicts...');

        console.log('Creating fresh Super Admin account with mandatory fields...');
        await User.create({
            name: 'Super Admin',
            email: superAdminEmail,
            password: 'Gopalst123',
            role: 'superadmin',
            department: 'SUPERADMIN',
            usn: 'SUPER-ADMIN-1',
            mobileNumber: '+919999999998'
        });
        
        console.log('SUCCESS: Super Admin account created successfully!');
        console.log('Email: gopalst2005@gmail.com');
        console.log('Pass: Gopalst123');

        process.exit();
    } catch (err) {
        console.error('Seeding Error:', err.message);
        process.exit(1);
    }
};

seedAdmin();
