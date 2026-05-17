const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://emkc.org/api/v2/piston/runtimes');
        console.log(JSON.stringify(res.data.filter(r => ['c', 'cpp', 'python', 'javascript', 'java'].includes(r.language)), null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
test();
