import { jsPDF } from 'jspdf';

export const generateCertificate = async (template, studentData) => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';
        img.src = template.backgroundImage.startsWith('http') ? template.backgroundImage : `${API_BASE}${template.backgroundImage}`;

        img.onload = () => {
            canvas.width = template.canvasWidth;
            canvas.height = template.canvasHeight;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Mapping tags to actual data
            const dataMap = {
                'Student Name': studentData.name,
                'USN / ID': studentData.usn,
                'Rank': studentData.rank || 'N/A',
                'Score': `${studentData.score} / ${studentData.totalMarks}`,
                'Date': new Date().toLocaleDateString(),
                'Event Title': studentData.eventTitle
            };

            Object.entries(template.fields).forEach(([key, config]) => {
                ctx.fillStyle = config.color;
                ctx.font = `${config.fontWeight} ${config.fontSize}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                
                const xPos = (config.x / 100) * canvas.width;
                const yPos = (config.y / 100) * canvas.height;

                const text = dataMap[config.label] || config.label;
                ctx.fillText(text, xPos, yPos);
            });

            // Convert to PDF
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${studentData.name.replace(/\s+/g, '_')}_Certificate.pdf`);
            resolve();
        };

        img.onerror = () => reject(new Error('Failed to load certificate template image'));
    });
};
