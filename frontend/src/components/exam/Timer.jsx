import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Timer = ({ timeLeft, onWarning }) => {
    const [showWarning, setShowWarning] = useState(false);

    useEffect(() => {
        if (timeLeft === 300) { // 5 minutes warning
            onWarning();
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 5000);
        }
    }, [timeLeft, onWarning]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    };

    const isCritical = timeLeft < 300;

    return (
        <div className="flex items-center gap-4">
            <AnimatePresence>
                {showWarning && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded shadow-lg z-50 flex items-center gap-3"
                    >
                        <AlertCircle className="text-amber-500" />
                        <span className="font-bold">Only 5 minutes remaining!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 14px',
                borderRadius: '10px',
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                fontSize: '16px', fontWeight: '700',
                border: '1px solid',
                transition: 'all 0.3s',
                ...(isCritical
                    ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }
                    : { background: 'rgba(96,165,250,0.08)', color: '#93c5fd', borderColor: 'rgba(96,165,250,0.15)' }
                ),
            }}>
                <Clock size={16} style={{ color: isCritical ? '#f87171' : '#60a5fa' }} />
                {formatTime(timeLeft)}
            </div>
        </div>
    );
};

export default Timer;
