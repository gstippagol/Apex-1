const { executeCode } = require('../utils/executor');

async function test() {
    const code = `#include <stdio.h>
int main() {
    int a,b;
    scanf("%d %d", &a, &b);
    printf("%d", a+b);
    return 0;
}`;
    const result = await executeCode(code, 'c', '10 20');
    console.log("C execution result:");
    console.log(result);
}
test();
