import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { Asset, AssetAssignment, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-assignments-list',
  imports: [SharedModule],
  templateUrl: './assignments-list.html',
  styleUrl: './assignments-list.scss'
})
export class AssignmentsList implements OnInit {
  @ViewChild('returnModal') returnModalTemplate!: TemplateRef<unknown>;

  assignments: AssetAssignment[] = [];
  assets: Asset[] = [];
  employees: EmployeeDetail[] = [];
  returnModel: Partial<AssetAssignment> = { ReturnedDate: '', Remarks: '', ReturnedBy: '' };
  activeAssignmentId: number | null = null;
  // table controls
  search = '';
  onlyNotReturned = false;
  page = 1;
  pageSize = 10;

  get filteredAssignments() {
    const q = this.search?.toLowerCase().trim();
    const rows = this.onlyNotReturned
      ? this.assignments.filter((a) => !a.IsReturned || a.IsReturned === 0)
      : this.assignments;
    if (!q) return rows;

    return rows.filter((a) => {
      const assetName = this.getAssetName(a.AssetId).toLowerCase();
      const employeeName = this.getEmployeeName(a.EmployeeId).toLowerCase();
      const assignedBy = String(a.AssignedBy || '').toLowerCase();
      const remarks = String(a.Remarks || '').toLowerCase();
      const assignedDate = String(a.AssignedDate || '').toLowerCase();
      const returnedDate = String(a.ReturnedDate || '').toLowerCase();
      const returnedStatus = a.IsReturned ? 'yes' : 'no';

      return String(a.AssignmentId).includes(q)
        || String(a.AssetId).includes(q)
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

  prevPage() {
    this.page = Math.max(1, this.page - 1);
  }

  nextPage() {
    this.page = Math.min(this.totalPages(), this.page + 1);
  }

  gotoPage(n: number) {
    this.page = n;
  }

  constructor(
    private readonly crud: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly notify: NotificationService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadEmployees();
    this.loadAssets();
  }

  load() {
    this.crud.getAssetAssignments().subscribe({
      next: (d) => {
        this.assignments = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.assignments = [];
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
    this.crud.getAssets().subscribe({
      next: (data) => {
        this.assets = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.cd.detectChanges();
      }
    });
  }

  openReturnModal(aId: number) {
    this.activeAssignmentId = aId;
    this.returnModel = {
      ReturnedDate: new Date().toISOString().split('T')[0],
      Remarks: '',
      ReturnedBy: this.auth.fullName || this.auth.username || ''
    };
    this.modalService.open(this.returnModalTemplate, { centered: true });
  }

  submitReturn(form: NgForm, modal: NgbModalRef) {
    if (!form.valid || !this.activeAssignmentId) return;
    this.crud.returnAsset(this.activeAssignmentId, this.returnModel).subscribe({ next: () => { this.load(); modal.close('returned'); }, error: () => this.notify.error('Unable to return asset.') });
  }

  getAssetName(assetId?: number | null): string {
    return this.assets.find((asset) => asset.AssetId === assetId)?.AssetName || '—';
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((e) => e.EmployeeId === employeeId)?.FullName || '—';
  }
}
