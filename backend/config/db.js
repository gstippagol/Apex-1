const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
        console.log(`Attempting to connect to: ${maskedUri}`);

        const conn = await mongoose.connect(uri, {
            maxPoolSize: 100,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Database Connection Error: ${error.message}`);
        process.exit(1);
    }
};


module.exports = connectDB;
