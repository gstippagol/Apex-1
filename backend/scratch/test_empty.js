const { executeCode } = require('../utils/executor');

async function test() {
    console.log("Testing JS with empty input...");
    const js = `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8');
console.log('input is', input);`;
    console.log(await executeCode(js, 'javascript', ''));
    
    console.log("Testing Python with empty input...");
    const py = `import sys
input_data = sys.stdin.read()
print('input is', input_data)`;
    console.log(await executeCode(py, 'python', ''));
}
test();
