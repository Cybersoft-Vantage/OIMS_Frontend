import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DetailedAsset, DetailedCategory, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_BRAND_FILL, PDF_BRAND_TEXT, PDF_SECTION_FILL, pdfText } from 'src/app/shared/pdf-export.util';

const PDF_HEADER_FILL: [number, number, number] = [242, 242, 242];
const PDF_MARGIN = 28;

@Component({
  selector: 'app-reports',
  imports: [SharedModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsPage implements OnInit {
  assignments: any[] = [];
  assets: DetailedAsset[] = [];
  categories: DetailedCategory[] = [];
  topCategories: DetailedCategory[] = [];
  reportSubCategories: DetailedCategory[] = [];
  employees: EmployeeDetail[] = [];
  selectedEmployeeId: number | null = null;
  selectedCategoryId: number | null = null;
  selectedSubCategory = '';
  showAll = false;
  search = '';
  page = 1;
  pageSize = 10;
  isLoading = false;

  constructor(
    private readonly crud: OimsCrudService,
    private readonly cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
    this.loadEmployees();
    this.loadAssets();
    this.loadDeletedAssets();
    this.loadCategories();
  }

  private loadCategories(): void {
    this.crud.getDetailedCategories().subscribe({
      next: (data) => {
        this.categories = data || [];
        this.topCategories = this.categories.filter((category) => !category.ParentId);
        this.cd.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.topCategories = [];
        this.reportSubCategories = [];
        this.cd.detectChanges();
      }
    });
  }

  onCategoryFilterChange(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.selectedSubCategory = '';
    if (!categoryId) {
      this.reportSubCategories = [];
      this.page = 1;
      return;
    }

    const parentCategory = this.categories.find((category) => category.DetailedCategoryId === categoryId);
    this.reportSubCategories = parentCategory?.children ?? [];
    this.page = 1;
  }

  onFilterChange(): void {
    this.page = 1;
  }

  clearSearch(): void {
    this.search = '';
    this.onFilterChange();
  }

  get hasActiveFilters(): boolean {
    return (
      this.selectedEmployeeId != null ||
      this.selectedCategoryId != null ||
      !!this.selectedSubCategory.trim() ||
      !!this.search?.trim() ||
      this.showAll
    );
  }

  resetFilters(): void {
    this.selectedEmployeeId = null;
    this.selectedCategoryId = null;
    this.selectedSubCategory = '';
    this.reportSubCategories = [];
    this.search = '';
    this.showAll = false;
    this.page = 1;
  }

  private loadAssignments(): void {
    this.isLoading = true;
    this.crud.getDetailedAssignments().subscribe({
      next: (data) => {
        this.assignments = data || [];
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.assignments = [];
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  private loadEmployees(): void {
    this.crud.getEmployees().subscribe({
      next: (data) => {
        this.employees = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.employees = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadAssets(): void {
    this.crud.getDetailedAssets().subscribe({
      next: (data) => {
        this.assets = this.mergeAssets(this.assets, data || []);
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = this.assets.filter((asset) => asset.IsDeleted === 1);
        this.cd.detectChanges();
      }
    });
  }

  private loadDeletedAssets(): void {
    this.crud.getDeletedDetailedAssets().subscribe({
      next: (data) => {
        this.assets = this.mergeAssets(this.assets, data || []);
        this.cd.detectChanges();
      },
      error: () => {
        this.cd.detectChanges();
      }
    });
  }

  private mergeAssets(primary: DetailedAsset[], secondary: DetailedAsset[]): DetailedAsset[] {
    const byId = new Map<number, DetailedAsset>();
    for (const asset of primary) {
      if (asset.DetailedAssetId != null) {
        byId.set(asset.DetailedAssetId, asset);
      }
    }
    for (const asset of secondary) {
      if (asset.DetailedAssetId != null) {
        byId.set(asset.DetailedAssetId, asset);
      }
    }
    return Array.from(byId.values());
  }

  get filteredAssignments() {
    const q = this.search?.toLowerCase().trim();
    let rows = this.assignments.filter((assignment) => this.showAll ? true : (!assignment.IsReturned || assignment.IsReturned === 0 || assignment.IsReturned === false || assignment.IsReturned == null));

    if (this.selectedEmployeeId != null) {
      rows = rows.filter((assignment) => assignment.EmployeeId === this.selectedEmployeeId);
    }

    if (this.selectedCategoryId != null) {
      rows = rows.filter((assignment) => {
        const asset = this.assets.find((item) => item.DetailedAssetId === assignment.DetailedAssetId);
        return asset?.DetailedCategoryId === this.selectedCategoryId;
      });
    }

    if (this.selectedSubCategory.trim()) {
      rows = rows.filter((assignment) => {
        const asset = this.assets.find((item) => item.DetailedAssetId === assignment.DetailedAssetId);
        return (asset?.SubCategory || '').trim() === this.selectedSubCategory.trim();
      });
    }

    if (!q) {
      return rows;
    }

    return rows.filter((assignment) => {
      const assetName = this.getAssetName(assignment.DetailedAssetId).toLowerCase();
      const assetTag = this.getAssetTag(assignment.DetailedAssetId).toLowerCase();
      const macAddress = this.getAssetMacAddress(assignment.DetailedAssetId).toLowerCase();
      const makeModel = this.getAssetMakeModel(assignment.DetailedAssetId).toLowerCase();
      const serialNumber = this.getAssetSerialNumber(assignment.DetailedAssetId).toLowerCase();
      const status = this.getAssetStatus(assignment.DetailedAssetId).toLowerCase();
      const employeeName = this.getEmployeeName(assignment.EmployeeId).toLowerCase();
      const assignedBy = String(assignment.AssignedBy || '').toLowerCase();
      const remarks = String(assignment.Remarks || '').toLowerCase();
      const assignedDate = String(assignment.AssignedDate || '').toLowerCase();
      const returnedDate = String(assignment.ReturnedDate || '').toLowerCase();

      return assetName.includes(q)
        || assetTag.includes(q)
        || macAddress.includes(q)
        || makeModel.includes(q)
        || serialNumber.includes(q)
        || status.includes(q)
        || employeeName.includes(q)
        || assignedBy.includes(q)
        || remarks.includes(q)
        || assignedDate.includes(q)
        || returnedDate.includes(q);
    });
  }

  get pagedAssignments() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAssignments.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredAssignments.length / this.pageSize));
  }

  prevPage() {
    this.page = Math.max(1, this.page - 1);
  }

  nextPage() {
    this.page = Math.min(this.totalPages(), this.page + 1);
  }

  gotoPage(n: number) {
    this.page = n;
  }

  getAssetName(detailedAssetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === detailedAssetId)?.Name || '—';
  }

  getAssetTag(detailedAssetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === detailedAssetId)?.AssetTag || '—';
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((employee) => employee.EmployeeId === employeeId)?.FullName || '—';
  }

  getAssignedByName(assignedBy?: number | string | null): string {
    if (assignedBy == null || assignedBy === '') {
      return '—';
    }

    if (typeof assignedBy === 'number') {
      return this.getEmployeeName(assignedBy);
    }

    const userId = String(assignedBy).trim();
    const matchingEmployee = this.employees.find((employee) =>
      employee.UserId?.toString().trim() === userId ||
      employee.EmployeeId?.toString() === userId
    );

    if (matchingEmployee) {
      return matchingEmployee.FullName || userId;
    }

    return userId;
  }

  getAssetSerialNumber(detailedAssetId?: number | null): string {
    const asset = this.assets.find((item) => item.DetailedAssetId === detailedAssetId);
    return asset?.SerialNo || '—';
  }

  getAssetMakeModel(detailedAssetId?: number | null): string {
    const asset = this.assets.find((item) => item.DetailedAssetId === detailedAssetId);
    return asset?.MakeModel || '—';
  }

  getAssetStatus(detailedAssetId?: number | null): string {
    const asset = this.assets.find((item) => item.DetailedAssetId === detailedAssetId);
    return asset?.Status || '—';
  }

  getAssetMacAddress(detailedAssetId?: number | null): string {
    const asset: any = this.assets.find((item) => item.DetailedAssetId === detailedAssetId);
    if (!asset) return '—';

    if (asset.MacAddress) {
      return String(asset.MacAddress);
    }

    const customValues = asset.CustomValues;
    if (!customValues) {
      return '—';
    }

    try {
      const parsed = typeof customValues === 'string' ? JSON.parse(customValues) : customValues;
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        const macKey = keys.find((key) => key.toLowerCase().replace(/\s|_/g, '').includes('macaddress'));
        if (macKey && parsed[macKey] != null && String(parsed[macKey]).trim() !== '') {
          return String(parsed[macKey]);
        }
      }
    } catch {
      return '—';
    }

    return '—';
  }

  private isReturned(assignment: any): boolean {
    return assignment?.IsReturned === 1 || assignment?.IsReturned === true;
  }

  private getReportRowStyle(assignment: any): string {
    const status = this.getAssetStatus(assignment?.DetailedAssetId).toLowerCase();
    if (status.includes('sold')) {
      return 'background-color:#0b3d91;color:#ffffff;';
    }
    if (status.includes('damag')) {
      return 'background-color:#ff3b30;color:#ffffff;';
    }
    if (this.isReturned(assignment)) {
      return 'background-color:#fff59d;color:#000000;';
    }
    return '';
  }

  private escapeHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatDate(value: any): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-CA');
  }

  private getReportRowPdfStyle(assignment: any): { fillColor: [number, number, number]; textColor: [number, number, number] } | null {
    const status = this.getAssetStatus(assignment?.DetailedAssetId).toLowerCase();
    if (status.includes('sold')) {
      return { fillColor: [11, 61, 145], textColor: [255, 255, 255] };
    }
    if (status.includes('damag')) {
      return { fillColor: [255, 59, 48], textColor: [255, 255, 255] };
    }
    if (this.isReturned(assignment)) {
      return { fillColor: [255, 245, 157], textColor: [0, 0, 0] };
    }
    return null;
  }

  /** Colour key for the row shading used in the report. Returns the box's bottom Y. */
  private drawLegendBox(doc: jsPDF, top: number): number {
    const entries: Array<{ fill: [number, number, number]; border?: [number, number, number]; label: string }> = [
      { fill: [255, 245, 157], label: 'Returned - asset handed back' },
      { fill: [255, 59, 48], label: 'Damaged - needs repair' },
      { fill: [11, 61, 145], label: 'Sold - disposed of' },
      { fill: [255, 255, 255], border: [170, 170, 170], label: 'No shading - currently assigned' }
    ];

    const pageWidth = doc.internal.pageSize.getWidth();
    const boxWidth = pageWidth - PDF_MARGIN * 2;
    const boxHeight = 30;

    doc.setDrawColor(200, 208, 220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(PDF_MARGIN, top, boxWidth, boxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('COLOUR KEY', PDF_MARGIN + 10, top + 12);

    doc.setFont('helvetica', 'normal');
    let x = PDF_MARGIN + 10;
    const swatchY = top + 17;
    for (const entry of entries) {
      doc.setFillColor(entry.fill[0], entry.fill[1], entry.fill[2]);
      const border = entry.border ?? entry.fill;
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.rect(x, swatchY, 14, 8, 'FD');

      doc.setTextColor(70, 70, 70);
      doc.setFontSize(7.5);
      doc.text(entry.label, x + 19, swatchY + 6);
      x += 19 + doc.getTextWidth(entry.label) + 18;
    }

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    return top + boxHeight;
  }

  downloadPdf(): void {
    const rows = this.filteredAssignments;
    if (!rows.length) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(PDF_BRAND_FILL[0], PDF_BRAND_FILL[1], PDF_BRAND_FILL[2]);
    doc.rect(PDF_MARGIN, 24, pageWidth - PDF_MARGIN * 2, 32, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PDF_BRAND_TEXT[0], PDF_BRAND_TEXT[1], PDF_BRAND_TEXT[2]);
    doc.text('CSV ASSET SHEET FOR SYSTEMS AND ACCESSORIES', pageWidth / 2, 45, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${rows.length} ${this.showAll ? 'assignment/return' : 'active assignment'}(s)`,
      PDF_MARGIN,
      70
    );
    doc.text(`Generated ${new Date().toLocaleDateString('en-CA')}`, pageWidth - PDF_MARGIN, 70, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    const legendBottom = this.drawLegendBox(doc, 80);

    const grouped = new Map<string, any[]>();
    for (const assignment of rows) {
      const employeeName = this.getEmployeeName(assignment.EmployeeId) || 'Unknown Employee';
      if (!grouped.has(employeeName)) grouped.set(employeeName, []);
      grouped.get(employeeName)!.push(assignment);
    }

    let cursorY = legendBottom + 12;
    for (const [employeeName, items] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (cursorY + 70 > pageHeight - 40) {
        doc.addPage();
        cursorY = 40;
      }

      doc.setFillColor(PDF_SECTION_FILL[0], PDF_SECTION_FILL[1], PDF_SECTION_FILL[2]);
      doc.rect(PDF_MARGIN, cursorY, pageWidth - PDF_MARGIN * 2, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(22, 53, 92);
      doc.text(pdfText(`Employee Name : ${employeeName}`), pageWidth / 2, cursorY + 14, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      cursorY += 20;

      const sortedItems = [...items].sort((a, b) => String(a.AssignedDate || '').localeCompare(String(b.AssignedDate || '')));

      autoTable(doc, {
        startY: cursorY,
        head: [['Asset ID', 'Asset Name', 'Make / Model', 'Serial Number', 'Assigned Date', 'Assigned By', 'Return Date']],
        body: sortedItems.map((assignment) => [
          pdfText(this.getAssetTag(assignment.DetailedAssetId)),
          pdfText(this.getAssetName(assignment.DetailedAssetId)),
          pdfText(this.getAssetMakeModel(assignment.DetailedAssetId)),
          pdfText(this.getAssetSerialNumber(assignment.DetailedAssetId)),
          pdfText(this.formatDate(assignment.AssignedDate)),
          pdfText(this.getAssignedByName(assignment.AssignedBy)),
          pdfText(this.formatDate(assignment.ReturnedDate))
        ]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, overflow: 'linebreak' },
        headStyles: { fillColor: PDF_HEADER_FILL, textColor: [31, 31, 31], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          4: { halign: 'center' },
          6: { halign: 'center' }
        },
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const style = this.getReportRowPdfStyle(sortedItems[data.row.index]);
          if (style) {
            data.cell.styles.fillColor = style.fillColor;
            data.cell.styles.textColor = style.textColor;
          }
        }
      });

      const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
      cursorY = (lastTable?.finalY ?? cursorY) + 16;
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - PDF_MARGIN, pageHeight - 16, { align: 'right' });
    }

    const filenameBase = this.selectedEmployeeId != null
      ? `employee_${this.selectedEmployeeId}_${this.showAll ? 'all' : 'assigned'}`
      : `all_employees_${this.showAll ? 'all' : 'assigned'}`;

    doc.save(`${filenameBase}.pdf`);
  }

  downloadCsv(): void {
    const rows = this.filteredAssignments;
    if (!rows.length) return;

    const grouped = new Map<string, any[]>();
    for (const assignment of rows) {
      const employeeName = this.getEmployeeName(assignment.EmployeeId) || 'Unknown Employee';
      if (!grouped.has(employeeName)) grouped.set(employeeName, []);
      grouped.get(employeeName)!.push(assignment);
    }

    const escapeCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];

    // Title row
    lines.push(escapeCsv('CSV ASSET SHEET FOR SYSTEMS AND ACCESSORIES'));
    lines.push('');

    for (const [employeeName, items] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      // Employee header row
      lines.push([escapeCsv('Employee Name'), escapeCsv(employeeName)].join(','));
      // Column headers
      lines.push([
        escapeCsv('Asset ID'),
        escapeCsv('Asset Name'),
        escapeCsv('Make / Model'),
        escapeCsv('Serial Number'),
        escapeCsv('Assigned Date'),
        escapeCsv('Assigned By'),
        escapeCsv('Return Date'),
        escapeCsv('Style')
      ].join(','));

      for (const assignment of items.sort((a, b) => String(a.AssignedDate || '').localeCompare(String(b.AssignedDate || '')))) {
        const status = this.getAssetStatus(assignment.DetailedAssetId).toLowerCase();
        let style = 'ASSIGNED';
        if (status.includes('sold')) style = 'SOLD';
        else if (status.includes('damag')) style = 'DAMAGED';
        else if (this.isReturned(assignment)) style = 'RETURNED';

        const row = [
          escapeCsv(this.getAssetTag(assignment.DetailedAssetId)),
          escapeCsv(this.getAssetName(assignment.DetailedAssetId)),
          escapeCsv(this.getAssetMakeModel(assignment.DetailedAssetId)),
          escapeCsv(this.getAssetSerialNumber(assignment.DetailedAssetId)),
          escapeCsv(this.formatDate(assignment.AssignedDate)),
          escapeCsv(this.getAssignedByName(assignment.AssignedBy)),
          escapeCsv(this.formatDate(assignment.ReturnedDate)),
          escapeCsv(style)
        ];
        lines.push(row.join(','));
      }

      // blank separation between employees
      lines.push('');
    }

    const csv = lines.join('\r\n');
    const filenameBase = this.selectedEmployeeId != null
      ? `employee_${this.selectedEmployeeId}_${this.showAll ? 'all' : 'assigned'}`
      : `all_employees_${this.showAll ? 'all' : 'assigned'}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filenameBase}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
