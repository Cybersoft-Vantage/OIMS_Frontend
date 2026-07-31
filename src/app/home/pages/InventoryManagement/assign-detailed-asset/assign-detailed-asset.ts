import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { DetailedAsset, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

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
  showAvailableOnly = false;
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
    return !this.assetHasOpenAssignment(asset) && !this.isUnderMaintenance(asset);
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
    if (!form.valid) {
      return;
    }

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
      },
      error: () => this.notify.error('Unable to assign detailed asset.')
    });
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

  statusLabel(status: string): string {
    if (!status) return 'Unknown';
    return status.toString().replace(/\b\w/g, (char) => char.toUpperCase());
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
