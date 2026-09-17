/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import { Citation } from '../types';

export interface ExportPdfOptions {
  imageDataBase64: string;
  title: string;
  sourceUrlOrName?: string;
  citations?: Citation[];
  type?: string;
  language?: string;
  style?: string;
}

export async function exportInfographicToPdf({
  imageDataBase64,
  title,
  sourceUrlOrName,
  citations = [],
  type = 'SiteSketch Infographic',
  language,
  style
}: ExportPdfOptions): Promise<void> {
  const base64Src = imageDataBase64.startsWith('data:')
    ? imageDataBase64
    : `data:image/png;base64,${imageDataBase64}`;

  // Pre-load image to get natural aspect ratio and dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
    img.src = base64Src;
  });

  const imgWidth = img.naturalWidth || img.width || 1200;
  const imgHeight = img.naturalHeight || img.height || 800;
  const isLandscape = imgWidth >= imgHeight;

  // Initialize PDF in matching orientation
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 8;
  const headerHeight = 20;
  const footerHeight = 10;

  // 1. Header Bar (Dark slate theme)
  pdf.setFillColor(10, 15, 30);
  pdf.rect(0, 0, pageWidth, headerHeight, 'F');

  // Accent Line
  pdf.setFillColor(16, 185, 129); // Emerald accent
  pdf.rect(0, headerHeight - 1, pageWidth, 1, 'F');

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(248, 250, 252);
  const cleanTitle = (title || 'Infographic Summary').trim();
  pdf.text(cleanTitle.length > 55 ? cleanTitle.slice(0, 52) + '...' : cleanTitle, margin, 8);

  // Subtitle (Type, Style, Language, Source)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  const metaParts = [type];
  if (style) metaParts.push(`Style: ${style}`);
  if (language) metaParts.push(`Language: ${language}`);
  if (sourceUrlOrName) metaParts.push(`Source: ${sourceUrlOrName}`);
  const subtitle = metaParts.join(' • ');
  pdf.text(subtitle.length > 95 ? subtitle.slice(0, 92) + '...' : subtitle, margin, 15);

  // Date Stamp
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  pdf.text(dateStr, pageWidth - margin, 11, { align: 'right' });

  // 2. Infographic Image (Aspect-Fit scaling)
  const maxAvailableWidth = pageWidth - margin * 2;
  const maxAvailableHeight = pageHeight - headerHeight - footerHeight - margin * 2;

  const scale = Math.min(maxAvailableWidth / imgWidth, maxAvailableHeight / imgHeight);
  const renderWidth = imgWidth * scale;
  const renderHeight = imgHeight * scale;

  const renderX = margin + (maxAvailableWidth - renderWidth) / 2;
  const renderY = headerHeight + margin + (maxAvailableHeight - renderHeight) / 2;

  // Background behind image for contrast
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(renderX - 1, renderY - 1, renderWidth + 2, renderHeight + 2, 2, 2, 'F');

  // Add Image
  pdf.addImage(base64Src, 'PNG', renderX, renderY, renderWidth, renderHeight, undefined, 'FAST');

  // 3. Footer Bar
  pdf.setFillColor(10, 15, 30);
  pdf.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Repo Vision Studio • Visual Intelligence Platform', margin, pageHeight - 4);
  pdf.text('Powered by Nano Banana Pro', pageWidth - margin, pageHeight - 4, { align: 'right' });

  // 4. Grounding Sources Page (if citations exist)
  if (citations && citations.length > 0) {
    pdf.addPage();

    // Header
    pdf.setFillColor(10, 15, 30);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');
    pdf.setFillColor(16, 185, 129);
    pdf.rect(0, headerHeight - 1, pageWidth, 1, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(248, 250, 252);
    pdf.text('Verified Grounding Sources & References', margin, 9);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`References utilized for: ${cleanTitle}`, margin, 15);

    let yOffset = headerHeight + 12;

    citations.forEach((cite, index) => {
      if (yOffset > pageHeight - 25) {
        pdf.addPage();
        yOffset = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      const citeTitle = `${index + 1}. ${cite.title || 'Web Document'}`;
      pdf.text(citeTitle.length > 80 ? citeTitle.slice(0, 77) + '...' : citeTitle, margin, yOffset);
      yOffset += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(5, 150, 105);
      pdf.text(cite.uri, margin + 4, yOffset);
      yOffset += 7;
    });

    // Footer
    pdf.setFillColor(10, 15, 30);
    pdf.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Repo Vision Studio • Grounded Intelligence Report', margin, pageHeight - 4);
  }

  // Generate clean filename
  const safeTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'infographic';
  pdf.save(`${safeTitle}-infographic.pdf`);
}
