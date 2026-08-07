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
  customFieldRows: Array<{ key: string; type: string; value: any }> = [];
  customValuesRaw = '';
  customValuesError = '';
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
        this.buildCustomFieldRows({ preserveEdits: false });
        this.cd.detectChanges();
      },
      error: () => {
        this.model = undefined;
        this.customFieldRows = [];
        this.customValuesRaw = '';
        this.cd.detectChanges();
      }
    });
  }

  private loadCategories() {
    this.crud.getDetailedCategories().subscribe({
      next: (d) => {
        this.categories = d;
        this.applyCategorySelection();
        this.buildCustomFieldRows({ preserveEdits: true });
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
    this.buildCustomFieldRows({ preserveEdits: true });
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
    this.buildCustomFieldRows({ preserveEdits: true });
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
    if (!this.applyCustomValues()) {
      return;
    }
    this.crud.updateDetailedAsset(this.id, this.model).subscribe({ next: () => { this.notify.success('Saved'); this.load(); }, error: () => this.notify.error('Unable to save detailed asset.') });
  }

  controlName(key: string): string {
    return `cv_${(key || '').toString().replace(/\s+/g, '_')}`;
  }

  /** Custom schema declared on the selected subcategory, falling back to the parent category. */
  private getCustomSchemaFields(): Array<{ key: string; type: string }> {
    if (!this.model) return [];

    const parse = (schema?: string | null): Array<{ key: string; type: string }> => {
      if (!schema) return [];
      try {
        const parsed = JSON.parse(schema);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((field) => field && field.key)
          .map((field) => ({ key: String(field.key), type: String(field.type || 'text') }));
      } catch {
        return [];
      }
    };

    const parent = this.model.DetailedCategoryId ? this.findCategory(this.categories, this.model.DetailedCategoryId) : undefined;
    const subCategoryName = (this.model.SubCategory || '').toString().trim();
    const child = subCategoryName
      ? (parent?.children ?? []).find((item) => (item.Name || '').toString().trim() === subCategoryName)
      : undefined;

    const childFields = parse(child?.CustomSchema);
    return childFields.length ? childFields : parse(parent?.CustomSchema);
  }

  private parseStoredCustomValues(): Record<string, any> | null {
    if (!this.model?.CustomValues) return {};
    try {
      const parsed = JSON.parse(this.model.CustomValues);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private inferFieldType(value: any): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    return 'text';
  }

  /**
   * Rebuilds the editable custom-value rows from the category schema plus whatever is
   * stored on the asset. `preserveEdits` keeps values the user has already typed in.
   */
  private buildCustomFieldRows(options: { preserveEdits: boolean }): void {
    this.customValuesError = '';

    if (!this.model) {
      this.customFieldRows = [];
      this.customValuesRaw = '';
      return;
    }

    const pending = options.preserveEdits
      ? this.customFieldRows.reduce<Record<string, any>>((acc, row) => {
          acc[row.key] = row.value;
          return acc;
        }, {})
      : {};

    const stored = this.parseStoredCustomValues();
    if (stored === null) {
      // Stored value is not a JSON object - fall back to raw editing.
      this.customFieldRows = [];
      this.customValuesRaw = this.model.CustomValues || '';
      return;
    }

    const rows: Array<{ key: string; type: string; value: any }> = [];
    const seen = new Set<string>();

    for (const field of this.getCustomSchemaFields()) {
      const value = options.preserveEdits && field.key in pending ? pending[field.key] : stored[field.key] ?? null;
      rows.push({ key: field.key, type: field.type, value });
      seen.add(field.key);
    }

    for (const key of Object.keys(stored)) {
      if (seen.has(key)) continue;
      const value = options.preserveEdits && key in pending ? pending[key] : stored[key];
      rows.push({ key, type: this.inferFieldType(stored[key]), value });
      seen.add(key);
    }

    this.customFieldRows = rows;
    this.customValuesRaw = rows.length ? '' : this.model.CustomValues || '';
  }

  /** Writes the edited custom values back onto the model. Returns false when the raw JSON is invalid. */
  private applyCustomValues(): boolean {
    if (!this.model) return false;
    this.customValuesError = '';

    if (this.customFieldRows.length) {
      const payload: Record<string, any> = {};
      for (const row of this.customFieldRows) {
        const key = (row.key || '').toString().trim();
        if (!key) continue;
        payload[key] = row.value === '' || row.value === undefined ? null : row.value;
      }
      this.model.CustomValues = JSON.stringify(payload);
      return true;
    }

    const raw = (this.customValuesRaw || '').trim();
    if (!raw) {
      this.model.CustomValues = null;
      return true;
    }

    try {
      JSON.parse(raw);
    } catch {
      this.customValuesError = 'Custom Values must be valid JSON, e.g. {"cpu":"i7","ram":"16GB"}.';
      this.notify.error(this.customValuesError);
      return false;
    }

    this.model.CustomValues = raw;
    return true;
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

  clearHistorySearch(): void {
    this.historySearch = '';
    this.resetHistoryPage();
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
