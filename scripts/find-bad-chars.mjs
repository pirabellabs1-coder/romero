import fs from "node:fs";
const c = fs.readFileSync("src/lib/user-guide-pdf.ts", "utf8");
const bad = new Set();
for (const ch of c) {
  const cp = ch.codePointAt(0);
  if (cp > 0xff) bad.add(ch + " U+" + cp.toString(16));
}
console.log([...bad].join("\n"));
