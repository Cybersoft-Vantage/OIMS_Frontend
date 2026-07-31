import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService, DetailedCategory } from 'src/app/services/oims-crud.service';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-add-detailed-category',
  imports: [SharedModule],
  templateUrl: './add-detailed-category.html',
  styleUrl: './add-detailed-category.scss'
})
export class AddDetailedCategory implements OnInit {
  constructor(private readonly crud: OimsCrudService, private cd: ChangeDetectorRef, private readonly notify: NotificationService) {}

  categories: DetailedCategory[] = [];
  deletedCategories: DetailedCategory[] = [];
  flatCategories: Array<{ id?: number; name: string }> = [];
  editingId: number | null = null;
  selectedCategoryId: number | null = null;

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

  model: Partial<DetailedCategory> = { Name: '', ParentId: null, Description: '', CustomSchema: '' };
  isSaving: boolean = false;
  saveMessage: string = '';
  saveError: string = '';

  get isCustomFieldsDisabled(): boolean {
    return !this.model.ParentId;
  }

  get isParentSelectorDisabled(): boolean {
    return this.editingId != null && !this.model.ParentId;
  }

  ngOnInit(): void {
    this.load();
    this.loadDeletedCategories();
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

  edit(cat: DetailedCategory) {
    this.selectedCategoryId = cat.DetailedCategoryId ?? null;
    this.crud.getDetailedCategory(cat.DetailedCategoryId!).subscribe({
      next: (detail) => {
        this.editingId = detail.DetailedCategoryId ?? null;
        this.model = { Name: detail.Name, ParentId: detail.ParentId ?? null, Description: detail.Description, CustomSchema: detail.CustomSchema };
        try { this.customFields = detail.CustomSchema ? JSON.parse(detail.CustomSchema) : []; } catch { this.customFields = []; }
        this.cd.detectChanges();
      },
      error: () => {
        this.editingId = cat.DetailedCategoryId ?? null;
        this.model = { Name: cat.Name, ParentId: cat.ParentId ?? null, Description: cat.Description, CustomSchema: cat.CustomSchema };
        try { this.customFields = cat.CustomSchema ? JSON.parse(cat.CustomSchema) : []; } catch { this.customFields = []; }
        this.cd.detectChanges();
      }
    });
  }

  addChildTo(parent: DetailedCategory) {
    this.clear();
    this.model.ParentId = parent.DetailedCategoryId ?? null;
    this.selectedCategoryId = parent.DetailedCategoryId ?? null;
  }

  clear() {
    this.editingId = null;
    this.selectedCategoryId = null;
    this.model = { Name: '', ParentId: null, Description: '', CustomSchema: '' };
    this.customFields = [];
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
    // Build payload and validate CustomSchema
    const payload: Partial<DetailedCategory> = {
      Name: (this.model.Name || '').toString(),
      ParentId: this.model.ParentId,
      Description: this.model.Description
    };

    // prefer structured customFields; if empty but model.CustomSchema provided, validate it
    if (this.customFields && this.customFields.length) {
      payload.CustomSchema = JSON.stringify(this.customFields || []);
    } else if (this.model.CustomSchema) {
      try {
        JSON.parse(this.model.CustomSchema);
        payload.CustomSchema = this.model.CustomSchema;
      } catch (ex) {
        this.saveError = 'Custom schema JSON is invalid. Please fix before saving.';
        return;
      }
    } else {
      payload.CustomSchema = JSON.stringify([]);
    }

    this.isSaving = true;
    const onSuccess = (resp?: any) => {
      this.isSaving = false;
      this.saveMessage = 'Saved';
      this.notify.success('Category saved successfully.');
      setTimeout(() => (this.saveMessage = ''), 2000);
      this.load();
      this.loadDeletedCategories();
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
}
