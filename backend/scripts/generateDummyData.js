const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const generate = async () => {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/exam-portal');
        console.log('MongoDB Connected...');

        // 1. Create Dummy Exam
        const exam = await Exam.create({
            title: 'Mock Placement Assessment 2024',
            duration: 3600, // 1 hour
            passingMarks: 50,
            status: 'Stopped',
            proctoring: { camera: true, microphone: true }
        });

        console.log(`Created Exam: ${exam._id}`);

        // 2. Create 148 Dummy Users and Results
        console.log('Generating 148 users...');
        for (let i = 1; i <= 148; i++) {
            const name = `Dummy Student ${i}`;
            const email = `dummy${i}@apex.com`;
            const usn = `APEX24CS${String(i).padStart(3, '0')}`;
            
            try {
                const user = await User.create({
                    name,
                    email,
                    password: 'password123',
                    role: 'student',
                    usn,
                    department: 'Computer Science',
                    mobileNumber: `+91${String(Math.floor(1000000000 + Math.random() * 9000000000)).slice(0, 10)}`
                });

                const score = Math.floor(Math.random() * 100);
                await Result.create({
                    userId: user._id,
                    examId: exam._id,
                    score: score,
                    totalMarks: 100,
                    totalQuestions: 50,
                    status: 'Submitted',
                    attendance: 'Present',
                    verdict: score >= 50 ? 'Pass' : 'Fail',
                    isPublished: true,
                    timeTaken: Math.floor(Math.random() * 3000) + 600,
                    createdAt: new Date()
                });

                if (i % 20 === 0) console.log(`Processed ${i} students...`);
            } catch (userErr) {
                console.error(`Error at index ${i}:`, userErr.message);
            }
        }

        console.log('DONE! 148 Users and Results generated.');
        process.exit();
    } catch (err) {
        console.error('Fatal Error:', err);
        process.exit(1);
    }
};

generate();
