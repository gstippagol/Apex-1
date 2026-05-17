const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const logger = require('./utils/logger');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Load env vars

dotenv.config();

const app = express();

// --- Security & Performance Middleware ---

// Set security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression
app.use(compression());

// Body parser
app.use(express.json({ limit: '10mb' }));

// Express 5 compatibility: make req.query writable for older middlewares
app.use((req, res, next) => {
    const query = { ...req.query };
    Object.defineProperty(req, 'query', {
        get: () => query,
        set: (val) => { Object.assign(query, val); },
        configurable: true,
        enumerable: true
    });
    next();
});

// Prevent NoSQL injection
app.use(mongoSanitize());

// Prevent HTTP param pollution
app.use(hpp());

// Cookie parser
app.use(cookieParser());

// Enable CORS
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// --- Rate Limiting Strategy ---
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 500,
    message: { success: false, message: 'Too many requests, please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many login attempts, please try again after 15 minutes.' }
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// --- Health Check ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Route files
const auth = require('./routes/auth');
const exams = require('./routes/exams');
const questions = require('./routes/questions');
const results = require('./routes/results');
const code = require('./routes/code');
const resources = require('./routes/resources');
const events = require('./routes/events');
const upload = require('./routes/upload');
const notices = require('./routes/notices');
const quiz = require('./routes/quiz');

// Mount routers
app.use('/api/auth', auth);
app.use('/api/exams', exams);
app.use('/api/questions', questions);
app.use('/api/results', results);
app.use('/api/code', code);
app.use('/api/resources', resources);
app.use('/api/events', events);
app.use('/api/upload', upload);
app.use('/api/notices', notices);
app.use('/api/quiz', quiz);
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/settings', require('./routes/settings'));

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error Handler Middleware
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set('io', io);

// Socket.io signaling & monitoring
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);

    socket.on('join-user', (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            logger.info(`User ${userId} joined their private room: user_${userId}`);
        }
    });

    socket.on('join-exam', ({ examId, userId, role }) => {
        if (!examId) return;

        if (role === 'admin') {
            socket.join(`admin-${examId}`);
            logger.info(`Admin joined monitoring room: admin-${examId}`);
        } else {
            socket.join(examId);
            if (userId) {
                socket.join(`student-${userId}`);
            }
            logger.info(`Student joined exam room: ${examId}`);
        }
    });

    socket.on('stream-update', (data) => {
        if (!data || !data.examId) return;
        io.to(`admin-${data.examId}`).emit('live-update', {
            userId: data.userId,
            snapshot: data.snapshot,
            micActivity: data.micActivity,
            timestamp: Date.now()
        });
    });

    socket.on('signal', (data) => {
        if (!data) return;
        const { targetId, signalData, fromId } = data;
        if (targetId) {
            io.to(`student-${targetId}`).emit('signal', { signalData, fromId });
        }
    });

    socket.on('disconnect', () => {
        logger.info('User disconnected');
    });
});

const PORT = process.env.PORT || 5000;

server.on('error', (error) => {
    if (error.syscall !== 'listen') throw error;
    switch (error.code) {
        case 'EADDRINUSE':
            logger.error(`Port ${PORT} is already in use. Please kill the process or use a different port.`);
            process.exit(1);
            break;
        default:
            logger.error(`Server error: ${error.message}`);
            throw error;
    }
});

// Graceful shutdown helper — closes server & DB before exit
const mongoose = require('mongoose');
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
        logger.info('HTTP server closed.');
        mongoose.connection.close(false).then(() => {
            logger.info('MongoDB connection closed.');
            process.exit(0);
        }).catch(() => process.exit(0));
    });
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 3000);
};

const startApp = async () => {
    try {
        await connectDB();
        server.listen(PORT, () => {
            logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        });
    } catch (err) {
        logger.error(`Failed to start application: ${err.message}`);
        process.exit(1);
    }
};

startApp();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(`${err.name}: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(`${err.name}: ${err.message}`);
    logger.error(err.stack);
    server.close(() => {
        process.exit(1);
    });
});

// Nodemon sends SIGUSR2; Windows uses SIGINT on Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGUSR2', () => {
    gracefulShutdown('SIGUSR2 (nodemon restart)');
});

// Restart trigger for nodemon
