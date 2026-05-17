const axios = require('axios');

async function test() {
    try {
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@apex.edu',
            password: 'admin' // I need to know the admin password
        });
        const token = loginRes.data.token;
        
        const payload = {
            title: "Test Exam",
            duration: 1800,
            scheduledDate: "2026-10-10",
            startTime: "10:00",
            status: 'Draft',
            passingMarks: 50,
            proctoring: { camera: true, microphone: false }
        };
        const res = await axios.post('http://localhost:5000/api/exams', payload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(res.data);
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}
test();
