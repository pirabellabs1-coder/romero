import fs from "node:fs";
import { buildQuotePdf, __setHeroCacheForTest } from "../src/lib/pdf-generator.ts";
const HERO="https://crqsj8bzda2jtevv.public.blob.vercel-storage.com/posts/hero-1781813364572-o90lnp-DSC02398.jpg";
const r=await fetch(HERO); const buf=new Uint8Array(await r.arrayBuffer());
__setHeroCacheForTest({bytes:buf,type:buf[0]===0x89?"png":"jpg"});
const studio={company_legal_name:"Mickael Romero",company_status:"Micro-entrepreneur",company_siret:"85325574300025",company_address:"12 rue du grand pin, 06100 Nice",company_email:"romerophotography.contact@gmail.com",company_phone:"06 04 03 70 76",vat_status:"no"};
const mini={reference:"DEV-2026-050",issue_date:"2026-07-23",validity_days:60,
  client:{name:"Sophie & Marc",email:"sophie@example.com"},
  wedding:{date:"2027-06-12",location:"Antibes",formula_name:"Le Grand Classique"},
  lines:[{label:"Formule Le Grand Classique",detail:"Preparatifs des maries\nCeremonie civile et laique ou religieuse\nPhotos de couple et de groupe\nVin d'honneur\nOuverture de bal\nGalerie privee en ligne\nRetouches premium",quantity:1,unit_price_cents:249900}],
  deposit_pct:30};
fs.writeFileSync("v9-mini.pdf", await buildQuotePdf({studio,doc:mini}));
console.log("OK mini");
