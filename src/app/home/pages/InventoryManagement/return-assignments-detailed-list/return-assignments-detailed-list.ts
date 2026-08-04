import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/app/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DetailedAsset, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-return-detailed-assignments-list',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './return-assignments-detailed-list.html',
  styleUrls: ['./return-assignments-detailed-list.scss']
})
export class ReturnAssignmentsDetailedList implements OnInit {
  assignments: any[] = [];
  assets: DetailedAsset[] = [];
  employees: EmployeeDetail[] = [];

  selectedAssignmentIds: number[] = [];
  returnToEmployeeId?: number;
  returnedDate = new Date().toISOString().split('T')[0];
  returnStatus = 'Available';
  remarks = '';

  search = '';
  employeeFilter?: number;
  page = 1;
  pageSize = 10;
  isSubmitting = false;

  constructor(
    private readonly crud: OimsCrudService,
    private readonly cd: ChangeDetectorRef,
    private readonly notify: NotificationService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
    this.loadAssets();
    this.loadEmployees();
  }

  private loadAssignments(): void {
    this.crud.getDetailedAssignments().subscribe({
      next: (data) => {
        this.assignments = (data || []).filter((item) => item.IsReturned === 0 || item.IsReturned === false || item.IsReturned == null);
        this.cd.detectChanges();
      },
      error: () => {
        this.assignments = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadAssets(): void {
    this.crud.getDetailedAssets().subscribe({
      next: (data) => {
        this.assets = data || [];
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadEmployees(): void {
    this.crud.getEmployees().subscribe({
      next: (data) => {
        this.employees = data || [];
        if (this.returnToEmployeeId == null && this.auth.username) {
          const currentUserEmployee = this.employees.find(
            (employee) => (employee.UserId || '').toString().toLowerCase() === this.auth.username?.toLowerCase()
          );
          this.returnToEmployeeId = currentUserEmployee?.EmployeeId;
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.employees = [];
        this.cd.detectChanges();
      }
    });
  }

  get filteredAssignments() {
    const q = this.search.trim().toLowerCase();
    return this.assignments
      .filter((assignment) => {
        if (!this.employeeFilter) return true;
        return assignment.EmployeeId === this.employeeFilter;
      })
      .filter((assignment) => {
        if (!q) return true;
        const asset = this.getAsset(assignment.DetailedAssetId);
        const employee = this.getEmployee(assignment.EmployeeId);
        return [
          asset?.AssetTag,
          asset?.Name,
          asset?.MakeModel,
          employee?.FullName,
          assignment.AssignedBy,
          assignment.Remarks
        ].some((value) => String(value || '').toLowerCase().includes(q));
      });
  }

  get pagedAssignments() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAssignments.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.filteredAssignments.length / this.pageSize));
  }

  prevPage(): void {
    this.page = Math.max(1, this.page - 1);
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages, this.page + 1);
  }

  gotoPage(n: number): void {
    this.page = n;
  }

  getAsset(detailedAssetId?: number): DetailedAsset | undefined {
    return this.assets.find((asset) => asset.DetailedAssetId === detailedAssetId);
  }

  getEmployee(employeeId?: number): EmployeeDetail | undefined {
    return this.employees.find((employee) => employee.EmployeeId === employeeId);
  }

  toggleSelection(assignment: any): void {
    const assignmentId = assignment?.AssignmentId;
    if (!assignmentId) return;

    const index = this.selectedAssignmentIds.indexOf(assignmentId);
    if (index === -1) {
      this.selectedAssignmentIds.push(assignmentId);
    } else {
      this.selectedAssignmentIds.splice(index, 1);
    }
  }

  isSelected(assignment: any): boolean {
    return this.selectedAssignmentIds.includes(assignment?.AssignmentId);
  }

  get selectedAssignments() {
    return this.assignments.filter((assignment) => this.selectedAssignmentIds.includes(assignment.AssignmentId));
  }

  submitReturns(): void {
    if (this.isSubmitting) {
      return;
    }
    if (!this.selectedAssignmentIds.length) {
      this.notify.warn('Please select at least one assignment to return.');
      return;
    }
    if (!this.returnToEmployeeId) {
      this.notify.warn('Please select Return To before submitting.');
      return;
    }

    const receiver = this.getEmployee(this.returnToEmployeeId);
    const returnedBy = receiver?.UserId || receiver?.FullName || this.auth.username || null;
    this.isSubmitting = true;

    this.crud.returnDetailedAssetsBulk({
      AssignmentIds: [...this.selectedAssignmentIds],
      ReturnedDate: this.returnedDate || null,
      ReturnedBy: returnedBy,
      Remarks: this.remarks || null,
      Status: this.returnStatus || null
    }).subscribe({
      next: (result) => {
        const returned = result?.returns?.length || 0;
        const failed = result?.failed_assignment_ids?.length || 0;
        this.selectedAssignmentIds = [];
        this.remarks = '';
        this.isSubmitting = false;
        this.loadAssignments();
        this.loadAssets();

        if (failed > 0) {
          this.notify.warn(`Returned ${returned} assignment(s). ${failed} assignment(s) could not be returned.`);
          return;
        }
        this.notify.success(`Returned ${returned} assignment(s) successfully.`);
      },
      error: () => {
        this.isSubmitting = false;
        this.notify.error('Unable to return selected assignments.');
      }
    });
  }
}
