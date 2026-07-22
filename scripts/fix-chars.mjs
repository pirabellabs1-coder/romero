import fs from "node:fs";
const p = "src/lib/user-guide-pdf.ts";
let c = fs.readFileSync(p, "utf8");
c = c.replaceAll("→", "->").replaceAll("─", "-");
fs.writeFileSync(p, c);
console.log("done");
