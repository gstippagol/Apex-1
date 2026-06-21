import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

const WebcamMonitor = ({ allowCamera = true, allowMicrophone = false, onStatusChange, examResultId, onViolation, triggerSnapshotOnFocusLoss = false, violations, onFrameStatus, showPreview = false, isExamActive = false }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const socketRef = useRef(null);
    const [userId, setUserId] = useState(null);
    const [examId, setExamId] = useState(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const modelRef = useRef(null);
    const violationsRef = useRef(violations);
    const onViolationRef = useRef(onViolation);
    const onFrameStatusRef = useRef(onFrameStatus);
    const noFaceFramesRef = useRef(0);
    const lastViolationTimeRef = useRef(0);

    useEffect(() => {
        violationsRef.current = violations;
        onViolationRef.current = onViolation;
        onFrameStatusRef.current = onFrameStatus;
    }, [violations, onViolation, onFrameStatus]);

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
                        event: 'focus-loss',
                        violations: violationsRef.current
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

    const peerConnectionRef = useRef(null);
    const jitsiApiRef = useRef(null);

    const getStreamingBackend = (uid) => {
        if (!uid) return 'webrtc';
        let hash = 0;
        for (let i = 0; i < uid.length; i++) {
            hash = uid.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % 3;
        const backends = ['webrtc', 'livekit', 'jitsi'];
        return backends[index];
    };
    const activeBackend = getStreamingBackend(userId);

    const loadJitsiScript = () => {
        return new Promise((resolve) => {
            if (window.JitsiMeetExternalAPI) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://meet.element.io/external_api.js';
            script.async = true;
            script.onload = () => resolve(true);
            document.body.appendChild(script);
        });
    };

    // Jitsi Meet streaming effect
    useEffect(() => {
        if (activeBackend !== 'jitsi' || !examId || !userId) return;

        let active = true;
        const initJitsi = async () => {
            await loadJitsiScript();
            if (!active) return;

            const domain = "meet.element.io";
            const options = {
                roomName: `apex-proctoring-${examId}-${userId}`,
                width: '1px',
                height: '1px',
                parentNode: document.getElementById('jitsi-student-container'),
                configOverwrite: {
                    resolution: 240,
                    constraints: {
                        video: {
                            height: { ideal: 240, max: 240, min: 144 }
                        }
                    },
                    startWithAudioMuted: !allowMicrophone,
                    startWithVideoMuted: !allowCamera,
                    prejoinPageEnabled: false,
                    prejoinConfig: {
                        enabled: false
                    },
                    disableSelfView: true,
                    toolbarButtons: [],
                    disabledNotifications: [
                        'audioOnly.silentJoined',
                        'dialog.silentJoined',
                        'notify.silent-joined',
                        'silent-joined',
                        'audio-only.silent-joined',
                        'notify.startSilentTitle',
                        'notify.startSilentDescription',
                        'notify.startSilent',
                        'dialog.startSilentTitle',
                        'dialog.startSilentDescription',
                        'dialog.startSilent',
                        'startSilentTitle',
                        'startSilentDescription',
                        'startSilent',
                        'audioOnly.startSilentTitle',
                        'audioOnly.startSilentDescription',
                        'audioOnly.startSilent',
                        'toolbar.talkWhileMutedPopup',
                        'toolbar.noisyAudioInputTitle',
                        'toolbar.noAudioSignalTitle',
                        'dialog.micNotAllowed',
                        'dialog.cameraNotAllowed',
                        'dialog.micError',
                        'dialog.cameraError',
                        'dialog.cameraPermissionDenied',
                        'dialog.micPermissionDenied',
                        'notify.micNotAllowed',
                        'notify.cameraNotAllowed',
                        'dialog.deviceErrorTitle',
                        'dialog.deviceNotFoundError',
                        'dialog.devicePermissionDenied',
                        'dialog.detectAudioMuting',
                        'dialog.detectAudioMutting',
                        'dialog.detectAudioMuted',
                        'dialog.connectError'
                    ]
                },
                interfaceConfigOverwrite: {
                    TOOLBAR_BUTTONS: [],
                }
            };
            try {
                jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);
                console.log("Jitsi Student Stream Established");
            } catch (e) {
                console.error("Jitsi init failed", e);
            }
        };

        initJitsi();

        return () => {
            active = false;
            if (jitsiApiRef.current) {
                jitsiApiRef.current.dispose();
                jitsiApiRef.current = null;
            }
        };
    }, [activeBackend, examId, userId, allowCamera, allowMicrophone]);

    // WebRTC connection signaling effect
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !userId || !examId) return;
        if (activeBackend !== 'webrtc' && activeBackend !== 'livekit') return;

        const handleInitiate = async () => {
            console.log("WebRTC: Received initiate signal from admin");
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            peerConnectionRef.current = pc;

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, streamRef.current);
                });
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('webrtc-candidate', {
                        examId,
                        userId,
                        candidate: event.candidate,
                        target: 'admin'
                    });
                }
            };

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('webrtc-offer', {
                    examId,
                    userId,
                    offer
                });
            } catch (e) {
                console.error("Failed to create WebRTC offer", e);
            }
        };

        const handleAnswer = async ({ answer }) => {
            console.log("WebRTC: Received answer from admin");
            if (peerConnectionRef.current) {
                try {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (e) {
                    console.error("Failed to set remote description", e);
                }
            }
        };

        const handleCandidate = async ({ candidate }) => {
            if (peerConnectionRef.current && candidate) {
                try {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error("Failed to add ICE candidate", e);
                }
            }
        };

        socket.on('webrtc-initiate', handleInitiate);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-candidate', handleCandidate);

        return () => {
            socket.off('webrtc-initiate', handleInitiate);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-candidate', handleCandidate);
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
        };
    }, [userId, examId, activeBackend]);

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
                micActivity: micLevel,
                streamingBackend: activeBackend,
                violations: violationsRef.current
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

        // Real-time streaming interval (approx 3.3 FPS for fluid low-res video, or 3s fallback if using WebRTC/Jitsi)
        const snapshotDelay = (activeBackend === 'webrtc' || activeBackend === 'jitsi') ? 3000 : 300;
        const captureInterval = setInterval(captureAndSend, snapshotDelay); 
        // Database persist interval (every 30 seconds to prevent DB overload)
        const dbInterval = setInterval(saveToDB, 30000);
        
        return () => {
            clearInterval(captureInterval);
            clearInterval(dbInterval);
            if (audioContext) audioContext.close();
        };
    }, [allowCamera, allowMicrophone, examResultId, examId, userId, activeBackend]);

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
        if (!isModelLoaded || !videoRef.current) return;

        let interval;

        const analyzeFrame = async () => {
            if (!videoRef.current || videoRef.current.videoWidth === 0) {
                if (onFrameStatusRef.current) onFrameStatusRef.current('no_person');
                
                if (isExamActive) {
                    noFaceFramesRef.current++;
                    if (noFaceFramesRef.current >= 3) { // 3 frames @ 1000ms = 3 seconds to trigger
                        const now = Date.now();
                        if (now - lastViolationTimeRef.current > 15000) {
                            if (onViolationRef.current) onViolationRef.current("camera off");
                            lastViolationTimeRef.current = now;
                        }
                        noFaceFramesRef.current = 0;
                    }
                }
                return;
            }

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

                let currentStatus = 'valid';
                if (personCount === 0) currentStatus = 'no_person';
                else if (personCount > 1) currentStatus = 'multiple_persons';
                
                if (onFrameStatusRef.current) onFrameStatusRef.current(currentStatus);

                // Rule 1: No Face Detected (OpenCV/MediaPipe logic)
                if (personCount === 0) {
                    if (isExamActive) {
                        noFaceFramesRef.current++;
                        if (noFaceFramesRef.current >= 3) { // 3 frames @ 1000ms = 3 seconds to trigger
                            const now = Date.now();
                            if (now - lastViolationTimeRef.current > 15000) {
                                if (onViolationRef.current) onViolationRef.current("face is not detected");
                                lastViolationTimeRef.current = now;
                            }
                            noFaceFramesRef.current = 0; // reset to avoid spamming
                        }
                    }
                } else {
                    noFaceFramesRef.current = 0;
                }

                // Rule 2: Multiple People (YOLO logic)
                /*
                if (personCount > 1 && isExamActive) {
                    const now = Date.now();
                    if (now - lastViolationTimeRef.current > 15000) {
                        if (onViolationRef.current) onViolationRef.current(`Multiple people detected (${personCount} persons)`);
                        lastViolationTimeRef.current = now;
                    }
                }
                */

                // Rule 3: Forbidden Objects (YOLO logic)
                if (forbiddenObjects.length > 0 && isExamActive) {
                    const now = Date.now();
                    if (now - lastViolationTimeRef.current > 15000) {
                        if (onViolationRef.current) onViolationRef.current(`Restricted object detected: ${forbiddenObjects[0]}`);
                        lastViolationTimeRef.current = now;
                    }
                }

            } catch (err) {
                // Ignore silent frame drops
            }
        };

        // Run analysis every 1000ms (1 second) as requested
        interval = setInterval(analyzeFrame, 1000);

        return () => clearInterval(interval);
    }, [isModelLoaded, isExamActive]);

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (socketRef.current && examId && userId && violations) {
            socketRef.current.emit('stream-update', {
                examId,
                userId,
                violations
            });
        }
    }, [violations, examId, userId]);

    if (!allowCamera && !allowMicrophone) return null;

    return (
        <>
            <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
                <div id="jitsi-student-container" style={{ position: 'fixed', left: '-9999px', width: '1px', height: '1px' }} />
            </div>
            
            <div style={
                showPreview 
                ? { position: 'fixed', bottom: '40px', right: '40px', zIndex: 9999, width: '320px', height: '240px', borderRadius: '16px', overflow: 'hidden', border: '3px solid #2563eb', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', background: '#000' }
                : { position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }
            }>
                {allowCamera && <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
        </>
    );
};

export default WebcamMonitor;
