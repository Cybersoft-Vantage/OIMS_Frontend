import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Asset, AssetHistory, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-asset-history',
  imports: [SharedModule],
  templateUrl: './asset-history.html',
  styleUrl: './asset-history.scss'
})
export class AssetHistoryPage implements OnInit {
  histories: AssetHistory[] = [];
  assets: Asset[] = [];
  employees: EmployeeDetail[] = [];
  search = '';
  page = 1;
  pageSize = 10;

  constructor(private readonly crudService: OimsCrudService,
    private readonly cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  get filteredHistories() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.histories;

    return this.histories.filter((h) => {
      const assetCode = this.getAssetCode(h.AssetId).toLowerCase();
      const assetName = this.getAssetName(h.AssetId).toLowerCase();
      const employeeName = this.getEmployeeName(h.EmployeeId).toLowerCase();
      const action = String(h.Action || '').toLowerCase();
      const notes = String(h.Notes || '').toLowerCase();
      const actionDate = h.ActionDate ? new Date(h.ActionDate).toLocaleString().toLowerCase() : '';

      return String(h.HistoryId).includes(q)
        || String(h.AssetId).includes(q)
        || assetCode.includes(q)
        || assetName.includes(q)
        || employeeName.includes(q)
        || action.includes(q)
        || notes.includes(q)
        || actionDate.includes(q);
    });
  }

  get pagedHistories() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredHistories.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredHistories.length / this.pageSize));
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

  private loadHistory() {
    this.crudService.getAssetHistory().subscribe({
      next: (data) => {
        this.histories = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.histories = [];
        this.cd.detectChanges();
      }
    });

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

  getAssetName(assetId?: number | null): string {
    const historyEntry = this.histories.find((h) => h.AssetId === assetId);
    if (historyEntry?.AssetName) return historyEntry.AssetName;
    return this.assets.find((asset) => asset.AssetId === assetId)?.AssetName || '—';
  }

  getAssetCode(assetId?: number | null): string {
    const historyEntry = this.histories.find((h) => h.AssetId === assetId);
    if (historyEntry?.AssetCode) return historyEntry.AssetCode;
    return this.assets.find((asset) => asset.AssetId === assetId)?.AssetCode || '—';
  }

  getEmployeeName(employeeId?: number | null): string {
    const historyEntry = this.histories.find((h) => h.EmployeeId === employeeId);
    if (historyEntry?.EmployeeName) return historyEntry.EmployeeName;
    return this.employees.find((employee) => employee.EmployeeId === employeeId)?.FullName || '—';
  }
}
