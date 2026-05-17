import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { 
    ArrowLeft, Edit2, Play, Square, Trash2, Plus, 
    CheckCircle2, Clock, Settings, Award, Calendar, Rocket,
    Cpu, Code, CheckSquare, X, Save, AlertCircle, PlusCircle, Eye, EyeOff, Power, ShieldOff, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';

const ExamDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const API_BASE = `http://${window.location.hostname}:5000`;

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
        images: [{ url: '', purpose: '', scale: 100 }],
        codingMetadata: {
            problemDescription: '',
            inputDescription: '',
            outputDescription: '',
            constraints: '',
            sampleInput: '',
            sampleOutput: '',
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
            if (currentQuestion) {
                await axios.put(`${API_BASE}/api/questions/${currentQuestion._id}`, qForm);
                toast.success('Question Logic Updated');
            } else {
                const res = await axios.post(`${API_BASE}/api/questions`, qForm);
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
                codingMetadata: {
                    problemDescription: meta.problemDescription || '',
                    inputDescription: meta.inputDescription || '',
                    outputDescription: meta.outputDescription || '',
                    constraints: meta.constraints || '',
                    sampleInput: meta.sampleInput || '',
                    sampleOutput: meta.sampleOutput || '',
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
                images: [{ url: '', purpose: '', scale: 100 }],
                codingMetadata: { 
                    problemDescription: '', 
                    inputDescription: '', 
                    outputDescription: '', 
                    constraints: '', 
                    sampleInput: '', 
                    sampleOutput: '', 
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

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-black text-blue-600 animate-pulse text-2xl tracking-tighter">ACCESSING BUILDER...</div>;
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
                             <button onClick={() => setShowExamModal(true)} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center justify-center min-h-[56px]"><Edit2 size={22} /></button>
                             <button onClick={async () => { 
                                 if(window.confirm('Erase entire portfolio?')) { 
                                    try {
                                        await axios.delete(`${API_BASE}/api/exams/${id}`); 
                                        navigate('/admin'); 
                                    } catch (err) {
                                        toast.error(err.response?.data?.message || 'Erase sequence compromised');
                                    }
                                 }
                             }} className="p-4 bg-slate-50 text-slate-400 hover:text-red-600 rounded-2xl transition-all border border-slate-200 active:scale-95 flex items-center justify-center min-h-[56px]"><Trash2 size={22} /></button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-10 md:pt-16">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 md:mb-12 gap-6">
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Question Portfolio</h3>
                            <button onClick={() => openQModal()} className="w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 shadow-2xl shadow-blue-500/30 active:scale-95 transition-all">
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
                                            <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openQModal(q)} className="p-3 text-blue-600 bg-white border border-blue-50 rounded-[1rem] hover:shadow-lg transition-all"><Edit2 size={20} /></button>
                                                <button onClick={async () => { 
                                                    if(window.confirm('Remove from portfolio?')) { 
                                                        try {
                                                            await axios.delete(`${API_BASE}/api/questions/${q._id}`); 
                                                            fetchExam(); 
                                                        } catch (err) {
                                                            toast.error('Removal sequence failed');
                                                        }
                                                    }
                                                }} className="p-3 text-red-500 bg-white border border-red-50 rounded-[1rem] hover:shadow-lg transition-all"><Trash2 size={20} /></button>
                                            </div>
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
                                        <input type="date" value={examForm.scheduledDate} onChange={e => setExamForm({...examForm, scheduledDate: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
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
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Problem Statement</label>
                                                <textarea rows="4" placeholder="Detailed problem statement..." value={qForm.codingMetadata.problemDescription} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, problemDescription: e.target.value}})} className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[2rem] font-mono text-sm leading-relaxed focus:bg-white transition-all shadow-inner" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Input Description</label>
                                                <textarea rows="2" placeholder="Describe input format..." value={qForm.codingMetadata.inputDescription} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, inputDescription: e.target.value}})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-medium text-xs focus:bg-white transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Output Description</label>
                                                <textarea rows="2" placeholder="Describe output format..." value={qForm.codingMetadata.outputDescription} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, outputDescription: e.target.value}})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-medium text-xs focus:bg-white transition-all" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Constraints</label>
                                                <input type="text" placeholder="e.g., 1 <= N <= 10^5" value={qForm.codingMetadata.constraints} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, constraints: e.target.value}})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1rem] font-black text-xs" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Sample Input</label>
                                                <textarea rows="2" placeholder="Sample input for students..." value={qForm.codingMetadata.sampleInput} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, sampleInput: e.target.value}})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-mono text-xs focus:bg-white transition-all shadow-inner" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 font-mono">Sample Output</label>
                                                <textarea rows="2" placeholder="Expected sample output..." value={qForm.codingMetadata.sampleOutput} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, sampleOutput: e.target.value}})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-mono text-xs focus:bg-white transition-all shadow-inner" />
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
    const API_BASE = `http://${window.location.hostname}:5000`;
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
