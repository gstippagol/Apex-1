import { motion } from 'framer-motion';
import CodeEditor from './CodeEditor';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * QuestionCard
 * – Coding  → full LeetCode split layout (CodeEditor handles its own UI)
 * – MCQ     → same dark panel style, matching the coding UI theme
 *
 * Extra props for MCQ navigation:
 *   onPrev, onNext, isFirst, isLast, totalQuestions
 */
const QuestionCard = ({
    question,
    index,
    totalQuestions,
    selectedAnswer,
    onSelect,
    onPrev,
    onNext,
    isFirst,
    isLast,
}) => {
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';
    const resolveImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${API_BASE}${url}`;
    };

    if (!question) return <div style={{ color: '#fff', padding: '20px' }}>Loading Question Data...</div>;

    /* ── CODING question: CodeEditor owns the full layout ── */
    if (question.type === 'Coding') {
        return (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                <CodeEditor question={question} selectedAnswer={selectedAnswer} onSelect={onSelect} onNext={onNext} />
            </div>
        );
    }

    /* ── MCQ / other: dark panel matching the coding UI ── */
    const optionLabels = ['A', 'B', 'C', 'D', 'E'];

    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: '#0f0f1a',
                overflow: 'hidden',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}
        >
            {/* ── Header bar (matches coding left-panel header) ── */}
            <div style={{
                padding: '14px 24px',
                background: '#13131f',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexShrink: 0,
            }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '12px', fontWeight: '900',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                }}>
                    Q{index + 1}
                </div>
                <span style={{
                    fontSize: '9px', fontWeight: '900', color: '#475569',
                    textTransform: 'uppercase', letterSpacing: '0.15em',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    padding: '3px 10px', borderRadius: '99px',
                }}>
                    {question.type} Question
                </span>
                <span style={{
                    fontSize: '9px', fontWeight: '900', color: '#f59e0b',
                    textTransform: 'uppercase', letterSpacing: '0.15em',
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    padding: '3px 10px', borderRadius: '99px',
                }}>
                    {question.marks ?? 1} Marks
                </span>
                <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#475569', fontWeight: '700' }}>
                    {index + 1} / {totalQuestions}
                </div>
            </div>

            {/* ── Scrollable content ── */}
            <div
                className="custom-scrollbar"
                style={{ flex: 1, overflowY: 'auto', padding: '32px 48px', minHeight: 0 }}
            >
                {/* Question text */}
                <motion.div
                    key={question._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                >
                    <h2 style={{
                        fontSize: '22px', fontWeight: '800', color: '#f1f5f9',
                        lineHeight: 1.45, marginBottom: '32px',
                        fontFamily: 'Outfit, Inter, system-ui, sans-serif',
                    }}>
                        {question.questionText}
                    </h2>

                    {/* Optional images */}
                    {question.images && question.images.filter(img => img.url && img.url.trim() !== '').map((img, idx) => (
                        <div key={idx} style={{ marginBottom: '28px', maxWidth: '600px' }}>
                            {img.purpose && (
                                <div style={{ 
                                    fontSize: '11px', 
                                    fontWeight: '900', 
                                    color: '#64748b', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.15em',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <div style={{ width: '12px', height: '2px', background: '#3b82f6' }} />
                                    {img.purpose}
                                </div>
                            )}
                            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <img 
                                    src={resolveImageUrl(img.url)} 
                                    alt={`Question Asset ${idx + 1}`} 
                                    style={{ width: img.scale ? `${img.scale}%` : '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }} 
                                    onError={(e) => {
                                        // Hide the entire container if image fails
                                        const container = e.target.closest('[style*="margin-bottom"]');
                                        if (container) container.style.display = 'none';
                                        else e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        </div>
                    ))}

                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '680px' }}>
                        {question.options.map((option, idx) => {
                            const isSelected = selectedAnswer === option;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => onSelect(option)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '16px',
                                        padding: '16px 20px',
                                        borderRadius: '14px',
                                        border: isSelected
                                            ? '2px solid #3b82f6'
                                            : '1.5px solid rgba(255,255,255,0.07)',
                                        background: isSelected
                                            ? 'rgba(59,130,246,0.12)'
                                            : 'rgba(255,255,255,0.03)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.15s ease',
                                        position: 'relative',
                                        outline: 'none',
                                        boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                                        }
                                    }}
                                >
                                    {/* Option label circle */}
                                    <div style={{
                                        width: '34px', height: '34px', borderRadius: '50%',
                                        border: isSelected ? '2px solid #3b82f6' : '1.5px solid rgba(255,255,255,0.12)',
                                        background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.04)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px', fontWeight: '900',
                                        color: isSelected ? '#fff' : '#64748b',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                        boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
                                    }}>
                                        {optionLabels[idx] || String.fromCharCode(65 + idx)}
                                    </div>

                                    <span style={{
                                        fontSize: '15px', fontWeight: '600',
                                        color: isSelected ? '#e2e8f0' : '#cbd5e1',
                                        flex: 1, lineHeight: 1.4,
                                    }}>
                                        {option}
                                    </span>

                                    {isSelected && (
                                        <CheckCircle2
                                            size={18}
                                            style={{ color: '#3b82f6', flexShrink: 0 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            </div>

            {/* ── Navigation footer (matching dark theme) ── */}
            <div style={{
                flexShrink: 0,
                background: '#13131f',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            }}>
                {/* Progress bar */}
                <div style={{ flex: 1, maxWidth: '340px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '9px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Progress
                        </span>
                        <span style={{ fontSize: '9px', color: '#60a5fa', fontWeight: '800' }}>
                            Q{index + 1} of {totalQuestions}
                        </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${((index + 1) / totalQuestions) * 100}%`,
                            background: 'linear-gradient(90deg,#2563eb,#4f46e5)',
                            borderRadius: '99px',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>
                </div>

                {/* Nav buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onPrev}
                        disabled={isFirst}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 18px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            borderRadius: '10px',
                            color: isFirst ? '#334155' : '#94a3b8',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isFirst ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s',
                            outline: 'none',
                        }}
                        onMouseEnter={e => { if (!isFirst) e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    >
                        <ChevronLeft size={15} /> Prev
                    </button>

                    <button
                        onClick={onNext}
                        disabled={isLast}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 18px',
                            background: isLast ? 'rgba(37,99,235,0.2)' : '#2563eb',
                            border: '1px solid',
                            borderColor: isLast ? 'rgba(37,99,235,0.3)' : '#2563eb',
                            borderRadius: '10px',
                            color: isLast ? '#1e3a8a' : '#fff',
                            fontSize: '12px', fontWeight: '800',
                            cursor: isLast ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s',
                            outline: 'none',
                            boxShadow: isLast ? 'none' : '0 2px 12px rgba(37,99,235,0.3)',
                        }}
                        onMouseEnter={e => { if (!isLast) e.currentTarget.style.background = '#1d4ed8'; }}
                        onMouseLeave={e => { if (!isLast) e.currentTarget.style.background = '#2563eb'; }}
                    >
                        Next <ChevronRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuestionCard;
