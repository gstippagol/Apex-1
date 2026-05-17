const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const cleanup = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apex-exam';
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('MongoDB Connected...');

        // 1. Find the dummy users
        const dummyUsers = await User.find({ 
            $or: [
                { name: /Dummy/i },
                { email: /@apex-mock\.com$/i },
                { email: /@apex\.com$/i }
            ]
        });
        
        const dummyUserIds = dummyUsers.map(u => u._id);
        console.log(`Found ${dummyUserIds.length} dummy users. Deleting their results...`);
        
        if (dummyUserIds.length > 0) {
            await Result.deleteMany({ userId: { $in: dummyUserIds } });
            const deleteResult = await User.deleteMany({ _id: { $in: dummyUserIds } });
            console.log(`Deleted ${deleteResult.deletedCount} dummy users.`);
        }

        // 3. Delete the dummy exam if it still exists
        await Exam.deleteMany({ title: /Mock Placement Assessment/i });
        console.log('Dummy exams cleared.');

        console.log('TOTAL CLEANUP DONE!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

cleanup();
