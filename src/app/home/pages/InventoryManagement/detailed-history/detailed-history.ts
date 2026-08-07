import { Component, OnInit, ChangeDetectorRef, TemplateRef, ViewChild, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationService } from 'src/app/services/notification.service';
import { DetailedAsset, DetailedAssetHistory, DetailedCategory, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_BRAND_FILL,
  PDF_BRAND_TEXT,
  PDF_HEADER_FILL,
  PDF_HEADER_TEXT,
  PDF_SECTION_FILL,
  PDF_ZEBRA_FILL,
  pdfText
} from 'src/app/shared/pdf-export.util';

@Component({
  selector: 'app-detailed-history',
  imports: [SharedModule],
  templateUrl: './detailed-history.html',
  styleUrl: './detailed-history.scss'
})
export class DetailedHistory implements OnInit {
  private auth = inject(AuthService);
  private currentEmployeeUserId = this.auth.username;
  private currentRole = (this.auth.role || '').toLowerCase();
  private currentEmployeeId?: number;
  @ViewChild('viewModal') viewModalTemplate!: TemplateRef<unknown>;

  histories: DetailedAssetHistory[] = [];
  assets: DetailedAsset[] = [];
  categories: DetailedCategory[] = [];
  employees: EmployeeDetail[] = [];
  assetDetail: DetailedAsset | null = null;
  viewAssignment: any | null = null;
  selectedAssetId: number | null = null;
  selectedAssetTag: string | null = null;
  selectedEmployeeId: number | null = null;
  search = '';
  page = 1;
  pageSize = 10;

  constructor(
    private readonly crud: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadAssets();
    this.loadDeletedAssets();
    this.loadEmployees();
    this.loadDetailedCategories();
  }

  onAssetChange(): void {
    this.page = 1;
    this.loadHistory();
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
      this.selectedAssetId != null ||
      this.selectedAssetTag != null ||
      this.selectedEmployeeId != null ||
      !!this.search?.trim()
    );
  }

  resetFilters(): void {
    const reloadHistory = this.selectedAssetId != null;
    this.selectedAssetId = null;
    this.selectedAssetTag = null;
    this.selectedEmployeeId = null;
    this.search = '';
    this.page = 1;
    if (reloadHistory) {
      this.loadHistory();
    }
  }

  /** Distinct asset tags present in the loaded assets, for the Asset Tag filter. */
  get assetTagOptions(): string[] {
    const tags = new Set<string>();
    for (const asset of this.assets) {
      const tag = (asset.AssetTag || '').trim();
      if (tag) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  private historyAssetTag(history: DetailedAssetHistory): string {
    return (history.AssetTag || this.getAssetTag(history.DetailedAssetId) || '').trim();
  }

  openViewModal(assetId: number) {
    // Load asset detail and latest assignment, then open modal when ready
    this.crud.getDetailedAsset(assetId).subscribe({
      next: (data) => {
        this.assetDetail = data;
        this.loadViewAssignment(assetId);
      },
      error: () => {
        const deletedAsset = this.assets.find((asset) => asset.DetailedAssetId === assetId);
        if (deletedAsset) {
          this.assetDetail = deletedAsset;
          this.loadViewAssignment(assetId);
          return;
        }

        // fallback to history snapshot if the asset is deleted
        this.crud.getDetailedHistory(assetId).subscribe({
          next: (hist) => {
            const latest = hist.sort((a, b) => (b.ActionDate ? Date.parse(b.ActionDate as string) : 0) - (a.ActionDate ? Date.parse(a.ActionDate as string) : 0))[0];
            if (latest) {
              this.assetDetail = {
                DetailedAssetId: assetId,
                AssetTag: latest.AssetTag || undefined,
                Name: latest.AssetName || 'Unknown Asset',
                DetailedCategoryId: null,
                SubCategory: null,
                MakeModel: null,
                SerialNo: null,
                Specifications: null,
                Status: null,
                IsDeleted: 1,
                DeletedAt: null
              };
            } else {
              this.assetDetail = null;
            }
            this.loadViewAssignment(assetId);
          },
          error: () => {
            this.assetDetail = null;
            this.viewAssignment = null;
            this.cd.detectChanges();
            this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
          }
        });
      }
    });
  }

  private loadViewAssignment(assetId: number) {
    this.crud.getDetailedAssignments(assetId).subscribe({
      next: (assigns) => {
        this.viewAssignment = assigns.sort((a: any, b: any) => (b.AssignmentId || 0) - (a.AssignmentId || 0))[0] || null;
        if (!this.viewAssignment) {
          this.crud.getDetailedHistory(assetId).subscribe({
            next: (hist) => {
              const assigned = hist
                .filter(h => String(h.Action).toLowerCase() === 'assigned')
                .sort((a, b) => (b.ActionDate ? Date.parse(b.ActionDate as string) : 0) - (a.ActionDate ? Date.parse(a.ActionDate as string) : 0))[0];
              const returned = hist
                .filter(h => String(h.Action).toLowerCase() === 'returned')
                .sort((a, b) => (b.ActionDate ? Date.parse(b.ActionDate as string) : 0) - (a.ActionDate ? Date.parse(a.ActionDate as string) : 0))[0];
              if (assigned) {
                this.viewAssignment = {
                  AssignedDate: assigned.ActionDate,
                  EmployeeId: undefined,
                  AssignedBy: this.parseAssignedByFromNotes(assigned.Notes) || assigned.EmployeeName || null,
                  IsReturned: !!returned,
                  ReturnedDate: returned?.ActionDate || null,
                  ReturnedBy: this.parseReturnedByFromNotes(returned?.Notes) || null
                } as any;
              } else if (returned) {
                this.viewAssignment = {
                  AssignedDate: null,
                  EmployeeId: undefined,
                  AssignedBy: null,
                  IsReturned: true,
                  ReturnedDate: returned.ActionDate,
                  ReturnedBy: this.parseReturnedByFromNotes(returned.Notes) || returned.EmployeeName || null
                } as any;
              }
              this.cd.detectChanges();
              this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
            },
            error: () => {
              this.cd.detectChanges();
              this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
            }
          });
          return;
        }
        this.cd.detectChanges();
        this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
      },
      error: () => {
        this.viewAssignment = null;
        this.cd.detectChanges();
        this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
      }
    });
  }

  private parseAssignedByFromNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const m = notes.match(/Assigned by\s*([^\-\(]+)/i);
    if (m && m[1]) return m[1].trim();
    return null;
  }

  private parseReturnedByFromNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const m = notes.match(/Returned by\s*([^\)\-]+)/i);
    if (m && m[1]) return m[1].trim();
    return null;
  }

  private loadAssetDetail(assetId: number) {
    this.crud.getDetailedAsset(assetId).subscribe({
      next: (data) => { this.assetDetail = data; this.cd.detectChanges(); },
      error: () => { this.assetDetail = null; this.cd.detectChanges(); }
    });
  }

  private loadAssetAssignments(assetId: number) {
    this.crud.getDetailedAssignments(assetId).subscribe({
      next: (data) => {
        this.viewAssignment = data
          .sort((a, b) => (b.AssignmentId || 0) - (a.AssignmentId || 0))[0] || null;
        this.cd.detectChanges();
      },
      error: () => { this.viewAssignment = null; this.cd.detectChanges(); }
    });
  }

  private loadEmployees(): void {
    this.crud.getEmployees().subscribe({
      next: (data) => {
        this.employees = data;
        this.currentEmployeeId = this.employees.find((employee) => String(employee.UserId).toLowerCase() === String(this.currentEmployeeUserId).toLowerCase())?.EmployeeId;
        this.cd.detectChanges();
        this.loadHistory();
      },
      error: () => {
        this.employees = [];
        this.currentEmployeeId = undefined;
        this.cd.detectChanges();
        this.loadHistory();
      }
    });
  }

  private loadDetailedCategories(): void {
    this.crud.getDetailedCategories().subscribe({
      next: (data) => { this.categories = data; this.cd.detectChanges(); },
      error: () => { this.categories = []; this.cd.detectChanges(); }
    });
  }

  private loadHistory(): void {
    this.crud.getDetailedHistory(this.selectedAssetId ?? undefined).subscribe({
      next: (data) => {
        const items = data || [];
        if (this.currentRole !== 'admin' && this.currentRole !== 'hr') {
          this.histories = items.filter((history) => history.EmployeeId === this.currentEmployeeId);
        } else {
          this.histories = items;
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.histories = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadDeletedAssets(): void {
    this.crud.getDeletedDetailedAssets().subscribe({
      next: (data) => {
        const deleted = data || [];
        this.assets = this.mergeAssets(this.assets, deleted);
        this.cd.detectChanges();
      },
      error: () => {
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

  getAssetName(assetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.Name || '—';
  }

  getAssetTag(assetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.AssetTag || '—';
  }

  getCategoryName(categoryId?: number | null): string {
    if (!categoryId) return '—';
    const found = this.categories.find((c) => c.DetailedCategoryId === categoryId);
    return found?.Name || '—';
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((e) => e.EmployeeId === employeeId)?.FullName || '—';
  }

  getReturnTo(): string {
    return this.viewAssignment?.ReturnedBy || '—';
  }

  getReturnBy(): string {
    if (!this.viewAssignment) return '—';
    return this.getEmployeeName(this.viewAssignment.EmployeeId);
  }

  get filteredHistories() {
    const q = this.search?.toLowerCase().trim();
    let rows = this.histories;

    if (this.selectedEmployeeId != null) {
      rows = rows.filter((history) => history.EmployeeId === this.selectedEmployeeId);
    }

    if (this.selectedAssetTag != null) {
      const tag = this.selectedAssetTag.toLowerCase();
      rows = rows.filter((history) => this.historyAssetTag(history).toLowerCase() === tag);
    }

    if (!q) return rows;

    return rows.filter((h) => {
      const action = String(h.Action || '').toLowerCase();
      const notes = String(h.Notes || '').toLowerCase();
      const employee = String(h.EmployeeName || '').toLowerCase();
      const detail = String(this.getHistoryDetail(h) || '').toLowerCase();
      const tag = String(h.AssetTag || this.getAssetTag(h.DetailedAssetId)).toLowerCase();
      const name = String(h.AssetName || this.getAssetName(h.DetailedAssetId)).toLowerCase();
      const date = String(h.ActionDate || '').toLowerCase();
      return (
        String(h.HistoryId).includes(q) ||
        String(h.DetailedAssetId).includes(q) ||
        action.includes(q) ||
        notes.includes(q) ||
        detail.includes(q) ||
        employee.includes(q) ||
        tag.includes(q) ||
        name.includes(q) ||
        date.includes(q)
      );
    });
  }

  getHistoryDetail(history: DetailedAssetHistory): string {
    const action = String(history.Action || '').toLowerCase();
    const notes = String(history.Notes || '').trim();
    if (notes) {
      return notes;
    }

    if (action === 'assigned') {
      return `Assigned by ${history.EmployeeName || 'Unknown'}`;
    }
    if (action === 'returned') {
      return `Returned by ${history.EmployeeName || 'Unknown'}`;
    }
    return notes || 'Details unavailable';
  }

  get pagedHistories() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredHistories.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredHistories.length / this.pageSize));
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

  // ------------------------------------------------------------- PDF report

  private formatReportDate(value?: string | null, withTime = true): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = date.toLocaleDateString('en-CA');
    return withTime ? `${day} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : day;
  }

  /** Human-readable description of the filters the report was generated under. */
  private describeActiveFilters(): string[] {
    const parts: string[] = [];
    parts.push(
      this.selectedAssetId != null
        ? `Asset: ${this.getAssetTag(this.selectedAssetId)} - ${this.getAssetName(this.selectedAssetId)}`
        : 'Asset: All assets'
    );
    parts.push(`Asset Tag: ${this.selectedAssetTag ?? 'All tags'}`);
    parts.push(
      this.selectedEmployeeId != null
        ? `Employee: ${this.getEmployeeName(this.selectedEmployeeId)}`
        : 'Employee: All users'
    );
    if (this.search?.trim()) {
      parts.push(`Search: "${this.search.trim()}"`);
    }
    return parts;
  }

  private actionPdfStyle(action?: string | null): { fillColor: [number, number, number]; textColor: [number, number, number] } | null {
    const normalized = String(action || '').toLowerCase().trim();
    if (normalized === 'assigned') return { fillColor: [11, 61, 145], textColor: [255, 255, 255] };
    if (normalized === 'returned') return { fillColor: [0, 176, 80], textColor: [255, 255, 255] };
    if (normalized.includes('damag')) return { fillColor: [255, 59, 48], textColor: [255, 255, 255] };
    if (normalized.includes('sold')) return { fillColor: [33, 37, 41], textColor: [255, 255, 255] };
    if (normalized.includes('maintenance') || normalized.includes('repair')) return { fillColor: [255, 193, 7], textColor: [0, 0, 0] };
    return null;
  }

  /**
   * Lifecycle report for the currently filtered history: cover block with the applied
   * filters, a summary of events by type, then one table per asset in chronological order.
   */
  downloadHistoryPdf(): void {
    const rows = this.filteredHistories;
    if (!rows.length) {
      this.notify.info('No history records to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const contentWidth = pageWidth - margin * 2;

    // ---- Title band
    doc.setFillColor(PDF_BRAND_FILL[0], PDF_BRAND_FILL[1], PDF_BRAND_FILL[2]);
    doc.rect(margin, 24, contentWidth, 34, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(PDF_BRAND_TEXT[0], PDF_BRAND_TEXT[1], PDF_BRAND_TEXT[2]);
    doc.text('Detailed Asset History Report', pageWidth / 2, 46, { align: 'center' });

    // ---- Applied filters + generation stamp
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    let cursorY = 74;
    for (const line of this.describeActiveFilters()) {
      doc.text(pdfText(line), margin, cursorY);
      cursorY += 12;
    }
    doc.text(
      pdfText(`Generated ${this.formatReportDate(new Date().toISOString())}`),
      pageWidth - margin,
      74,
      { align: 'right' }
    );
    doc.text(pdfText(`${rows.length} event(s)`), pageWidth - margin, 86, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // ---- Summary: event counts by action, distinct assets/employees, period covered
    const actionCounts = new Map<string, number>();
    const assetIds = new Set<number>();
    const employees = new Set<string>();
    let earliest: number | null = null;
    let latest: number | null = null;

    for (const history of rows) {
      const action = String(history.Action || 'unknown').trim() || 'unknown';
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      if (history.DetailedAssetId != null) assetIds.add(history.DetailedAssetId);
      const employeeName = history.EmployeeName || this.getEmployeeName(history.EmployeeId);
      if (employeeName && employeeName !== '—' && employeeName !== '-') employees.add(employeeName);
      const time = history.ActionDate ? Date.parse(history.ActionDate as string) : NaN;
      if (!Number.isNaN(time)) {
        earliest = earliest == null ? time : Math.min(earliest, time);
        latest = latest == null ? time : Math.max(latest, time);
      }
    }

    const period =
      earliest != null && latest != null
        ? `${this.formatReportDate(new Date(earliest).toISOString(), false)} to ${this.formatReportDate(new Date(latest).toISOString(), false)}`
        : '-';

    const summaryPairs: string[][] = [
      ['Total events', String(rows.length)],
      ['Assets covered', String(assetIds.size)],
      ['People involved', String(employees.size)],
      ['Period', period]
    ];
    for (const [action, count] of Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])) {
      summaryPairs.push([this.titleCase(action), String(count)]);
    }

    cursorY = Math.max(cursorY, 96) + 6;
    autoTable(doc, {
      startY: cursorY,
      head: [['Summary', '']],
      body: summaryPairs.map(([label, value]) => [pdfText(label), pdfText(value)]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: PDF_HEADER_FILL, textColor: PDF_HEADER_TEXT, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 130, fontStyle: 'bold' }, 1: { cellWidth: 110 } },
      margin: { left: margin, right: margin },
      tableWidth: 240
    });
    cursorY = this.lastPdfY(doc, cursorY) + 16;

    // ---- One section per asset, events oldest first so the lifecycle reads top-down
    const grouped = new Map<string, DetailedAssetHistory[]>();
    for (const history of rows) {
      const tag = history.AssetTag || this.getAssetTag(history.DetailedAssetId);
      const name = history.AssetName || this.getAssetName(history.DetailedAssetId);
      const key = `${tag} - ${name}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(history);
    }

    for (const [assetLabel, events] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (cursorY + 80 > pageHeight - 40) {
        doc.addPage();
        cursorY = 40;
      }

      doc.setFillColor(PDF_SECTION_FILL[0], PDF_SECTION_FILL[1], PDF_SECTION_FILL[2]);
      doc.rect(margin, cursorY, contentWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(22, 53, 92);
      doc.text(pdfText(assetLabel), margin + 8, cursorY + 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(pdfText(`${events.length} event(s)`), pageWidth - margin - 8, cursorY + 14, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      cursorY += 20;

      const ordered = [...events].sort(
        (a, b) =>
          (a.ActionDate ? Date.parse(a.ActionDate as string) : 0) - (b.ActionDate ? Date.parse(b.ActionDate as string) : 0)
      );

      autoTable(doc, {
        startY: cursorY,
        head: [['#', 'Date', 'Action', 'Employee', 'Details']],
        body: ordered.map((history, index) => [
          String(index + 1),
          pdfText(this.formatReportDate(history.ActionDate as string)),
          pdfText(this.titleCase(String(history.Action || '-'))),
          pdfText(history.EmployeeName || this.getEmployeeName(history.EmployeeId)),
          pdfText(this.getHistoryDetail(history))
        ]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: PDF_HEADER_FILL, textColor: PDF_HEADER_TEXT, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: PDF_ZEBRA_FILL },
        columnStyles: {
          0: { cellWidth: 26, halign: 'center' },
          1: { cellWidth: 92 },
          2: { cellWidth: 78, halign: 'center' },
          3: { cellWidth: 130 }
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 2) return;
          const style = this.actionPdfStyle(ordered[data.row.index]?.Action);
          if (style) {
            data.cell.styles.fillColor = style.fillColor;
            data.cell.styles.textColor = style.textColor;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      cursorY = this.lastPdfY(doc, cursorY) + 14;
    }

    // ---- Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
      doc.text('Detailed Asset History Report', margin, pageHeight - 16);
    }

    const suffix = this.selectedAssetId != null ? `asset_${this.selectedAssetId}` : 'all_assets';
    doc.save(`detailed_asset_history_${suffix}.pdf`);
  }

  private titleCase(value: string): string {
    return String(value || '').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private lastPdfY(doc: jsPDF, fallback: number): number {
    const table = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    return table?.finalY ?? fallback;
  }
}
