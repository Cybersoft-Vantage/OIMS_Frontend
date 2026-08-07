import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { DetailedAsset, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_BRAND_FILL,
  PDF_BRAND_TEXT,
  PDF_HEADER_FILL,
  PDF_HEADER_TEXT,
  PDF_ZEBRA_FILL,
  pdfText
} from 'src/app/shared/pdf-export.util';

@Component({
  selector: 'app-assign-detailed-asset',
  imports: [SharedModule],
  templateUrl: './assign-detailed-asset.html',
  styleUrl: './assign-detailed-asset.scss'
})
export class AssignDetailedAsset implements OnInit {
  @ViewChild('assignModal') assignModalTemplate!: TemplateRef<unknown>;

  assets: DetailedAsset[] = [];
  assignments: any[] = [];
  employees: EmployeeDetail[] = [];
  search = '';
  showAvailableOnly = true;
  isSubmitting = false;
  page = 1;
  pageSize = 10;
  selectedAsset?: DetailedAsset | null;
  assignModel: any = { DetailedAssetId: undefined, EmployeeId: undefined, AssignedDate: '', AssignedBy: '', Remarks: '' };

  constructor(
    private readonly crud: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadAssets();
    this.loadAssignments();
    this.loadEmployees();
  }

  get filteredAssets() {
    const q = this.search?.toLowerCase().trim();
    let filtered = this.assets;
    if (q) {
      filtered = filtered.filter((asset) =>
        String(asset.Name || '').toLowerCase().includes(q) ||
        String(asset.AssetTag || '').toLowerCase().includes(q) ||
        String(asset.MakeModel || '').toLowerCase().includes(q)
      );
    }
    if (this.showAvailableOnly) {
      filtered = filtered.filter((asset) => this.isAssetAvailable(asset));
    }
    return filtered;
  }

  isAssetAvailable(asset: DetailedAsset): boolean {
    return !this.assetHasOpenAssignment(asset) && !this.isBlockedForAssignment(asset);
  }

  get pagedAssets() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAssets.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredAssets.length / this.pageSize));
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

  openModal(asset: DetailedAsset) {
    this.selectedAsset = asset;
    this.assignModel = {
      DetailedAssetId: asset.DetailedAssetId,
      EmployeeId: undefined,
      AssignedDate: new Date().toISOString().split('T')[0],
      AssignedBy: this.auth.username || '',
      Remarks: ''
    };
    this.modalService.open(this.assignModalTemplate, { centered: true, size: 'lg' });
  }

  submitAssignment(form: NgForm, modal: NgbModalRef) {
    if (!form.valid || this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;

    const payload = {
      DetailedAssetId: this.assignModel.DetailedAssetId ?? 0,
      EmployeeId: this.assignModel.EmployeeId ?? 0,
      AssignedDate: this.assignModel.AssignedDate || new Date().toISOString().split('T')[0],
      AssignedBy: this.assignModel.AssignedBy || null,
      Remarks: this.assignModel.Remarks || null,
      IsReturned: 0
    };

    this.crud.assignDetailedAsset(payload).subscribe({
      next: () => {
        modal.close('saved');
        this.loadAssets();
        this.loadAssignments();
        this.isSubmitting = false;
      },
      error: () => {
        this.isSubmitting = false;
        this.notify.error('Unable to assign detailed asset.');
      }
    });
  }

  onFilterChange(): void {
    this.page = 1;
  }

  clearSearch(): void {
    this.search = '';
    this.onFilterChange();
  }

  get hasActiveFilters(): boolean {
    return !!this.search?.trim() || !this.showAvailableOnly;
  }

  resetFilters(): void {
    this.search = '';
    this.showAvailableOnly = true;
    this.page = 1;
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((e) => e.EmployeeId === employeeId)?.FullName || '—';
  }

  assetHasOpenAssignment(asset: DetailedAsset): boolean {
    if (!asset?.DetailedAssetId) {
      return false;
    }
    return this.assignments.some((assignment) => assignment.DetailedAssetId === asset.DetailedAssetId && (assignment.IsReturned === 0 || assignment.IsReturned === false || assignment.IsReturned == null));
  }

  isUnderMaintenance(asset: DetailedAsset): boolean {
    if (!asset || !asset.Status) return false;
    const s = (asset.Status || '').toString().trim().toLowerCase();
    return s === 'damaged' || s === 'damage' || s === 'maintenance';
  }

  isSold(asset: DetailedAsset): boolean {
    if (!asset || !asset.Status) return false;
    const s = (asset.Status || '').toString().trim().toLowerCase();
    return s === 'sold' || s === 'sold out' || s === 'sold-out';
  }

  isBlockedForAssignment(asset: DetailedAsset): boolean {
    return this.isUnderMaintenance(asset) || this.isSold(asset);
  }

  statusLabel(status: string): string {
    if (!status) return 'Unknown';
    return status.toString().replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /** Full name of the employee currently holding the asset, or '-' when it is not assigned. */
  getAssignedToName(asset: DetailedAsset): string {
    if (!asset?.DetailedAssetId) {
      return '-';
    }
    const openAssignment = this.assignments.find(
      (assignment) =>
        assignment.DetailedAssetId === asset.DetailedAssetId &&
        (assignment.IsReturned === 0 || assignment.IsReturned === false || assignment.IsReturned == null)
    );
    if (!openAssignment) {
      return '-';
    }
    const employeeName = this.employees.find((employee) => employee.EmployeeId === openAssignment.EmployeeId)?.FullName;
    return (employeeName || openAssignment.EmployeeName || '').toString().trim() || '-';
  }

  /** Exports the currently filtered asset list (not just the visible page) to PDF. */
  downloadAssetsPdf(): void {
    const rows = this.filteredAssets;
    if (!rows.length) {
      this.notify.info('No assets available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 28;

    doc.setFillColor(PDF_BRAND_FILL[0], PDF_BRAND_FILL[1], PDF_BRAND_FILL[2]);
    doc.rect(margin, 24, pageWidth - margin * 2, 32, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PDF_BRAND_TEXT[0], PDF_BRAND_TEXT[1], PDF_BRAND_TEXT[2]);
    doc.text('Detailed Asset Assignment Sheet', pageWidth / 2, 45, { align: 'center' });

    const filterParts = [this.showAvailableOnly ? 'Available assets only' : 'All assets'];
    if (this.search?.trim()) {
      filterParts.push(`Search: "${this.search.trim()}"`);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(pdfText(`${rows.length} asset(s) · ${filterParts.join(' · ')}`), margin, 70);
    doc.text(`Generated ${new Date().toLocaleDateString('en-CA')}`, pageWidth - margin, 70, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 82,
      head: [['#', 'Asset Tag', 'Brand Name', 'Make/Model', 'Status', 'Assign To']],
      body: rows.map((asset, index) => [
        String(index + 1),
        pdfText(asset.AssetTag || '-'),
        pdfText(asset.Name || '-'),
        pdfText(asset.MakeModel || '-'),
        pdfText(this.statusLabel(asset.Status || 'Unknown')),
        pdfText(this.getAssignedToName(asset))
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, overflow: 'linebreak' },
      headStyles: { fillColor: PDF_HEADER_FILL, textColor: PDF_HEADER_TEXT, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: PDF_ZEBRA_FILL },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 90 },
        4: { cellWidth: 70, halign: 'center' }
      },
      margin: { left: margin, right: margin }
    });

    const pageCount = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
    }

    doc.save(`detailed_assets_${this.showAvailableOnly ? 'available' : 'all'}.pdf`);
  }

  private loadAssignments(): void {
    this.crud.getDetailedAssignments().subscribe({ next: (data) => { this.assignments = data; this.cd.detectChanges(); }, error: () => { this.assignments = []; this.cd.detectChanges(); } });
  }

  private loadAssets() {
    this.crud.getDetailedAssets().subscribe({ next: (data) => { this.assets = data; this.cd.detectChanges(); }, error: () => { this.assets = []; this.cd.detectChanges(); } });
  }

  private loadEmployees() {
    this.crud.getEmployees().subscribe({ next: (data) => { this.employees = data; this.cd.detectChanges(); }, error: () => { this.employees = []; this.cd.detectChanges(); } });
  }
}
