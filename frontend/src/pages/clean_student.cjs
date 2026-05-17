const fs = require('fs');
const path = 'd:/nnnnnnnnnn/frontend/src/pages/StudentDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Remove Status column header
content = content.replace(/<th className="px-8 py-5 text-\[10px\] font-black text-slate-400 uppercase tracking-widest">Status<\/th>/g, '');

// Remove Status column cells
content = content.replace(/<td className="px-8 py-6">\s*<span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-\[10px\] font-black uppercase tracking-widest rounded-full border border-emerald-100">Logged<\/span>\s*<\/td>/g, '');

// Remove Verdict badge from title
content = content.replace(/<span className={`text-\[8px\] font-black uppercase px-2 py-0.5 rounded-full \${r.verdict === 'Pass' \? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>[\s\S]*?{r.verdict}[\s\S]*?<\/span>/g, '');

fs.writeFileSync(path, content);
console.log('Done');
