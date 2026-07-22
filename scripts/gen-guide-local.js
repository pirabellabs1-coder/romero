// Génère le PDF localement pour vérification
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

// Copie simplifiée pour test local (charge le vrai lib compilé si possible)
process.env.NODE_PATH = path.join(__dirname, "..", "node_modules");
require("module").Module._initPaths();

// On charge le TS via un compilateur simple : dans notre cas on va appeler
// l'endpoint prod avec un token de bypass (dev-only).
// Alternative : compiler à la volée. Simple : téléchargement direct.
console.log(
  "Pour tester en local, utilise l'endpoint prod avec une session admin."
);
console.log(
  "Ou : lance `npm run dev` puis ouvre https://localhost:3000/api/admin/export/user-guide"
);
