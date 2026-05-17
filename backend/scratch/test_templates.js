const { executeCode } = require('../utils/executor');

async function test() {
    const cCode = '#include <stdio.h>\\n\\nint main() {\\n    // Read input from stdin\\n    // Example: int a; scanf("%d", &a);\\n\\n    // Write output to stdout\\n    // Example: printf("%d", a);\\n\\n    return 0;\\n}';
    console.log("C:", await executeCode(cCode, 'c', ''));

    const pyCode = 'import sys\\n\\ndef main():\\n    # Read all input from standard input\\n    input_data = sys.stdin.read().split()\\n    if not input_data: return\\n    \\n    # Example: a = int(input_data[0])\\n    \\n    # Write output to standard output\\n    # Example: print(a)\\n\\nif __name__ == "__main__":\\n    main()\\n';
    console.log("PY:", await executeCode(pyCode, 'python', ''));

    const jsCode = 'const fs = require("fs");\\n\\nfunction main() {\\n    // Read all input from standard input\\n    const input = fs.readFileSync(0, "utf-8").trim().split(/\\\\s+/);\\n    if (input.length === 0 || input[0] === "") return;\\n\\n    // Example: const a = parseInt(input[0], 10);\\n\\n    // Write output to standard output\\n    // Example: console.log(a);\\n}\\n\\nmain();\\n';
    console.log("JS:", await executeCode(jsCode, 'javascript', ''));
}
test();
