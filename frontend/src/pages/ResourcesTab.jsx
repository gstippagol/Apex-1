import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Book, Video, Image, FileText, Plus, Trash2, 
    ExternalLink, Eye, X, Send, Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';
import LoadingScreen from '../components/LoadingScreen';

const ResourcesTab = () => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [viewingResource, setViewingResource] = useState(null);
    const [form, setForm] = useState({ title: '', link: '', type: 'Link', category: 'General' });

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
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/resources`);
            setResources(res.data.data);
        } catch (err) {
            toast.error('Library sync failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/api/resources`, form);
            toast.success('Resource added to library');
            setShowAddModal(false);
            setForm({ title: '', link: '', type: 'Link', category: 'General' });
            fetchResources();
        } catch (err) {
            toast.error('Creation failed');
        }
    };

    const handleDelete = async (id, resourceTitle = 'this resource') => {
        triggerConfirm({
            title: 'Erase Academic Record',
            message: `Are you sure you want to permanently erase "${resourceTitle}" from the library? This action is irreversible.`,
            confirmText: 'Erase Resource',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/resources/${id}`);
                    toast.success('Resource eliminated');
                    fetchResources();
                } catch (err) {
                    toast.error('Deletion failed');
                }
            }
        });
    };

    const getEmbedLink = (url) => {
        if (!url) return '';
        
        // Handle Google Drive
        if (url.includes('drive.google.com')) {
            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
        }
        
        // Handle YouTube
        if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }
        
        // Return original URL for other direct links (PDF, Image, etc.)
        return url;
    };

    const ResourceIcon = ({ type }) => {
        switch (type) {
            case 'PDF': return <FileText className="text-rose-500" />;
            case 'Video': return <Video className="text-blue-500" />;
            case 'Image': return <Image className="text-emerald-500" />;
            default: return <Book className="text-amber-500" />;
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm gap-6">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Academic Library</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage shared study materials and assets</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                    <Plus size={18} /> New Resource
                </button>
            </div>

            {loading ? (
                <LoadingScreen message="Synchronizing Repository..." dark={false} fullScreen={false} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {resources.map(r => (
                        <div key={r._id} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                                    <ResourceIcon type={r.type} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setViewingResource(r)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Eye size={18} /></button>
                                    <button onClick={() => handleDelete(r._id, r.title)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                            <h4 className="text-lg font-black text-slate-800 mb-1 truncate">{r.title}</h4>
                            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-50">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.category}</span>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-3 py-1 bg-blue-50 rounded-full">{r.type}</span>
                            </div>
                        </div>
                    ))}
                    {resources.length === 0 && (
                        <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                            <Book size={48} className="mb-4 opacity-20" />
                            <p className="text-xs font-black uppercase tracking-widest">No resources catalogued</p>
                        </div>
                    )}
                </div>
            )}

            {/* Add Resource Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-lg rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Add New Resource</h3>
                            <form onSubmit={handleAdd} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Title</label>
                                    <input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" placeholder="e.g. Data Structures PDF" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Link (Drive, YouTube, or direct PDF/Image link)</label>
                                    <input type="url" required value={form.link} onChange={e => setForm({...form, link: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none placeholder:font-medium" placeholder="https://..." />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Type</label>
                                        <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none">
                                            <option value="PDF">PDF Document</option>
                                            <option value="Video">Video File</option>
                                            <option value="Image">Visual Aid</option>
                                            <option value="Link">External Link</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Classification</label>
                                        <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" placeholder="e.g. Unit 1" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95">
                                    Add to Library
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Viewer Modal */}
            <AnimatePresence>
                {viewingResource && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingResource(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white w-full h-full rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col">
                            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><ResourceIcon type={viewingResource.type} /></div>
                                    <div>
                                        <h4 className="font-black text-slate-900 tracking-tight">{viewingResource.title}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest underline decoration-blue-600/20">{viewingResource.link}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <a href={viewingResource.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-widest transition-all"><ExternalLink size={18} /> Open Direct</a>
                                    <button onClick={() => setViewingResource(null)} className="p-3 text-slate-400 hover:text-rose-600 transition-all"><X size={24} /></button>
                                </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center bg-slate-100 p-4">
                                <div className="w-full max-w-4xl aspect-video">
                                    <iframe 
                                        src={getEmbedLink(viewingResource.link)}
                                        className="w-full h-full border-none"
                                        allow="autoplay"
                                        title={viewingResource.title}
                                    />
                                </div>
                            </div>
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

export default ResourcesTab;
