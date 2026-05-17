const { executeCode } = require('../utils/executor');

async function test() {
    const jsCode = `
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8');
console.log("Got: " + input);
    `;
    console.log("JS:", await executeCode(jsCode, 'javascript', 'hello input'));

    const pyCode = `
import sys
input_data = sys.stdin.read()
print("Got: " + input_data)
    `;
    console.log("PY:", await executeCode(pyCode, 'python', 'hello input'));
}
test();
