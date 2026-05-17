const axios = require('axios');
async function test() {
    try {
        const res = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: 'python',
            version: '3.10.0',
            files: [{ name: 'test.py', content: 'print("hello")' }]
        });
        console.log('Success:', res.data);
    } catch (e) {
        console.error('Failure:', e.response?.data || e.message);
    }
}
test();
