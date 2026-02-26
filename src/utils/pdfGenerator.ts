import { jsPDF } from 'jspdf';
import { PlotData, FeasibilityResult } from '@/services/DDAGISService';

export async function generatePlotPDF(plot: PlotData, feasibility: FeasibilityResult): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Background
  pdf.setFillColor(15, 23, 42); // Dark background
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header with gradient effect (simulated with rectangles)
  pdf.setFillColor(6, 182, 212); // Cyan
  pdf.rect(0, 0, pageWidth, 50, 'F');
  pdf.setFillColor(139, 92, 246); // Purple gradient
  pdf.rect(pageWidth - 60, 0, 60, 50, 'F');

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DDA Plot Report', margin, 30);

  // Date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-AE', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, 40);

  yPos = 70;

  // Plot Number Section
  pdf.setFillColor(30, 41, 59);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, 'F');
  
  pdf.setFontSize(12);
  pdf.setTextColor(148, 163, 184);
  pdf.text('Plot Number', margin + 10, yPos + 10);
  
  pdf.setFontSize(18);
  pdf.setTextColor(6, 182, 212);
  pdf.setFont('helvetica', 'bold');
  pdf.text(plot.id, margin + 10, yPos + 20);

  yPos += 35;

  // Location & Status Row
  pdf.setFillColor(30, 41, 59);
  pdf.roundedRect(margin, yPos, (pageWidth - margin * 2 - 10) / 2, 30, 3, 3, 'F');
  pdf.roundedRect(margin + (pageWidth - margin * 2 - 10) / 2 + 10, yPos, (pageWidth - margin * 2 - 10) / 2, 30, 3, 3, 'F');

  // Location
  pdf.setFontSize(10);
  pdf.setTextColor(148, 163, 184);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Area / Location', margin + 10, yPos + 10);
  
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  const location = plot.location || plot.project || plot.entity || 'Dubai';
  pdf.text(location.substring(0, 25), margin + 10, yPos + 22);

  // Status
  const statusX = margin + (pageWidth - margin * 2 - 10) / 2 + 20;
  pdf.setFontSize(10);
  pdf.setTextColor(148, 163, 184);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Status', statusX, yPos + 10);
  
  pdf.setFontSize(12);
  if (plot.status === 'Available') {
    pdf.setTextColor(34, 197, 94);
  } else if (plot.status === 'Frozen') {
    pdf.setTextColor(239, 68, 68);
  } else {
    pdf.setTextColor(249, 115, 22);
  }
  pdf.setFont('helvetica', 'bold');
  pdf.text(plot.status, statusX, yPos + 22);

  yPos += 45;

  // Property Details Section
  pdf.setFontSize(14);
  pdf.setTextColor(6, 182, 212);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Property Details', margin, yPos);

  yPos += 10;

  const detailsData = [
    ['Plot Size', `${plot.area.toLocaleString()} m²`],
    ['Gross Floor Area (GFA)', `${plot.gfa.toLocaleString()} m²`],
    ['Floors Allowed', plot.floors],
    ['Zoning', plot.zoning],
    ['Developer', plot.developer || 'N/A'],
    ['Project', plot.project || 'N/A'],
    ['Max Height', plot.maxHeight ? `${plot.maxHeight}m` : 'N/A'],
    ['Plot Coverage', plot.plotCoverage ? `${plot.plotCoverage}%` : 'N/A']
  ];

  pdf.setFillColor(30, 41, 59);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, detailsData.length * 10 + 10, 3, 3, 'F');

  yPos += 5;
  detailsData.forEach(([label, value], index) => {
    const rowY = yPos + (index * 10) + 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(148, 163, 184);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, margin + 10, rowY);
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, pageWidth - margin - 10, rowY, { align: 'right' });
  });

  yPos += detailsData.length * 10 + 20;

  // Feasibility Analysis Section
  pdf.setFontSize(14);
  pdf.setTextColor(139, 92, 246);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Feasibility Analysis', margin, yPos);

  yPos += 10;

  const feasibilityData = [
    ['Estimated Revenue', `AED ${(feasibility.revenue / 1000000).toFixed(2)}M`],
    ['Estimated Cost', `AED ${(feasibility.cost / 1000000).toFixed(2)}M`],
    ['Projected Profit', `AED ${(feasibility.profit / 1000000).toFixed(2)}M`],
    ['Return on Investment (ROI)', `${feasibility.roi}%`],
    ['Profit Margin', `${feasibility.profitMargin}%`],
    ['Risk Level', feasibility.riskLevel]
  ];

  pdf.setFillColor(30, 41, 59);
  pdf.roundedRect(margin, yPos, pageWidth - margin * 2, feasibilityData.length * 10 + 10, 3, 3, 'F');

  yPos += 5;
  feasibilityData.forEach(([label, value], index) => {
    const rowY = yPos + (index * 10) + 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(148, 163, 184);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, margin + 10, rowY);
    
    // Color code based on value type
    if (label.includes('ROI')) {
      pdf.setTextColor(34, 197, 94);
    } else if (label.includes('Risk')) {
      if (value === 'Low') pdf.setTextColor(34, 197, 94);
      else if (value === 'Medium') pdf.setTextColor(249, 115, 22);
      else pdf.setTextColor(239, 68, 68);
    } else {
      pdf.setTextColor(255, 255, 255);
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, pageWidth - margin - 10, rowY, { align: 'right' });
  });

  yPos += feasibilityData.length * 10 + 25;

  // Footer
  pdf.setFillColor(30, 41, 59);
  pdf.rect(0, pageHeight - 30, pageWidth, 30, 'F');

  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.setFont('helvetica', 'normal');
  pdf.text('This report is generated from DDA GIS data for informational purposes only.', margin, pageHeight - 20);
  pdf.text('Data source: Dubai Development Authority (DDA) GIS Services', margin, pageHeight - 14);
  
  pdf.setTextColor(6, 182, 212);
  pdf.text('HyperPlot AI', pageWidth - margin, pageHeight - 17, { align: 'right' });

  // Save PDF
  pdf.save(`DDA-Plot-${plot.id}-Report.pdf`);
}
