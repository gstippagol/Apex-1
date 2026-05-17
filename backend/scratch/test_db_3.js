const mongoose = require('mongoose');

const uri = 'mongodb+srv://videowebapna123_db_user:videowebapna123_db_user@cluster0.3ey6qq1.mongodb.net/?appName=Cluster0';

const test = async () => {
    console.log(`Testing URI with password candidate: videowebapna123_db_user (no brackets)`);
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('SUCCESS!');
        process.exit(0);
    } catch (err) {
        console.log(`FAILED: ${err.message}`);
        process.exit(1);
    }
};

test();
