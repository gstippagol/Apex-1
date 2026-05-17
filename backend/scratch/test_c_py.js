const { executeCode } = require('../utils/executor');

async function test() {
    console.log("C test:");
    console.log(await executeCode('#include <stdio.h>\\nint main() { printf("success"); return 0; }', 'c', ''));
    console.log("Python test:");
    console.log(await executeCode('print("success")', 'python', ''));
}
test();
