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
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175', 'https://apexclub-muse.netlify.app'];

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
    max: 500, // 500 requests per student
    keyGenerator: (req) => {
        if (req.headers.authorization) return req.headers.authorization;
        if (req.cookies && req.cookies.token) return req.cookies.token;
        return req.ip;
    },
    message: { success: false, message: 'Too many requests, please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // 100 login attempts per student email
    keyGenerator: (req) => {
        if (req.body && req.body.email) return req.body.email.toLowerCase();
        return req.ip;
    },
    message: { success: false, message: 'Too many login attempts, please try again after 15 minutes.' }
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// --- Root Status Dashboard & Health Check ---
app.get('/', (req, res) => {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    let dbStatus = 'Disconnected';
    if (dbState === 1) dbStatus = 'Connected';
    else if (dbState === 2) dbStatus = 'Connecting';
    else if (dbState === 3) dbStatus = 'Disconnecting';

    const frontendUrl = process.env.FRONTEND_URL || 'https://apexclub-muse.netlify.app';

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APEX Engine | System Status</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        :root {
            --bg-color: #08090d;
            --card-bg: rgba(17, 19, 31, 0.65);
            --border-color: rgba(255, 255, 255, 0.08);
            --primary-glow: rgba(99, 102, 241, 0.15);
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --accent: #6366f1;
            --success: #10b981;
            --success-glow: rgba(16, 185, 129, 0.2);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        /* Beautiful glowing background spots */
        body::before, body::after {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            border-radius: 50%;
            background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
            z-index: 0;
            pointer-events: none;
        }

        body::before {
            top: -100px;
            left: -100px;
            animation: float 20s infinite alternate;
        }

        body::after {
            bottom: -150px;
            right: -100px;
            animation: float 25s infinite alternate-reverse;
        }

        @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(50px, 30px) scale(1.1); }
        }

        .container {
            z-index: 10;
            width: 90%;
            max-width: 520px;
            position: relative;
        }

        .status-card {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .status-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.1);
        }

        /* Pulsing Status Ring */
        .status-indicator-container {
            position: relative;
            width: 100px;
            height: 100px;
            margin: 0 auto 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .outer-pulse {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: var(--success-glow);
            animation: pulse 2s infinite ease-in-out;
        }

        .inner-circle {
            position: relative;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.1);
            border: 2px solid var(--success);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
        }

        .inner-circle svg {
            width: 32px;
            height: 32px;
            color: var(--success);
            animation: scaleCheck 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }

        @keyframes pulse {
            0% { transform: scale(0.85); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 0.3; }
            100% { transform: scale(0.85); opacity: 0.8; }
        }

        @keyframes scaleCheck {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        h1 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .tagline {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 32px;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 500;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            text-align: left;
            margin-bottom: 32px;
        }

        .metric-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 14px;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .metric-label {
            font-size: 14px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .metric-label svg {
            width: 16px;
            height: 16px;
            color: var(--accent);
        }

        .metric-value {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .metric-value.healthy {
            color: var(--success);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .metric-value.healthy::before {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: var(--success);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--success);
        }

        .links-container {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .btn-primary {
            background: var(--accent);
            color: #ffffff;
            border: none;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .btn-primary:hover {
            background: #4f46e5;
            box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .footer {
            margin-top: 24px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.25);
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status-card">
            <div class="status-indicator-container">
                <div class="outer-pulse"></div>
                <div class="inner-circle">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </div>
            
            <h1>APEX Backend Engine</h1>
            <p class="tagline">All Systems Operational</p>

            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        API Status
                    </span>
                    <span class="metric-value healthy">Active</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                        Database (MongoDB)
                    </span>
                    <span class="metric-value">\${dbStatus}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Environment
                    </span>
                    <span class="metric-value" style="text-transform: capitalize;">\${process.env.NODE_ENV || 'production'}</span>
                </div>
            </div>

            <div class="links-container">
                <a href="/health" class="btn btn-secondary">
                    View Health JSON
                </a>
                <a href="\${frontendUrl}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
                    Open Platform
                    <svg style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>

            <p class="footer">APEX Platform &bull; Secure Assessment Ecosystem</p>
        </div>
    </div>
</body>
</html>
    `);
});

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
app.use('/api/feedback', require('./routes/feedback'));

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
            streamingBackend: data.streamingBackend,
            timestamp: Date.now(),
            violations: data.violations
        });
    });

    socket.on('admin-message', (data) => {
        if (!data || !data.targetId) {
            logger.warn('Admin message failed: Missing targetId');
            return;
        }
        logger.info(`Routing admin message to student-${data.targetId}: ${data.message}`);
        io.to(`student-${data.targetId.toString()}`).emit('admin-message', {
            message: data.message,
            timestamp: Date.now()
        });
    });

    socket.on('webrtc-initiate', ({ examId, userId }) => {
        logger.info(`Admin initiating WebRTC connection with student ${userId} for exam ${examId}`);
        io.to(`student-${userId}`).emit('webrtc-initiate', { examId });
    });

    socket.on('webrtc-offer', ({ examId, userId, offer }) => {
        logger.info(`Student ${userId} sending WebRTC offer for exam ${examId}`);
        io.to(`admin-${examId}`).emit('webrtc-offer', { userId, offer });
    });

    socket.on('webrtc-answer', ({ examId, userId, answer }) => {
        logger.info(`Admin sending WebRTC answer for student ${userId} in exam ${examId}`);
        io.to(`student-${userId}`).emit('webrtc-answer', { answer });
    });

    socket.on('webrtc-candidate', ({ examId, userId, candidate, target }) => {
        if (target === 'admin') {
            io.to(`admin-${examId}`).emit('webrtc-candidate', { userId, candidate });
        } else {
            io.to(`student-${userId}`).emit('webrtc-candidate', { candidate });
        }
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
        
        // Auto-delete feedback after 7 days
        const cleanupOldFeedback = async () => {
            try {
                const Feedback = require('./models/Feedback');
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const result = await Feedback.deleteMany({ createdAt: { $lt: sevenDaysAgo } });
                if (result.deletedCount > 0) {
                    logger.info(`Auto-cleaned ${result.deletedCount} old feedback entries on startup.`);
                }
            } catch (err) {
                logger.error(`Feedback cleanup error: ${err.message}`);
            }
        };
        await cleanupOldFeedback();

        // Run cleanup every 24 hours
        setInterval(async () => {
            try {
                const Feedback = require('./models/Feedback');
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const result = await Feedback.deleteMany({ createdAt: { $lt: sevenDaysAgo } });
                if (result.deletedCount > 0) {
                    logger.info(`Auto-cleaned ${result.deletedCount} old feedback entries.`);
                }
            } catch (err) {
                logger.error(`Feedback cleanup error: ${err.message}`);
            }
        }, 24 * 60 * 60 * 1000);

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
