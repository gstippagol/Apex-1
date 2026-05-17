import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useState } from 'react';

const QuestionPalette = ({ 
    questions, 
    currentIdx, 
    answers, 
    visited, 
    markedForReview, 
    onJump 
}) => {
    // Start collapsed on mobile (width < 768px)
    const [collapsed, setCollapsed] = useState(window.innerWidth < 768);

    const getStatusColor = (idx) => {
        const qId = questions[idx]._id;
        if (markedForReview.includes(qId)) return 'bg-yellow-400 text-white';
        if (answers[qId]) return 'bg-emerald-500 text-white';
        if (visited.includes(qId)) return 'bg-red-500 text-white';
        return 'bg-slate-200 text-slate-500';
    };

    return (
        <aside className={`fixed right-0 top-14 md:top-16 bottom-0 bg-white border-l border-slate-100 transition-all duration-300 z-40 ${
            collapsed ? 'w-10' : 'w-72 md:w-80'
        }`}>
            <button 
                onClick={() => setCollapsed(!collapsed)}
                className="absolute left-[-12px] top-4 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-blue-600 shadow-sm"
            >
                {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            {!collapsed && (
                <div className="p-6 overflow-y-auto h-full">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Question Palette</h3>
                    
                    <div className="grid grid-cols-5 gap-3 mb-8">
                        {questions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => onJump(idx)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all relative ${
                                    getStatusColor(idx)
                                } ${
                                    currentIdx === idx ? 'ring-4 ring-blue-500/20 scale-110 shadow-lg' : ''
                                }`}
                            >
                                {idx + 1}
                                {currentIdx === idx && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4 pt-6 border-t border-slate-50">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Legend</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <LegendItem color="bg-emerald-500" label="Answered" />
                            <LegendItem color="bg-red-500" label="Not Answered" />
                            <LegendItem color="bg-yellow-400" label="For Review" />
                            <LegendItem color="bg-slate-200" label="Not Visited" />
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

const LegendItem = ({ color, label }) => (
    <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded ${color}`} />
        <span className="text-xs font-semibold text-slate-600">{label}</span>
    </div>
);

export default QuestionPalette;
