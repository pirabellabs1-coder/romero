/** Ajoute les annotations de type TS aux fonctions internes. */
import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
let s = fs.readFileSync(p, "utf8");

const R = [
  // import : on remet PDFPage / PDFFont pour typer
  [
    'import { PDFDocument, StandardFonts, rgb } from "pdf-lib";',
    'import { PDFDocument, StandardFonts, rgb } from "pdf-lib";\nimport type { PDFPage, PDFFont } from "pdf-lib";\n\ntype Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };\ntype Rgb = ReturnType<typeof rgb>;\ntype Hero = { bytes: Uint8Array; type: "jpg" | "png" } | null;\ntype ParaOpts = {\n  x: number;\n  y: number;\n  font: PDFFont;\n  size: number;\n  color?: Rgb;\n  maxWidth: number;\n  lineGap?: number;\n};\ntype HeaderDoc = {\n  title: string;\n  reference: string;\n  date: string;\n  weddingDate?: string;\n  dueDate?: string;\n};',
  ],
  ["export function sanitizeForPdf(s) {", "export function sanitizeForPdf(s: string): string {"],
  ["function wrapPage(page) {", "function wrapPage(page: PDFPage): PDFPage {"],
  [
    "  page.drawText = (text, options) =>\n    original(sanitizeForPdf(String(text ?? \"\")), options);",
    "  page.drawText = (text: string, options?: unknown) =>\n    original(sanitizeForPdf(String(text ?? \"\")), options as never);",
  ],
  ["function sanitizeDeep(input) {", "function sanitizeDeep<T>(input: T): T {"],
  [
    '  if (typeof input === "string") return sanitizeForPdf(input);\n  if (Array.isArray(input)) return input.map((v) => sanitizeDeep(v));\n  if (typeof input === "object") {\n    const out = {};\n    for (const [k, v] of Object.entries(input)) out[k] = sanitizeDeep(v);\n    return out;\n  }',
    '  if (typeof input === "string") return sanitizeForPdf(input) as unknown as T;\n  if (Array.isArray(input)) return input.map((v) => sanitizeDeep(v)) as unknown as T;\n  if (typeof input === "object") {\n    const out: Record<string, unknown> = {};\n    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {\n      out[k] = sanitizeDeep(v);\n    }\n    return out as unknown as T;\n  }',
  ],
  ["async function loadFonts(pdf) {", "async function loadFonts(pdf: PDFDocument): Promise<Fonts> {"],
  ["function formatCents(cents) {", "function formatCents(cents: number): string {"],
  ["function formatDate(iso) {", "function formatDate(iso: string): string {"],
  ["const formatDateUpper = (iso) => formatDate(iso).toUpperCase();", "const formatDateUpper = (iso: string): string => formatDate(iso).toUpperCase();"],
  [
    "function wrapText(text, font, size, maxWidth) {",
    "function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {",
  ],
  ["  const lines = [];", "  const lines: string[] = [];"],
  ["function drawParagraph(page, text, opts) {", "function drawParagraph(page: PDFPage, text: string, opts: ParaOpts): number {"],
  [
    "function rightAlign(page, text, rightX, y, size, font, color = INK) {",
    "function rightAlign(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color: Rgb = INK) {",
  ],
  [
    "function centerText(page, text, cx, y, size, font, color = INK) {",
    "function centerText(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color: Rgb = INK) {",
  ],
  ["function drawTopRightCurve(page) {", "function drawTopRightCurve(page: PDFPage) {"],
  ["function drawBottomCurves(page) {", "function drawBottomCurves(page: PDFPage) {"],
  [
    "function drawDotGrid(page, x, y, cols = 12, gap = 5.6) {",
    "function drawDotGrid(page: PDFPage, x: number, y: number, cols = 12, gap = 5.6) {",
  ],
  [
    "function drawLogo(page, x, y, scale = 1) {",
    "function drawLogo(page: PDFPage, x: number, y: number, scale = 1) {",
  ],
  ["let heroCache;", "let heroCache: Hero | undefined;"],
  ["export function __setHeroCacheForTest(v) {", "export function __setHeroCacheForTest(v: Hero): void {"],
  ["export async function fetchHeroImage() {", "export async function fetchHeroImage(): Promise<Hero> {"],
  [
    "    const row = await queryOne(",
    "    const row = await queryOne<{ value: string }>(",
  ],
  [
    "async function drawHeroPhoto(pdf, page, hero) {",
    "async function drawHeroPhoto(pdf: PDFDocument, page: PDFPage, hero: Hero): Promise<void> {",
  ],
  ["    const smooth = (u) => u * u * (3 - 2 * u);", "    const smooth = (u: number) => u * u * (3 - 2 * u);"],
  [
    "function drawDocHeader(page, fonts, studio, doc) {",
    "function drawDocHeader(page: PDFPage, fonts: Fonts, studio: StudioProfile, doc: HeaderDoc): number {",
  ],
  [
    'function drawClientBlock(page, fonts, client, y, label = "CLIENTS") {',
    'function drawClientBlock(page: PDFPage, fonts: Fonts, client: Client, y: number, label = "CLIENTS"): number {',
  ],
  ["function colBounds() {", "function colBounds(): number[] {"],
  ["  const xs = [];", "  const xs: number[] = [];"],
  [
    "function drawLinesTable(page, fonts, lines, startY, vatRatePct, vatApplicable) {",
    "function drawLinesTable(\n  page: PDFPage,\n  fonts: Fonts,\n  lines: DocumentLine[],\n  startY: number,\n  vatRatePct: number,\n  vatApplicable: boolean\n): { y: number; subtotal: number; vat: number; total: number } {",
  ],
  [
    "function drawTotalBar(page, fonts, label, amountCents, y, opts) {",
    "function drawTotalBar(\n  page: PDFPage,\n  fonts: Fonts,\n  label: string,\n  amountCents: number,\n  y: number,\n  opts?: { muted?: boolean }\n): number {",
  ],
  [
    "function drawDepositBox(page, fonts, pct, amountCents, x, y, w) {",
    "function drawDepositBox(\n  page: PDFPage,\n  fonts: Fonts,\n  pct: number,\n  amountCents: number,\n  x: number,\n  y: number,\n  w: number\n): void {",
  ],
  [
    'function drawSignatureBox(page, fonts, x, y, w, title = "SIGNATURE") {',
    'function drawSignatureBox(\n  page: PDFPage,\n  fonts: Fonts,\n  x: number,\n  y: number,\n  w: number,\n  title = "SIGNATURE"\n): void {',
  ],
  [
    "function drawLabeledBox(page, fonts, title, body, x, y, w, h) {",
    "function drawLabeledBox(\n  page: PDFPage,\n  fonts: Fonts,\n  title: string,\n  body: string | undefined,\n  x: number,\n  y: number,\n  w: number,\n  h: number\n): void {",
  ],
  [
    "function drawFooter(page, fonts, studio, opts) {",
    "function drawFooter(\n  page: PDFPage,\n  fonts: Fonts,\n  studio: StudioProfile,\n  opts?: { decorated?: boolean }\n): void {",
  ],
  [
    "export async function buildQuotePdf(rawInput) {",
    "export async function buildQuotePdf(rawInput: {\n  studio: StudioProfile;\n  doc: QuoteDoc;\n}): Promise<Uint8Array> {",
  ],
  [
    "export async function buildInvoicePdf(rawInput) {",
    "export async function buildInvoicePdf(rawInput: {\n  studio: StudioProfile;\n  doc: InvoiceDoc;\n}): Promise<Uint8Array> {",
  ],
  [
    "export async function buildContractPdf(rawInput) {",
    "export async function buildContractPdf(rawInput: {\n  studio: StudioProfile;\n  doc: ContractDoc;\n}): Promise<Uint8Array> {",
  ],
  [
    "function drawFieldLine(page, fonts, label, value, x, y, lineW = 200) {",
    "function drawFieldLine(\n  page: PDFPage,\n  fonts: Fonts,\n  label: string,\n  value: string | undefined,\n  x: number,\n  y: number,\n  lineW = 200\n): void {",
  ],
  [
    "function drawCheckbox(page, fonts, label, x, y) {",
    "function drawCheckbox(page: PDFPage, fonts: Fonts, label: string, x: number, y: number): void {",
  ],
  [
    "  const heading = (t) => {",
    "  const heading = (t: string) => {",
  ],
  [
    "  const ensureRoom = (need) => {",
    "  const ensureRoom = (need: number) => {",
  ],
  [
    "  const article = (num, title, body) => {",
    "  const article = (num: number, title: string, body: string) => {",
  ],
  [
    "const WINANSI_REPLACE = [",
    "const WINANSI_REPLACE: Array<[RegExp, string]> = [",
  ],
];

let applied = 0;
for (const [from, to] of R) {
  if (s.includes(from)) {
    s = s.split(from).join(to);
    applied++;
  } else {
    console.warn("NOT FOUND: " + from.slice(0, 70).replace(/\n/g, "\\n"));
  }
}

fs.writeFileSync(p, s);
console.log("annotated " + applied + "/" + R.length);
