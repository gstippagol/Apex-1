const { executeCode } = require('../utils/executor');

async function testAll() {
    const codes = {
        'c': '#include <stdio.h>\\nint main() { printf("success"); return 0; }',
        'cpp': '#include <iostream>\\nint main() { std::cout << "success"; return 0; }',
        'java': 'public class Main { public static void main(String[] args) { System.out.print("success"); } }',
        'python': 'print("success", end="")',
        'javascript': 'process.stdout.write("success");'
    };

    for (const [lang, code] of Object.entries(codes)) {
        console.log(`\\n--- Testing ${lang} ---`);
        try {
            const result = await executeCode(code, lang, '');
            console.log(result);
        } catch (e) {
            console.log("Exception:", e);
        }
    }
}
testAll();
