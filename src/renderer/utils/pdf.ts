import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const DEFAULT_RECEIPT_WIDTH_MM = 80;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MAX_PAGE_HEIGHT_MM = 2000;
const MIN_PAGE_HEIGHT_MM = 20;

const NAMED_FORMATS: Record<string, [number, number]> = {
  a4: [A4_WIDTH_MM, A4_HEIGHT_MM],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

export interface PDFGenerationOptions {
  filename?: string;
  format?: 'a4' | 'letter' | 'legal';
  margin?: number;
  quality?: number;
  paperWidth?: number;
  maxPageHeight?: number;
}

export function parsePaperWidthMm(value?: string | null): number {
  if (!value) return DEFAULT_RECEIPT_WIDTH_MM;

  const raw = String(value).trim();
  const mm = /^(\d+(?:\.\d+)?)\s*mm$/i.exec(raw);

  if (mm) {
    const parsed = parseFloat(mm[1]);
    if (parsed > 0) return parsed;
  }

  if (/^a4$/i.test(raw)) return A4_WIDTH_MM;

  return DEFAULT_RECEIPT_WIDTH_MM;
}

function createSlice(
  source: HTMLCanvasElement,
  sourceY: number,
  sourceHeight: number
): HTMLCanvasElement {
  const slice = document.createElement('canvas');
  slice.width = source.width;
  slice.height = sourceHeight;

  const context = slice.getContext('2d');
  if (context) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      source,
      0,
      sourceY,
      source.width,
      sourceHeight,
      0,
      0,
      source.width,
      sourceHeight
    );
  }

  return slice;
}

export async function generateReceiptPDF(
  element: HTMLElement,
  options: PDFGenerationOptions = {}
): Promise<Blob> {
  const { margin = 0, quality = 2, maxPageHeight } = options;

  const namedFormat = options.format
    ? NAMED_FORMATS[options.format.toLowerCase()]
    : undefined;
  const paperWidthMm = options.paperWidth ?? DEFAULT_RECEIPT_WIDTH_MM;

  const pageWidthMm = namedFormat ? namedFormat[0] : paperWidthMm;
  const defaultPageHeightLimitMm =
    paperWidthMm > A4_WIDTH_MM / 2 ? A4_HEIGHT_MM : MAX_PAGE_HEIGHT_MM;
  const pageHeightLimitMm = Math.min(
    maxPageHeight ?? namedFormat?.[1] ?? defaultPageHeightLimitMm,
    MAX_PAGE_HEIGHT_MM
  );

  const canvas = await html2canvas(element, {
    scale: quality,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: Math.max(document.documentElement.clientWidth, 1280),
    windowHeight: Math.max(document.documentElement.clientHeight, 1024),
  });

  const imageWidth = canvas.width;
  const imageHeight = canvas.height;

  if (!imageWidth || !imageHeight) {
    throw new Error('Receipt could not be rendered to an image');
  }

  const contentWidthMm = Math.max(pageWidthMm - 2 * margin, 1);
  const contentHeightMm = imageHeight * (contentWidthMm / imageWidth);
  const pageHeightMm = Math.min(
    Math.max(contentHeightMm, MIN_PAGE_HEIGHT_MM),
    Math.max(pageHeightLimitMm, MIN_PAGE_HEIGHT_MM)
  );

  const pageCount = Math.max(1, Math.ceil(contentHeightMm / pageHeightMm));
  const isPortrait = pageHeightMm >= pageWidthMm;
  const orientation = isPortrait ? 'portrait' : 'landscape';
  const pageFormat: number[] = isPortrait
    ? [pageWidthMm, pageHeightMm]
    : [pageHeightMm, pageWidthMm];

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageFormat,
    compress: true,
  });

  const mmPerPixel = contentWidthMm / imageWidth;
  const sliceHeightPx = imageHeight / pageCount;

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) {
      pdf.addPage(pageFormat, orientation);
    }

    const sourceY = Math.round(page * sliceHeightPx);
    const sourceHeight =
      page === pageCount - 1
        ? imageHeight - sourceY
        : Math.round(sliceHeightPx);

    const slice = createSlice(canvas, sourceY, sourceHeight);
    const sliceHeightMm = slice.height * mmPerPixel;

    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      margin,
      pageHeightMm - margin - sliceHeightMm,
      contentWidthMm,
      sliceHeightMm
    );
  }

  return pdf.output('blob');
}

export async function generateReceiptPDFFile(
  element: HTMLElement,
  filename: string = 'receipt.pdf',
  options: Omit<PDFGenerationOptions, 'filename'> = {}
): Promise<void> {
  const blob = await generateReceiptPDF(element, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function saveReceiptPDF(
  element: HTMLElement,
  defaultFilename: string = 'receipt.pdf',
  options: Omit<PDFGenerationOptions, 'filename'> = {}
): Promise<{ success: boolean; filePath?: string }> {
  const blob = await generateReceiptPDF(element, options);
  const buffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  const array = Array.from(uint8Array);

  return window.electronAPI.savePDF({
    data: array,
    defaultFilename,
  });
}
