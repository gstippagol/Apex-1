const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkUsernames = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('name email role isActive isEliminated');
        
        console.log('\n--- Administrative Account Registry ---');
        users.forEach(u => {
            const status = u.isEliminated ? 'ELIMINATED' : (u.isActive ? 'ACTIVE' : 'DEACTIVATED');
            console.log(`[${u.role.toUpperCase()}] [${status.padEnd(11)}] Name: ${u.name.padEnd(25)} | Email: ${u.email}`);
        });
        console.log('---------------------------------------\n');
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUsernames();
