import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DetailedAsset, DetailedCategory, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';
import * as ExcelJS from 'exceljs';

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

  private getReportRowXlsxStyle(assignment: any): { background?: string; fontColor?: string } {
    const status = this.getAssetStatus(assignment?.DetailedAssetId).toLowerCase();
    if (status.includes('sold')) {
      return { background: 'FF0B3D91', fontColor: 'FFFFFFFF' };
    }
    if (status.includes('damag')) {
      return { background: 'FFFF3B30', fontColor: 'FFFFFFFF' };
    }
    if (this.isReturned(assignment)) {
      return { background: 'FFFFF59D', fontColor: 'FF000000' };
    }
    return {};
  }

  async downloadXlsx(): Promise<void> {
    const rows = this.filteredAssignments;
    if (!rows.length) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Assignments');

    worksheet.columns = [
      { width: 20 },
      { width: 28 },
      { width: 20 },
      { width: 20 },
      { width: 16 },
      { width: 22 },
      { width: 16 }
    ];

    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'CSV ASSET SHEET FOR SYSTEMS AND ACCESSORIES';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFCF3F' }, underline: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4EB3' } };
    worksheet.getRow(1).height = 32;

    const grouped = new Map<string, any[]>();
    for (const assignment of rows) {
      const employeeName = this.getEmployeeName(assignment.EmployeeId) || 'Unknown Employee';
      if (!grouped.has(employeeName)) grouped.set(employeeName, []);
      grouped.get(employeeName)!.push(assignment);
    }

    let rowIndex = 3;
    for (const [employeeName, items] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      worksheet.mergeCells(`A${rowIndex}:G${rowIndex}`);
      const employeeCell = worksheet.getCell(`A${rowIndex}`);
      employeeCell.value = `Employee Name : ${employeeName}`;
      employeeCell.font = { bold: true, size: 13 };
      employeeCell.alignment = { horizontal: 'center', vertical: 'middle' };
      rowIndex += 1;

      const header = worksheet.getRow(rowIndex);
      header.values = [
        'Asset ID',
        'Asset Name',
        'Mac Address',
        'Serial Number',
        'Assigned Date',
        'Assigned By',
        'Return Date'
      ];
      for (let c = 1; c <= 7; c += 1) {
        const cell = header.getCell(c);
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      rowIndex += 1;

      for (const assignment of items.sort((a, b) => String(a.AssignedDate || '').localeCompare(String(b.AssignedDate || '')))) {
        const row = worksheet.getRow(rowIndex);
        row.values = [
          this.getAssetTag(assignment.DetailedAssetId),
          this.getAssetName(assignment.DetailedAssetId),
          this.getAssetMacAddress(assignment.DetailedAssetId),
          this.getAssetSerialNumber(assignment.DetailedAssetId),
          this.formatDate(assignment.AssignedDate),
          this.getAssignedByName(assignment.AssignedBy),
          this.formatDate(assignment.ReturnedDate)
        ];

        const style = this.getReportRowXlsxStyle(assignment);
        for (let c = 1; c <= 7; c += 1) {
          const cell = row.getCell(c);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (style.background && style.fontColor) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.background } };
            cell.font = { color: { argb: style.fontColor } };
          }
        }

        rowIndex += 1;
      }

      rowIndex += 1;
    }

    const filenameBase = this.selectedEmployeeId != null
      ? `employee_${this.selectedEmployeeId}_${this.showAll ? 'all' : 'assigned'}`
      : `all_employees_${this.showAll ? 'all' : 'assigned'}`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filenameBase}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        escapeCsv('Mac Address'),
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
          escapeCsv(this.getAssetMacAddress(assignment.DetailedAssetId)),
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
