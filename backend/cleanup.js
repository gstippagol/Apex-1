const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const cleanIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/apex-exam');
        console.log('Connected to DB');
        
        const Result = mongoose.connection.collection('results');
        
        console.log('Fetching indexes...');
        const indexes = await Result.indexes();
        console.log('Current Indexes:', indexes);

        // Target old/stale index that is blocking submissions
        const targetIndex = 'exam_1_student_1_attemptNumber_1';
        
        if (indexes.find(i => i.name === targetIndex)) {
            console.log(`Dropping stale index: ${targetIndex}`);
            await Result.dropIndex(targetIndex);
            console.log('Index dropped successfully!');
        } else {
            console.log('Stale index not found. Your DB might be clean.');
            // Drop ALL unique indexes on the results collection just in case
            for (const index of indexes) {
                if (index.unique && index.name !== '_id_') {
                    console.log(`Dropping unique index: ${index.name}`);
                    await Result.dropIndex(index.name);
                }
            }
        }

        console.log('Database cleanup complete. You can now submit exams.');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
};

cleanIndexes();
