const axios = require('axios');

async function test() {
    try {
        const pyCode = 'import sys\nprint("hello")';
        const res1 = await axios.post('http://localhost:5000/api/code/run', {
            code: pyCode,
            language: 'python',
            input: ''
        });
        console.log("PY run:", res1.data);
    } catch(e) {
        console.error(e.message, e.response?.data);
    }
}
test();
