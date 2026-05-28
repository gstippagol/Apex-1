import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ChevronLeft, Save, Upload, Type, Move, Trash2, Download, Info } from 'lucide-react';

const CertificateDesigner = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [image, setImage] = useState(null);
    const [fields, setFields] = useState({
        name: { x: 50, y: 40, fontSize: 32, color: '#000000', fontWeight: 'bold', label: 'Student Name' },
        usn: { x: 50, y: 50, fontSize: 18, color: '#666666', fontWeight: 'normal', label: 'USN / ID' },
        rank: { x: 50, y: 60, fontSize: 24, color: '#2563eb', fontWeight: 'bold', label: 'Rank' },
        score: { x: 50, y: 70, fontSize: 18, color: '#000000', fontWeight: 'normal', label: 'Score' },
        date: { x: 80, y: 85, fontSize: 16, color: '#000000', fontWeight: 'normal', label: 'Date' },
        title: { x: 50, y: 20, fontSize: 36, color: '#000000', fontWeight: 'black', label: 'Event Title' }
    });
    const [selectedField, setSelectedField] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [loading, setLoading] = useState(true);
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    useEffect(() => {
        fetchTemplate();
    }, [eventId]);

    const fetchTemplate = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/certificates/${eventId}`);
            if (res.data.success && res.data.data) {
                const template = res.data.data;
                setFields(template.fields);
                setCanvasSize({ width: template.canvasWidth, height: template.canvasHeight });
                if (template.backgroundImage) {
                    loadTemplateImage(template.backgroundImage);
                }
            }
        } catch (err) {
            console.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const loadTemplateImage = (url) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url.startsWith('http') ? url : `${API_BASE}${url}`;
        img.onload = () => {
            setImage(img);
            setCanvasSize({ width: img.width, height: img.height });
        };
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await axios.post(`${API_BASE}/api/upload`, formData);
            loadTemplateImage(res.data.url);
            toast.success('Template background uploaded');
        } catch (err) {
            toast.error('Upload failed');
        }
    };

    const handleCanvasClick = (e) => {
        if (!canvasRef.current || !selectedField) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setFields({
            ...fields,
            [selectedField]: { ...fields[selectedField], x, y }
        });
    };

    const saveTemplate = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/certificates`, {
                eventId,
                backgroundImage: image?.src.replace(API_BASE, ''),
                fields,
                canvasWidth: canvasSize.width,
                canvasHeight: canvasSize.height
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Certificate Template Mastered');
        } catch (err) {
            toast.error('Failed to save configuration');
        }
    };

    useEffect(() => {
        drawCanvas();
    }, [image, fields, selectedField]);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (image) {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '20px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Upload Certificate Background to Begin', canvas.width / 2, canvas.height / 2);
        }

        // Draw Fields
        Object.entries(fields).forEach(([key, config]) => {
            ctx.fillStyle = config.color;
            ctx.font = `${config.fontWeight} ${config.fontSize}px Inter`;
            ctx.textAlign = 'center';
            
            const xPos = (config.x / 100) * canvas.width;
            const yPos = (config.y / 100) * canvas.height;

            if (selectedField === key) {
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2;
                ctx.strokeRect(xPos - 100, yPos - config.fontSize, 200, config.fontSize + 10);
            }

            ctx.fillText(`{{${config.label}}}`, xPos, yPos);
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white border-b border-slate-100 p-6 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Certificate Forge</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol: Template Engineering</p>
                    </div>
                </div>
                <button onClick={saveTemplate} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 flex items-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                    <Save size={18} /> Save Protocol
                </button>
            </header>

            <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Tools Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Template Asset</label>
                        <label className="w-full h-32 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                            <Upload className="text-slate-300 mb-2" size={24} />
                            <span className="text-[10px] font-black text-slate-400 uppercase">Upload Background</span>
                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </label>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Injection Fields</label>
                        <div className="space-y-2">
                            {Object.entries(fields).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedField(key)}
                                    className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${selectedField === key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-200'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Type size={16} />
                                        <span className="text-xs font-black uppercase tracking-tight">{config.label}</span>
                                    </div>
                                    <Move size={14} className="opacity-40" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedField && (
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Tuning: {fields[selectedField].label}</label>
                            
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Font Size</label>
                                <input 
                                    type="range" min="8" max="120" 
                                    value={fields[selectedField].fontSize} 
                                    onChange={(e) => setFields({...fields, [selectedField]: {...fields[selectedField], fontSize: parseInt(e.target.value)}})}
                                    className="w-full accent-blue-600"
                                />
                            </div>

                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase">Color Hex</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={fields[selectedField].color} 
                                        onChange={(e) => setFields({...fields, [selectedField]: {...fields[selectedField], color: e.target.value}})}
                                        className="w-10 h-10 rounded-lg overflow-hidden border-none"
                                    />
                                    <input 
                                        type="text" 
                                        value={fields[selectedField].color} 
                                        onChange={(e) => setFields({...fields, [selectedField]: {...fields[selectedField], color: e.target.value}})}
                                        className="flex-1 bg-slate-50 border-none rounded-lg text-xs font-bold px-3"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-3">
                    <div className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl overflow-hidden flex items-center justify-center min-h-[70vh] relative">
                        <div className="absolute top-8 left-8 flex items-center gap-3">
                            <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Live Simulation Matrix</span>
                        </div>
                        
                        <div className="bg-white rounded-lg shadow-2xl max-w-full overflow-auto custom-scrollbar">
                            <canvas
                                ref={canvasRef}
                                width={canvasSize.width}
                                height={canvasSize.height}
                                onClick={handleCanvasClick}
                                className="cursor-crosshair"
                                style={{ maxWidth: '100%', height: 'auto' }}
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex items-center justify-center gap-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Info size={14} className="text-blue-600" />
                            Click anywhere on the certificate to move the selected field
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CertificateDesigner;
