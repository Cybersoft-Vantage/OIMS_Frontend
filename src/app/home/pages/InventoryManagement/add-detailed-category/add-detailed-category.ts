import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService, DetailedAsset, DetailedCategory } from 'src/app/services/oims-crud.service';
import { NgForm } from '@angular/forms';

type CategoryTab = 'addcategory' | 'showcategory' | 'visibility' | 'customfields' | 'deleted';

/** One row of the flattened category overview: a parent followed by its subcategories. */
interface CategoryRow {
  category: DetailedCategory;
  parent?: DetailedCategory;
  isSubcategory: boolean;
}

@Component({
  selector: 'app-add-detailed-category',
  imports: [SharedModule],
  templateUrl: './add-detailed-category.html',
  styleUrl: './add-detailed-category.scss'
})
export class AddDetailedCategory implements OnInit {
  constructor(
    private readonly crud: OimsCrudService,
    private cd: ChangeDetectorRef,
    private readonly notify: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  activeTab: CategoryTab = 'addcategory';

  categories: DetailedCategory[] = [];
  deletedCategories: DetailedCategory[] = [];
  assets: DetailedAsset[] = [];
  flatCategories: Array<{ id?: number; name: string }> = [];
  editingId: number | null = null;
  selectedCategoryId: number | null = null;
  SubcategoryTagName: string = '';

  // Overview / visibility tab filters
  search = '';
  visibilityFilter: 'all' | 'visible' | 'hidden' = 'all';
  typeFilter: 'all' | 'parent' | 'sub' = 'all';
  pendingVisibilityIds: { [id: number]: boolean } = {};

  // custom fields editor
  customFields: Array<{ key: string; type: string; required?: boolean }> = [];
  newField: { key: string; type: string; required: boolean } = { key: '', type: 'text', required: false };
  // pending operations for undo/confirm
  pendingOps: Array<{
    id: string;
    type: 'add' | 'remove';
    field: { key: string; type: string; required?: boolean };
    index: number;
    timer?: any;
  }> = [];

  model: Partial<DetailedCategory> = { Name: '', ParentId: null, SubcategoryTagName: '', Description: '', CustomSchema: '' };
  isSaving: boolean = false;
  saveMessage: string = '';
  saveError: string = '';

  get isSubcategory(): boolean {
    return !!this.model.ParentId;
  }

  get isCustomFieldsDisabled(): boolean {
    return !this.model.ParentId;
  }

  get isParentSelectorDisabled(): boolean {
    return this.editingId != null && !this.model.ParentId;
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab') as CategoryTab | null;
      this.activeTab = this.isKnownTab(tab) ? tab : 'addcategory';
      this.cd.detectChanges();
    });
    this.load();
    this.loadDeletedCategories();
    this.loadAssets();
  }

  private isKnownTab(tab: string | null): tab is CategoryTab {
    return tab === 'addcategory' || tab === 'showcategory' || tab === 'visibility' || tab === 'customfields' || tab === 'deleted';
  }

  setActiveTab(tab: CategoryTab): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  load() {
    this.crud.getDetailedCategories().subscribe({
      next: (d) => {
        this.categories = d;
        this.flatCategories = this.flattenCategories(d);
        this.cd.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.flatCategories = [];
        this.cd.detectChanges();
      }
    });
  }

  loadDeletedCategories() {
    this.crud.getDeletedDetailedCategories().subscribe({
      next: (d) => {
        this.deletedCategories = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.deletedCategories = [];
        this.cd.detectChanges();
      }
    });
  }

  private loadAssets() {
    this.crud.getDetailedAssets().subscribe({
      next: (d) => {
        this.assets = d || [];
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.cd.detectChanges();
      }
    });
  }

  private flattenCategories(categories: DetailedCategory[]): Array<{ id?: number; name: string }> {
    // Return only top-level (parent) categories for the ParentId selector.
    const list: Array<{ id?: number; name: string }> = [];
    for (const cat of categories) {
      if (!cat.ParentId) {
        list.push({ id: cat.DetailedCategoryId, name: cat.Name });
      }
    }
    return list;
  }

  // ---------------------------------------------------------------- overview

  /** Parents and their subcategories flattened into display order. */
  get categoryRows(): CategoryRow[] {
    const rows: CategoryRow[] = [];
    for (const parent of this.categories) {
      rows.push({ category: parent, isSubcategory: false });
      for (const child of parent.children ?? []) {
        rows.push({ category: child, parent, isSubcategory: true });
      }
    }
    return rows;
  }

  get filteredCategoryRows(): CategoryRow[] {
    const q = this.search?.toLowerCase().trim();
    return this.categoryRows.filter((row) => {
      if (this.typeFilter === 'parent' && row.isSubcategory) return false;
      if (this.typeFilter === 'sub' && !row.isSubcategory) return false;
      if (this.visibilityFilter === 'hidden' && !this.isHidden(row.category)) return false;
      if (this.visibilityFilter === 'visible' && this.isHidden(row.category)) return false;
      if (!q) return true;
      return (
        String(row.category.Name || '').toLowerCase().includes(q) ||
        String(row.category.SubcategoryTagName || '').toLowerCase().includes(q) ||
        String(row.category.Description || '').toLowerCase().includes(q) ||
        String(row.parent?.Name || '').toLowerCase().includes(q)
      );
    });
  }

  resetFilters(): void {
    this.search = '';
    this.visibilityFilter = 'all';
    this.typeFilter = 'all';
  }

  get hasOverviewFilters(): boolean {
    return !!this.search?.trim() || this.visibilityFilter !== 'all' || this.typeFilter !== 'all';
  }

  get parentCount(): number {
    return this.categories.length;
  }

  get subCategoryCount(): number {
    return this.categories.reduce((total, parent) => total + (parent.children?.length ?? 0), 0);
  }

  get hiddenCount(): number {
    return this.categoryRows.filter((row) => this.isHidden(row.category)).length;
  }

  /** Assets that are currently invisible in the asset listings because their category is hidden. */
  get hiddenAssetCount(): number {
    return this.categoryRows
      .filter((row) => this.isHidden(row.category))
      .reduce((total, row) => total + this.getAssetCount(row.category), 0);
  }

  isHidden(category?: DetailedCategory | null): boolean {
    // The API returns 0/1; Number() also tolerates a boolean or numeric string.
    return !!category && Number(category.IsHidden) === 1;
  }

  /**
   * Assets attached to this category. Parents own assets directly via
   * DetailedCategoryId; subcategories are matched by name because assets store
   * the subcategory as text (DetailedAsset.SubCategory).
   */
  getAssetCount(category: DetailedCategory, parent?: DetailedCategory): number {
    if (!category) return 0;
    const isSub = !!category.ParentId || !!parent;
    if (!isSub) {
      return this.assets.filter((asset) => asset.DetailedCategoryId === category.DetailedCategoryId).length;
    }
    const parentId = category.ParentId ?? parent?.DetailedCategoryId ?? null;
    const name = (category.Name || '').trim().toLowerCase();
    return this.assets.filter(
      (asset) =>
        (parentId == null || asset.DetailedCategoryId === parentId) &&
        (asset.SubCategory || '').trim().toLowerCase() === name
    ).length;
  }

  getCustomFieldCount(category: DetailedCategory): number {
    return this.parseCustomFields(category).length;
  }

  parseCustomFields(category: DetailedCategory): Array<{ key: string; type: string; required?: boolean }> {
    if (!category?.CustomSchema) return [];
    try {
      const parsed = JSON.parse(category.CustomSchema);
      return Array.isArray(parsed) ? parsed.filter((field) => field && field.key) : [];
    } catch {
      return [];
    }
  }

  /** Categories that declare at least one custom field, for the Custom Fields tab. */
  get customFieldRows(): CategoryRow[] {
    return this.categoryRows.filter((row) => this.getCustomFieldCount(row.category) > 0);
  }

  // -------------------------------------------------------------- visibility

  toggleVisibility(category: DetailedCategory, parent?: DetailedCategory): void {
    const id = category?.DetailedCategoryId;
    if (!id || this.pendingVisibilityIds[id]) return;

    const hide = !this.isHidden(category);
    const isParent = !category.ParentId && !parent;
    const childCount = category.children?.length ?? 0;
    const assetCount = this.getAssetCount(category, parent);

    const confirmLines = [`${hide ? 'Hide' : 'Show'} "${category.Name}"?`];
    if (hide) {
      confirmLines.push(
        `${assetCount} asset(s) will ${assetCount === 1 ? 'be' : 'be'} hidden from the asset list and pickers.`
      );
      if (isParent && childCount) {
        confirmLines.push(`Its ${childCount} subcategory(ies) will be hidden as well.`);
      }
      confirmLines.push('Nothing is deleted - you can show it again at any time.');
    } else if (isParent && childCount) {
      confirmLines.push(`Its ${childCount} subcategory(ies) will be shown as well.`);
    }

    this.notify.confirmModal(confirmLines.join('\n\n')).then((ok) => {
      if (!ok) return;
      this.pendingVisibilityIds[id] = true;
      this.crud.setDetailedCategoryVisibility(id, hide).subscribe({
        next: () => {
          delete this.pendingVisibilityIds[id];
          this.notify.success(`"${category.Name}" is now ${hide ? 'hidden' : 'visible'}.`);
          this.load();
        },
        error: () => {
          delete this.pendingVisibilityIds[id];
          this.notify.error('Unable to update category visibility.');
          this.cd.detectChanges();
        }
      });
    });
  }

  isVisibilityPending(category: DetailedCategory): boolean {
    const id = category?.DetailedCategoryId;
    return !!id && !!this.pendingVisibilityIds[id];
  }

  /** Hides or shows every parent (cascading to subcategories) in one go. */
  setAllVisibility(hide: boolean): void {
    const targets = this.categories.filter((parent) => this.isHidden(parent) !== hide && parent.DetailedCategoryId != null);
    if (!targets.length) {
      this.notify.info(hide ? 'All categories are already hidden.' : 'All categories are already visible.');
      return;
    }

    this.notify.confirmModal(`${hide ? 'Hide' : 'Show'} all ${targets.length} category tree(s)?`).then((ok) => {
      if (!ok) return;
      let remaining = targets.length;
      let failed = 0;
      for (const parent of targets) {
        const id = parent.DetailedCategoryId!;
        this.pendingVisibilityIds[id] = true;
        this.crud.setDetailedCategoryVisibility(id, hide).subscribe({
          next: () => {
            delete this.pendingVisibilityIds[id];
            remaining -= 1;
            if (remaining === 0) this.finishBulkVisibility(hide, failed);
          },
          error: () => {
            delete this.pendingVisibilityIds[id];
            failed += 1;
            remaining -= 1;
            if (remaining === 0) this.finishBulkVisibility(hide, failed);
          }
        });
      }
    });
  }

  private finishBulkVisibility(hide: boolean, failed: number): void {
    if (failed) {
      this.notify.error(`${failed} category(ies) could not be updated.`);
    } else {
      this.notify.success(`All categories are now ${hide ? 'hidden' : 'visible'}.`);
    }
    this.load();
  }

  // ------------------------------------------------------------- add / edit

  edit(cat: DetailedCategory) {
    this.selectedCategoryId = cat.DetailedCategoryId ?? null;
    this.crud.getDetailedCategory(cat.DetailedCategoryId!).subscribe({
      next: (detail) => {
        this.editingId = detail.DetailedCategoryId ?? null;
        this.model = {
          Name: detail.Name,
          ParentId: detail.ParentId ?? null,
          SubcategoryTagName: detail.SubcategoryTagName ?? '',
          Description: detail.Description,
          CustomSchema: detail.CustomSchema
        };
        try { this.customFields = detail.CustomSchema ? JSON.parse(detail.CustomSchema) : []; } catch { this.customFields = []; }
        this.cd.detectChanges();
      },
      error: () => {
        this.editingId = cat.DetailedCategoryId ?? null;
        this.model = {
          Name: cat.Name,
          ParentId: cat.ParentId ?? null,
          SubcategoryTagName: cat.SubcategoryTagName ?? '',
          Description: cat.Description,
          CustomSchema: cat.CustomSchema
        };
        try { this.customFields = cat.CustomSchema ? JSON.parse(cat.CustomSchema) : []; } catch { this.customFields = []; }
        this.cd.detectChanges();
      }
    });
  }

  /** Opens a category in the editor tab - used by the overview and custom-field tabs. */
  editInFormTab(cat: DetailedCategory): void {
    this.edit(cat);
    this.setActiveTab('addcategory');
  }

  addChildTo(parent: DetailedCategory) {
    this.clear();
    this.model.ParentId = parent.DetailedCategoryId ?? null;
    this.selectedCategoryId = parent.DetailedCategoryId ?? null;
    this.setActiveTab('addcategory');
  }

  clear() {
    this.editingId = null;
    this.selectedCategoryId = null;
    this.model = { Name: '', ParentId: null, SubcategoryTagName: '', Description: '', CustomSchema: '' };
    this.customFields = [];
    this.saveError = '';
  }

  addField() {
    const key = (this.newField.key || '').toString().trim();
    if (!key) return;
    // prevent duplicate keys
    if (this.customFields.find((f) => f.key && f.key.toString().trim().toLowerCase() === key.toLowerCase())) {
      this.notify.warn('Field name already exists');
      return;
    }
    const field = { key, type: this.newField.type, required: !!this.newField.required };
    const idx = this.customFields.push(field) - 1;
    this.newField = { key: '', type: 'text', required: false };

    if (this.editingId != null) {
      const opId = `op_add_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const timer = setTimeout(() => this.confirmPendingOp(opId), 5000);
      this.pendingOps.push({ id: opId, type: 'add', field, index: idx, timer });
    } else {
      // new category - no server call until Save
      this.model.CustomSchema = JSON.stringify(this.customFields || []);
    }
  }

  removeField(idx: number) {
    if (idx < 0 || idx >= this.customFields.length) return;
    const field = this.customFields[idx];
    // remove locally for immediate feedback
    this.customFields.splice(idx, 1);

    if (this.editingId != null) {
      const opId = `op_remove_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const timer = setTimeout(() => this.confirmPendingOp(opId), 5000);
      this.pendingOps.push({ id: opId, type: 'remove', field, index: idx, timer });
    } else {
      this.model.CustomSchema = JSON.stringify(this.customFields || []);
    }
  }

  confirmPendingOp(opId: string) {
    const opIndex = this.pendingOps.findIndex((p) => p.id === opId);
    if (opIndex === -1) return;
    const op = this.pendingOps[opIndex];
    if (op.timer) { clearTimeout(op.timer); }
    // persist current customFields as the source of truth
    this.model.CustomSchema = JSON.stringify(this.customFields || []);
    if (this.editingId != null) {
      this.crud.updateDetailedCategory(this.editingId, { CustomSchema: this.model.CustomSchema }).subscribe({ next: () => { this.load(); }, error: () => this.notify.error('Unable to persist custom schema') });
    }
    this.pendingOps.splice(opIndex, 1);
  }

  undoPendingOp(opId: string) {
    const opIndex = this.pendingOps.findIndex((p) => p.id === opId);
    if (opIndex === -1) return;
    const op = this.pendingOps[opIndex];
    if (op.timer) { clearTimeout(op.timer); }
    if (op.type === 'add') {
      // remove the added field if still present
      const idx = this.customFields.findIndex((f) => f.key === op.field.key && f.type === op.field.type);
      if (idx !== -1) this.customFields.splice(idx, 1);
    } else if (op.type === 'remove') {
      // re-insert the removed field at its original index
      const insertAt = Math.min(Math.max(0, op.index), this.customFields.length);
      this.customFields.splice(insertAt, 0, op.field);
    }
    this.pendingOps.splice(opIndex, 1);
    // update model.CustomSchema for non-editing or as local state; actual server persist skipped on undo
    if (this.editingId == null) {
      this.model.CustomSchema = JSON.stringify(this.customFields || []);
    }
  }

  save(f: NgForm) {
    if (!f.valid) return;
    this.saveError = '';
    const normalizedTag = (this.model.SubcategoryTagName || '').toString().trim().toUpperCase();
    if (this.model.ParentId && !normalizedTag) {
      this.saveError = 'Subcategory tag required.';
      return;
    }

    // Build payload and validate CustomSchema
    const payload: Partial<DetailedCategory> = {
      Name: (this.model.Name || '').toString(),
      ParentId: this.model.ParentId,
      SubcategoryTagName: this.model.ParentId ? normalizedTag : null,
      Description: this.model.Description
    };

    // prefer structured customFields; if empty but model.CustomSchema provided, validate it
    if (this.customFields && this.customFields.length) {
      payload.CustomSchema = JSON.stringify(this.customFields || []);
    } else if (this.model.CustomSchema) {
      try {
        JSON.parse(this.model.CustomSchema);
        payload.CustomSchema = this.model.CustomSchema;
      } catch {
        this.saveError = 'Custom schema JSON is invalid. Please fix before saving.';
        return;
      }
    } else {
      payload.CustomSchema = JSON.stringify([]);
    }

    this.isSaving = true;
    const onSuccess = () => {
      this.isSaving = false;
      this.saveMessage = 'Saved';
      this.notify.success('Category saved successfully.');
      setTimeout(() => (this.saveMessage = ''), 2000);
      this.load();
      this.loadDeletedCategories();
      this.loadAssets();
      this.clear();
      this.cd.detectChanges();
    };
    const onError = (err?: any) => {
      this.isSaving = false;
      const msg = err?.error?.detail || err?.message || 'Unable to save category.';
      this.saveError = msg;
      this.notify.error(this.saveError);
      this.cd.detectChanges();
      console.error('createDetailedCategory error', err);
    };

    if (this.editingId != null) {
      this.crud.updateDetailedCategory(this.editingId, payload).subscribe({ next: onSuccess, error: onError });
    } else {
      this.crud.createDetailedCategory(payload as DetailedCategory).subscribe({ next: onSuccess, error: onError });
    }
  }

  deleteCategory(id?: number) {
    if (!id) return;
    this.notify.confirmModal('Delete category?').then((ok) => {
      if (!ok) return;
      this.crud.deleteDetailedCategory(id).subscribe({
        next: () => {
          this.notify.info('Category soft-deleted. You can restore it from the deleted list.');
          if (this.editingId === id) this.clear();
          this.load();
          this.loadDeletedCategories();
        },
        error: (error: any) => {
          if (error?.isDependencyError) {
            this.notify.error(`Cannot delete category:\n\n${error.message}`);
          } else {
            this.notify.error('Unable to delete');
          }
        }
      });
    });
  }

  restoreCategory(id: number) {
    this.notify.confirmModal('Restore this deleted category?').then((ok) => {
      if (!ok) return;
      this.crud.restoreDetailedCategory(id).subscribe({
        next: () => {
          this.notify.success('Category restored successfully.');
          this.load();
          this.loadDeletedCategories();
        },
        error: () => {
          this.notify.error('Unable to restore category.');
        }
      });
    });
  }

  getParentName(category: DetailedCategory): string {
    if (!category?.ParentId) return '-';
    const parent = this.categories.find((item) => item.DetailedCategoryId === category.ParentId);
    return parent?.Name || '-';
  }
}
