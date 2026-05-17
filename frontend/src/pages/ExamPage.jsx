import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ShieldAlert, Maximize2, CameraOff, MicOff, Monitor } from 'lucide-react';

// Components
import Timer from '../components/exam/Timer';
import QuestionCard from '../components/exam/QuestionCard';
import WebcamMonitor from '../components/exam/WebcamMonitor';
import SubmitConfirmation from '../components/exam/SubmitConfirmation';
import { io } from 'socket.io-client';

const VIOLATION_LIMIT = 3;

const ExamPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const API_BASE = (window.location.hostname.includes('loca.lt') || window.location.hostname.includes('trycloudflare.com'))
        ? 'https://green-ears-first-donated.trycloudflare.com'
        : `http://${window.location.hostname}:5000`;

    // Exam Data
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);

    // Exam Progress State
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const [visited, setVisited] = useState([]);
    const [markedForReview, setMarkedForReview] = useState([]);

    // Proctoring & UI State
    const [tabSwitches, setTabSwitches] = useState(0);
    const [fullscreenExits, setFullscreenExits] = useState(0);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [mediaStatus, setMediaStatus] = useState('pending'); // pending, granted, denied
    const [resultId, setResultId] = useState(null);
    const [aiViolations, setAiViolations] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
            setIsMobile(mobileRegex.test(userAgent) || window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f1a] text-center p-10 font-sans">
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-8 border border-rose-500/20">
                <Monitor size={48} className="text-rose-500" />
            </div>
            <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Desktop Required</h1>
            <p className="text-slate-400 font-bold max-w-md leading-relaxed">
                Examination protocols require a desktop or laptop environment. Mobile access is strictly prohibited for security integrity.
            </p>
            <button 
                onClick={() => navigate('/student')}
                className="mt-10 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
            >
                Return to Dashboard
            </button>
        </div>
    );

    const submitExam = useCallback(async () => {
        try {
            const formattedAnswers = Object.keys(answers).map(qId => {
                const answer = answers[qId];
                return typeof answer === 'object'
                    ? { questionId: qId, ...answer }
                    : { questionId: qId, selectedOption: answer };
            });

            const res = await axios.post(`${API_BASE}/api/results`, {
                examId: id,
                answers: formattedAnswers,
                violations: { tabSwitches, fullscreenExits, aiViolations },
                timeTaken: (exam?.duration || 0) - timeLeft
            });

            if (res.data.success) {
                localStorage.removeItem(`exam_save_${id}`);
                toast.success('Exam submitted successfully!');
                navigate(`/student`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Submission failed');
        }
    }, [answers, tabSwitches, fullscreenExits, aiViolations, id, navigate, exam, timeLeft, API_BASE]);

    const handleJump = (idx) => {
        if (!exam?.questions?.[idx]) return;
        setCurrentIdx(idx);
        const qId = exam.questions[idx]._id;
        if (!visited.includes(qId)) setVisited([...visited, qId]);
    };

    const enterFullscreen = () => {
        document.documentElement.requestFullscreen().catch(() => {
            toast.error('Failed to enter fullscreen');
        });
    };

    const [socket, setSocket] = useState(null);

    // Socket Connection
    useEffect(() => {
        const saved = localStorage.getItem('user');
        if (!saved) return;
        const user = JSON.parse(saved);

        const socketUrl = (window.location.hostname.includes('loca.lt') || window.location.hostname.includes('trycloudflare.com'))
            ? 'https://green-ears-first-donated.trycloudflare.com'
            : `http://${window.location.hostname}:5000`;

        const s = io(socketUrl, {
            reconnectionAttempts: 5,
            reconnectionDelay: 5000,
        });
        setSocket(s);

        s.on('connect', () => {
            console.log("Exam Session Socket Connected");
            s.emit('join-exam', { examId: id, userId: user._id, role: 'student' });
        });

        s.on('session-suspended', (data) => {
            if (data.examId === id) {
                setExam(prev => ({ ...prev, status: 'Suspended', suspensionReason: data.reason }));
                localStorage.removeItem(`exam_save_${id}`);
                toast.error('Session suspended by admin', { duration: 10000 });
            }
        });

        return () => s.disconnect();
    }, [id]);

    // Initial Fetch
    useEffect(() => {
        const fetchExam = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/exams/${id}`);
                let examData = res.data.data;
                if (examData.status === 'Stopped') {
                    toast.error('This session has concluded.');
                    return navigate('/student');
                }

                const saved = localStorage.getItem(`exam_save_${id}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.shuffledQuestions) {
                        examData.questions = parsed.shuffledQuestions;
                    } else if (examData.questions) {
                        const q = [...examData.questions];
                        for (let i = q.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [q[i], q[j]] = [q[j], q[i]];
                        }
                        examData.questions = q;
                    }
                    const firstQId = examData.questions?.[0]?._id || null;
                    setAnswers(parsed.answers || {});
                    setMarkedForReview(parsed.marked || []);
                    setVisited(parsed.visited || (firstQId ? [firstQId] : []));
                } else {
                    if (examData.questions) {
                        const q = [...examData.questions];
                        for (let i = q.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [q[i], q[j]] = [q[j], q[i]];
                        }
                        examData.questions = q;
                    }
                    const firstQId = examData.questions?.[0]?._id || null;
                    setVisited(firstQId ? [firstQId] : []);
                }

                setExam(examData);
                setTimeLeft(examData.duration);

                // Initialize/Register attempt
                try {
                    const startRes = await axios.post(`${API_BASE}/api/results/start`, { examId: id });
                    setResultId(startRes.data.data._id);

                    // Check if already suspended from DB on initial load
                    if (startRes.data.data.status === 'Suspended') {
                        setExam(prev => ({ ...prev, status: 'Suspended', suspensionReason: startRes.data.data.suspensionReason }));
                    }
                } catch (e) { console.error("Start recording failed", e); }

                setLoading(false);
            } catch (err) {
                toast.error('Load failure');
                navigate('/student');
            }
        };
        fetchExam();
    }, [id, navigate, API_BASE]);

    // Timer logic
    useEffect(() => {
        if (loading || !exam || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); submitExam(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [loading, exam, timeLeft, submitExam]);

    // Auto-save
    useEffect(() => {
        if (!loading && exam) {
            localStorage.setItem(`exam_save_${id}`, JSON.stringify({
                answers, marked: markedForReview, visited,
                shuffledQuestions: exam.questions
            }));
        }
    }, [answers, markedForReview, visited, loading, id, exam]);

    // Tab Switch
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                setTabSwitches(s => s + 1);
                const currentViolations = tabSwitches + fullscreenExits + aiViolations + 1;
                const remaining = VIOLATION_LIMIT - currentViolations;

                if (remaining > 0) {
                    toast.error(`TAB SWITCH DETECTED! Warning: ${remaining} chances remaining before session termination.`, {
                        duration: 8000,
                        style: { backgroundColor: '#991b1b', color: '#fff', fontWeight: 'bold' }
                    });
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [tabSwitches, fullscreenExits, aiViolations]);

    // Navigation Lock & BeforeUnload
    useEffect(() => {
        // Push state to prevent back navigation
        window.history.pushState(null, null, window.location.pathname);

        const handlePopState = () => {
            window.history.pushState(null, null, window.location.pathname);
            toast.error('BACK BUTTON DETECTED! Navigation is locked. Continued attempts will result in IMMEDIATE session termination.', {
                duration: 6000,
                style: { background: '#000', color: '#f87171', border: '1px solid #f87171', fontWeight: '900' }
            });
            setFullscreenExits(e => e + 1); // Treat as violation
        };

        const handleBeforeUnload = (e) => {
            const msg = "Are you sure you want to exit? Your exam session will be terminated and auto-submitted.";
            e.preventDefault();
            e.returnValue = msg;
            return msg;
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // Fullscreen detection
    useEffect(() => {
        const handleFullscreen = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                setFullscreenExits(e => e + 1);
                const currentViolations = tabSwitches + fullscreenExits + aiViolations + 1;
                const remaining = VIOLATION_LIMIT - currentViolations;

                if (remaining > 0) {
                    toast.error(`FULLSCREEN EXITED! Warning: ${remaining} chances remaining. Re-enter fullscreen immediately or the session will terminate.`, {
                        duration: 8000,
                        style: { backgroundColor: '#000', color: '#fff', border: '2px solid #ef4444', fontWeight: 'bold' }
                    });
                }
            } else {
                setIsFullscreen(true);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreen);
        return () => document.removeEventListener('fullscreenchange', handleFullscreen);
    }, [tabSwitches, fullscreenExits, aiViolations]);

    // Sync violations with server
    useEffect(() => {
        if (!resultId) return;
        const syncViolations = async () => {
            try {
                await axios.patch(`${API_BASE}/api/results/${resultId}/session`, {
                    violations: { tabSwitches, fullscreenExits, aiViolations }
                });
            } catch (e) { }
        };
        syncViolations();
    }, [tabSwitches, fullscreenExits, aiViolations, resultId, API_BASE]);

    // Violation limit
    useEffect(() => {
        const totalViolations = tabSwitches + fullscreenExits + aiViolations;
        if (totalViolations >= VIOLATION_LIMIT) {
            toast.error('Violation limit reached! Auto-submitting...', { duration: 5000 });
            submitExam();
        }
    }, [tabSwitches, fullscreenExits, aiViolations, submitExam]);

    // Right-click & Copy-Paste Prevention & Anti-Screenshot
    useEffect(() => {
        const prevent = (e) => e.preventDefault();

        const handleKeyDown = (e) => {
            // Block common screenshot shortcuts and PrintScreen
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                setTabSwitches(s => s + 1);
                toast.error('Screenshot attempt detected! Violation recorded.', { duration: 5000 });
                return false;
            }

            // Win/Cmd + Shift + S (Snipping Tool)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
                setTabSwitches(s => s + 1);
                toast.error('Screen capture tool detected! Violation recorded.', { duration: 5000 });
            }

            // Block developer tools (F12, Ctrl+Shift+I/J, Ctrl+U)
            if (e.keyCode === 123 ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                ((e.ctrlKey || e.metaKey) && e.key === 'u')) {
                e.preventDefault();
                toast.error('Developer tools are restricted.', { duration: 3000 });
                return false;
            }
        };

        const handleBlur = () => {
            // Blur happens when user opens another app or screenshot tool
            setTabSwitches(s => s + 1);
            toast.error('Focus loss detected! Do not leave the exam window or use external software.', {
                duration: 5000,
                style: { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }
            });
        };

        document.addEventListener('contextmenu', prevent);
        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('selectstart', prevent);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('selectstart', prevent);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);


    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#60a5fa', fontWeight: 700, fontSize: '18px' }}>
            Synchronizing Terminal...
        </div>
    );

    if (exam?.status === 'Suspended') return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#fff', textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <ShieldAlert size={40} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em' }}>SESSION SUSPENDED</h1>
            <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem', lineHeight: 1.6 }}>
                Administrative intervention has terminated your session. <br />
                <b>Reason:</b> {exam.suspensionReason || 'Failure to follow examination protocols.'}
            </p>
            <button
                onClick={() => navigate('/student')}
                style={{ padding: '1rem 3rem', background: '#ef4444', color: '#fff', borderRadius: '1rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}
            >
                Return to Dashboard
            </button>
        </div>
    );

    const currentQuestion = exam.questions?.[currentIdx] || null;
    const stats = {
        answered: Object.keys(answers).length,
        total: exam.questions?.length || 0
    };

    /* ── Shared vertical sidebar renderer ── */
    const QSidebar = () => (
        <aside style={{
            width: '58px',
            background: '#13131f',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '14px',
            paddingBottom: '14px',
            gap: '9px',
            overflowY: 'auto',
            flexShrink: 0,
        }}>
            {/* Label */}
            <span style={{
                fontSize: '7px', fontWeight: '900', color: '#475569',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '4px', display: 'block'
            }}>Q No.</span>

            {(exam.questions || []).map((q, idx) => {
                const isAnswered = !!answers[q._id];
                const isCurrent = idx === currentIdx;

                let bg = '#fee2e2';
                let textColor = '#dc2626';
                let border = '2px solid #fca5a5';
                if (isAnswered) {
                    bg = '#dcfce7';
                    textColor = '#16a34a';
                    border = '2px solid #86efac';
                }
                let boxShadow = 'none';
                if (isCurrent) boxShadow = '0 0 0 3px #3b82f6, 0 0 0 5px rgba(59,130,246,0.25)';

                return (
                    <button
                        key={q._id}
                        onClick={() => handleJump(idx)}
                        title={`Q${idx + 1} – ${isAnswered ? 'Answered' : 'Not Answered'}`}
                        style={{
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: bg, border, boxShadow,
                            color: textColor, fontSize: '11px', fontWeight: '800',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', transition: 'all 0.15s ease',
                            flexShrink: 0, fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.13)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        {idx + 1}
                    </button>
                );
            })}

            {/* Legend */}
            <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dcfce7', border: '1.5px solid #86efac' }} />
                    <span style={{ fontSize: '6px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Done</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fee2e2', border: '1.5px solid #fca5a5' }} />
                    <span style={{ fontSize: '6px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pend</span>
                </div>
            </div>
        </aside>
    );

    const totalViolations = tabSwitches + fullscreenExits + aiViolations;

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            background: '#0f0f1a',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, sans-serif',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0
        }}>
            {/* ── LANDSCAPE ORIENTATION GATE ── */}
            <style>{`
                @media (orientation: portrait) {
                    #orientation-gate { display: flex !important; }
                }
            `}</style>
            <div id="orientation-gate" style={{
                position: 'fixed', inset: 0, background: '#0f0f1a', zIndex: 9999,
                display: 'none', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', textAlign: 'center', padding: '40px'
            }}>
                <div style={{ transform: 'rotate(-90deg)', marginBottom: '30px' }}>
                    <Monitor size={64} color="#60a5fa" />
                </div>
                <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>Rotate Your Device</h2>
                <p style={{ color: '#94a3b8', marginTop: '10px' }}>This assessment protocol requires landscape orientation for optimal visibility.</p>
            </div>

            {/* ── TOP HEADER ── */}
            <header style={{
                height: '56px', flexShrink: 0,
                background: '#13131f',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 60,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h1 style={{
                        fontSize: '14px', fontWeight: '900',
                        background: 'linear-gradient(90deg, #60a5fa, #818cf8)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                    }}>
                        {exam.title}
                    </h1>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>
                        <ShieldAlert size={14} style={{ color: totalViolations > 0 ? '#f59e0b' : '#94a3b8' }} />
                        Violations:&nbsp;
                        <span style={{ color: totalViolations > 0 ? '#f87171' : '#34d399', fontWeight: '900' }}>
                            {totalViolations}/{VIOLATION_LIMIT}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Progress pill */}
                    <div style={{
                        padding: '4px 12px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '99px',
                        fontSize: '11px', fontWeight: '700', color: '#94a3b8',
                    }}>
                        {stats.answered}<span style={{ color: '#475569' }}>/{stats.total}</span> answered
                    </div>

                    <Timer timeLeft={timeLeft} onWarning={() => toast('Final 5 minutes!', { icon: '⏰' })} />

                    <button
                        onClick={() => setShowSubmitModal(true)}
                        style={{
                            background: '#2563eb', color: '#fff',
                            padding: '8px 20px', borderRadius: '10px',
                            fontWeight: '800', fontSize: '13px', border: 'none',
                            cursor: 'pointer', letterSpacing: '0.02em',
                            boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                    >
                        Submit Exam
                    </button>
                </div>
            </header>

            {/* ── FULLSCREEN GATE ── */}
            {!isFullscreen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,15,26,0.96)',
                    zIndex: 100, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px',
                    overflowY: 'auto'
                }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <Maximize2 size={36} style={{ color: '#60a5fa' }} />
                    </div>
                    <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>Fullscreen Required</h2>
                    <p style={{ color: '#64748b', maxWidth: '400px', marginBottom: '32px', lineHeight: 1.6 }}>
                        This exam requires fullscreen mode to ensure academic integrity.
                    </p>
                    <button
                        onClick={enterFullscreen}
                        style={{
                            background: '#2563eb', color: '#fff', padding: '14px 40px',
                            borderRadius: '12px', fontWeight: '800', fontSize: '15px',
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                        }}
                    >
                        Enter Fullscreen
                    </button>
                </div>
            )}

            {/* ── MAIN CONTENT: sidebar + question (SAME for all types) ── */}
            <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <QSidebar />

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <QuestionCard
                        question={currentQuestion}
                        index={currentIdx}
                        totalQuestions={exam.questions?.length || 0}
                        selectedAnswer={currentQuestion ? answers[currentQuestion._id] : null}
                        onSelect={(val) => currentQuestion && setAnswers({ ...answers, [currentQuestion._id]: val })}
                        onPrev={() => handleJump(Math.max(0, currentIdx - 1))}
                        onNext={() => handleJump(Math.min((exam.questions?.length || 1) - 1, currentIdx + 1))}
                        isFirst={currentIdx === 0}
                        isLast={currentIdx === (exam.questions?.length || 1) - 1}
                    />
                </div>
            </main>

            <WebcamMonitor
                allowCamera={exam?.proctoring?.camera ?? true}
                allowMicrophone={exam?.proctoring?.microphone ?? false}
                onStatusChange={(status) => setMediaStatus(status)}
                examResultId={resultId}
                onViolation={(reason) => {
                    setAiViolations(v => v + 1);
                    const remaining = VIOLATION_LIMIT - (tabSwitches + fullscreenExits + aiViolations + 1);
                    if (remaining >= 0) {
                        toast.error(`AI PROCTORING ALERT: ${reason}. Warning: ${remaining} chances remaining.`, {
                            duration: 6000,
                            style: { backgroundColor: '#ef4444', color: '#fff', fontWeight: 'bold' }
                        });
                    }
                }}
            />

            {/* ── MEDIA ACCESS GATE ── */}
            {(mediaStatus === 'denied' || mediaStatus === 'not-found') && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,15,26,0.98)',
                    zIndex: 200, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px',
                }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                        {exam?.proctoring?.camera && <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraOff size={32} style={{ color: '#ef4444' }} /></div>}
                        {exam?.proctoring?.microphone && <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MicOff size={32} style={{ color: '#ef4444' }} /></div>}
                    </div>
                    <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>
                        {mediaStatus === 'not-found' ? 'Hardware Not Detected' : 'Access Denied'}
                    </h2>
                    <p style={{ color: '#64748b', maxWidth: '450px', marginBottom: '32px', lineHeight: 1.6 }}>
                        {mediaStatus === 'not-found'
                            ? `We couldn't detect a required ${exam?.proctoring?.camera ? 'camera' : ''} ${exam?.proctoring?.camera && exam?.proctoring?.microphone ? 'or' : ''} ${exam?.proctoring?.microphone ? 'microphone' : ''}. Please plug in the necessary hardware and refresh.`
                            : `You have blocked camera/microphone access. This exam cannot be taken without active monitoring. Please enable permissions in your browser settings and refresh.`
                        }
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#2563eb', color: '#fff', padding: '14px 40px',
                            borderRadius: '12px', fontWeight: '800', fontSize: '15px',
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                        }}
                    >
                        Refresh & Try Again
                    </button>
                </div>
            )}

            {showSubmitModal && (
                <SubmitConfirmation
                    stats={stats}
                    onCancel={() => setShowSubmitModal(false)}
                    onConfirm={submitExam}
                />
            )}
        </div>
    );
};

export default ExamPage;
