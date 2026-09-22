import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFGenerationOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter' | 'legal';
  margin?: number;
  quality?: number;
}

export async function generateReceiptPDF(
  element: HTMLElement,
  options: PDFGenerationOptions = {}
): Promise<Blob> {
  const {
    orientation = 'portrait',
    format = 'a4',
    margin = 10,
    quality = 2,
  } = options;

  const canvas = await html2canvas(element, {
    scale: quality,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const effectiveWidth = pdfWidth - 2 * margin;
  const effectiveHeight = pdfHeight - 2 * margin;

  const widthRatio = effectiveWidth / imgWidth;
  const heightRatio = effectiveHeight / imgHeight;
  const ratio = Math.min(widthRatio, heightRatio);

  const finalWidth = imgWidth * ratio;
  const finalHeight = imgHeight * ratio;

  const x = (pdfWidth - finalWidth) / 2;
  const y = margin;

  pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

  return pdf.output('blob');
}

export async function generateReceiptPDFFile(
  element: HTMLElement,
  filename: string = 'receipt.pdf',
  options: Omit<PDFGenerationOptions, 'filename'> = {}
): Promise<void> {
  const blob = await generateReceiptPDF(element, { ...options, filename });
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
  defaultFilename: string = 'receipt.pdf'
): Promise<{ success: boolean; filePath?: string }> {
  const blob = await generateReceiptPDF(element);
  const buffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  const array = Array.from(uint8Array);
  
  return window.electronAPI.savePDF({
    data: array,
    defaultFilename,
  });
}
