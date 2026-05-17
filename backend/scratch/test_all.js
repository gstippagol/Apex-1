const { executeCode } = require('../utils/executor');

async function test() {
    console.log("Testing JS:");
    console.log(await executeCode('console.log("JS works");', 'javascript', ''));
    console.log("Testing PY:");
    console.log(await executeCode('print("PY works")', 'python', ''));
    console.log("Testing C:");
    console.log(await executeCode('#include <stdio.h>\\nint main() { printf("C works"); return 0; }', 'c', ''));
    console.log("Testing CPP:");
    console.log(await executeCode('#include <iostream>\\nint main() { std::cout << "CPP works"; return 0; }', 'cpp', ''));
}
test();
