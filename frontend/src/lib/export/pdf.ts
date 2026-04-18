import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    console.warn('Element not found for PDF export, using fallback');
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFontSize(20);
    pdf.text('Daily Brief Report', 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('Content not available', 20, 40);
    pdf.save(`${filename}.pdf`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFontSize(20);
    pdf.text('Daily Brief Report', 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('Export failed - please try again', 20, 40);
    pdf.save(`${filename}.pdf`);
  }
}

export async function exportPDFText(content: string, filename: string) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(20);
  pdf.text('Daily Brief Report', pageWidth / 2, 20, { align: 'center' });

  pdf.setFontSize(12);
  const lines = content.split('\n');
  let y = 40;

  lines.forEach((line) => {
    if (y > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, 10, y);
    y += 7;
  });

  pdf.save(`${filename}.pdf`);
}
