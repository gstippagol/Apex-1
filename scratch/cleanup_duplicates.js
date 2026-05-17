const mongoose = require('mongoose');
const Result = require('../backend/models/Result');

async function cleanDuplicates() {
    try {
        await mongoose.connect('mongodb://localhost:27017/apex-exam'); 
        console.log('Connected to DB');

        const duplicates = await Result.aggregate([
            {
                $group: {
                    _id: { userId: '$userId', examId: '$examId' },
                    count: { $sum: 1 },
                    ids: { $push: '$_id' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        console.log(`Found ${duplicates.length} sets of duplicates`);

        for (const doc of duplicates) {
            // Keep the last one (latest)
            const idsToDelete = doc.ids.slice(0, doc.ids.length - 1);
            await Result.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`Deleted ${idsToDelete.length} duplicates for user ${doc._id.userId} on exam ${doc._id.examId}`);
        }

        console.log('Cleanup complete');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
}

cleanDuplicates();
