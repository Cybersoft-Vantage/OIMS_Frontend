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
  activeTab: 'users' | 'import' = 'users';
  showPassword = false;
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
  importFile?: File;
  importValidationError?: string;
  importResultMessage?: string;
  importErrors: Array<{ row?: number; error: string }> = [];
  importPreviewHeaders: string[] = [];
  importPreviewRows: Array<Record<string, string>> = [];
  readonly importPreviewLimit = 5;

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

  onFilterChange(): void {
    this.page = 1;
  }

  clearSearch(): void {
    this.search = '';
    this.onFilterChange();
  }

  get hasActiveFilters(): boolean {
    return !!this.search?.trim() || (!!this.roleFilter && this.roleFilter !== 'all');
  }

  resetFilters(): void {
    this.search = '';
    this.roleFilter = 'all';
    this.page = 1;
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

  setActiveTab(tab: 'users' | 'import'): void {
    this.activeTab = tab;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
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
    this.showPassword = false;
    this.employeeForm = { ...employee, Password: '' };
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

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile = input.files && input.files.length ? input.files[0] : undefined;
    this.importValidationError = undefined;
    this.importResultMessage = undefined;
    this.importErrors = [];
    this.importPreviewHeaders = [];
    this.importPreviewRows = [];

    if (!this.importFile) {
      return;
    }

    const filename = this.importFile.name.toLowerCase();
    if (!filename.endsWith('.csv') && !filename.endsWith('.xlsx')) {
      this.importValidationError = 'Only CSV or XLSX files are supported.';
      this.importFile = undefined;
      return;
    }

    if (filename.endsWith('.csv')) {
      this.loadImportCsvPreview(this.importFile);
    }
  }

  private loadImportCsvPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) {
        this.importValidationError = 'CSV file appears to be empty.';
        return;
      }
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim().length > 0);
      if (!lines.length) {
        this.importValidationError = 'CSV file appears to be empty.';
        return;
      }
      const headers = lines[0].split(',').map((header) => header.trim()).filter((header) => header.length > 0);
      if (!headers.length) {
        this.importValidationError = 'CSV header row is missing or malformed.';
        return;
      }
      this.importPreviewHeaders = headers;
      this.importPreviewRows = lines.slice(1, 1 + this.importPreviewLimit).map((line) => {
        const values = line.split(',').map((value) => value.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ?? '';
        });
        return row;
      });
    };
    reader.onerror = () => {
      this.importValidationError = 'Unable to read the selected CSV file.';
    };
    reader.readAsText(file);
  }

  uploadUsers(): void {
    if (!this.importFile) {
      this.notify.warn('Please select a file first.');
      return;
    }
    if (this.importValidationError) {
      this.notify.error(this.importValidationError);
      return;
    }

    this.crudService.uploadUsers(this.importFile)
      .pipe(finalize(() => this.cd.detectChanges()))
      .subscribe({
        next: (response) => {
          this.importResultMessage = `Processed ${response.processed} rows: created ${response.created}, updated ${response.updated}.`;
          this.importErrors = Array.isArray(response.errors)
            ? response.errors.map((error) => ({ row: error.row, error: error.error }))
            : [];
          this.loadEmployees();
        },
        error: (err) => {
          this.importResultMessage = undefined;
          const message = err?.error?.detail || err?.message || 'User import failed.';
          this.importErrors = [{ error: String(message) }];
        }
      });
  }

  downloadUserTemplate(format: 'csv' | 'xlsx'): void {
    const filename = format === 'csv' ? 'user_import_template.csv' : 'user_import_template.xlsx';
    const download = format === 'csv'
      ? this.crudService.downloadUserImportTemplateCsv()
      : this.crudService.downloadUserImportTemplateXlsx();

    download.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.notify.error('Unable to download import template.');
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
    this.showPassword = false;
    this.employeeForm = {
      UserId: '',
      FullName: '',
      Department: '',
      Designation: '',
      Email: '',
      Phone: '',
      IsActive: 1,
      Role: 'employee',
      Password: 'CSV112233'
    };
  }
}
