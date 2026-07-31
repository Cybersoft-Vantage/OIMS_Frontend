import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/app/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService, DetailedAsset, DetailedCategory, EmployeeDetail } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-assignments-detailed-list',
  imports: [SharedModule],
  templateUrl: './assignments-detailed-list.html',
  styleUrls: ['./assignments-detailed-list.scss'],
})
export class AssignmentsDetailedList implements OnInit {
  assets: DetailedAsset[] = [];
  categories: DetailedCategory[] = [];
  employees: EmployeeDetail[] = [];
  assignments: any[] = [];

  selectedAssets: number[] = [];
  selectedEmployeeId?: number;
  assignedDate = new Date().toISOString().split('T')[0];
  condition = 'Good';
  notes = '';
  acknowledge = false;

  search = '';
  categoryFilter?: number;
  page = 1;
  pageSize = 10;

  constructor(
    private readonly crud: OimsCrudService,
    private readonly cd: ChangeDetectorRef,
    private readonly notify: NotificationService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAssets();
    this.loadCategories();
    this.loadEmployees();
    this.loadAssignments();
  }

  private loadAssets(): void {
    this.crud.getDetailedAssets().subscribe({
      next: (data) => { this.assets = data; this.cd.detectChanges(); },
      error: () => { this.assets = []; this.cd.detectChanges(); }
    });
  }

  private loadCategories(): void {
    this.crud.getDetailedCategories().subscribe({
      next: (data) => { this.categories = data; this.cd.detectChanges(); },
      error: () => { this.categories = []; this.cd.detectChanges(); }
    });
  }

  private loadEmployees(): void {
    this.crud.getEmployees().subscribe({
      next: (data) => { this.employees = data; this.cd.detectChanges(); },
      error: () => { this.employees = []; this.cd.detectChanges(); }
    });
  }

  private loadAssignments(): void {
    this.crud.getDetailedAssignments().subscribe({
      next: (data) => { this.assignments = data; this.cd.detectChanges(); },
      error: () => { this.assignments = []; this.cd.detectChanges(); }
    });
  }

  get filteredAssets() {
    const q = this.search?.toLowerCase().trim();
    return this.assets
      .filter(asset => this.isSelected(asset) || (!this.assetHasOpenAssignment(asset) && !this.isUnderMaintenance(asset)))
      .filter(asset => {
        if (this.categoryFilter) {
          return asset.DetailedCategoryId === this.categoryFilter;
        }
        return true;
      })
      .filter(asset => {
        if (!q) return true;
        return [asset.AssetTag, asset.Name, asset.MakeModel, asset.Status]
          .some(value => String(value || '').toLowerCase().includes(q));
      });
  }

  get pagedAssets() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAssets.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.filteredAssets.length / this.pageSize));
  }

  prevPage(): void { this.page = Math.max(1, this.page - 1); }
  nextPage(): void { this.page = Math.min(this.totalPages, this.page + 1); }
  gotoPage(n: number): void { this.page = n; }

  getCategoryName(id?: number | null): string {
    return this.categories.find(c => c.DetailedCategoryId === id)?.Name || '—';
  }

  assetHasOpenAssignment(asset: DetailedAsset): boolean {
    if (!asset.DetailedCategoryId) {
      return false;
    }
    return this.assignments.some((assignment) => assignment.DetailedAssetId === asset.DetailedAssetId && (assignment.IsReturned === 0 || assignment.IsReturned === false || assignment.IsReturned == null));
  }

  isUnderMaintenance(asset: DetailedAsset): boolean {
    const status = (asset.Status || '').toLowerCase();
    return ['damaged', 'damage', 'maintenance'].includes(status);
  }

  toggleSelection(asset: DetailedAsset): void {
    if (!asset.DetailedAssetId || this.assetHasOpenAssignment(asset) || this.isUnderMaintenance(asset)) {
      return;
    }
    const idx = this.selectedAssets.indexOf(asset.DetailedAssetId);
    if (idx === -1) {
      this.selectedAssets.push(asset.DetailedAssetId);
    } else {
      this.selectedAssets.splice(idx, 1);
    }
  }

  isSelected(asset: DetailedAsset): boolean {
    return asset.DetailedAssetId != null && this.selectedAssets.includes(asset.DetailedAssetId);
  }

  get selectedAssetList() {
    return this.assets.filter(asset => asset.DetailedAssetId != null && this.selectedAssets.includes(asset.DetailedAssetId));
  }

  submitAssignments(): void {
    if (!this.selectedEmployeeId) {
      this.notify.warn('Please select an employee to assign.');
      return;
    }
    if (!this.selectedAssets.length) {
      this.notify.warn('Please select at least one asset.');
      return;
    }

    this.crud.assignDetailedAssetsBulk({
      DetailedAssetIds: [...this.selectedAssets],
      EmployeeId: this.selectedEmployeeId,
      AssignedDate: this.assignedDate,
      AssignedBy: this.auth.username || null,
      Remarks: this.notes || null,
    }).subscribe({
      next: (res) => {
        this.selectedAssets = [];
        this.notes = '';
        this.acknowledge = false;
        this.loadAssignments();
        this.loadAssets();

        const assignedCount = res?.assignments?.length || 0;
        const failedCount = res?.failed_asset_ids?.length || 0;
        if (failedCount > 0) {
          this.notify.warn(`Assigned ${assignedCount} asset(s). ${failedCount} asset(s) could not be assigned.`);
          return;
        }
        this.notify.success(`Assigned ${assignedCount} asset(s) successfully.`);
      },
      error: () => {
        this.notify.error('Unable to assign selected assets.');
      }
    });
  }
}
