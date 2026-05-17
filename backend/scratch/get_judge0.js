const axios = require('axios');
async function get() {
    try {
        const res = await axios.get('https://ce.judge0.com/languages');
        console.log(JSON.stringify(res.data.filter(l => ['C', 'C++', 'Java', 'Python', 'JavaScript'].some(n => l.name.includes(n))), null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
get();
