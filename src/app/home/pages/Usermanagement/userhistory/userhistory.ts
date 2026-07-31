import { Component, OnInit, ChangeDetectorRef, TemplateRef, ViewChild, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { DetailedAsset, DetailedAssetHistory, DetailedCategory, EmployeeDetail, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-userhistory',
  imports: [SharedModule],
  templateUrl: './userhistory.html',
  styleUrl: './userhistory.scss',
})

export class Userhistory implements OnInit {
  private auth = inject(AuthService);
  private currentEmployeeUserId = this.auth.username;
  private currentRole = (this.auth.role || '').toLowerCase();
  private currentEmployeeId?: number;
  @ViewChild('viewModal') viewModalTemplate!: TemplateRef<unknown>;

  histories: DetailedAssetHistory[] = [];
  assets: DetailedAsset[] = [];
  categories: DetailedCategory[] = [];
  employees: EmployeeDetail[] = [];
  assetDetail: DetailedAsset | null = null;
  viewAssignment: any | null = null;
  selectedAssetId: number | null = null;
  search = '';
  page = 1;
  pageSize = 10;

  constructor(
    private readonly crud: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAssets();
    this.loadDeletedAssets();
    this.loadEmployees();
    this.loadDetailedCategories();
  }

  onAssetChange(): void {
    this.page = 1;
    this.loadHistory();
  }

  openViewModal(assetId: number) {
    // Load asset detail and latest assignment, then open modal when ready
    this.crud.getDetailedAsset(assetId).subscribe({
      next: (data) => {
        this.assetDetail = data;
        this.crud.getDetailedAssignments(assetId).subscribe({
          next: (assigns) => {
            this.viewAssignment = assigns.sort((a: any, b: any) => (b.AssignmentId || 0) - (a.AssignmentId || 0))[0] || null;
            if (!this.viewAssignment) {
              // fallback to history entries if there are no active assignment records
              this.crud.getDetailedHistory(assetId).subscribe({ next: (hist) => {
                // pick latest assigned and returned events
                const assigned = hist
                  .filter(h => String(h.Action).toLowerCase() === 'assigned')
                  .sort((a, b) => (b.ActionDate ? Date.parse(b.ActionDate as string) : 0) - (a.ActionDate ? Date.parse(a.ActionDate as string) : 0))[0];
                const returned = hist
                  .filter(h => String(h.Action).toLowerCase() === 'returned')
                  .sort((a, b) => (b.ActionDate ? Date.parse(b.ActionDate as string) : 0) - (a.ActionDate ? Date.parse(a.ActionDate as string) : 0))[0];
                if (assigned) {
                  this.viewAssignment = {
                    AssignedDate: assigned.ActionDate,
                    EmployeeId: undefined,
                    AssignedBy: this.parseAssignedByFromNotes(assigned.Notes) || assigned.EmployeeName || null,
                    IsReturned: !!returned,
                    ReturnedDate: returned?.ActionDate || null,
                    ReturnedBy: this.parseReturnedByFromNotes(returned?.Notes) || null
                  } as any;
                } else if (returned) {
                  this.viewAssignment = {
                    AssignedDate: null,
                    EmployeeId: undefined,
                    AssignedBy: null,
                    IsReturned: true,
                    ReturnedDate: returned.ActionDate,
                    ReturnedBy: this.parseReturnedByFromNotes(returned.Notes) || returned.EmployeeName || null
                  } as any;
                }
                this.cd.detectChanges();
                this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
              }, error: () => { this.cd.detectChanges(); this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' }); } });
              return;
            }
            this.cd.detectChanges();
            this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
          },
          error: () => {
            this.viewAssignment = null;
            this.cd.detectChanges();
            this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
          }
        });
      },
      error: () => {
        const deletedAsset = this.assets.find((asset) => asset.DetailedAssetId === assetId);
        if (deletedAsset) {
          this.assetDetail = deletedAsset;
          this.loadAssetAssignments(assetId);
          return;
        }

        this.assetDetail = null;
        this.viewAssignment = null;
        this.cd.detectChanges();
        this.modalService.open(this.viewModalTemplate, { centered: true, size: 'lg' });
      }
    });
  }

  private parseAssignedByFromNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const m = notes.match(/Assigned by\s*([^\-\(]+)/i);
    if (m && m[1]) return m[1].trim();
    return null;
  }

  private parseReturnedByFromNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const m = notes.match(/Returned by\s*([^\)\-]+)/i);
    if (m && m[1]) return m[1].trim();
    return null;
  }

  private loadAssetDetail(assetId: number) {
    this.crud.getDetailedAsset(assetId).subscribe({
      next: (data) => { this.assetDetail = data; this.cd.detectChanges(); },
      error: () => { this.assetDetail = null; this.cd.detectChanges(); }
    });
  }

  private loadAssetAssignments(assetId: number) {
    this.crud.getDetailedAssignments(assetId).subscribe({
      next: (data) => {
        this.viewAssignment = data
          .sort((a, b) => (b.AssignmentId || 0) - (a.AssignmentId || 0))[0] || null;
        this.cd.detectChanges();
      },
      error: () => { this.viewAssignment = null; this.cd.detectChanges(); }
    });
  }

  private loadEmployees(): void {
    this.crud.getEmployees().subscribe({
      next: (data) => {
        this.employees = data;
        const match = this.employees.find((employee) => String(employee.UserId).toLowerCase() === String(this.currentEmployeeUserId).toLowerCase());
        this.currentEmployeeId = match?.EmployeeId;
        this.cd.detectChanges();
        this.loadHistory();
      },
      error: () => { this.employees = []; this.currentEmployeeId = undefined; this.cd.detectChanges(); this.loadHistory(); }
    });
  }

  private loadDetailedCategories(): void {
    this.crud.getDetailedCategories().subscribe({
      next: (data) => { this.categories = data; this.cd.detectChanges(); },
      error: () => { this.categories = []; this.cd.detectChanges(); }
    });
  }

  private loadHistory(): void {
    this.crud.getDetailedHistory(this.selectedAssetId ?? undefined).subscribe({
      next: (data) => {
        const items = data || [];
        if (this.currentRole !== 'admin' && this.currentRole !== 'hr') {
          this.histories = items.filter((history) => history.EmployeeId === this.currentEmployeeId);
        } else {
          this.histories = items;
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.histories = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadDeletedAssets(): void {
    this.crud.getDeletedDetailedAssets().subscribe({
      next: (data) => {
        const deleted = data || [];
        this.assets = this.mergeAssets(this.assets, deleted);
        this.cd.detectChanges();
      },
      error: () => {
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

  getAssetName(assetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.Name || '—';
  }

  getAssetTag(assetId?: number | null): string {
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.AssetTag || '—';
  }

  getCategoryName(categoryId?: number | null): string {
    if (!categoryId) return '—';
    const found = this.categories.find((c) => c.DetailedCategoryId === categoryId);
    return found?.Name || '—';
  }

  getEmployeeName(employeeId?: number | null): string {
    return this.employees.find((e) => e.EmployeeId === employeeId)?.FullName || '—';
  }

  getReturnTo(): string {
    return this.viewAssignment?.ReturnedBy || '—';
  }

  getReturnBy(): string {
    if (!this.viewAssignment) return '—';
    return this.getEmployeeName(this.viewAssignment.EmployeeId);
  }

  get filteredHistories() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.histories;

    return this.histories.filter((h) => {
      const action = String(h.Action || '').toLowerCase();
      const notes = String(h.Notes || '').toLowerCase();
      const employee = String(h.EmployeeName || '').toLowerCase();
      const detail = String(this.getHistoryDetail(h) || '').toLowerCase();
      const tag = this.getAssetTag(h.DetailedAssetId).toLowerCase();
      const name = this.getAssetName(h.DetailedAssetId).toLowerCase();
      const date = String(h.ActionDate || '').toLowerCase();
      return (
        String(h.HistoryId).includes(q) ||
        String(h.DetailedAssetId).includes(q) ||
        action.includes(q) ||
        notes.includes(q) ||
        detail.includes(q) ||
        employee.includes(q) ||
        tag.includes(q) ||
        name.includes(q) ||
        date.includes(q)
      );
    });
  }

  getHistoryDetail(history: DetailedAssetHistory): string {
    const action = String(history.Action || '').toLowerCase();
    const notes = String(history.Notes || '').trim();
    if (notes) {
      return notes;
    }

    if (action === 'assigned') {
      return `Assigned by ${history.EmployeeName || 'Unknown'}`;
    }
    if (action === 'returned') {
      return `Returned by ${history.EmployeeName || 'Unknown'}`;
    }
    return notes || 'Details unavailable';
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
}