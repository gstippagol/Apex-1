import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play, Send, Loader2, Code2, CheckCircle, XCircle,
  ChevronRight, Clock, Cpu, BookOpen, AlignLeft, Terminal,
  Activity, FileText, CheckCircle2, Lock
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────────────────────────────────────────────────────
   LANGUAGE TEMPLATES
───────────────────────────────────────────────────────────── */
const TEMPLATES = {
  c:          '#include <stdio.h>\n\nint main() {\n    // Write your code here\n\n    return 0;\n}',
  cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n\n    return 0;\n}',
  java:       'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Write your code here\n\n    }\n}',
  python:     '# Write your code here\n\n',
};

const LANG_LABELS = {
  c: 'C (GCC 10)',
  cpp: 'C++ (GCC 10)',
  java: 'Java 15',
  python: 'Python 3',
};

/* ─────────────────────────────────────────────────────────────
   ERROR CLEANER – strips file paths, keeps first useful line
───────────────────────────────────────────────────────────── */
const cleanError = (raw) => {
  if (!raw) return 'An error occurred during execution.';
  
  let text = String(raw);
  
  // Remove backend prefixes if they exist
  if (text.startsWith('Runtime Error:\n')) text = text.substring(15);
  else if (text.startsWith('Compilation Error:\n')) text = text.substring(19);

  // 1. Strip absolute paths from ALL lines to clean up output
  // Matches D:\path\to\source.c: or /path/to/script.js: and replaces with just the filename
  text = text.replace(/(?:[a-zA-Z]:)?[\/\\](?:[^\/\\]+[\/\\])*([^:\/\\]+\.[a-zA-Z0-9]+:)/g, '$1');

  const lines = text.split('\n').map(l => l.trimRight()).filter(Boolean); // trimRight preserves indentation for carets
  if (!lines.length) return 'Runtime Error';

  // 2. Handle Python Tracebacks (Keep just the last exception line for simplicity, or return the whole thing? 
  // User requested "don't miss single mistake", but Python tracebacks are very noisy. 
  // Let's keep the exact Exception line which is most useful).
  if (text.includes('Traceback (most recent call last):')) {
    const excIndex = lines.findIndex(l => l.includes('Error:') || l.includes('Exception:'));
    if (excIndex !== -1) {
      return lines.slice(excIndex).join('\n');
    }
  }

  // 3. For C/C++/Java/Node, return the full cleaned output so they see "In function 'main':" AND the actual errors/carets!
  const filtered = lines.filter(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('at ') || trimmed.startsWith('at Object.')) return false; // Hide internal Node stack traces
    return true;
  });

  return filtered.join('\n');
};

/* ─────────────────────────────────────────────────────────────
   BULLET FORMATTER HELPER
   ───────────────────────────────────────────────────────────── */
const getBullets = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
};



/* ─────────────────────────────────────────────────────────────
   DIFFICULTY BADGE
───────────────────────────────────────────────────────────── */
const DiffBadge = ({ diff }) => {
  const map = {
    Easy:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
    Hard:   'bg-rose-500/10   text-rose-400   border-rose-500/20',
  };
  return (
    <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${map[diff] || map.Medium}`}>
      {diff || 'Medium'}
    </span>
  );
};



/* ─────────────────────────────────────────────────────────────
   TEST CASE PILL
───────────────────────────────────────────────────────────── */
const CasePill = ({ label, status, active, onClick }) => {
  const base = 'px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all border select-none';
  const styles = {
    idle:    active ? 'bg-slate-700 border-slate-500 text-white'        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500',
    pass:    active ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-emerald-500/5 border-emerald-500/40 text-emerald-500 hover:border-emerald-500',
    fail:    active ? 'bg-rose-500/20 border-rose-500 text-rose-300'    : 'bg-rose-500/5 border-rose-500/40 text-rose-500 hover:border-rose-500',
  };
  return (
    <button onClick={onClick} className={`${base} ${styles[status || 'idle']}`}>
      {status === 'pass' && <CheckCircle size={10} className="inline mr-1.5 mb-px" />}
      {status === 'fail' && <XCircle    size={10} className="inline mr-1.5 mb-px" />}
      {label}
    </button>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
   Props:
     question   – full question object (including codingMetadata)
     onSelect   – callback(submissionData) when submitted
───────────────────────────────────────────────────────────── */
const CodeEditor = ({ question, selectedAnswer, onSelect, onNext }) => {
  const { _id: questionId, codingMetadata } = question;
  const visibleCases = codingMetadata?.testCases?.filter(tc => tc.isVisible) || [];

  const getDisplayExamples = () => {
    if (codingMetadata?.examples && codingMetadata.examples.length > 0) {
      return codingMetadata.examples;
    }
    if (codingMetadata?.sampleInput || codingMetadata?.sampleOutput) {
      return [{
        input: codingMetadata.sampleInput || '',
        output: codingMetadata.sampleOutput || '',
        explanation: ''
      }];
    }
    if (visibleCases && visibleCases.length > 0) {
      return visibleCases.map(tc => ({
        input: tc.input || '',
        output: tc.expectedOutput || '',
        explanation: ''
      }));
    }
    return [];
  };

  const displayExamples = getDisplayExamples();
  const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : (window.location.hostname.includes('loca.lt') || window.location.hostname.includes('trycloudflare.com'))
      ? `https://${window.location.host}`
      : 'https://apex-s1q2.onrender.com';

  const resolveImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
  };

  // Editor state
  const [language, setLanguage]   = useState(selectedAnswer?.language || 'c');
  const [code, setCode]           = useState(() => {
    if (selectedAnswer?.code) return selectedAnswer.code;
    const lang = selectedAnswer?.language || 'c';
    return question.codingMetadata?.starterCode?.[lang] || TEMPLATES[lang];
  });
  const editorRef                 = useRef(null);

  // Run/submit state
  const [running, setRunning]           = useState(false);
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [caseResults, setCaseResults]     = useState([]);   // [{isPassed, input, expected, actual, isVisible}]
  const [summary, setSummary]             = useState(null); // {passCount, totalCount, verdict, mode}

  /* ── Language change ── */
  const handleLangChange = (lang) => {
    setLanguage(lang);
    const starter = question.codingMetadata?.starterCode?.[lang];
    setCode(starter || TEMPLATES[lang]);
    setCaseResults([]);
    setSummary(null);
  };

  /* ── RUN — show ALL test cases (visible + hidden) pass/fail ── */
  const handleRun = async () => {
    const currentCode = editorRef.current?.getValue() ?? code;
    setRunning(true);
    setCaseResults([]);
    setSummary(null);
    try {
      const res = await axios.post(`${API_BASE}/api/code/run`, {
        code: currentCode,
        language,
        questionId,
        checkAll: true,
      });

      if (res.data.results) {
        // Show ALL results – visible and hidden
        setCaseResults(res.data.results);
        setSummary({
          passCount:  res.data.passCount,
          totalCount: res.data.totalCount,
          verdict:    res.data.success ? 'accepted' : 'wrong',
          mode:       'run',
          message:    res.data.message,
        });
      } else if (!res.data.success) {
        const msg = cleanError(res.data.message);
        toast.error(msg);
        setSummary({ verdict: 'error', message: msg, mode: 'run' });
      }
      setActiveCaseIdx(0);
    } catch (err) {
      const msg = cleanError(err.response?.data?.message || 'Execution failed');
      toast.error(msg);
      setSummary({ verdict: 'error', message: msg, mode: 'run' });
    } finally {
      setRunning(false);
    }
  };

  /* ── SUBMIT — verdict hidden; just record and move on ── */
  const handleSubmit = async () => {
    const currentCode = editorRef.current?.getValue() ?? code;
    setRunning(true);
    setCaseResults([]);   // always clear – submit never shows case pills
    setSummary(null);
    try {
      const res = await axios.post(`${API_BASE}/api/code/submit`, {
        code: currentCode,
        language,
        questionId,
      });

      if (!res.data.success && !res.data.results) {
        const msg = cleanError(res.data.message || 'Execution Protocol Failed');
        toast.error(msg);
        setSummary({ verdict: 'error', message: msg, mode: 'submit' });
        return;
      }

      // Record answer in parent (for final exam submission)
      onSelect?.({
        code: currentCode,
        language,
        codingResults: {
          testCasesPassed: res.data.passCount,
          totalTestCases:  res.data.totalCount,
          aiFeedback:      res.data.aiFeedback,
        },
      });

      // Show neutral submitted panel, then auto-advance
      setSummary({ verdict: 'submitted', mode: 'submit' });
      toast.success('Code submitted!');

      // Auto-move to next question after a short delay
      setTimeout(() => {
        onNext?.();
      }, 800);

    } catch (err) {
      const msg = cleanError(err.response?.data?.message || 'Submission Error');
      toast.error(msg);
      setSummary({ verdict: 'error', message: msg, mode: 'submit' });
    } finally {
      setRunning(false);
    }
  };


  /* ─────────────────────────────────────────────────────────
     CASE DETAIL
  ───────────────────────────────────────────────────────── */
  const CaseDetail = ({ result }) => {
    if (!result) return null;
    // For private cases just show pass/fail
    if (!result.isVisible && result.isPassed) return (
      <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold py-2">
        <CheckCircle size={16} /> Hidden test case – Passed
      </div>
    );
    if (!result.isVisible && !result.isPassed) return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-rose-400 text-sm font-bold py-2">
          <XCircle size={16} /> Hidden test case – Failed
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock size={12} /> Input / Expected output hidden for private test cases
        </div>
      </div>
    );
    // Visible case
    return (
      <div className="space-y-3 text-xs font-mono animate-in fade-in duration-200">
        <div>
          <p className="text-slate-500 uppercase font-black text-[9px] tracking-widest mb-1">Input</p>
          <div className="bg-[#0d0d17] border border-white/5 rounded-xl p-3 text-slate-300">{result.input ?? '—'}</div>
        </div>
        <div>
          <p className="text-slate-500 uppercase font-black text-[9px] tracking-widest mb-1">Expected Output</p>
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-emerald-400">{result.expected ?? '—'}</div>
        </div>
        {!result.isPassed && (
          <div>
            <p className="text-slate-500 uppercase font-black text-[9px] tracking-widest mb-1">Your Output</p>
            <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-rose-400">{result.actual ?? '—'}</div>
          </div>
        )}
      </div>
    );
  };

  /* RENDER */
    return (
    <div className="lc-split-root flex flex-col lg:flex-row h-full overflow-hidden bg-[#0f0f1a]">

      {/* ═══════════════════ LEFT PANEL – Question ═══════════════════ */}
      <div className="lc-left w-full lg:w-[42%] h-[40%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 overflow-hidden">
        {/* Left header */}
        <div className="px-6 py-4 border-b border-white/5 bg-[#13131f] flex items-center gap-3">
          <BookOpen size={16} className="text-blue-400" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Problem</span>
          <div className="ml-auto">
            <DiffBadge diff={question.difficulty} />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">

          {/* Title */}
          <h2 className="text-xl font-black text-white leading-tight">
            {question.questionText}
          </h2>

          {/* Problem description */}
          {codingMetadata?.problemDescription && (
            <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
              {codingMetadata.problemDescription}
            </div>
          )}

          {/* Images */}
          {question.images && question.images.filter(img => img.url && img.url.trim() !== '').map((img, idx) => (
            <div key={idx} className="image-container space-y-3">
              {img.purpose && (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-0.5 bg-blue-500 rounded-full" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{img.purpose}</span>
                </div>
              )}
              <div className="rounded-2xl overflow-hidden border border-white/5 shadow-inner bg-black/20 flex justify-center p-2" style={{ width: img.scale ? `${img.scale}%` : '100%', maxWidth: '100%' }}>
                <img 
                  src={resolveImageUrl(img.url)} 
                  alt={`Problem illustration ${idx + 1}`} 
                  className="w-full max-h-[280px] object-contain block rounded-xl shadow-lg" 
                  onError={(e) => {
                    // Hide the entire container if image fails
                    const container = e.target.closest('.image-container');
                    if (container) container.style.display = 'none';
                    else e.target.style.display = 'none';
                  }}
                />
              </div>
            </div>
          ))}

          {/* IO & Constraints */}
          {codingMetadata && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Input Format */}
                {codingMetadata.inputDescription && getBullets(codingMetadata.inputDescription).length > 0 && (
                  <div className="bg-[#1a1a2e]/50 p-4 rounded-2xl border border-white/5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white/5 text-amber-400">
                        <AlignLeft size={14} />
                      </div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Input Format</h5>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300 font-semibold leading-relaxed">
                      {getBullets(codingMetadata.inputDescription).map((bullet, idx) => (
                        <li key={idx} className="marker:text-slate-500">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Output Format */}
                {codingMetadata.outputDescription && getBullets(codingMetadata.outputDescription).length > 0 && (
                  <div className="bg-[#1a1a2e]/50 p-4 rounded-2xl border border-white/5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white/5 text-emerald-400">
                        <Terminal size={14} />
                      </div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Output Format</h5>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300 font-semibold leading-relaxed">
                      {getBullets(codingMetadata.outputDescription).map((bullet, idx) => (
                        <li key={idx} className="marker:text-slate-500">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Constraints */}
              {codingMetadata.constraints && getBullets(codingMetadata.constraints).length > 0 && (
                <div className="bg-[#1a1a2e]/50 p-4 rounded-2xl border border-white/5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white/5 text-indigo-400">
                      <Activity size={14} />
                    </div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Constraints</h5>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300 font-semibold leading-relaxed">
                    {getBullets(codingMetadata.constraints).map((bullet, idx) => (
                      <li key={idx} className="marker:text-slate-500">{bullet}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Examples (visible test cases) */}
          {displayExamples.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" /> Examples
              </h4>
              {displayExamples.map((ex, i) => (
                <div key={i} className="bg-[#1a1a2e]/60 border border-white/5 rounded-2xl p-4 font-mono text-xs space-y-3">
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Example {i + 1}</p>
                  {ex.input && (
                    <div className="flex items-start gap-1">
                      <span className="text-blue-400 font-bold shrink-0">Input:  </span>
                      <pre className="text-slate-300 font-mono m-0 whitespace-pre-wrap leading-tight">{ex.input}</pre>
                    </div>
                  )}
                  {ex.output && (
                    <div className="flex items-start gap-1">
                      <span className="text-emerald-400 font-bold shrink-0">Output: </span>
                      <pre className="text-slate-300 font-mono m-0 whitespace-pre-wrap leading-tight">{ex.output}</pre>
                    </div>
                  )}
                  {ex.explanation && (
                    <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
                      <span className="text-amber-400 font-bold">Explanation:</span>
                      <p className="text-slate-400 font-sans leading-relaxed m-0">{ex.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ RIGHT PANEL – Editor + Test Cases ═══════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Editor toolbar ── */}
        <div className="px-3 md:px-4 py-2 md:py-3 border-b border-white/5 bg-[#13131f] flex items-center gap-2 md:gap-3">
          {/* Language selector */}
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-white/5 border border-white/10 rounded-xl">
            <Code2 size={12} className="text-blue-400" />
            <select
              value={language}
              onChange={(e) => handleLangChange(e.target.value)}
              className="bg-transparent text-slate-200 text-[10px] md:text-xs font-black outline-none uppercase tracking-wider cursor-pointer"
            >
              {Object.entries(LANG_LABELS).map(([val, lbl]) => (
                <option key={val} value={val} className="bg-[#13131f]">{lbl}</option>
              ))}
            </select>
          </div>

          {/* Engine badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider">Apex Engine</span>
          </div>

          <div className="ml-auto flex gap-1.5 md:gap-2">
            {/* Run */}
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-wider hover:bg-white/10 transition-all active:scale-95 disabled:opacity-40"
            >
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
              <span className="hidden xs:inline">Run</span>
            </button>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={running}
              className="flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-1.5 md:py-2 bg-emerald-600 text-white rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-wider hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-700/20 active:scale-95 disabled:opacity-40"
            >
              {running ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              <span className="hidden xs:inline">Submit</span>
            </button>
          </div>
        </div>

        {/* ── Monaco Editor ── */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <Editor
            height="100%"
            onMount={(editor, monaco) => {
              editorRef.current = editor;

              // ── Disable copy / cut / paste inside Monaco ──
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {});
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {});
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {});
              editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {});

              // ── Block right-click context menu on the editor DOM node ──
              const domNode = editor.getDomNode();
              if (domNode) {
                domNode.addEventListener('contextmenu', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }, true);
              }
            }}
            theme="vs-dark"
            language={language === 'c' ? 'cpp' : language}
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              minimap: { enabled: false },
              lineNumbers: 'on',
              padding: { top: 20, bottom: 20 },
              automaticLayout: true,
              scrollBeyondLastLine: false,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              renderLineHighlight: 'all',
              scrollbar: { vertical: 'auto', horizontal: 'hidden' },
              // ── DISABLE SUGGESTIONS / AUTOCOMPLETE ──
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              parameterHints: { enabled: false },
              snippetSuggestions: 'none',
              wordBasedSuggestions: 'off',
              tabCompletion: 'off',
              hover: { enabled: false },
              contextmenu: false,
              // Prevent ghost text / inline suggestions
              inlineSuggest: { enabled: false },
              readOnlyMessage: { value: '' },
            }}
          />
        </div>

        {/* ── Bottom Results Panel (single, no tabs, no console output) ── */}
        <div className="h-[200px] border-t border-white/5 bg-[#0d0d17] flex flex-col">

          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-2 bg-[#13131f]">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em]">
              Test Result
            </span>
            {running && (
              <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-widest">
                <Loader2 size={10} className="animate-spin" /> Running…
              </div>
            )}
            {/* Summary count badge (shown after run) */}
            {!running && summary?.mode === 'run' && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                summary.passCount === summary.totalCount
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
              }`}>
                {summary.passCount}/{summary.totalCount} passed
              </span>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

            {/* Nothing run yet */}
            {!summary && !running && (
              <p className="text-slate-600 text-xs font-mono">
                Click <span className="text-slate-400 font-bold">Run</span> to test your code against all test cases.
              </p>
            )}

            {/* ── RUN: show case pills only, NO verdict banner, NO output ── */}
            {summary?.mode === 'run' && (
              <div className="space-y-3">
                {/* Error state */}
                {summary.verdict === 'error' && !summary.message?.startsWith('Compilation Error') && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <XCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-amber-300 text-[11px] font-mono leading-snug">
                      {summary.message}
                    </p>
                  </div>
                )}

                {/* Compilation Error or Runtime message */}
                {summary.message && (summary.message.startsWith('Compilation Error') || summary.message.startsWith('Runtime Error')) && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <XCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-amber-300 text-[11px] font-mono leading-snug whitespace-pre-wrap">
                      {cleanError(summary.message)}
                    </p>
                  </div>
                )}

                {/* Pass/fail pills for all test cases */}
                {caseResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {caseResults.map((r, i) => (
                        <CasePill
                          key={i}
                          label={r.isVisible ? `Case ${i + 1}` : `Hidden ${i + 1}`}
                          status={r.isPassed ? 'pass' : 'fail'}
                          active={activeCaseIdx === i}
                          onClick={() => setActiveCaseIdx(i)}
                        />
                      ))}
                    </div>
                    {/* Case detail (input / expected only for visible failed cases) */}
                    <CaseDetail result={caseResults[activeCaseIdx]} />
                  </div>
                )}
              </div>
            )}

            {/* ── SUBMIT: neutral confirmation only, no verdict ── */}
            {summary?.mode === 'submit' && (
              <div className="space-y-3">
                {summary.verdict === 'submitted' && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CheckCircle size={22} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-emerald-400 font-black text-base leading-tight">Submitted Successfully</p>
                      <p className="text-slate-500 text-xs mt-0.5">Moving to next question…</p>
                    </div>
                  </div>
                )}
                {summary.verdict === 'error' && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <XCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-amber-300 text-[11px] font-mono leading-snug">{summary.message}</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;

