import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import LoadingScreen from '../components/LoadingScreen';
import { 
    ArrowLeft, Edit2, Play, Square, Trash2, Plus, 
    CheckCircle2, Clock, Settings, Award, Calendar, Rocket,
    Cpu, Code, CheckSquare, X, Save, AlertCircle, PlusCircle, Eye, EyeOff, Power, ShieldOff, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import ConfirmModal from '../components/ConfirmModal';

const getInitialArray = (val) => {
    if (Array.isArray(val)) return val.length > 0 ? val : [''];
    if (typeof val === 'string' && val.trim()) {
        return val.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [''];
};

const getInitialExamples = (meta) => {
    if (Array.isArray(meta.examples) && meta.examples.length > 0) {
        return meta.examples;
    }
    if (meta.sampleInput || meta.sampleOutput) {
        return [{ input: meta.sampleInput || '', output: meta.sampleOutput || '', explanation: '' }];
    }
    return [{ input: '', output: '', explanation: '' }];
};

const ExamDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);

    const getLocalISO = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString();
    };
    const minDate = getLocalISO(new Date()).split('T')[0];

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Confirm',
        type: 'danger'
    });

    const triggerConfirm = ({ title, message, onConfirm, confirmText = 'Confirm', type = 'danger' }) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            },
            confirmText,
            type
        });
    };

    const handleEraseExam = () => {
        triggerConfirm({
            title: 'Erase Exam Blueprint',
            message: `Are you sure you want to permanently erase "${exam?.title}"? This action cannot be undone.`,
            confirmText: 'Erase Exam',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/exams/${id}`); 
                    navigate('/admin'); 
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Erase sequence compromised');
                }
            }
        });
    };
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    const resolveImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${API_BASE}${url}`;
    };

    // Modal States
    const [showExamModal, setShowExamModal] = useState(false);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishDepartments, setPublishDepartments] = useState(['All']);
    const [availableDepartments, setAvailableDepartments] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [starterLang, setStarterLang] = useState('python');
    const [uploading, setUploading] = useState(false);

    // Form States
    const [examForm, setExamForm] = useState({ title: '', duration: 30, scheduledDate: '', startTime: '', passingMarks: 0 });
    const [qForm, setQForm] = useState({ 
        type: 'MCQ',
        questionText: '',
        marks: 1,
        options: ['', '', '', ''],
        correctAnswer: '',
        difficulty: 'Medium',
        images: [{ url: '', purpose: '', scale: 100 }],
        codingMetadata: {
            problemDescription: '',
            inputDescription: [''],
            outputDescription: [''],
            constraints: [''],
            sampleInput: '',
            sampleOutput: '',
            examples: [{ input: '', output: '', explanation: '' }],
            testCases: [{ input: '', expectedOutput: '', isVisible: true }],
            starterCode: {
                python: '',
                java: '',
                cpp: '',
                c: '',
                javascript: ''
            }
        }
    });

    useEffect(() => {
        fetchExam();
    }, [id]);

    const fetchExam = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/exams/${id}`);
            const data = res.data.data;
            setExam(data);
            setExamForm({ 
                title: data.title, 
                duration: Math.round(data.duration / 60),
                scheduledDate: data.scheduledDate || '',
                startTime: data.startTime || '',
                passingMarks: data.passingMarks || '',
                proctoring: data.proctoring || { camera: true, microphone: false }
            });
        } catch (err) {
            toast.error('Builder synchronization failed');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateExam = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...examForm, duration: examForm.duration * 60, passingMarks: examForm.passingMarks ? Number(examForm.passingMarks) : 0 };
            await axios.put(`${API_BASE}/api/exams/${id}`, payload);
            toast.success('Specifications Synchronized');
            setShowExamModal(false);
            fetchExam();
        } catch (err) {
            toast.error('Sync failed');
        }
    };

    const handleQuestionSubmit = async (e) => {
        e.preventDefault();
        try {
            const finalQForm = { ...qForm };
            if (finalQForm.type === 'Coding' && finalQForm.codingMetadata) {
                const examples = finalQForm.codingMetadata.examples || [];
                finalQForm.codingMetadata.sampleInput = examples[0]?.input || '';
                finalQForm.codingMetadata.sampleOutput = examples[0]?.output || '';
            }
            if (currentQuestion) {
                await axios.put(`${API_BASE}/api/questions/${currentQuestion._id}`, finalQForm);
                toast.success('Question Logic Updated');
            } else {
                const res = await axios.post(`${API_BASE}/api/questions`, finalQForm);
                const qId = res.data.data._id;
                await axios.put(`${API_BASE}/api/exams/${id}`, {
                    questions: [...exam.questions.map(q => q._id), qId]
                });
                toast.success('Logic Appended to Portfolio');
            }
            setShowQuestionModal(false);
            fetchExam();
        } catch (err) {
            toast.error('Injection failed');
        }
    };

    const openQModal = (q = null) => {
        if (q) {
            setCurrentQuestion(q);
            const meta = q.codingMetadata || {};
            setQForm({ 
                ...q, 
                marks: q.marks !== undefined ? q.marks : 1,
                difficulty: q.difficulty || 'Medium',
                codingMetadata: {
                    problemDescription: meta.problemDescription || '',
                    inputDescription: getInitialArray(meta.inputDescription),
                    outputDescription: getInitialArray(meta.outputDescription),
                    constraints: getInitialArray(meta.constraints),
                    sampleInput: meta.sampleInput || '',
                    sampleOutput: meta.sampleOutput || '',
                    examples: getInitialExamples(meta),
                    testCases: meta.testCases || [{ input: '', expectedOutput: '', isVisible: true }],
                    starterCode: meta.starterCode || { python: '', java: '', cpp: '', c: '', javascript: '' }
                } 
            });
        } else {
            setCurrentQuestion(null);
            setQForm({ 
                type: 'MCQ', 
                questionText: '', 
                marks: 1,
                options: ['', '', '', ''], 
                correctAnswer: '', 
                difficulty: 'Medium',
                images: [{ url: '', purpose: '', scale: 100 }],
                codingMetadata: { 
                    problemDescription: '', 
                    inputDescription: [''], 
                    outputDescription: [''], 
                    constraints: [''], 
                    sampleInput: '', 
                    sampleOutput: '', 
                    examples: [{ input: '', output: '', explanation: '' }],
                    testCases: [{ input: '', expectedOutput: '', isVisible: true }],
                    starterCode: { python: '', java: '', cpp: '', c: '', javascript: '' }
                } 
            });
        }
        setStarterLang('python');
        setShowQuestionModal(true);
    };

    const addTestCase = () => {
        setQForm({
            ...qForm,
            codingMetadata: {
                ...qForm.codingMetadata,
                testCases: [...qForm.codingMetadata.testCases, { input: '', expectedOutput: '', isVisible: false }]
            }
        });
    };

    const updateTestCase = (idx, field, val) => {
        const newCases = [...qForm.codingMetadata.testCases];
        newCases[idx][field] = val;
        setQForm({
            ...qForm,
            codingMetadata: { ...qForm.codingMetadata, testCases: newCases }
        });
    };

    const handleImageUpload = async (e, index) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            const res = await axios.post(`${API_BASE}/api/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newImages = [...qForm.images];
            newImages[index].url = res.data.url; // Use relative path
            setQForm({ ...qForm, images: newImages });
            toast.success('Asset Uplink Established');
        } catch (err) {
            toast.error('Uplink failed');
        } finally {
            setUploading(false);
        }
    };

    const addImageField = () => {
        setQForm({
            ...qForm,
            images: [...qForm.images, { url: '', purpose: '', scale: 100 }]
        });
    };

    const removeImageField = (index) => {
        const newImages = [...qForm.images];
        newImages.splice(index, 1);
        setQForm({ ...qForm, images: newImages });
    };

    const updateImageField = (index, field, val) => {
        const newImages = [...qForm.images];
        newImages[index][field] = val;
        setQForm({ ...qForm, images: newImages });
    };

    if (loading) return <LoadingScreen message="Accessing Builder..." dark={false} fullScreen={true} />;
    if (!exam) return <div className="min-h-screen flex items-center justify-center">Record Expired</div>;
    const totalMarks = exam.questions.reduce((sum, q) => sum + (q.marks !== undefined ? Number(q.marks) : 1), 0);

    const withdrawExam = async () => {
        try {
            await axios.patch(`${API_BASE}/api/exams/${id}/withdraw`);
            toast.success('Exam withdrawn from student screens');
            fetchExam();
        } catch (err) {
            toast.error('Withdrawal failed');
        }
    };

    const openPublishModal = () => {
        const hardcodedDepts = ['CSD', 'CSE', 'AIML', 'AIDS', 'CEE', 'BMRE'];
        setAvailableDepartments(hardcodedDepts);
        setShowPublishModal(true);
    };

    const togglePublishDepartment = (dept) => {
        if (dept === 'All') {
            setPublishDepartments(['All']);
            return;
        }
        let newSelected = publishDepartments.filter(d => d !== 'All');
        if (newSelected.includes(dept)) {
            newSelected = newSelected.filter(d => d !== dept);
        } else {
            newSelected.push(dept);
        }
        if (newSelected.length === 0) newSelected = ['All'];
        setPublishDepartments(newSelected);
    };

    const handlePublishConfirm = async (e) => {
        e.preventDefault();
        try {
            await axios.patch(`${API_BASE}/api/exams/${id}/publish`, { targetDepartments: publishDepartments });
            toast.success('Assessment Published Successfully');
            setShowPublishModal(false);
            fetchExam();
        } catch (err) {
            toast.error('Publishing failed');
        }
    };


    const endExam = async () => {
        try {
            await axios.patch(`${API_BASE}/api/exams/${id}/stop`);
            toast.success('Exam session terminated');
            fetchExam();
        } catch (err) {
            toast.error('End session failed');
        }
    };

    const restartExam = async () => {
        try {
            await axios.patch(`${API_BASE}/api/exams/${id}/restart`);
            toast.success('Assessment Protocol Reactivated');
            fetchExam();
        } catch (err) {
            toast.error('Restoration failed');
        }
    };

    const isHosted = exam.status === 'Published' || exam.status === 'Ongoing';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <Navbar />
            
            <main className="max-w-6xl mx-auto w-full p-4 md:p-8">
                <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold mb-8 transition-colors group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-all" /> Dashboard
                </button>

                <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-10 md:p-14 shadow-2xl border border-slate-100 mb-8 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                        <div className="flex-1 w-full">
                           <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">{exam.title}</h1>
                                <div className="w-fit"><StatusBadge status={exam.status} /></div>
                           </div>
                           <div className="flex flex-wrap items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm"><Clock size={14} className="text-blue-500" /> {Math.round(exam.duration/60)} MINS</div>
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm"><CheckSquare size={14} className="text-emerald-500" /> {exam.questions?.length} Qs</div>
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm"><Award size={14} className="text-amber-500" /> {totalMarks} MARKS</div>
                                {exam.scheduledDate && (
                                    <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-2xl border border-blue-100 shadow-sm w-full sm:w-auto justify-center sm:justify-start">
                                        <Calendar size={14} /> {exam.scheduledDate} {exam.startTime && `@ ${exam.startTime}`}
                                    </div>
                                )}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full md:w-auto">
                             <StatusToggle exam={exam} onPublish={openPublishModal} onUpdate={fetchExam} onWithdraw={withdrawExam} onEnd={endExam} onRestart={restartExam} />
                             <button 
                                 disabled={isHosted}
                                 onClick={() => setShowExamModal(true)} 
                                 className={`p-4 rounded-2xl transition-all flex items-center justify-center min-h-[56px] ${
                                     isHosted 
                                         ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50 shadow-none' 
                                         : 'bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-900/10 active:scale-95'
                                 }`}
                             >
                                 <Edit2 size={22} />
                             </button>
                             <button 
                                 disabled={isHosted}
                                 onClick={handleEraseExam} 
                                 className={`p-4 rounded-2xl transition-all border flex items-center justify-center min-h-[56px] ${
                                     isHosted 
                                         ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50 shadow-none' 
                                         : 'bg-slate-50 text-slate-400 border border-slate-200 hover:text-red-600 hover:border-red-100 hover:bg-red-50 active:scale-95'
                                 }`}
                             >
                                 <Trash2 size={22} />
                             </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-10 md:pt-16">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 md:mb-12 gap-6">
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Question Portfolio</h3>
                            <button 
                                disabled={isHosted}
                                onClick={() => openQModal()} 
                                className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                                    isHosted 
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-500/30 active:scale-95'
                                }`}
                            >
                                <Plus size={20} /> Add Question
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            {exam.questions.map((q, idx) => (
                                <motion.div whileHover={{ y: -4 }} key={q._id} className="p-6 md:p-10 bg-slate-50 rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 group transition-all flex flex-col md:flex-row items-start gap-6 md:gap-10 shadow-sm hover:shadow-xl hover:bg-white">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-[1rem] md:rounded-[1.5rem] flex items-center justify-center font-black text-blue-600 shrink-0 shadow-lg border border-slate-100 text-xl md:text-2xl">
                                        Q{idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-6">
                                            <p className="font-bold text-slate-800 text-xl leading-tight tracking-tight">{q.questionText}</p>
                                            {!isHosted && (
                                                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => openQModal(q)} className="p-3 text-blue-600 bg-white border border-blue-50 rounded-[1rem] hover:shadow-lg transition-all"><Edit2 size={20} /></button>
                                                    <button onClick={() => {
                                                        triggerConfirm({
                                                            title: 'Erase Question Protocol',
                                                            message: 'Are you sure you want to permanently remove this question from the exam portfolio?',
                                                            confirmText: 'Erase Question',
                                                            onConfirm: async () => {
                                                                try {
                                                                    await axios.delete(`${API_BASE}/api/questions/${q._id}`); 
                                                                    fetchExam(); 
                                                                } catch (err) {
                                                                    toast.error('Removal sequence failed');
                                                                }
                                                            }
                                                        });
                                                    }} className="p-3 text-red-500 bg-white border border-red-50 rounded-[1rem] hover:shadow-lg transition-all"><Trash2 size={20} /></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <span className="text-[10px] font-black tracking-widest uppercase px-4 py-2 bg-slate-900 text-white rounded-xl flex items-center gap-3">
                                                {q.type === 'Coding' ? <Code size={14} /> : q.type === 'MCQ' ? <CheckSquare size={14} /> : <AlertCircle size={14} />} {q.type}
                                            </span>
                                            <span className="text-[10px] font-black tracking-[0.1em] text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl uppercase">
                                                {q.marks !== undefined ? q.marks : 1} Marks
                                            </span>
                                            <span className="text-[10px] font-black tracking-[0.1em] text-slate-400 bg-white border border-slate-100 px-4 py-2 rounded-xl uppercase">Expect: {q.correctAnswer || 'Evaluated'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <AnimatePresence>
                {/* Exam Settings Modal */}
                {showExamModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }} 
                            className="bg-white rounded-[3.5rem] w-full max-w-4xl p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto"
                        >
                            <button onClick={() => setShowExamModal(false)} className="absolute right-10 top-10 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all"><X size={28} /></button>
                            <h2 className="text-3xl font-black mb-10 flex items-center gap-3 tracking-tight"><Settings className="text-blue-600" /> Assessment Settings</h2>
                            <form onSubmit={handleUpdateExam} className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Designation</label>
                                    <input type="text" required value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Duration (Minutes)</label>
<input type="number" min="1" required value={examForm.duration} onChange={e => setExamForm({...examForm, duration: Number(e.target.value)})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                    
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Minimum Marks (To Pass)</label>
                                    <input type="number" required value={examForm.passingMarks} onChange={e => setExamForm({...examForm, passingMarks: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. 35" />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Scheduled Date</label>
                                        <input type="date" min={minDate} value={examForm.scheduledDate} onChange={e => setExamForm({...examForm, scheduledDate: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Start Time</label>
                                        <input type="time" value={examForm.startTime} onChange={e => setExamForm({...examForm, startTime: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Webcamera Monitoring</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Access Camera</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setExamForm({ ...examForm, proctoring: { ...examForm.proctoring, camera: !examForm.proctoring?.camera } })}
                                            className={`w-14 h-7 rounded-full transition-all relative ${examForm.proctoring?.camera ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${examForm.proctoring?.camera ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Microphone Access</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Audio Stream</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setExamForm({ ...examForm, proctoring: { ...examForm.proctoring, microphone: !examForm.proctoring?.microphone } })}
                                            className={`w-14 h-7 rounded-full transition-all relative ${examForm.proctoring?.microphone ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${examForm.proctoring?.microphone ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-2xl active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px]">Execute Synchronize</button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Question Builder Modal */}
                {showQuestionModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4">
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl relative">
                            <div className="p-6 sm:p-10 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-2 uppercase">{currentQuestion ? 'Modify Logic' : 'New Logic Injection'}</h2>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                        <PlusCircle size={12} /> Instance: Q{exam.questions.length + (currentQuestion ? 0 : 1)}
                                    </p>
                                </div>
                                <button onClick={() => setShowQuestionModal(false)} className="p-3 sm:p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all"><X size={24} /></button>
                            </div>

                            <form onSubmit={handleQuestionSubmit} className="p-6 sm:p-10 overflow-y-auto custom-scrollbar flex-1 space-y-8 sm:space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 font-mono">Protocol Type</label>
                                        <select value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value})} className="w-full p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[1.5rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
                                            <option value="MCQ">Standard MCQ</option>
                                            <option value="TrueFalse">Binary logic</option>
                                            <option value="Coding">Coding Question</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 font-mono">Marks</label>
                                        <input type="number" min="0" required value={qForm.marks} onChange={e => setQForm({ ...qForm, marks: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[1.5rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 font-mono">Instruction Text</label>
                                        <textarea rows="3" required placeholder="Question instructions..." value={qForm.questionText} onChange={e => setQForm({...qForm, questionText: e.target.value})} className="w-full p-5 sm:p-8 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[2rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                                    </div>
                                    <div className="md:col-span-2 space-y-8">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Examination Visual Assets</label>
                                            <button type="button" onClick={addImageField} className="text-blue-600 font-black text-[10px] uppercase tracking-[0.1em] flex items-center gap-2 hover:text-blue-700 transition-all">
                                                <Plus size={16} /> Add Another Image
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {qForm.images.map((img, idx) => (
                                                <div key={idx} className="p-5 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100 flex flex-col gap-4 relative group/asset">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Asset #{idx+1} Source</label>
                                                            <div className="flex gap-2">
                                                                <input type="text" placeholder="URL or Uploaded Path" value={img.url} onChange={e => updateImageField(idx, 'url', e.target.value)} className="flex-1 p-3 bg-white border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                                                                <input type="file" id={`exam-img-${idx}`} accept="image/*" hidden onChange={(e) => handleImageUpload(e, idx)} />
                                                                <label htmlFor={`exam-img-${idx}`} className="shrink-0 p-3 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition-all shadow-md"><PlusCircle size={16}/></label>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Purpose / Name</label>
                                                            <input type="text" placeholder="e.g. Example 1: Diagram" value={img.purpose} onChange={e => updateImageField(idx, 'purpose', e.target.value)} className="w-full p-3 bg-white border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                                                        </div>
                                                    </div>
                                                    
                                                    {qForm.images.length > 1 && (
                                                        <button type="button" onClick={() => removeImageField(idx)} className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover/asset:opacity-100">
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    )}
                                                    {img.url && (
                                                        <div className="space-y-4 pt-2 border-t border-slate-200/60">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scale: {img.scale || 100}%</label>
                                                                <input 
                                                                    type="range" 
                                                                    min="10" 
                                                                    max="100" 
                                                                    value={img.scale || 100} 
                                                                    onChange={(e) => updateImageField(idx, 'scale', parseInt(e.target.value))}
                                                                    className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                                                                />
                                                            </div>
                                                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white mx-auto shadow-sm" style={{ width: `${img.scale || 100}%` }}>
                                                                <img src={resolveImageUrl(img.url)} alt="Preview" className="w-full h-auto block" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {qForm.type === 'MCQ' && (
                                    <div className="space-y-6 border-t border-slate-100 pt-8">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">Standardized Options</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                            {qForm.options.map((opt, i) => (
                                                <div key={i} className="relative flex items-center">
                                                    <span className="absolute left-4 font-black text-slate-200 text-xl">{String.fromCharCode(65 + i)}</span>
                                                    <input type="text" placeholder={`Option ${i+1}`} value={opt} onChange={e => { const n = [...qForm.options]; n[i] = e.target.value; setQForm({...qForm, options: n}); }} className="w-full pl-12 pr-6 py-4 sm:py-6 bg-slate-50 border rounded-xl sm:rounded-[1.5rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-4">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Correct Selection</label>
                                            <select value={qForm.correctAnswer} onChange={e => setQForm({...qForm, correctAnswer: e.target.value})} className="w-full p-4 sm:p-6 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl sm:rounded-[1.5rem] font-black text-xs sm:text-sm uppercase tracking-widest outline-none">
                                                <option value="">Pick target option</option>
                                                {qForm.options.map((opt, i) => <option key={i} value={opt}>{opt || `Empty Option ${String.fromCharCode(65+i)}`}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {qForm.type === 'TrueFalse' && (
                                    <div className="space-y-4 pt-4 border-t border-slate-100 pt-8">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono text-center">Boolean Verdict</label>
                                        <div className="flex gap-4 max-w-md mx-auto">
                                            {['True', 'False'].map(v => (
                                                <button 
                                                    key={v} 
                                                    type="button" 
                                                    onClick={() => setQForm({...qForm, correctAnswer: v, options: ['True', 'False']})} 
                                                    className={`flex-1 py-4 sm:py-6 rounded-xl sm:rounded-2xl font-black border-2 transition-all text-sm sm:text-base tracking-tight ${qForm.correctAnswer === v ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-200'}`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Coding Fields (HIGH PRIORITY) */}
                                {qForm.type === 'Coding' && (
                                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Difficulty Level</label>
                                                <div className="flex gap-4">
                                                    {['Easy', 'Medium', 'Hard'].map(level => (
                                                        <button
                                                            key={level}
                                                            type="button"
                                                            onClick={() => setQForm({ ...qForm, difficulty: level })}
                                                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                                                                qForm.difficulty === level
                                                                    ? level === 'Easy' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                                                    : level === 'Medium' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                                                                    : 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20'
                                                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {level}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Problem Statement</label>
                                                <textarea rows="4" placeholder="Detailed problem statement..." value={qForm.codingMetadata.problemDescription} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, problemDescription: e.target.value}})} className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[2rem] font-mono text-sm leading-relaxed focus:bg-white transition-all shadow-inner" />
                                            </div>
                                            <div className="md:col-span-1 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Input Description</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                inputDescription: [...qForm.codingMetadata.inputDescription, '']
                                                            }
                                                        })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {qForm.codingMetadata.inputDescription.map((desc, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Bullet point ${idx + 1}`}
                                                                value={desc}
                                                                onChange={e => {
                                                                    const newArr = [...qForm.codingMetadata.inputDescription];
                                                                    newArr[idx] = e.target.value;
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, inputDescription: newArr}});
                                                                }}
                                                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:bg-white transition-all outline-none"
                                                            />
                                                            {qForm.codingMetadata.inputDescription.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newArr = [...qForm.codingMetadata.inputDescription];
                                                                        newArr.splice(idx, 1);
                                                                        setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, inputDescription: newArr}});
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-1 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Output Description</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                outputDescription: [...qForm.codingMetadata.outputDescription, '']
                                                            }
                                                        })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {qForm.codingMetadata.outputDescription.map((desc, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Bullet point ${idx + 1}`}
                                                                value={desc}
                                                                onChange={e => {
                                                                    const newArr = [...qForm.codingMetadata.outputDescription];
                                                                    newArr[idx] = e.target.value;
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, outputDescription: newArr}});
                                                                }}
                                                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:bg-white transition-all outline-none"
                                                            />
                                                            {qForm.codingMetadata.outputDescription.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newArr = [...qForm.codingMetadata.outputDescription];
                                                                        newArr.splice(idx, 1);
                                                                        setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, outputDescription: newArr}});
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Constraints</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                constraints: [...qForm.codingMetadata.constraints, '']
                                                            }
                                                        })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {qForm.codingMetadata.constraints.map((c, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Bullet point ${idx + 1}`}
                                                                value={c}
                                                                onChange={e => {
                                                                    const newArr = [...qForm.codingMetadata.constraints];
                                                                    newArr[idx] = e.target.value;
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, constraints: newArr}});
                                                                }}
                                                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:bg-white transition-all outline-none"
                                                            />
                                                            {qForm.codingMetadata.constraints.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newArr = [...qForm.codingMetadata.constraints];
                                                                        newArr.splice(idx, 1);
                                                                        setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, constraints: newArr}});
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Sample Examples (Visible to Students)</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                examples: [...qForm.codingMetadata.examples, { input: '', output: '', explanation: '' }]
                                                            }
                                                        })}
                                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-100 transition-all shadow-sm outline-none"
                                                    >
                                                        <Plus size={14} /> Add Example
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-6">
                                                    {qForm.codingMetadata.examples.map((ex, idx) => (
                                                        <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 relative group/example shadow-sm">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Example {idx + 1}</span>
                                                                {qForm.codingMetadata.examples.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr.splice(idx, 1);
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Input</label>
                                                                    <textarea
                                                                        rows="2"
                                                                        placeholder="Input for this example..."
                                                                        value={ex.input}
                                                                        onChange={e => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr[idx].input = e.target.value;
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-4 focus:ring-blue-500/5 outline-none shadow-inner"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Output</label>
                                                                    <textarea
                                                                        rows="2"
                                                                        placeholder="Expected output..."
                                                                        value={ex.output}
                                                                        onChange={e => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr[idx].output = e.target.value;
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-4 focus:ring-blue-500/5 outline-none shadow-inner"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Explanation (Optional)</label>
                                                                    <textarea
                                                                        rows="2"
                                                                        placeholder="Explanation of how the input leads to the output..."
                                                                        value={ex.explanation || ''}
                                                                        onChange={e => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr[idx].explanation = e.target.value;
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-medium text-xs focus:ring-4 focus:ring-blue-500/5 outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Starter Code (Template)</label>
                                            </div>
                                            <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden">
                                                <div className="flex border-b border-slate-200 bg-white p-2 gap-2 overflow-x-auto">
                                                    {['python', 'java', 'cpp', 'c', 'javascript'].map(lang => (
                                                        <button
                                                            key={lang}
                                                            type="button"
                                                            onClick={() => setStarterLang(lang)}
                                                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${starterLang === lang ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                                                        >
                                                            {lang}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="h-[300px]">
                                                    <Editor
                                                        height="100%"
                                                        theme="vs-dark"
                                                        language={starterLang === 'c' ? 'cpp' : starterLang}
                                                        value={qForm.codingMetadata.starterCode?.[starterLang] || ''}
                                                        onChange={(val) => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                starterCode: {
                                                                    ...qForm.codingMetadata.starterCode,
                                                                    [starterLang]: val
                                                                }
                                                            }
                                                        })}
                                                        options={{
                                                            fontSize: 14,
                                                            minimap: { enabled: false },
                                                            scrollBeyondLastLine: false,
                                                            automaticLayout: true,
                                                            padding: { top: 20, bottom: 20 }
                                                        }}
                                                    />
                                                </div>
                                                <div className="p-4 bg-white border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                                    <AlertCircle size={14} /> This code will load as default for students selecting {starterLang}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Multiple Test Cases</label>
                                                <button type="button" onClick={addTestCase} className="px-6 py-3 bg-blue-50 text-blue-600 rounded-[1rem] text-[10px] font-black uppercase flex items-center gap-3 hover:bg-blue-100 transition-all shadow-lg shadow-blue-500/5"><Plus size={16} /> Append Case</button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-6">
                                                {qForm.codingMetadata.testCases.map((tc, i) => (
                                                    <div key={i} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative group/case shadow-sm hover:shadow-md transition-all">
                                                        <div className="flex items-center justify-between mb-6">
                                                            <div className="flex items-center gap-4">
                                                                <span className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 shadow-sm">#{i+1}</span>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => updateTestCase(i, 'isVisible', !tc.isVisible)}
                                                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-3 transition-all ${tc.isVisible ? 'bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-500/10' : 'bg-slate-200 text-slate-500'}`}
                                                                >
                                                                    {tc.isVisible ? <><Eye size={12} /> Visible (Sample)</> : <><EyeOff size={12} /> Hidden (Primary)</>}
                                                                </button>
                                                            </div>
                                                            {i > 0 && <button type="button" onClick={() => { const n = [...qForm.codingMetadata.testCases]; n.splice(i, 1); setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, testCases: n}})}} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"><Trash2 size={20} /></button>}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div>
                                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 font-bold">Test Case Input</label>
                                                                <textarea value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} className="w-full p-6 bg-white border border-slate-200 rounded-[1.5rem] font-mono text-xs focus:ring-4 focus:ring-blue-500/5 min-h-[100px] shadow-sm" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 font-bold">Expected Output</label>
                                                                <textarea value={tc.expectedOutput} onChange={e => updateTestCase(i, 'expectedOutput', e.target.value)} className="w-full p-6 bg-white border border-slate-200 rounded-[1.5rem] font-mono text-xs focus:ring-4 focus:ring-blue-500/5 min-h-[100px] shadow-sm" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="w-full py-7 bg-slate-900 text-white font-black rounded-[2rem] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 active:scale-[0.98] tracking-[0.2em] uppercase text-[10px]">
                                    <Save size={28} /> Deploy Assessment Logic
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
                {showPublishModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-lg p-6 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                            <button onClick={() => setShowPublishModal(false)} className="absolute right-6 top-6 sm:right-8 sm:top-8 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all z-10"><X size={24} /></button>
                            
                            <div className="mb-8">
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Publish Assessment</h2>
                                <p className="text-slate-500 text-[11px] sm:text-xs font-bold leading-relaxed max-w-[85%]">Select the target departments for this assessment. Selecting 'All' will make it available to everyone.</p>
                            </div>

                            <form onSubmit={handlePublishConfirm} className="space-y-8 overflow-hidden flex flex-col flex-1">
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                    <label className={`flex items-center gap-5 p-5 rounded-2xl cursor-pointer border-2 transition-all ${publishDepartments.includes('All') ? 'bg-blue-50 border-blue-600 shadow-lg shadow-blue-600/10' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${publishDepartments.includes('All') ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                            <input type="checkbox" className="hidden" checked={publishDepartments.includes('All')} onChange={() => togglePublishDepartment('All')} />
                                            {publishDepartments.includes('All') && <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />}
                                        </div>
                                        <span className={`font-black text-xs sm:text-sm uppercase tracking-widest ${publishDepartments.includes('All') ? 'text-blue-600' : 'text-slate-500'}`}>All Departments</span>
                                    </label>
                                    
                                    {availableDepartments.map(dept => (
                                        <label key={dept} className={`flex items-center gap-5 p-5 rounded-2xl cursor-pointer border-2 transition-all ${publishDepartments.includes(dept) ? 'bg-white border-blue-600 shadow-md' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${publishDepartments.includes(dept) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                                <input type="checkbox" className="hidden" checked={publishDepartments.includes(dept)} onChange={() => togglePublishDepartment(dept)} />
                                                {publishDepartments.includes(dept) && <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />}
                                            </div>
                                            <span className={`font-black text-xs sm:text-sm uppercase tracking-widest ${publishDepartments.includes(dept) ? 'text-slate-900' : 'text-slate-400'}`}>{dept}</span>
                                        </label>
                                    ))}
                                </div>
                                <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all">
                                    <Play size={18} fill="white" /> Execute Publish Protocol
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Premium Custom Confirmation Overlay */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                confirmText={confirmModal.confirmText}
                type={confirmModal.type}
            />
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const colors = { 
        Draft: 'bg-slate-100 text-slate-400', 
        Published: 'bg-blue-50 text-blue-600', 
        Ongoing: 'bg-emerald-50 text-emerald-600 animate-pulse', 
        Stopped: 'bg-red-50 text-red-600',
        Withdrawn: 'bg-amber-50 text-amber-600 border-amber-100'
    };
    return <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border shadow-sm ${colors[status] || 'bg-slate-50'}`}>{status}</span>;
};

const StatusToggle = ({ exam, onPublish, onUpdate, onWithdraw, onEnd, onRestart }) => {
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';
    const handlePublish = onPublish;

    return (
        <>
            {/* Contextual Status Buttons */}
            {(exam.status === 'Draft' || exam.status === 'Withdrawn') && (
                <button onClick={handlePublish} className="col-span-2 sm:flex-none px-6 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                    <Play size={18} fill="white" /> Publish
                </button>
            )}

            {(exam.status === 'Published' || exam.status === 'Ongoing') && (
                <>
                    <button onClick={onEnd} className="px-6 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <Power size={18} /> END
                    </button>
                    <button onClick={onWithdraw} className="px-6 py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <ShieldOff size={18} /> Withdraw
                    </button>
                </>
            )}

            {exam.status === 'Stopped' && (
                <>
                    <button onClick={onRestart} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <Plus size={18} /> Restart
                    </button>
                    <button onClick={onWithdraw} className="px-6 py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <ShieldOff size={18} /> Withdraw
                    </button>
                </>
            )}
        </>
    );
};

export default ExamDetails;
