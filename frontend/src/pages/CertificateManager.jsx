import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { Award, ChevronRight, Search, LayoutGrid, List } from 'lucide-react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import LoadingScreen from '../components/LoadingScreen';

const CertificateManager = () => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    const fetchExams = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/exams`);
            setExams(res.data.data);
        } catch (err) {
            console.error('Failed to load exams');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
    }, []);

    useEffect(() => {
        const socket = io(API_BASE);
        socket.on('data-updated', (data) => {
            if (data.type === 'exam') {
                console.log('CertificateManager: Exam updated, refetching...');
                fetchExams();
            }
        });
        return () => socket.disconnect();
    }, []);

    const filteredExams = exams.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col font-sans">
            <div className="w-full">
                <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 mb-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <Award className="text-amber-500" size={40} /> Certificate Forge
                            </h1>
                            <p className="text-slate-500 font-bold mt-2">Design and manage automated credentials for your assessments.</p>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search assessment..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 font-bold"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <LoadingScreen message="Synchronizing Forge..." dark={false} fullScreen={false} />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredExams.map(exam => (
                            <motion.div 
                                key={exam._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
                                        <Award size={32} />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${exam.status === 'Completed' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {exam.status}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">{exam.title}</h3>
                                <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest">
                                    {exam.questions?.length} Performance Nodes • {exam.duration / 60} Minute Window
                                </p>
                                <button 
                                    onClick={() => navigate(`/admin/certificate-designer/${exam._id}`)}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 group-hover:bg-amber-600 group-hover:shadow-lg group-hover:shadow-amber-600/20"
                                >
                                    Enter Designer <ChevronRight size={18} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CertificateManager;
