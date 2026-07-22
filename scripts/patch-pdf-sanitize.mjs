import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
let c = fs.readFileSync(p, "utf8");
const marker = "const WINANSI_REPLACE: Array<[RegExp, string]> = [";
const end = "];";
const start = c.indexOf(marker);
if (start < 0) throw new Error("marker not found");
const finish = c.indexOf(end, start) + end.length;
const replacement =
  "const WINANSI_REPLACE: Array<[RegExp, string]> = [\n" +
  "  [/[\\u2009\\u200A\\u202F\\u205F\\u3000]/g, \" \"],\n" +
  "  [/[\\u2028\\u2029]/g, \"\\n\"],\n" +
  "  [/[\\uFEFF\\u200B\\u200C\\u200D]/g, \"\"],\n" +
  "  [/\\u2192/g, \"->\"],\n" +
  "  [/\\u2190/g, \"<-\"],\n" +
  "  [/\\u2194/g, \"<->\"],\n" +
  "  [/[\\u2500-\\u257F]/g, \"-\"],\n" +
  "  [/\\u2212/g, \"-\"],\n" +
  "];";
c = c.slice(0, start) + replacement + c.slice(finish);
fs.writeFileSync(p, c);
console.log("patched OK");
