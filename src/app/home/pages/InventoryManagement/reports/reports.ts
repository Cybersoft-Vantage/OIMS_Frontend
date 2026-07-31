import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DetailedAsset, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-reports',
  imports: [SharedModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsPage implements OnInit {
  assignments: any[] = [];
  assets: DetailedAsset[] = [];
  employees: EmployeeDetail[] = [];
  selectedEmployeeId: number | null = null;
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
    let rows = this.assignments.filter((assignment) => !assignment.IsReturned || assignment.IsReturned === 0);

    if (this.selectedEmployeeId != null) {
      rows = rows.filter((assignment) => assignment.EmployeeId === this.selectedEmployeeId);
    }

    if (!q) {
      return rows;
    }

    return rows.filter((assignment) => {
      const assetName = this.getAssetName(assignment.DetailedAssetId).toLowerCase();
      const assetTag = this.getAssetTag(assignment.DetailedAssetId).toLowerCase();
      const employeeName = this.getEmployeeName(assignment.EmployeeId).toLowerCase();
      const assignedBy = String(assignment.AssignedBy || '').toLowerCase();
      const remarks = String(assignment.Remarks || '').toLowerCase();
      const assignedDate = String(assignment.AssignedDate || '').toLowerCase();

      return assetName.includes(q)
        || assetTag.includes(q)
        || employeeName.includes(q)
        || assignedBy.includes(q)
        || remarks.includes(q)
        || assignedDate.includes(q);
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

  downloadCsv(): void {
    const rows = this.filteredAssignments.map((assignment) => ({
      AssetTag: this.getAssetTag(assignment.DetailedAssetId),
      AssetName: this.getAssetName(assignment.DetailedAssetId),
      Employee: this.getEmployeeName(assignment.EmployeeId),
      AssignedDate: assignment.AssignedDate || '',
      AssignedBy: this.getAssignedByName(assignment.AssignedBy),
      ReturnDate: assignment.ReturnDate || ''
    }));

    const headers = ['AssetTag', 'AssetName', 'Employee', 'AssignedDate', 'AssignedBy'];
    const csv = [headers.join(',')]
      .concat(rows.map((row) => headers.map((field) => `"${String((row as any)[field] ?? '').replace(/"/g, '""')}"`).join(',')))
      .join('\r\n');

    const filename = this.selectedEmployeeId != null
      ? `employee_${this.selectedEmployeeId}_active_assignments.csv`
      : 'all_employee_active_assignments.csv';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
