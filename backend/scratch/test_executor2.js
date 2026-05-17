const { executeCode } = require('../utils/executor');

async function test() {
    console.log(await executeCode('print("hello python")', 'python'));
    console.log(await executeCode('console.log("hello js")', 'javascript'));
}
test();
