import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Asset, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';
import { NotificationService } from 'src/app/services/notification.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-adduser',
  imports: [SharedModule],
  templateUrl: './adduser.html',
  styleUrl: './adduser.scss',
})
export class Adduser implements OnInit {
  @ViewChild('userModal') userModalTemplate!: TemplateRef<unknown>;

  employees: EmployeeDetail[] = [];
  assets: Asset[] = [];
  roleFilter: string | null = null;
  employeeForm: EmployeeDetail & { Password?: string | null } = {
    UserId: '',
    FullName: '',
    Department: '',
    Designation: '',
    Email: '',
    Phone: '',
    IsActive: 1,
    Role: 'employee',
    Password: ''
  };
  isEditing = false;
  editingId: number | null = null;
  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  get filteredEmployees() {
    const q = this.search?.toLowerCase().trim();
    return this.employees.filter((e) => {
      const statusLabel = e.IsActive === 1 ? 'active' : 'inactive';
      if (this.roleFilter && this.roleFilter !== 'all' && String(e.Role || 'employee').toLowerCase() !== this.roleFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return String(e.FullName || '').toLowerCase().includes(q)
        || String(e.UserId || '').toLowerCase().includes(q)
        || String(e.Department || '').toLowerCase().includes(q)
        || String(e.Designation || '').toLowerCase().includes(q)
        || String(e.Email || '').toLowerCase().includes(q)
        || String(e.Phone || '').toLowerCase().includes(q)
        || String(e.Role || '').toLowerCase().includes(q)
        || statusLabel.includes(q);
    });
  }

  get pagedEmployees() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredEmployees.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredEmployees.length / this.pageSize));
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
    private readonly crudService: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    forkJoin({
      employees: this.crudService.getEmployees(),
      assets: this.crudService.getAssets()
    }).subscribe({
      next: (data) => {
        this.assets = data.assets || [];
        this.employees = (data.employees || []).map((employee) => ({
          ...employee,
          AssetCount: this.assets.filter((asset) => asset.CurrentEmployeeId === employee.EmployeeId).length
        }));
        this.cd.detectChanges();
      },
      error: () => {
        this.employees = [];
        this.assets = [];
        this.cd.detectChanges();
      }
    });
  }

  openModal(): void {
    this.resetForm();
    this.modalService.open(this.userModalTemplate, { centered: true, size: 'lg' });
  }

  editEmployee(employee: EmployeeDetail): void {
    this.isEditing = true;
    this.editingId = employee.EmployeeId ?? null;
    this.employeeForm = { ...employee };
    this.modalService.open(this.userModalTemplate, { centered: true, size: 'lg' });
  }

  submitUser(form: NgForm, modal: NgbModalRef): void {
    if (!form.valid) {
      return;
    }
    const payload = {
      ...this.employeeForm,
      IsActive: Number(this.employeeForm.IsActive),
      Role: this.employeeForm.Role || 'employee',
      Password: this.employeeForm.Password || undefined
    };

    const request = this.isEditing && this.editingId
      ? this.crudService.updateEmployee(this.editingId, payload)
      : this.crudService.createEmployee(payload);

    request.subscribe({
      next: () => {
        this.loadEmployees();
        modal.close('saved');
        this.resetForm();
      },
      error: () => {
        this.notify.error('Unable to save employee.');
      }
    });
  }

  deleteEmployee(id: number): void {
    this.notify.confirmModal('Delete this employee?').then((ok) => {
      if (!ok) return;
      this.crudService.deleteEmployee(id).subscribe({
        next: () => this.loadEmployees(),
        error: () => this.notify.error('Unable to delete employee.')
      });
    });
  }

  private resetForm(): void {
    this.isEditing = false;
    this.editingId = null;
    this.employeeForm = {
      UserId: '',
      FullName: '',
      Department: '',
      Designation: '',
      Email: '',
      Phone: '',
      IsActive: 1,
      Role: 'employee',
      Password: ''
    };
  }
}
