import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { Asset, AssetAssignment, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-assign-asset',
  imports: [SharedModule],
  templateUrl: './assign-asset.html',
  styleUrl: './assign-asset.scss',
})
export class AssignAsset implements OnInit {
  @ViewChild('assignModal') assignModalTemplate!: TemplateRef<unknown>;

  assets: Asset[] = [];
  employees: EmployeeDetail[] = [];
  search = '';
  availabilityFilter: 'all' | 'available' | 'unavailable' = 'all';
  employeeFilter?: number | null = undefined;
  page = 1;
  pageSize = 10;
  selectedAsset?: Asset | null;
  assignModel: Partial<AssetAssignment> = {
    AssetId: undefined,
    EmployeeId: undefined,
    AssignedDate: '',
    AssignedBy: '',
    Remarks: ''
  };

  constructor(
    private readonly crudService: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly auth: AuthService
  , private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.loadAssets();
    this.loadEmployees();
  }

  get filteredAssets() {
    const q = this.search?.toLowerCase().trim();
    const filtered = this.assets.filter((asset) => {
      if (this.availabilityFilter === 'available' && asset.IsAvailable !== 1) return false;
      if (this.availabilityFilter === 'unavailable' && asset.IsAvailable === 1) return false;
      if (this.employeeFilter && asset.CurrentEmployeeId !== this.employeeFilter) return false;
      return true;
    });

    if (!q) return filtered;
    return filtered.filter((asset) =>
      String(asset.AssetName || '').toLowerCase().includes(q) ||
      String(asset.AssetCode || '').toLowerCase().includes(q) ||
      String(asset.Brand || '').toLowerCase().includes(q) ||
      String(this.getEmployeeName(asset.CurrentEmployeeId)).toLowerCase().includes(q)
    );
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

  openModal(asset: Asset) {
    this.selectedAsset = asset;
    this.assignModel = {
      AssetId: asset.AssetId,
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

    const payload: AssetAssignment = {
      AssetId: this.assignModel.AssetId ?? 0,
      EmployeeId: this.assignModel.EmployeeId ?? 0,
      AssignedDate: this.assignModel.AssignedDate || new Date().toISOString().split('T')[0],
      AssignedBy: this.assignModel.AssignedBy || null,
      Remarks: this.assignModel.Remarks || null,
      IsReturned: 0
    };

    this.crudService.assignAsset(payload).subscribe({
      next: () => {
        modal.close('saved');
        this.loadAssets();
      },
      error: () => this.notify.error('Unable to assign asset.')
    });
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((e) => e.EmployeeId === employeeId)?.FullName || '—';
  }

  private loadAssets() {
    this.crudService.getAssets().subscribe({
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

  private loadEmployees() {
    this.crudService.getEmployees().subscribe({
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
}
