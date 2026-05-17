const { executeCode } = require('./utils/executor');

async function test() {
    const code = `
#include <stdio.h>
int main() {
    int a;
    scanf("%d", &a);
    printf("%d", a * 2);
    return 0;
}
    `;
    const res = await executeCode(code, 'c', '5');
    console.log(res);
}
test();
