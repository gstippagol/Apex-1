const mongoose = require('mongoose');

const uris = [
    'mongodb+srv://videowebapna123:videowebapna123@cluster0.3ey6qq1.mongodb.net/?appName=Cluster0',
    'mongodb+srv://videowebapna123:password123@cluster0.3ey6qq1.mongodb.net/?appName=Cluster0',
    'mongodb+srv://videowebapna123_db_user:password123@cluster0.3ey6qq1.mongodb.net/?appName=Cluster0',
    'mongodb+srv://videowebapna123_db_user:Apex@123@cluster0.3ey6qq1.mongodb.net/?appName=Cluster0'
];

const test = async () => {
    for (const uri of uris) {
        console.log(`Testing: ${uri.replace(/:[^@]+@/, ':****@')}`);
        try {
            await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
            console.log('SUCCESS!');
            process.exit(0);
        } catch (err) {
            console.log(`FAILED: ${err.message}`);
        }
    }
    process.exit(1);
};

test();
