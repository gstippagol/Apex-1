class Node {
    constructor(val) {
        this.val = val;
        this.left = null;
        this.right = null;
    }
}

// TODO: Implement this function
function height(root) {
    return 0;
}

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let input = [];

rl.on("line", (line) => {
    input.push(line);
}).on("close", () => {
    let n = parseInt(input[0]);

    let root = null;

    console.log(height(root));
});