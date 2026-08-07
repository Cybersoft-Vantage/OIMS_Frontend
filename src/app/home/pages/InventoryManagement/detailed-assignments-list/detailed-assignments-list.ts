import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { DetailedAsset, OimsCrudService, EmployeeDetail } from 'src/app/services/oims-crud.service';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-detailed-assignments-list',
  imports: [SharedModule],
  templateUrl: './detailed-assignments-list.html',
  styleUrl: './detailed-assignments-list.scss'
})
export class DetailedAssignmentsList implements OnInit {
  @ViewChild('returnModal') returnModalTemplate!: TemplateRef<unknown>;

  assignments: any[] = [];
  assets: DetailedAsset[] = [];
  employees: EmployeeDetail[] = [];
  statusOptions = ['Available', 'Good', 'Damaged', 'Maintenance'];
  returnModel: { ReturnedDate?: string; Remarks?: string; ReturnedBy?: string; Status?: string } = { ReturnedDate: '', Remarks: '', ReturnedBy: '', Status: 'Available' };
  activeAssignmentId: number | null = null;
  search = '';
  employeeFilter?: number;
  onlyNotReturned = true;
  page = 1;
  pageSize = 10;
  isSubmitting = false;

  constructor(
    private readonly crud: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadEmployees();
    this.loadAssets();
    this.loadDeletedAssets();
  }

  load() {
    this.crud.getDetailedAssignments().subscribe({ next: (d) => { this.assignments = d; this.cd.detectChanges(); }, error: () => { this.assignments = []; this.cd.detectChanges(); } });
  }

  private loadEmployees(): void {
    this.crud.getEmployees().subscribe({ next: (data) => { this.employees = data; this.cd.detectChanges(); }, error: () => { this.employees = []; this.cd.detectChanges(); } });
  }

  private loadAssets(): void {
    this.crud.getDetailedAssets().subscribe({ next: (data) => { this.assets = this.mergeAssets(this.assets, data || []); this.cd.detectChanges(); }, error: () => { this.assets = this.assets.filter((asset) => asset.IsDeleted === 1); this.cd.detectChanges(); } });
  }

  private loadDeletedAssets(): void {
    this.crud.getDeletedDetailedAssets().subscribe({ next: (data) => { this.assets = this.mergeAssets(this.assets, data || []); this.cd.detectChanges(); }, error: () => { this.cd.detectChanges(); } });
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

  openReturnModal(aId: number) {
    const assignment = this.assignments.find((a) => a.AssignmentId === aId);
    const asset = assignment ? this.assets.find((asset) => asset.DetailedAssetId === assignment.DetailedAssetId) : undefined;
    this.activeAssignmentId = aId;
    this.returnModel = {
      ReturnedDate: new Date().toISOString().split('T')[0],
      Remarks: '',
      ReturnedBy: this.auth.fullName || this.auth.username || '',
      Status: this.defaultReturnStatus(asset?.Status)
    };
    this.modalService.open(this.returnModalTemplate, { centered: true });
  }

  /**
   * An asset out on assignment carries the "Assigned" status, which is not a condition
   * you can return it in - default those (and any unknown status) to "Available".
   */
  private defaultReturnStatus(currentStatus?: string | null): string {
    const normalized = (currentStatus || '').trim();
    const match = this.statusOptions.find((option) => option.toLowerCase() === normalized.toLowerCase());
    return match || 'Available';
  }

  submitReturn(form: NgForm, modal: NgbModalRef) {
    if (!form.valid || !this.activeAssignmentId || this.isSubmitting) return;
    this.isSubmitting = true;
    this.crud.returnDetailedAsset(this.activeAssignmentId, this.returnModel).subscribe({
      next: () => {
        this.load();
        this.isSubmitting = false;
        modal.close('returned');
      },
      error: () => {
        this.isSubmitting = false;
        this.notify.error('Unable to return detailed asset.');
      }
    });
  }

  getAssetName(assetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.Name || '—';
  }

  getAssetTag(assetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.AssetTag || '—';
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((e) => e.EmployeeId === employeeId)?.FullName || '—';
  }

  get filteredAssignments() {
    const q = this.search?.toLowerCase().trim();
    let rows = this.onlyNotReturned ? this.assignments.filter((a) => !a.IsReturned || a.IsReturned === 0) : this.assignments;
    if (this.employeeFilter) {
      rows = rows.filter((a) => a.EmployeeId === this.employeeFilter);
    }
    if (!q) return rows;
    return rows.filter((a) => {
      const assetName = this.getAssetName(a.DetailedAssetId).toLowerCase();
      const employeeName = this.getEmployeeName(a.EmployeeId).toLowerCase();
      const assignedBy = String(a.AssignedBy || '').toLowerCase();
      const remarks = String(a.Remarks || '').toLowerCase();
      const assignedDate = String(a.AssignedDate || '').toLowerCase();
      const returnedDate = String(a.ReturnedDate || '').toLowerCase();
      const returnedStatus = a.IsReturned ? 'yes' : 'no';

      return String(a.AssignmentId).includes(q)
        || String(a.DetailedAssetId).includes(q)
        || String(a.EmployeeId).includes(q)
        || assetName.includes(q)
        || employeeName.includes(q)
        || assignedBy.includes(q)
        || remarks.includes(q)
        || assignedDate.includes(q)
        || returnedDate.includes(q)
        || returnedStatus.includes(q);
    });
  }

  get pagedAssignments() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAssignments.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredAssignments.length / this.pageSize));
  }

  prevPage() { this.page = Math.max(1, this.page - 1); }
  nextPage() { this.page = Math.min(this.totalPages(), this.page + 1); }
  gotoPage(n: number) { this.page = n; }

  onFilterChange(): void {
    this.page = 1;
  }

  clearSearch(): void {
    this.search = '';
    this.onFilterChange();
  }

  get hasActiveFilters(): boolean {
    return !!this.search?.trim() || this.employeeFilter != null || !this.onlyNotReturned;
  }

  resetFilters(): void {
    this.search = '';
    this.employeeFilter = undefined;
    this.onlyNotReturned = true;
    this.page = 1;
  }
}
