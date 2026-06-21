import Navbar from '../components/Navbar';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Zap, Target, BookOpen, ChevronRight, GraduationCap,
  Mail, Phone, Globe, ExternalLink, Code, MessageCircle, Info, Briefcase, X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo_transparent.png';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:5000'
  : 'https://apex-s1q2.onrender.com';

const Landing = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeModal, setActiveModal] = useState(null);

  // Feedback Portal States
  const [feedbackCategory, setFeedbackCategory] = useState('Exams');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackUsn, setFeedbackUsn] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Auto-fill logged-in user details
  useEffect(() => {
    if (user) {
      setFeedbackName(user.name || '');
      setFeedbackEmail(user.email || '');
      setFeedbackUsn(user.usn || '');
    } else {
      setFeedbackName('');
      setFeedbackEmail('');
      setFeedbackUsn('');
    }
  }, [user, activeModal]);

  useEffect(() => {
    if (location.hash) {
      const hash = location.hash.substring(1);
      const element = document.getElementById(hash);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [location]);

  useEffect(() => {
    const handleSecurity = (e) => {
        e.preventDefault();
    };

    const handleKeyDown = (e) => {
        if (e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
            (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
            (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
            (e.ctrlKey && e.keyCode === 85)) {               // Ctrl+U
            e.preventDefault();
        }
    };

    const blockDevTools = setInterval(() => {
        Function("debugger")();
    }, 50);

    document.addEventListener('copy', handleSecurity);
    document.addEventListener('paste', handleSecurity);
    document.addEventListener('cut', handleSecurity);
    document.addEventListener('contextmenu', handleSecurity);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
        clearInterval(blockDevTools);
        document.removeEventListener('copy', handleSecurity);
        document.removeEventListener('paste', handleSecurity);
        document.removeEventListener('cut', handleSecurity);
        document.removeEventListener('contextmenu', handleSecurity);
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const features = [
    {
      icon: <Shield className="w-8 h-8 text-blue-500" />,
      title: "Secure Exams",
      desc: "Advanced proctoring with tab detention, fullscreen enforcement and webcam monitoring."
    },
    {
      icon: <Zap className="w-8 h-8 text-amber-500" />,
      title: "Instant Results",
      desc: "Get your detailed performance analytics and score immediately after submission."
    },
    {
      icon: <Target className="w-8 h-8 text-emerald-500" />,
      title: "AI Exam Evaluation",
      desc: "Automated intelligent grading and comprehensive performance mapping for every student."
    },
    {
      icon: <Briefcase className="w-8 h-8 text-purple-500" />,
      title: "Placement and Training",
      desc: "Comprehensive mock interview sessions and industry-standard training modules for career success."
    }
  ];

  const renderModal = () => {
    if (!activeModal) return null;

    if (activeModal === 'feedback') {
      const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        if (!feedbackText.trim()) {
          toast.error('Please enter your feedback message.');
          return;
        }
        if (!feedbackName.trim()) {
          toast.error('Please enter your name.');
          return;
        }
        if (!feedbackEmail.trim()) {
          toast.error('Please enter your email.');
          return;
        }

        setFeedbackSubmitting(true);
        try {
          const config = {};
          const token = localStorage.getItem('token');
          if (token) {
            config.headers = {
              'Authorization': `Bearer ${token}`
            };
          }

          const res = await axios.post(`${API_BASE}/api/feedback`, {
            name: feedbackName,
            email: feedbackEmail,
            usn: feedbackUsn,
            category: feedbackCategory,
            message: feedbackText
          }, config);

          if (res.data.success) {
            toast.success('Thank you! Your feedback has been received.', {
              icon: '🎉',
              style: {
                borderRadius: '12px',
                background: '#1e293b',
                color: '#fff',
                fontWeight: '600'
              }
            });
            setFeedbackText('');
            setActiveModal(null);
          }
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
        } finally {
          setFeedbackSubmitting(false);
        }
      };

      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-xl md:max-w-2xl max-h-[95vh] sm:max-h-[90vh] shadow-2xl overflow-hidden text-slate-100 flex flex-col"
          >
            <div className="relative p-6 md:p-8 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-blue-900/20 to-indigo-900/20 shrink-0">
              <div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Feedback Portal</span>
                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <MessageCircle size={22} className="text-blue-500" /> Share Your Thoughts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white border border-slate-700/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="p-6 md:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Category Pills */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">What is this regarding?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Exams', 'Website', 'Apex Club', 'General'].map((cat) => {
                    const isActive = feedbackCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFeedbackCategory(cat)}
                        className={`py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border text-center ${isActive
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20 scale-[1.02]'
                          : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                          }`}
                      >
                        {cat === 'Exams' && '📝 '}
                        {cat === 'Website' && '🌐 '}
                        {cat === 'Apex Club' && '⚡ '}
                        {cat === 'General' && '💬 '}
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name, Email & USN Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Your Email</label>
                  <input
                    type="email"
                    required
                    disabled={!!user}
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={`w-full px-4 py-3 border rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${!!user ? 'bg-slate-900/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-950 border-slate-800'
                      }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Your Name</label>
                  <input
                    type="text"
                    required
                    disabled={!!user}
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="Enter your name"
                    className={`w-full px-4 py-3 border rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${!!user ? 'bg-slate-900/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-950 border-slate-800'
                      }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Your USN</label>
                  <input
                    type="text"
                    disabled={!!user}
                    value={feedbackUsn}
                    onChange={(e) => setFeedbackUsn(e.target.value.toUpperCase())}
                    placeholder="Enter USN"
                    className={`w-full px-4 py-3 border rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${!!user ? 'bg-slate-900/50 border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-950 border-slate-800'
                      }`}
                  />
                </div>
              </div>

              {/* Feedback Textarea */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Feedback Details</label>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{feedbackText.length}/1000</span>
                </div>
                <textarea
                  required
                  maxLength={1000}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={`Write your feedback about ${feedbackCategory} here...`}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-3 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center gap-2"
                >
                  {feedbackSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      );
    }

    const modals = {
      privacy: {
        title: "Privacy Policy & Protocols",
        content: (
          <div className="space-y-4 text-sm text-slate-600">
            <p><strong>1. Data Collection:</strong> APEX Club collects personal and academic data strictly for the purpose of examination proctoring and performance analytics. This includes webcam feeds, tab activity, and keystroke patterns during assessments.</p>
            <p><strong>2. Data Security:</strong> All assessment data is encrypted at rest and in transit. Only authorized administrators and faculty have access to your academic records and proctoring logs.</p>
            <p><strong>3. Third-Party Sharing:</strong> We do not sell or share your data with third parties. Data is used exclusively within the Mysore University School of Engineering ecosystem.</p>
            <p><strong>4. Consent:</strong> By using the Assessment Portal, you consent to our proctoring protocols and AI-driven evaluation methodologies.</p>
          </div>
        )
      },
      terms: {
        title: "Terms of Service",
        content: (
          <div className="space-y-4 text-sm text-slate-600">
            <p><strong>1. Acceptance of Terms:</strong> By accessing the APEX Club platform, you agree to abide by these terms and the academic integrity policies of the University of Mysore.</p>
            <p><strong>2. User Conduct:</strong> Any attempt to bypass the proctoring protocols, reverse engineer the platform, or submit fraudulent work will result in immediate disciplinary action.</p>
            <p><strong>3. Service Availability:</strong> While we strive for 99.9% uptime, APEX Club is not liable for service interruptions due to external network failures.</p>
            <p><strong>4. Intellectual Property:</strong> All content, algorithms, and interface designs are the intellectual property of APEX Club.</p>
          </div>
        )
      },
      mission: {
        title: "Our Mission",
        content: (
          <div className="space-y-4 text-sm text-slate-600 text-left">
            <div>
              <h4 className="font-bold text-slate-800 mb-1">1. Skill Development</h4>
              <p>Apex Club is dedicated to empowering students with essential technical and soft skills required for academic excellence, placements, and professional success. Through continuous learning, practical training, workshops, and real-world guidance, the club helps students strengthen their knowledge, confidence, communication, and problem-solving abilities.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-1">2. Placement Preparation</h4>
              <p>The club aims to prepare students for successful career opportunities by conducting mock tests, mock interviews, group discussions, aptitude sessions, resume-building activities, and placement-focused training programs. Apex Club creates a supportive environment where students can practice, improve, and become industry-ready professionals.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-1">3. Career Growth</h4>
              <p>Apex Club believes in helping students grow beyond placements by encouraging leadership, teamwork, innovation, and lifelong learning. The mission is to inspire students to build meaningful careers, achieve their goals, and become confident individuals who contribute positively to their organizations and society.</p>
            </div>
          </div>
        )
      },
      excellence: {
        title: "Engineering Excellence",
        content: (
          <div className="space-y-4 text-sm text-slate-600">
            <p>Engineering Excellence at APEX means building systems that are resilient, scalable, and secure. It's the core philosophy behind our architecture.</p>
            <p>Our platform leverages state-of-the-art WebRTC for real-time monitoring, AI-driven behavioral analysis, and a highly optimized microservices architecture.</p>
            <p>We are dedicated to continuous innovation, ensuring that Mysore University School of Engineering remains at the forefront of educational technology.</p>
          </div>
        )
      },
      support: {
        title: "Support Ticket Protocol",
        content: (
          <div className="space-y-4 text-sm text-slate-600">
            <p>If you are experiencing technical difficulties or have an account-related query, please follow the protocol below:</p>
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <p className="font-bold text-slate-800 mb-2">Step 1: Contact via Email</p>
              <p>Email your query to <a href="mailto:apex.muse2026@gmail.com" className="text-blue-600 font-bold hover:underline">apex.muse2026@gmail.com</a>.</p>
              <p>For admin Email : <a href="mailto:gopalst2005@gmail.com" className="text-blue-600 font-bold hover:underline">gopalst2005@gmail.com</a>.</p>

            </div>
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <p className="font-bold text-slate-800 mb-2">Step 2: Required Information</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use the subject line: <strong>SUPPORT TICKET: [Your Issue]</strong></li>
                <li>Include your University ID (USN).</li>
                <li>Provide a detailed description of the problem, including screenshots if applicable.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500 italic mt-4">Note: For urgent exam-related issues, please contact your invigilator or administrator immediately rather than raising an email ticket.</p>
          </div>
        )
      }
    };

    const modal = modals[activeModal];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">{modal.title}</h3>
            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {modal.content}
          </div>
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button onClick={() => setActiveModal(null)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-sm">
              Understood
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[60%] bg-blue-100/50 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[60%] bg-indigo-100/50 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wider text-blue-600 uppercase bg-blue-100 rounded-full">
              The Future of Online Testing
            </span>
            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
              Smart Online <span className="gradient-text">Examination</span> System
            </h1>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Experience a seamless, secure, and smart way to conduct online exams. Built with advanced proctoring and real-time analytics.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!user ? (
                <>
                  <Link to="/login" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-lg px-8 py-4">
                    Access Your Dashboard <ChevronRight size={20} />
                  </Link>
                  <Link to="/register" className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 text-lg px-8 py-4">
                    Register
                  </Link>
                </>
              ) : (user.role === 'admin' || user.role === 'superadmin') ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <Link to="/admin" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-lg px-8 py-4">
                    Admin Panel <Shield size={20} />
                  </Link>
                  <Link to="/admin" className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 text-lg px-8 py-4">
                    Create Exam <GraduationCap size={20} />
                  </Link>
                </div>
              ) : (
                <Link to="/student" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-lg px-8 py-4">
                  Enter Portal <ChevronRight size={20} />
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose APEX Club?</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Our platform provides all the tools needed for secure and efficient examination management.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -10 }}
                className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-all hover:bg-white hover:shadow-xl"
              >
                <div className="mb-6 p-3 w-fit bg-white rounded-xl shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="bg-slate-900 text-slate-300 pt-20 pb-10 overflow-hidden relative safe-pb">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600" />

        <div className="max-w-7xl mx-auto px-6">
          {/* Top Row: Grid Header */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10 md:gap-8 mb-12 pb-12 border-b border-slate-800">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-white rounded-lg p-1">
                  <img src={logo} alt="APEX" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-black text-white tracking-tight">APEX <span className="text-blue-500">Club</span></span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                <ExternalLink size={12} className="text-blue-500" /> Links
              </h4>
              <ul className="space-y-3 text-xs font-bold">
                <li><Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-blue-500 transition-colors">Home</Link></li>
                <li><Link to={!user ? "/login" : (user.role === 'admin' || user.role === 'superadmin') ? "/admin" : "/student"} className="hover:text-blue-500 transition-colors">Enter Portal</Link></li>
                <li><button onClick={() => { setActiveModal('feedback'); setFeedbackCategory('Exams'); setFeedbackText(''); }} className="hover:text-blue-500 transition-colors text-left">Feedback</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                <Shield size={12} className="text-blue-500" /> Legal
              </h4>
              <ul className="space-y-3 text-xs font-bold">
                <li><button onClick={() => setActiveModal('privacy')} className="hover:text-blue-500 transition-colors text-left">Privacy Policy</button></li>
                <li><button onClick={() => setActiveModal('terms')} className="hover:text-blue-500 transition-colors text-left">Terms of Service</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                <MessageCircle size={12} className="text-blue-500" /> Contact
              </h4>
              <ul className="space-y-3 text-xs font-bold">
                <li><a href="mailto:gopalst2005@gmail.com" className="hover:text-blue-500 transition-colors">Help Center</a></li>
                <li><button onClick={() => setActiveModal('support')} className="hover:text-blue-500 transition-colors text-left">Support Ticket</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                <Globe size={12} className="text-blue-500" /> Platform
              </h4>
              <ul className="space-y-3 text-xs font-bold">
                <li><button onClick={() => setActiveModal('mission')} className="hover:text-blue-500 transition-colors text-left">Our Mission</button></li>
                <li><button onClick={() => setActiveModal('excellence')} className="hover:text-blue-500 transition-colors text-left">Engineering Excellence</button></li>
              </ul>
            </div>
          </div>

          {/* Middle Row: Description */}
          <div className="mb-12">
            <p className="text-slate-400 max-w-3xl leading-relaxed text-sm font-medium mb-6">
              APEX Club empowers future engineers through intelligent assessments, integrated placement and training, and a secure digital exam ecosystem—designed for excellence, integrity, and career growth.
            </p>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
              <span className="text-white font-black uppercase tracking-widest text-[10px] mt-2">Connect With Us:</span>
              <div className="flex items-center gap-3">
                <a href="https://www.instagram.com/_apex_club_?igsh=bDg3N2pyN3RxcXZq" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-pink-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                </a>
                <a href="https://www.linkedin.com/in/apex-club-aa3754400" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
                </a>
                <a href="mailto:apex.muse2026@gmail.com" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-600 transition-colors">
                  <Mail size={16} />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Row: Contact Info & Socials */}
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-800 gap-8">
            <div className="flex flex-wrap justify-center md:justify-start gap-10">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-white">apex.muse2026@gmail.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-white">+91 8088849937</span>
              </div>
            </div>
          </div>

          {/* Developer Section */}
          <div className="mt-16 pt-8 border-t border-slate-800/50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-xl shadow-blue-600/20 md:mt-1">
                  G
                </div>
                <div className="text-center md:text-left">
                  <h4 className="text-lg font-black text-white mb-0.5">Gopal Sadashiv Tippagol</h4>
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">WEB DEVELOPER & CYBERSECURITY ENTHUSIAST.</p>
                  <p className="text-slate-400 text-[11px] font-bold max-w-md leading-relaxed mb-4">
                    Passionate Computer Science student with a strong passion for software engineering and cybersecurity. Dedicated to mastering secure development practices, discovering vulnerabilities, and building innovative technology solutions with real-world impact.
                  </p>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <a href="mailto:gopalst2005@gmail.com" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-blue-600/20 text-slate-300 hover:text-blue-400 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-all text-[9px] font-black uppercase tracking-widest">
                      <Mail size={12} /> Connect
                    </a>
                    <a href="https://www.linkedin.com/in/gopal-tippagol-641352292?utm_source=share_via&utm_content=profile&utm_medium=member_android" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 transition-all text-[9px] font-black uppercase tracking-widest">
                      <ExternalLink size={12} /> LinkedIn
                    </a>
                    <a href="https://github.com/gopalst" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 transition-all text-[9px] font-black uppercase tracking-widest">
                      <Code size={12} /> Projects
                    </a>
                    {/* <a href="https://www.instagram.com/gopal_st_31?igsh=MWg4a3p3MzV3YmRkcA==" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 transition-all text-[9px] font-black uppercase tracking-widest">
                      <Globe size={12} /> Social Media
                    </a> */}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-16 text-center md:text-left">
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.2em]">
              © 2026 <span className="text-white">APEX Club</span>. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {renderModal()}
      </AnimatePresence>
    </div>
  );
};

export default Landing;
