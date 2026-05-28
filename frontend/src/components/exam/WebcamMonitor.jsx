import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

const WebcamMonitor = ({ allowCamera = true, allowMicrophone = false, onStatusChange, examResultId, onViolation, triggerSnapshotOnFocusLoss = false }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const socketRef = useRef(null);
    const [userId, setUserId] = useState(null);
    const [examId, setExamId] = useState(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const modelRef = useRef(null);

    // Snapshot Functionality (Extracted for reuse)
    const getSnapshot = (canvas, context) => {
        if (allowCamera && videoRef.current && videoRef.current.videoWidth > 0) {
            canvas.width = 160;
            canvas.height = 120;
            context.drawImage(videoRef.current, 0, 0, 160, 120);
            return canvas.toDataURL('image/jpeg', 0.3);
        }
        return null;
    };

    useEffect(() => {
        if (!socketRef.current || !userId || !examId) return;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        const handleFocusLoss = () => {
            if (document.hidden && triggerSnapshotOnFocusLoss) {
                const snapshot = getSnapshot(canvas, context);
                if (snapshot) {
                    socketRef.current.emit('stream-update', {
                        examId,
                        userId,
                        snapshot,
                        micActivity: 0,
                        event: 'focus-loss'
                    });
                }
            }
        };

        if (triggerSnapshotOnFocusLoss) {
            document.addEventListener('visibilitychange', handleFocusLoss);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleFocusLoss);
        };
    }, [triggerSnapshotOnFocusLoss, userId, examId]);

    useEffect(() => {
        const saved = localStorage.getItem('user');
        if (saved) {
            const user = JSON.parse(saved);
            setUserId(user.id || user._id);
        }
        
        const pathParts = window.location.pathname.split('/');
        const id = pathParts[pathParts.length - 1];
        setExamId(id);

        const socketUrl = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? `http://${window.location.hostname}:5000`
            : 'https://apex-s1q2.onrender.com';
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on('connect', () => {
            if (id) {
                console.log("Student Socket Connected - Joining Session:", id);
                socket.emit('join-exam', { examId: id, userId: userId, role: 'student' });
            }
        });

        return () => socket.disconnect();
    }, [userId]);

    useEffect(() => {
        const startMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: allowCamera,
                    audio: allowMicrophone 
                });
                streamRef.current = stream;
                if (videoRef.current && allowCamera) {
                    videoRef.current.srcObject = stream;
                }
                onStatusChange?.('granted');
            } catch (err) {
                console.error("Media access error:", err.name, err.message);
                
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    onStatusChange?.('denied');
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    onStatusChange?.('not-found');
                } else {
                    onStatusChange?.('denied');
                }
            }
        };
        
        if (allowCamera || allowMicrophone) {
            startMedia();
        } else {
            onStatusChange?.('granted');
        }

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [allowCamera, allowMicrophone]);

    useEffect(() => {
        const saved = localStorage.getItem('user');
        let currentUserId = null;
        if (saved) {
            const user = JSON.parse(saved);
            currentUserId = user.id || user._id;
            setUserId(currentUserId);
        }
        
        const pathParts = window.location.pathname.split('/');
        const id = pathParts[pathParts.length - 1];
        setExamId(id);

        const socketUrl = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? `http://${window.location.hostname}:5000`
            : 'https://apex-s1q2.onrender.com';
            
        const socket = io(socketUrl, {
            reconnectionAttempts: 5,
            reconnectionDelay: 5000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (id && currentUserId) {
                console.log("Student Socket Connected - Joining Session:", id);
                socket.emit('join-exam', { examId: id, userId: currentUserId, role: 'student' });
            }
        });

        return () => socket.disconnect();
    }, []); // Run only once

    useEffect(() => {
        if (!socketRef.current || !userId || !examId) return;
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

        let audioContext, analyser, dataArray, source;
        if (allowMicrophone && streamRef.current) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                source = audioContext.createMediaStreamSource(streamRef.current);
                source.connect(analyser);
                analyser.fftSize = 256;
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            } catch (e) { console.error("Audio Analysis failed", e); }
        }

        const getMicLevel = () => {
            if (!analyser || !dataArray) return 0;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            return Math.round((sum / dataArray.length) * 100 / 255);
        };

        const captureAndSend = async () => {
            const micLevel = allowMicrophone ? getMicLevel() : 0;
            let snapshot = null;
            
            if (allowCamera && videoRef.current && videoRef.current.videoWidth > 0) {
                // Low quality video streaming resolution
                canvas.width = 160; 
                canvas.height = 120;
                context.drawImage(videoRef.current, 0, 0, 160, 120);
                snapshot = canvas.toDataURL('image/jpeg', 0.25); 
            }
            
            socketRef.current.emit('stream-update', {
                examId,
                userId,
                snapshot,
                micActivity: micLevel
            });
        };

        const saveToDB = async () => {
            const micLevel = allowMicrophone ? getMicLevel() : 0;
            let snapshot = null;
            if (allowCamera && videoRef.current && videoRef.current.videoWidth > 0) {
                canvas.width = 240; 
                canvas.height = 180;
                context.drawImage(videoRef.current, 0, 0, 240, 180);
                snapshot = canvas.toDataURL('image/jpeg', 0.4); 
            }
            if (examResultId) {
                try {
                    await axios.patch(`${API_BASE}/api/results/${examResultId}/session`, {
                        snapshot, micActivity: micLevel
                    });
                } catch (e) {}
            }
        };

        // Real-time streaming interval (approx 3.3 FPS for fluid low-res video)
        const captureInterval = setInterval(captureAndSend, 300); 
        // Database persist interval (every 30 seconds to prevent DB overload)
        const dbInterval = setInterval(saveToDB, 30000);
        
        return () => {
            clearInterval(captureInterval);
            clearInterval(dbInterval);
            if (audioContext) audioContext.close();
        };
    }, [allowCamera, allowMicrophone, examResultId, examId, userId]);

    // AI Proctoring Initialization (YOLO / MediaPipe Equivalent)
    useEffect(() => {
        if (!allowCamera) return;

        const loadModel = async () => {
            try {
                // We use COCO-SSD (TensorFlow) for Object/Person detection
                const loadedModel = await cocoSsd.load();
                modelRef.current = loadedModel;
                setIsModelLoaded(true);
                console.log("AI Proctoring Model Loaded");
            } catch (err) {
                console.error("Failed to load AI model:", err);
            }
        };
        loadModel();
    }, [allowCamera]);

    // AI Tracking Loop
    useEffect(() => {
        if (!isModelLoaded || !videoRef.current || !onViolation) return;

        let interval;
        let noFaceFrames = 0;

        const analyzeFrame = async () => {
            if (!videoRef.current || videoRef.current.videoWidth === 0) return;

            try {
                const predictions = await modelRef.current.detect(videoRef.current);
                
                let personCount = 0;
                let forbiddenObjects = [];

                predictions.forEach(p => {
                    if (p.class === 'person') personCount++;
                    if (['cell phone', 'book', 'laptop', 'tv', 'remote'].includes(p.class)) {
                        forbiddenObjects.push(p.class);
                    }
                });

                // Rule 1: No Face Detected (OpenCV/MediaPipe logic)
                if (personCount === 0) {
                    noFaceFrames++;
                    if (noFaceFrames >= 3) {
                        onViolation("Face not detected in frame");
                        noFaceFrames = 0; // reset to avoid spamming
                    }
                } else {
                    noFaceFrames = 0;
                }

                // Rule 2: Multiple People (YOLO logic)
                if (personCount > 1) {
                    onViolation(`Multiple people detected (${personCount} persons)`);
                }

                // Rule 3: Forbidden Objects (YOLO logic)
                if (forbiddenObjects.length > 0) {
                    onViolation(`Restricted object detected: ${forbiddenObjects[0]}`);
                }

            } catch (err) {
                // Ignore silent frame drops
            }
        };

        // Run analysis every 3 seconds
        interval = setInterval(analyzeFrame, 3000);

        return () => clearInterval(interval);
    }, [isModelLoaded, onViolation]);

    if (!allowCamera && !allowMicrophone) return null;

    return (
        <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
            {allowCamera && <video ref={videoRef} autoPlay playsInline muted />}
        </div>
    );
};

export default WebcamMonitor;
