// Compresse la vidéo hero du concours pour un chargement rapide.
// 62 MB → cible ~4-6 MB avec H.264 CRF 28 + audio 96k + downscale à 720p.
// Le résultat garde une qualité largement suffisante pour une vidéo verticale
// affichée en poster de 420 px de large.
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const SRC = process.argv[2] || "C:\\Romero\\ADS 1 PHOTOGRAPHY EVENTS.mp4";
const OUT = "public/uploads/concours/video-concours.mp4";

if (!fs.existsSync(SRC)) {
  console.error("Source not found:", SRC);
  process.exit(1);
}

const before = fs.statSync(SRC).size;
console.log("Source :", (before / 1024 / 1024).toFixed(1), "MB");

// Vidéo verticale — downscale à 720p max en préservant l'aspect ratio.
// Faststart pour permettre au navigateur de commencer à décoder pendant
// le téléchargement (streaming progressif).
const args = [
  "-y",
  "-i", SRC,
  "-vf", "scale='min(720,iw)':-2",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "28",
  "-c:a", "aac",
  "-b:a", "96k",
  "-movflags", "+faststart",
  "-pix_fmt", "yuv420p",
  OUT,
];

console.log("Encoding…");
execFileSync(ffmpegInstaller.path, args, { stdio: "inherit" });

const after = fs.statSync(OUT).size;
const pct = ((1 - after / before) * 100).toFixed(0);
console.log("Result :", (after / 1024 / 1024).toFixed(2), "MB");
console.log("Reduction :", pct + "%");
