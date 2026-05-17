const { executeCode } = require('../utils/executor');

async function test() {
    console.log(await executeCode('#include <stdio.h>\nint main() { printf("hello c"); return 0; }', 'c'));
}
test();
