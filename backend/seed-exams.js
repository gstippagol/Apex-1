const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Exam = require('./models/Exam');
const Question = require('./models/Question');
const User = require('./models/User');

dotenv.config();

const seedExams = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.log('Admin user not found. Please run seed.js first.');
            process.exit(1);
        }

        // Create Questions
        const questionsData = [
            {
                questionText: "Which of the following is not a primitive data type in JavaScript?",
                options: ["String", "Number", "Array", "Boolean"],
                correctAnswer: "Array",
                createdBy: admin._id
            },
            {
                questionText: "What does the 'typeof' operator return for an Array?",
                options: ["array", "object", "undefined", "list"],
                correctAnswer: "object",
                createdBy: admin._id
            },
            {
                questionText: "Which company developed JavaScript?",
                options: ["Microsoft", "Oracle", "Netscape", "Google"],
                correctAnswer: "Netscape",
                createdBy: admin._id
            },
            {
                questionText: "How do you write 'Hello World' in an alert box?",
                options: ["msg('Hello World');", "alert('Hello World');", "console.log('Hello World');", "print('Hello World');"],
                correctAnswer: "alert('Hello World');",
                createdBy: admin._id
            }
        ];

        const createdQuestions = await Question.insertMany(questionsData);
        const questionIds = createdQuestions.map(q => q._id);

        // Create Exam
        const exam = new Exam({
            title: "JavaScript Fundamentals 101",
            duration: 1200, // 20 minutes
            questions: questionIds,
            createdBy: admin._id
        });

        await exam.save();
        console.log('Sample Exam Seeded Successfully!');
        console.log('Exam ID:', exam._id);
        process.exit();
    } catch (err) {
        console.error('Error seeding exam:', err);
        process.exit(1);
    }
};

seedExams();
