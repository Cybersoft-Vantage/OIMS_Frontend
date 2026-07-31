import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService, DetailedAsset, DetailedCategory, DetailedAssetHistory, AssetStatus } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-detailed-asset-detail',
  imports: [SharedModule],
  templateUrl: './detailed-asset-detail.html',
  styleUrl: './detailed-asset-detail.scss'
})
export class DetailedAssetDetail implements OnInit {
  id?: number;
  model?: DetailedAsset;
  categories: DetailedCategory[] = [];
  subCategories: DetailedCategory[] = [];
  history: DetailedAssetHistory[] = [];
  statuses: AssetStatus[] = [];
  historySearch = '';
  historyPage = 1;
  historyPageSize = 10;
  activeTab: 'overview' | 'history' = 'overview';

  constructor(private readonly route: ActivatedRoute, private readonly crud: OimsCrudService, private readonly cd: ChangeDetectorRef, private readonly router: Router, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const routeId = params.get('assetId');
      const resolvedId = routeId ? Number(routeId) : undefined;
      const detailTab = params.get('detailTab');
      
      this.activeTab = detailTab === 'history' ? 'history' : 'overview';

      if (!resolvedId) {
        this.id = undefined;
        this.model = undefined;
        return;
      }

      this.id = resolvedId;
      this.load();
      this.loadCategories();
      this.loadHistory();
      this.loadStatuses();
    });
  }

  load() {
    if (!this.id) return;
    this.crud.getDetailedAsset(this.id).subscribe({
      next: (d) => {
        this.model = d;
        if (this.categories.length) {
          this.applyCategorySelection();
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.model = undefined;
        this.cd.detectChanges();
      }
    });
  }

  private loadCategories() {
    this.crud.getDetailedCategories().subscribe({
      next: (d) => {
        this.categories = d;
        this.applyCategorySelection();
        this.cd.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadHistory() {
    if (!this.id) return;
    this.crud.getDetailedHistory(this.id).subscribe({ next: (data) => { this.history = data; this.cd.detectChanges(); }, error: () => { this.history = []; this.cd.detectChanges(); } });
  }

  private loadStatuses() {
    if (!this.id) return;
    this.crud.getAssetStatuses().subscribe({
      next: (s) => {
        this.statuses = s;
        this.cd.detectChanges();
      },
      error: () => {
        this.statuses = [];
        this.cd.detectChanges();
      }
    });
  }

  onCategoryChange(id?: number | null, clearSubCategory = true) {
    if (!this.model) return;
    this.subCategories = [];
    if (clearSubCategory) {
      this.model.SubCategory = undefined;
    }

    if (!id) {
      return;
    }

    const category = this.findCategory(this.categories, id);
    if (category?.children?.length) {
      this.subCategories = category.children;
    }
  }

  onSubCategoryChange(subCategoryName?: string) {
    if (!this.model) return;
    const selectedName = (subCategoryName || '').toString().trim();
    if (!selectedName) {
      return;
    }

    const parent = this.findSubcategoryParent(selectedName);
    if (!parent) {
      return;
    }

    this.model.DetailedCategoryId = parent.DetailedCategoryId;
    this.subCategories = parent.children ?? [];
  }

  private findSubcategoryParent(name: string): DetailedCategory | undefined {
    const normalized = name.trim();
    for (const category of this.categories) {
      if (!category.children) {
        continue;
      }
      const match = category.children.find((child) => child.Name?.trim() === normalized);
      if (match) {
        return category;
      }
    }
    return undefined;
  }

  private applyCategorySelection() {
    if (!this.model || !this.model.DetailedCategoryId) return;
    this.onCategoryChange(this.model.DetailedCategoryId, false);
  }

  submit(form: NgForm) {
    if (!form.valid || !this.id || !this.model) {
      form.form.markAllAsTouched();
      return;
    }
    this.crud.updateDetailedAsset(this.id, this.model).subscribe({ next: () => { this.notify.success('Saved'); this.load(); }, error: () => this.notify.error('Unable to save detailed asset.') });
  }

  closeEditor(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { assetId: null },
      queryParamsHandling: 'merge'
    });
  }
  
  getCategoryName(categoryId?: number | null): string {
    if (!categoryId) return '—';
    const found = this.findCategory(this.categories, categoryId);
    return found?.Name || '—';
  }

  private findCategory(categories: DetailedCategory[], id: number): DetailedCategory | undefined {
    for (const category of categories) {
      if (category.DetailedCategoryId === id) {
        return category;
      }
      if (category.children && category.children.length) {
        const childMatch = this.findCategory(category.children, id);
        if (childMatch) {
          return childMatch;
        }
      }
    }
    return undefined;
  }

  get customValuesDisplay() {
    if (!this.model?.CustomValues) return [];
    try {
      const parsed = JSON.parse(this.model.CustomValues);
      return Object.keys(parsed).map((key) => ({ key, value: parsed[key] }));
    } catch {
      return [];
    }
  }

  get filteredHistory() {
    const q = this.historySearch?.toLowerCase().trim();
    if (!q) return this.history;
    return this.history.filter((h) => {
      return (
        String(h.Action || '').toLowerCase().includes(q) ||
        String(h.EmployeeName || '').toLowerCase().includes(q) ||
        String(h.Notes || '').toLowerCase().includes(q) ||
        String(this.getHistoryDetail(h) || '').toLowerCase().includes(q) ||
        String(h.ActionDate || '').toLowerCase().includes(q)
      );
    });
  }

  get totalHistoryPages() {
    return Math.max(1, Math.ceil(this.filteredHistory.length / this.historyPageSize));
  }

  get pagedHistory() {
    const start = (this.historyPage - 1) * this.historyPageSize;
    return this.filteredHistory.slice(start, start + this.historyPageSize);
  }

  prevHistoryPage(): void {
    this.historyPage = Math.max(1, this.historyPage - 1);
  }

  nextHistoryPage(): void {
    this.historyPage = Math.min(this.totalHistoryPages, this.historyPage + 1);
  }

  gotoHistoryPage(page: number): void {
    this.historyPage = Math.min(this.totalHistoryPages, Math.max(1, page));
  }

  resetHistoryPage(): void {
    this.historyPage = 1;
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
}
