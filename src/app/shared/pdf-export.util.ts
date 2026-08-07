/**
 * Helpers shared by the inventory PDF exports (jsPDF + jspdf-autotable).
 */

/** Title band and table colours used across the inventory PDFs, as RGB triplets. */
export const PDF_BRAND_FILL: [number, number, number] = [11, 78, 179];
export const PDF_BRAND_TEXT: [number, number, number] = [255, 207, 63];
export const PDF_HEADER_FILL: [number, number, number] = [217, 226, 243];
export const PDF_HEADER_TEXT: [number, number, number] = [31, 31, 31];
export const PDF_ZEBRA_FILL: [number, number, number] = [250, 250, 250];
export const PDF_SECTION_FILL: [number, number, number] = [220, 230, 241];
export const PDF_SUBSECTION_FILL: [number, number, number] = [243, 246, 250];

/**
 * jsPDF's built-in fonts only cover the WinAnsi character set; anything outside it
 * (em dashes, curly quotes, non-Latin scripts) is silently dropped from the output.
 * Normalise the common cases and flag the rest so nothing disappears unnoticed.
 */
export function pdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    // Keep tabs and line breaks; anything else outside WinAnsi becomes a visible marker.
    .replace(/[^\u0020-\u00FF]/g, (char) => ('\t\n\r'.includes(char) ? char : '?'));
}
