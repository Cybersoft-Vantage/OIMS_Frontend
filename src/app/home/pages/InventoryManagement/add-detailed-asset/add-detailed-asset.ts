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
import { ReturnAssignmentsDetailedList } from '../return-assignments-detailed-list/return-assignments-detailed-list';
import * as ExcelJS from 'exceljs';

@Component({
  selector: 'app-add-detailed-asset',
  imports: [SharedModule, AssignDetailedAsset, DetailedAssignmentsList, DetailedHistory, DetailedAssetDetail, AssignmentsDetailedList, ReturnAssignmentsDetailedList, InventoryImport],
  templateUrl: './add-detailed-asset.html',
  styleUrl: './add-detailed-asset.scss'
})
export class AddDetailedAsset implements OnInit {
  constructor(private readonly crud: OimsCrudService, private cd: ChangeDetectorRef, private route: ActivatedRoute, private readonly router: Router, private readonly notify: NotificationService) {}

  categories: DetailedCategory[] = [];
  topCategories: DetailedCategory[] = [];
  subCategories: DetailedCategory[] = [];
  assetFilterSubCategories: DetailedCategory[] = [];
  // Asset Tag modal state
  assetTagModalOpen = false;
  assetTagSelected: { [id: number]: boolean } = {};
  assetTagFilterCategoryId: number | null = null;
  assetTagFilterSubCategory = '';
  assetTagFilterSubCategories: DetailedCategory[] = [];
  assets: DetailedAsset[] = [];
  statuses: AssetStatus[] = [];
  selectedFilterCategoryId: number | null = null;
  selectedFilterSubCategory = '';
  activeTab: 'addasset' | 'showAsset' | 'assignasset' | 'returnasset' | 'assethistory' | 'assignmulti' | 'returnmulti' | 'import' = 'addasset';
  selectedAssetId?: number | null = null;
  customFields: Array<{ key: string; type: string; required?: boolean }> = [];
  customValues: { [k: string]: any } = {};
  parentCustomFields: Array<{ key: string; type: string; required?: boolean }> = [];
  currentCustomSource: 'parent' | 'child' | 'none' = 'none';

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

  get filteredAssets(): DetailedAsset[] {
    return this.assets.filter((asset) => {
      if (this.selectedFilterCategoryId != null && asset.DetailedCategoryId !== this.selectedFilterCategoryId) {
        return false;
      }
      if (this.selectedFilterSubCategory.trim() && (asset.SubCategory || '').trim() !== this.selectedFilterSubCategory.trim()) {
        return false;
      }
      return true;
    });
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

  setActiveTab(tab: 'addasset' | 'showAsset' | 'assignasset' | 'returnasset' | 'assethistory' | 'assignmulti' | 'returnmulti' | 'import'): void {
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
      'Model',
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

  onAssetFilterCategoryChange(categoryId: number | null): void {
    this.selectedFilterCategoryId = categoryId;
    this.selectedFilterSubCategory = '';
    if (!categoryId) {
      this.assetFilterSubCategories = [];
      return;
    }
    const category = this.categories.find((item) => item.DetailedCategoryId === categoryId);
    this.assetFilterSubCategories = category?.children ?? [];
  }

  // Asset Tag modal helpers
  openAssetTagModal(): void {
    this.assetTagModalOpen = true;
    this.assetTagSelected = {};
    this.assetTagFilterCategoryId = null;
    this.assetTagFilterSubCategory = '';
    this.assetTagFilterSubCategories = [];
    // pre-select none; ensure change detection
    this.cd.detectChanges();
  }

  closeAssetTagModal(): void {
    this.assetTagModalOpen = false;
  }

  onAssetTagModalCategoryChange(categoryId: number | null): void {
    this.assetTagFilterCategoryId = categoryId;
    this.assetTagFilterSubCategory = '';
    if (!categoryId) {
      this.assetTagFilterSubCategories = [];
      return;
    }
    const category = this.categories.find((item) => item.DetailedCategoryId === categoryId);
    this.assetTagFilterSubCategories = category?.children ?? [];
  }

  get assetTagModalAssets(): DetailedAsset[] {
    return this.assets.filter((asset) => {
      if (this.assetTagFilterCategoryId != null && asset.DetailedCategoryId !== this.assetTagFilterCategoryId) return false;
      if (this.assetTagFilterSubCategory && (asset.SubCategory || '').trim() !== this.assetTagFilterSubCategory.trim()) return false;
      return true;
    });
  }

  isAssetTagSelected(a: DetailedAsset): boolean {
    const id = Number(a.DetailedAssetId ?? -1);
    return !!this.assetTagSelected[id];
  }

  toggleAssetTagSelection(a: DetailedAsset): void {
    const id = Number(a.DetailedAssetId ?? -1);
    if (id < 0) return;
    this.assetTagSelected[id] = !this.assetTagSelected[id];
  }

  anyAssetTagSelected(): boolean {
    return Object.values(this.assetTagSelected).some(Boolean);
  }

  allAssetTagSelected(): boolean {
    const items = this.assetTagModalAssets.map((a) => Number(a.DetailedAssetId ?? -1)).filter((i) => i >= 0);
    if (!items.length) return false;
    return items.every((id) => !!this.assetTagSelected[id]);
  }

  allAssetTagSelectedToggle(flag: boolean): void {
    for (const a of this.assetTagModalAssets) {
      const id = Number(a.DetailedAssetId ?? -1);
      if (id < 0) continue;
      this.assetTagSelected[id] = flag;
    }
  }


  toggleSelectAll(e: Event): void {
    const checked = !!(e.target as HTMLInputElement).checked;
    this.allAssetTagSelectedToggle(checked);
  }

  // Export selected asset tags to XLSX
  async downloadAssetTagsXlsx(): Promise<void> {
    const selectedIds = Object.keys(this.assetTagSelected).filter((k) => this.assetTagSelected[Number(k)]).map((k) => Number(k));
    const selectedAssets = this.assets.filter((a) => selectedIds.includes(Number(a.DetailedAssetId ?? -1)));
    if (!selectedAssets.length) {
      this.notify.info('No assets selected');
      return;
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Tags');
    const headerRow = worksheet.getRow(3);

    worksheet.columns = [{ width: 30 }];
    worksheet.mergeCells('A1:A1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Inventory Tags';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    // apply a simple theme-aware header fill so exported file is readable in light/dark modes
    try {
      const theme = document.body?.getAttribute('data-theme') || document.documentElement?.getAttribute('data-theme') || 'light';
      const isDark = theme.toLowerCase() === 'dark';
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isDark ? 'FF2B2B2B' : 'FFDCE6F1' } };
      headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isDark ? 'FF1F1F1F' : 'FFD9E2F3' } };
      headerRow.getCell(1).font = { bold: true, color: { argb: isDark ? 'FFFFFFFF' : 'FF000000' } };
    } catch {
      // ignore if DOM not available
    }

    // Header
    headerRow.getCell(1).value = 'Asset Tag';
    headerRow.getCell(1).font = { bold: true };
    headerRow.height = 20;

    let rowIndex = 4;
    for (const asset of selectedAssets) {
      const row = worksheet.getRow(rowIndex);
      row.getCell(1).value = asset.AssetTag || '';
      rowIndex += 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Inventory_Tags.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.closeAssetTagModal();
  }

  private getAssetMacAddress(asset: DetailedAsset): string {
    const assetWithMac = asset as DetailedAsset & { MacAddress?: string | null };
    if (assetWithMac.MacAddress) {
      return String(assetWithMac.MacAddress);
    }
    if (!asset.CustomValues) {
      return '—';
    }
    try {
      const parsed = typeof asset.CustomValues === 'string' ? JSON.parse(asset.CustomValues) : asset.CustomValues;
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        const macKey = keys.find((key) => key.toLowerCase().replace(/\s|_/g, '').includes('macaddress'));
        if (macKey && parsed[macKey] != null && String(parsed[macKey]).trim() !== '') {
          return String(parsed[macKey]);
        }
      }
    } catch {
      return '—';
    }
    return '—';
  }

  private formatExportDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-CA');
  }

  private parseCustomValueEntries(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed).map(([key, value]) => `${key}: ${value ?? ''}`);
      }
      return [];
    } catch {
      return [String(raw)];
    }
  }

  private applyThinBorder(row: ExcelJS.Row, length: number): void {
    for (let i = 1; i <= length; i += 1) {
      row.getCell(i).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  }

  private applySectionFill(row: ExcelJS.Row, length: number, fill: string): void {
    for (let i = 1; i <= length; i += 1) {
      row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    }
  }

  private applyStatusStyle(statusCell: ExcelJS.Cell, status?: string | null): void {
    const normalized = (status || '').toLowerCase().trim();
    if (normalized === 'available') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      statusCell.font = { color: { argb: 'FF000000' } };
      return;
    }
    if (normalized.includes('damag')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      statusCell.font = { color: { argb: 'FFFFFFFF' } };
      return;
    }
    if (normalized.includes('sold')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      statusCell.font = { color: { argb: 'FFFFFFFF' } };
      return;
    }
    if (normalized === 'new') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };
      statusCell.font = { color: { argb: 'FFFFFFFF' } };
      return;
    }
    if (normalized === 'good') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
      statusCell.font = { color: { argb: 'FFFFFFFF' } };
    }
  }

  async downloadExistingAssetsXlsx(): Promise<void> {
    const exportAssets = this.filteredAssets;
    if (!exportAssets.length) {
      this.notify.info('No detailed assets available to export.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Stock');

    worksheet.columns = [
      { width: 20 },
      { width: 24 },
      { width: 22 },
      { width: 20 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 28 }
    ];

    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Inventory Stock -CSV';
    titleCell.font = { bold: true, size: 20, color: { argb: 'FFFFCF3F' }, underline: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4EB3' } };
    titleCell.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      bottom: { style: 'medium' },
      right: { style: 'medium' }
    };
    worksheet.getRow(1).height = 30;

    const parentGroups = new Map<string, Map<string, DetailedAsset[]>>();
    for (const asset of exportAssets) {
      const parentCategory = this.getCategoryName(asset.DetailedCategoryId) || 'Uncategorized';
      const subCategory = (asset.SubCategory || '').trim() || 'Unspecified';
      if (!parentGroups.has(parentCategory)) {
        parentGroups.set(parentCategory, new Map<string, DetailedAsset[]>());
      }
      const subMap = parentGroups.get(parentCategory)!;
      if (!subMap.has(subCategory)) {
        subMap.set(subCategory, []);
      }
      subMap.get(subCategory)!.push(asset);
    }

    let rowIndex = 3;
    for (const [parentCategory, subGroups] of Array.from(parentGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      worksheet.mergeCells(`A${rowIndex}:L${rowIndex}`);
      const parentCell = worksheet.getCell(`A${rowIndex}`);
      parentCell.value = `Category Name: ${parentCategory}`;
      parentCell.font = { bold: true, size: 13, color: { argb: 'FF16355C' } };
      parentCell.alignment = { horizontal: 'left', vertical: 'middle' };
      parentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      rowIndex += 1;

      for (const [subCategory, subAssets] of Array.from(subGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        worksheet.mergeCells(`A${rowIndex}:L${rowIndex}`);
        const subCell = worksheet.getCell(`A${rowIndex}`);
        subCell.value = `Subcategory: ${subCategory}`;
        subCell.font = { bold: true, size: 12, color: { argb: 'FF3F3F3F' } };
        subCell.alignment = { horizontal: 'left', vertical: 'middle' };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FA' } };
        rowIndex += 1;

        const customEntries = subAssets.map((asset) => this.parseCustomValueEntries(asset.CustomValues));
        const maxCustomCount = customEntries.reduce((max, values) => Math.max(max, values.length), 0);

        const headers = [
          'Asset ID',
          'Asset Name',
          'Macaddress',
          'Serial Number',
          'Purchase Cost',
          'Purchase Date',
          'Warranty End',
          'Status'
        ];
        for (let i = 1; i <= maxCustomCount; i += 1) {
          headers.push(`Custom Value ${i}`);
        }

        const headerRow = worksheet.getRow(rowIndex);
        headerRow.values = headers;
        for (let c = 1; c <= headers.length; c += 1) {
          const cell = headerRow.getCell(c);
          cell.font = { bold: true, color: { argb: 'FF1F1F1F' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
        }
        this.applyThinBorder(headerRow, headers.length);
        headerRow.height = 22;
        rowIndex += 1;

        const sortedAssets = [...subAssets].sort((a, b) => String(a.AssetTag || '').localeCompare(String(b.AssetTag || '')));
        for (const asset of sortedAssets) {
          const values = this.parseCustomValueEntries(asset.CustomValues);
          const rowData: any[] = [
            asset.AssetTag || '—',
            asset.Name || '—',
            this.getAssetMacAddress(asset),
            asset.SerialNo || '—',
            asset.PurchaseCost == null ? '—' : asset.PurchaseCost,
            this.formatExportDate(asset.PurchaseDate),
            this.formatExportDate(asset.WarrantyEnd),
            asset.Status || '—'
          ];
          for (let i = 0; i < maxCustomCount; i += 1) {
            rowData.push(values[i] ?? '');
          }

          const dataRow = worksheet.getRow(rowIndex);
          dataRow.values = rowData;
          dataRow.alignment = { vertical: 'top', wrapText: true };
          dataRow.getCell(5).alignment = { horizontal: 'right' };
          this.applyStatusStyle(dataRow.getCell(8), asset.Status);
          this.applyThinBorder(dataRow, headers.length);
          if (rowIndex % 2 === 0) {
            this.applySectionFill(dataRow, headers.length, 'FFFAFAFA');
            this.applyStatusStyle(dataRow.getCell(8), asset.Status);
          }
          rowIndex += 1;
        }

        rowIndex += 1;
      }

      rowIndex += 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Inventory_Stock_CSV.xlsx');
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

  ensureAssetTag() {
    const selectedSubCategory = this.model.SubCategory?.trim();
    if (!selectedSubCategory) {
      this.model.AssetTag = '';
      return;
    }

    const selectedCategory = (this.subCategories || []).find(
      (category) => (category.Name || '').toString().trim() === selectedSubCategory
    );
    const rawTag = (selectedCategory?.SubcategoryTagName || '').toString().trim().toUpperCase();
    if (rawTag.length !== 3) {
      this.model.AssetTag = '';
      return;
    }

    const prefix = rawTag;
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
