import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService, DetailedCategory, DetailedAsset, AssetStatus } from 'src/app/services/oims-crud.service';
import { NgForm } from '@angular/forms';
import { AssignAsset } from "../assign-asset/assign-asset";
import { AssignDetailedAsset } from "../assign-detailed-asset/assign-detailed-asset";
import { DetailedAssignmentsList } from "../detailed-assignments-list/detailed-assignments-list";
import { DetailedHistory } from "../detailed-history/detailed-history";
import { ActivatedRoute, Router } from '@angular/router';
import { DetailedAssetDetail } from "../detailed-asset-detail/detailed-asset-detail";
import { AssignmentsDetailedList } from "../assignments-detailed-list/assignments-detailed-list";
import { InventoryImport } from '../bulk-import/import';

@Component({
  selector: 'app-add-detailed-asset',
  imports: [SharedModule, AssignDetailedAsset, DetailedAssignmentsList, DetailedHistory, DetailedAssetDetail, AssignmentsDetailedList, InventoryImport],
  templateUrl: './add-detailed-asset.html',
  styleUrl: './add-detailed-asset.scss'
})
export class AddDetailedAsset implements OnInit {
  constructor(private readonly crud: OimsCrudService, private cd: ChangeDetectorRef, private route: ActivatedRoute, private readonly router: Router, private readonly notify: NotificationService) {}

  categories: DetailedCategory[] = [];
  topCategories: DetailedCategory[] = [];
  subCategories: DetailedCategory[] = [];
  assets: DetailedAsset[] = [];
  statuses: AssetStatus[] = [];
  activeTab: 'addasset' | 'showAsset' | 'assignasset' | 'returnasset' | 'assethistory' | 'assignmulti' | 'import' = 'addasset';
  selectedAssetId?: number | null = null;
  customFields: Array<{ key: string; type: string; required?: boolean }> = [];
  customValues: { [k: string]: any } = {};
  parentCustomFields: Array<{ key: string; type: string; required?: boolean }> = [];
  currentCustomSource: 'parent' | 'child' | 'none' = 'none';

  subCategoryTagMap: Record<string, string> = {
    laptop: 'LPT',
    laptops: 'LPT',
    desktop: 'DPC',
    desktops: 'DPC',
    monitor: 'MNT',
    monitors: 'MNT',
    mouse: 'MUX',
    mice: 'MUX'
  };

  model: DetailedAsset = {
    Name: '',
    AssetTag: '',
    DetailedCategoryId: undefined,
    SubCategory: '',
    MakeModel: '',
    SerialNo: '',
    Specifications: '',
    Status: '',
    PurchaseCost: null,
    PurchaseDate: '',
    WarrantyEnd: '',
    CustomValues: ''
  };

  controlName(key: string) {
    return `cv_${(key || '').toString().replace(/\s+/g, '_')}`;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.route.queryParams.subscribe(params => {
      this.activeTab = params['tab'] || 'addasset';
      this.selectedAssetId = params['assetId'] ? Number(params['assetId']) : null;
      if (this.activeTab !== 'showAsset') {
        this.selectedAssetId = null;
      }
    });
    this.crud.getDetailedCategories().subscribe({
      next: (d) => {
        this.categories = d;
        this.topCategories = d.filter((c) => !c.ParentId);
        this.cd.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.topCategories = [];
        this.cd.detectChanges();
      }
    });

    this.crud.getDetailedAssets().subscribe({
      next: (d) => {
        this.assets = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.cd.detectChanges();
      }
    });

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

  submit(form: NgForm) {
    if (!form.valid) {
      form.form.markAllAsTouched();
      return;
    }
    this.ensureAssetTag();
    // attach custom values: if structured customFields exist, serialize `customValues`.
    // If no structured fields are present, preserve the raw JSON the user may have entered in `model.CustomValues`.
    if (this.customFields && this.customFields.length) {
      try { this.model.CustomValues = JSON.stringify(this.customValues || {}); } catch { this.model.CustomValues = null as any; }
    }
      this.crud.createDetailedAsset(this.model).subscribe({ next: () => { this.loadData(); this.notify.success('Saved'); form.resetForm(); this.customValues = {}; }, error: () => this.notify.error('Unable to save detailed asset.') });
  }

  getCategoryName(id?: number | null): string {
    if (!id) return '—';
    const found = this.categories.find((c) => c.DetailedCategoryId === id);
    return found ? found.Name : '—';
  }

  setActiveTab(tab: 'addasset' | 'showAsset' | 'assignasset' | 'returnasset' | 'assethistory' | 'assignmulti' | 'import'): void {
    if (tab !== 'showAsset' && this.selectedAssetId != null) {
      this.selectedAssetId = null;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab, assetId: null, detailTab: null },
        queryParamsHandling: 'merge'
      });
    } else if (tab === 'showAsset') {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: 'showAsset', assetId: this.selectedAssetId ?? null, detailTab: null },
        queryParamsHandling: 'merge'
      });
    }
    this.activeTab = tab;
  }

  downloadImportTemplate(): void {
    const headers = [
      'AssetTag',
      'Name',
      'DetailedCategoryId',
      'SubCategory',
      'MakeModel',
      'SerialNo',
      'Specifications',
      'Status',
      'PurchaseCost',
      'PurchaseDate',
      'WarrantyEnd',
      'CustomValues'
    ];
    const csv = headers.join(',') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'detailed_asset_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  deleteAsset(id?: number | null) {
    if (!id) return;
    this.notify.confirmModal('Delete this detailed asset?').then((ok) => {
      if (!ok) return;
      this.crud.deleteDetailedAsset(id).subscribe({
        next: () => this.loadData(),
        error: (error: any) => {
          if (error?.isDependencyError) {
            this.notify.error(`Cannot delete asset:\n\n${error.message}`);
          } else {
            this.notify.error('Unable to delete detailed asset.');
          }
        }
      });
    });
  }
  viewAsset(id?: number | null) {
    this.selectedAssetId = id ?? null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'showAsset', assetId: id ?? null, detailTab: 'history' },
      queryParamsHandling: 'merge'
    });
  }
  editAsset(id?: number | null) {
    this.selectedAssetId = id ?? null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'showAsset', assetId: id ?? null, detailTab: 'overview' },
      queryParamsHandling: 'merge'
    });
  }

  getCustomValuesLines(asset: DetailedAsset): string[] {
    if (!asset.CustomValues) return [];
    try {
      const parsed = JSON.parse(asset.CustomValues);
      return Object.entries(parsed).map(([key, value]) => `${key}: ${value}`);
    } catch {
      return [String(asset.CustomValues)];
    }
  }

  openInfo(asset: DetailedAsset) {
    const lines = this.getCustomValuesLines(asset);
    if (!lines || !lines.length) {
        this.notify.info('No additional info');
      return;
    }
      this.notify.info(lines.join('\n'));
  }

  closeAssetDetail() {
    this.selectedAssetId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'showAsset', assetId: null },
      queryParamsHandling: 'merge'
    });
  }

  private getTagPrefix(subCategory: string): string | undefined {
    const normalized = subCategory.trim().toLowerCase();
    const mapped = this.subCategoryTagMap[normalized];
    if (mapped) {
      return mapped;
    }

    const cleanedWords = normalized.replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean);
    if (!cleanedWords.length) {
      return undefined;
    }

    const combined = cleanedWords.join('');
    return combined.substring(0, 3).toUpperCase();
  }

  ensureAssetTag() {
    const selectedSubCategory = this.model.SubCategory?.trim();
    if (!selectedSubCategory) {
      this.model.AssetTag = '';
      return;
    }

    const prefix = this.getTagPrefix(selectedSubCategory);
    if (!prefix) {
      this.model.AssetTag = '';
      return;
    }

    const existingTags = (this.assets || [])
      .map((asset) => asset.AssetTag || '')
      .filter((tag) => tag.startsWith(`CSV-${prefix}-`));

    const maxNumber = existingTags.reduce((max, tag) => {
      const match = tag.match(new RegExp(`^CSV-${prefix}-(\\d{3})$`));
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
    this.model.AssetTag = `CSV-${prefix}-${nextNumber}`;
  }

  onCategoryChange(id?: number | null) {
    this.customFields = [];
    this.customValues = {};
    this.subCategories = [];
    this.model.SubCategory = '';
    this.model.AssetTag = '';

    if (!id) return;

    const parentCategory = this.categories.find((c) => c.DetailedCategoryId === id);
    if (parentCategory) {
      this.subCategories = parentCategory.children ?? [];
      if (parentCategory.CustomSchema) {
        try {
          this.parentCustomFields = JSON.parse(parentCategory.CustomSchema);
          this.customFields = this.parentCustomFields;
          this.currentCustomSource = this.parentCustomFields.length ? 'parent' : 'none';
        } catch {
          this.parentCustomFields = [];
          this.customFields = [];
          this.currentCustomSource = 'none';
        }
      }
    }

    for (const f of this.customFields) {
      this.customValues[f.key] = null;
    }
  }

  // Called when a subcategory is selected. Uses child custom schema if present,
  // otherwise falls back to parent category's custom fields.
  onSubCategoryChange(subCategoryName?: string) {
    const name = (subCategoryName || '').toString().trim();
    // reset asset tag and custom values
    this.ensureAssetTag();
    this.customValues = {};
    if (!name) {
      this.customFields = this.parentCustomFields || [];
      for (const f of this.customFields) this.customValues[f.key] = null;
      this.currentCustomSource = this.customFields.length ? 'parent' : 'none';
      return;
    }

    const child = (this.subCategories || []).find((c) => c.Name && c.Name.toString().trim() === name);
    if (!child) {
      this.customFields = this.parentCustomFields || [];
      for (const f of this.customFields) this.customValues[f.key] = null;
      this.currentCustomSource = this.customFields.length ? 'parent' : 'none';
      return;
    }

    if (child.CustomSchema) {
      try {
        this.customFields = JSON.parse(child.CustomSchema);
        this.currentCustomSource = this.customFields.length ? 'child' : (this.parentCustomFields.length ? 'parent' : 'none');
      } catch {
        this.customFields = this.parentCustomFields || [];
        this.currentCustomSource = this.customFields.length ? 'parent' : 'none';
      }
    } else {
      this.customFields = this.parentCustomFields || [];
      this.currentCustomSource = this.customFields.length ? 'parent' : 'none';
    }

    for (const f of this.customFields) this.customValues[f.key] = null;
  }
}
