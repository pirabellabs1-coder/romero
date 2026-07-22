import fs from "node:fs";
import path from "node:path";
import { buildUserGuidePDF } from "../src/lib/user-guide-pdf.ts";

const bytes = await buildUserGuidePDF();
const out = path.resolve("Romero-Studio-Guide-Utilisation.pdf");
fs.writeFileSync(out, bytes);
console.log("OK ->", out, bytes.length, "bytes");
