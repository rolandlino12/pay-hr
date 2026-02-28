// Utilities for file handling, export and document management
import jsPDF from 'jspdf';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  name: string; // Original filename
  label: string; // User-defined label/title
  type: string;
  size: number;
  data: string; // Base64 encoded
  createdAt: string;
}

// Export data as CSV
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(';'),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(';')) {
          return `"${value}"`;
        }
        return String(value);
      }).join(';')
    )
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// Export data as JSON
export function exportToJSON(data: unknown, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

// Generate and download payslip as HTML (printable)
export function generatePayslipHTML(
  employee: { firstName: string; lastName: string; matricule: string; position: string; phone?: string; cnssNumber?: string; nif?: string; },
  payroll: {
    month: string;
    baseSalary: number;
    grossEarnings: number;
    netSalary: number;
    cnssEmployee: number;
    amuEmployee: number;
    irpp: number;
    familyChargeDeduction?: number;
    components: { name: string; amount: number }[];
    otherDeductions?: { type: string; description: string; amount: number }[];
    modifications?: { date: string; note: string }[];
  },
  company: { name: string; address?: string; nif?: string; cnssNumber?: string; }
): string {
  const monthName = new Date(payroll.month + '-01').toLocaleDateString('fr-FR', { 
    month: 'long', 
    year: 'numeric' 
  });

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bulletin de paie - ${employee.firstName} ${employee.lastName} - ${monthName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; padding: 20px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
    .company { font-size: 14px; }
    .company-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
    .employee-info { text-align: right; }
    .title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0; background: #f5f5f5; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f9f9f9; font-weight: 600; }
    .amount { text-align: right; }
    .section-title { background: #e9e9e9; font-weight: bold; }
    .total-row { font-weight: bold; background: #f0f0f0; }
    .net-row { font-size: 14px; background: #333; color: white; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature { text-align: center; padding-top: 40px; border-top: 1px solid #333; width: 200px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <div class="company-name">${company.name || 'Entreprise'}</div>
      ${company.address ? `<div>${company.address}</div>` : ''}
      ${company.nif ? `<div>NIF: ${company.nif}</div>` : ''}
      ${company.cnssNumber ? `<div>CNSS Employeur: ${company.cnssNumber}</div>` : ''}
    </div>
  <div class="employee-info">
      <div><strong>${employee.firstName} ${employee.lastName}</strong></div>
      <div>Matricule: ${employee.matricule}</div>
      <div>Poste: ${employee.position}</div>
      ${employee.phone ? `<div>Tel: ${employee.phone}</div>` : ''}
      ${employee.cnssNumber ? `<div>CNSS: ${employee.cnssNumber}</div>` : ''}
      ${employee.nif ? `<div>NIF: ${employee.nif}</div>` : ''}
    </div>
  </div>

  <div class="title">BULLETIN DE PAIE - ${monthName.toUpperCase()}</div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="amount">Montant (FCFA)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="section-title">
        <td colspan="2">RÉMUNÉRATION</td>
      </tr>
      <tr>
        <td>Salaire de base</td>
        <td class="amount">${formatAmount(payroll.baseSalary)}</td>
      </tr>
      ${payroll.components.map(c => `
      <tr>
        <td>${c.name}</td>
        <td class="amount">${formatAmount(c.amount)}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td>SALAIRE BRUT</td>
        <td class="amount">${formatAmount(payroll.grossEarnings)}</td>
      </tr>
      <tr class="section-title">
        <td colspan="2">RETENUES LEGALES</td>
      </tr>
      <tr>
        <td>CNSS (Part salariale)</td>
        <td class="amount">- ${formatAmount(payroll.cnssEmployee)}</td>
      </tr>
      <tr>
        <td>AMU (Part salariale)</td>
        <td class="amount">- ${formatAmount(payroll.amuEmployee)}</td>
      </tr>
      ${payroll.familyChargeDeduction && payroll.familyChargeDeduction > 0 ? `
      <tr>
        <td>Deduction charges familiales</td>
        <td class="amount" style="color: #16a34a;">- ${formatAmount(payroll.familyChargeDeduction)}</td>
      </tr>
      ` : ''}
      <tr>
        <td>IRPP</td>
        <td class="amount">- ${formatAmount(payroll.irpp)}</td>
      </tr>
      ${payroll.otherDeductions && payroll.otherDeductions.length > 0 ? `
      <tr class="section-title">
        <td colspan="2">AUTRES RETENUES</td>
      </tr>
      ${payroll.otherDeductions.map(d => `
      <tr>
        <td>${d.description} (${d.type})</td>
        <td class="amount">- ${formatAmount(d.amount)}</td>
      </tr>
      `).join('')}
      ` : ''}
      <tr class="total-row">
        <td>TOTAL RETENUES</td>
        <td class="amount">- ${formatAmount(
          payroll.cnssEmployee + payroll.amuEmployee + payroll.irpp + 
          (payroll.otherDeductions?.reduce((s, d) => s + d.amount, 0) || 0)
        )}</td>
      </tr>
      <tr class="net-row">
        <td>NET A PAYER</td>
        <td class="amount">${formatAmount(payroll.netSalary)}</td>
      </tr>
    </tbody>
  </table>
  
  ${payroll.modifications && payroll.modifications.length > 0 ? `
  <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
    <p style="font-weight: bold; margin-bottom: 5px;">Modifications apportees:</p>
    ${payroll.modifications.map(m => `
    <p style="font-size: 11px; margin: 2px 0;">- ${new Date(m.date).toLocaleDateString('fr-FR')}: ${m.note}</p>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    <div class="signature">L'Employeur</div>
    <div class="signature">L'Employé</div>
  </div>
</body>
</html>
  `;
}

function formatAmount(amount: number): string {
  // Use regular space instead of non-breaking space for PDF compatibility
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Download payslip as PDF file
export function downloadPayslip(
  employee: { firstName: string; lastName: string; matricule: string; position: string; phone?: string; cnssNumber?: string; nif?: string; },
  payroll: {
    month: string;
    baseSalary: number;
    grossEarnings: number;
    netSalary: number;
    cnssEmployee: number;
    amuEmployee: number;
    irpp: number;
    familyChargeDeduction?: number;
    components: { name: string; amount: number }[];
    otherDeductions?: { type: string; description: string; amount: number }[];
    modifications?: { date: string; note: string }[];
  },
  company: { name: string; address?: string; nif?: string; cnssNumber?: string; logo?: string; }
): void {
  const monthName = new Date(payroll.month + '-01').toLocaleDateString('fr-FR', { 
    month: 'long', 
    year: 'numeric' 
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Add watermark logo if available
  if (company.logo) {
    try {
      // Add watermark in the center of the page (faded)
      const watermarkSize = 100;
      const watermarkX = (pageWidth - watermarkSize) / 2;
      const watermarkY = (pageHeight - watermarkSize) / 2;
      
      // Save current graphics state
      pdf.saveGraphicsState();
      // Set transparency for watermark
      pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
      pdf.addImage(company.logo, 'AUTO', watermarkX, watermarkY, watermarkSize, watermarkSize);
      // Restore graphics state
      pdf.restoreGraphicsState();
    } catch (e) {
      console.warn('Could not add watermark logo:', e);
    }
  }

  let y = 20;

  // Header - Logo and Company info
  let logoEndX = 20;
  if (company.logo) {
    try {
      // Add logo in header
      const logoSize = 18;
      pdf.addImage(company.logo, 'AUTO', 20, y - 5, logoSize, logoSize);
      logoEndX = 20 + logoSize + 5;
    } catch (e) {
      console.warn('Could not add header logo:', e);
    }
  }

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(company.name || 'Entreprise', logoEndX, y);
  y += 6;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  if (company.address) {
    pdf.text(company.address, logoEndX, y);
    y += 4;
  }
  if (company.nif) {
    pdf.text(`NIF: ${company.nif}`, logoEndX, y);
    y += 4;
  }
  if (company.cnssNumber) {
    pdf.text(`CNSS Employeur: ${company.cnssNumber}`, logoEndX, y);
  }

  // Employee info (right side)
  let empY = 20;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${employee.firstName} ${employee.lastName}`, pageWidth - 20, empY, { align: 'right' });
  empY += 6;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Matricule: ${employee.matricule}`, pageWidth - 20, empY, { align: 'right' });
  empY += 4;
  pdf.text(`Poste: ${employee.position}`, pageWidth - 20, empY, { align: 'right' });
  if (employee.phone) {
    empY += 4;
    pdf.text(`Tel: ${employee.phone}`, pageWidth - 20, empY, { align: 'right' });
  }
  if (employee.cnssNumber) {
    empY += 4;
    pdf.text(`CNSS: ${employee.cnssNumber}`, pageWidth - 20, empY, { align: 'right' });
  }
  if (employee.nif) {
    empY += 4;
    pdf.text(`NIF: ${employee.nif}`, pageWidth - 20, empY, { align: 'right' });
  }

  // Title
  y = 50;
  pdf.setFillColor(245, 245, 245);
  pdf.rect(20, y - 5, pageWidth - 40, 10, 'F');
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`BULLETIN DE PAIE - ${monthName.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  
  // Table header
  y = 70;
  pdf.setFillColor(249, 249, 249);
  pdf.rect(20, y - 4, pageWidth - 40, 8, 'F');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Désignation', 22, y);
  pdf.text('Montant (FCFA)', pageWidth - 22, y, { align: 'right' });
  
  // Section: Rémunération
  y += 12;
  pdf.setFillColor(233, 233, 233);
  pdf.rect(20, y - 4, pageWidth - 40, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('REMUNERATION', 22, y);
  
  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.text('Salaire de base', 22, y);
  pdf.text(formatAmount(payroll.baseSalary), pageWidth - 22, y, { align: 'right' });
  
  // Components
  payroll.components.forEach(c => {
    y += 6;
    pdf.text(c.name, 22, y);
    pdf.text(formatAmount(c.amount), pageWidth - 22, y, { align: 'right' });
  });
  
  // Gross total
  y += 8;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(20, y - 4, pageWidth - 40, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('SALAIRE BRUT', 22, y);
  pdf.text(formatAmount(payroll.grossEarnings), pageWidth - 22, y, { align: 'right' });
  
  // Section: Retenues
  y += 12;
  pdf.setFillColor(233, 233, 233);
  pdf.rect(20, y - 4, pageWidth - 40, 7, 'F');
  pdf.text('RETENUES', 22, y);
  
  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.text('CNSS (Part salariale)', 22, y);
  pdf.text(`- ${formatAmount(payroll.cnssEmployee)}`, pageWidth - 22, y, { align: 'right' });
  
  y += 6;
  pdf.text('AMU (Part salariale)', 22, y);
  pdf.text(`- ${formatAmount(payroll.amuEmployee)}`, pageWidth - 22, y, { align: 'right' });
  
  if (payroll.familyChargeDeduction && payroll.familyChargeDeduction > 0) {
    y += 6;
    pdf.setTextColor(22, 163, 74); // Green
    pdf.text('Deduction charges familiales', 22, y);
    pdf.text(`- ${formatAmount(payroll.familyChargeDeduction)}`, pageWidth - 22, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  }
  
  y += 6;
  pdf.text('IRPP', 22, y);
  pdf.text(`- ${formatAmount(payroll.irpp)}`, pageWidth - 22, y, { align: 'right' });
  
  // Other deductions (avances, acomptes, oppositions)
  let totalOtherDeductions = 0;
  if (payroll.otherDeductions && payroll.otherDeductions.length > 0) {
    y += 10;
    pdf.setFillColor(233, 233, 233);
    pdf.rect(20, y - 4, pageWidth - 40, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.text('AUTRES RETENUES', 22, y);
    
    pdf.setFont('helvetica', 'normal');
    payroll.otherDeductions.forEach(d => {
      y += 6;
      const typeLabel = d.type === 'acompte' ? 'Acompte' : d.type === 'avance' ? 'Avance' : 'Opposition';
      pdf.text(`${d.description} (${typeLabel})`, 22, y);
      pdf.text(`- ${formatAmount(d.amount)}`, pageWidth - 22, y, { align: 'right' });
      totalOtherDeductions += d.amount;
    });
  }
  
  // Total deductions
  const totalDeductions = payroll.cnssEmployee + payroll.amuEmployee + payroll.irpp + totalOtherDeductions;
  y += 8;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(20, y - 4, pageWidth - 40, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL RETENUES', 22, y);
  pdf.text(`- ${formatAmount(totalDeductions)}`, pageWidth - 22, y, { align: 'right' });
  
  // Net salary
  y += 10;
  pdf.setFillColor(51, 51, 51);
  pdf.rect(20, y - 5, pageWidth - 40, 10, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.text('NET A PAYER', 22, y);
  pdf.text(formatAmount(payroll.netSalary), pageWidth - 22, y, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
  
  // Modifications section
  if (payroll.modifications && payroll.modifications.length > 0) {
    y += 15;
    pdf.setFillColor(255, 243, 205);
    pdf.rect(20, y - 4, pageWidth - 40, 8 + payroll.modifications.length * 5, 'F');
    pdf.setDrawColor(255, 193, 7);
    pdf.rect(20, y - 4, pageWidth - 40, 8 + payroll.modifications.length * 5, 'S');
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(133, 100, 4);
    pdf.text('Modifications apportees:', 22, y);
    
    pdf.setFont('helvetica', 'normal');
    payroll.modifications.forEach(m => {
      y += 5;
      const dateStr = new Date(m.date).toLocaleDateString('fr-FR');
      pdf.text(`- ${dateStr}: ${m.note}`, 24, y);
    });
    pdf.setTextColor(0, 0, 0);
  }
  
  // Signatures
  y += 25;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.line(30, y, 80, y);
  pdf.text("L'Employeur", 55, y + 5, { align: 'center' });
  
  pdf.line(pageWidth - 80, y, pageWidth - 30, y);
  pdf.text("L'Employe", pageWidth - 55, y + 5, { align: 'center' });

  pdf.save(`bulletin_${employee.matricule}_${payroll.month}.pdf`);
}

// Helper to download a blob
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Read file as Base64
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Download a stored document
export function downloadDocument(doc: EmployeeDocument): void {
  const link = document.createElement('a');
  link.href = doc.data;
  link.download = doc.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
