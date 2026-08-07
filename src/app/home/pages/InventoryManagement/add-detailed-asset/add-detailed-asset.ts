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
import { DETAILED_ASSET_IMPORT_COLUMNS } from '../bulk-import/import-columns';
import { ReturnAssignmentsDetailedList } from '../return-assignments-detailed-list/return-assignments-detailed-list';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_BRAND_FILL,
  PDF_BRAND_TEXT,
  PDF_HEADER_FILL,
  PDF_HEADER_TEXT,
  PDF_SECTION_FILL,
  PDF_SUBSECTION_FILL,
  PDF_ZEBRA_FILL,
  pdfText
} from 'src/app/shared/pdf-export.util';

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
      if (this.isAssetCategoryHidden(asset)) {
        return false;
      }
      if (this.selectedFilterCategoryId != null && asset.DetailedCategoryId !== this.selectedFilterCategoryId) {
        return false;
      }
      if (this.selectedFilterSubCategory.trim() && (asset.SubCategory || '').trim() !== this.selectedFilterSubCategory.trim()) {
        return false;
      }
      return true;
    });
  }

  private isCategoryHidden(category?: DetailedCategory | null): boolean {
    // The API returns 0/1; Number() also tolerates a boolean or numeric string.
    return !!category && Number(category.IsHidden) === 1;
  }

  /**
   * True when the asset's parent category, or the subcategory it belongs to, has been
   * hidden from the category manager. Hidden assets stay in the database and keep their
   * assignment history - they are just filtered out of the listings and pickers here.
   */
  isAssetCategoryHidden(asset: DetailedAsset): boolean {
    const parent = this.categories.find((category) => category.DetailedCategoryId === asset.DetailedCategoryId);
    if (!parent) {
      return false;
    }
    if (this.isCategoryHidden(parent)) {
      return true;
    }
    const subCategoryName = (asset.SubCategory || '').trim().toLowerCase();
    if (!subCategoryName) {
      return false;
    }
    const child = (parent.children ?? []).find(
      (item) => (item.Name || '').toString().trim().toLowerCase() === subCategoryName
    );
    return this.isCategoryHidden(child);
  }

  /** Parent categories a new asset may be filed under - hidden ones are excluded. */
  get visibleTopCategories(): DetailedCategory[] {
    return this.topCategories.filter((category) => !this.isCategoryHidden(category));
  }

  private visibleChildren(category?: DetailedCategory | null): DetailedCategory[] {
    return (category?.children ?? []).filter((child) => !this.isCategoryHidden(child));
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
    // Single source of truth, shared with the import screen's column check so the
    // template and the validation can never drift apart.
    const headers = DETAILED_ASSET_IMPORT_COLUMNS.map((column) => column.header);
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

  get hasAssetFilters(): boolean {
    return this.selectedFilterCategoryId != null || !!this.selectedFilterSubCategory.trim();
  }

  resetAssetFilters(): void {
    this.selectedFilterCategoryId = null;
    this.selectedFilterSubCategory = '';
    this.assetFilterSubCategories = [];
  }

  onAssetFilterCategoryChange(categoryId: number | null): void {
    this.selectedFilterCategoryId = categoryId;
    this.selectedFilterSubCategory = '';
    if (!categoryId) {
      this.assetFilterSubCategories = [];
      return;
    }
    const category = this.categories.find((item) => item.DetailedCategoryId === categoryId);
    this.assetFilterSubCategories = this.visibleChildren(category);
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
    this.assetTagFilterSubCategories = this.visibleChildren(category);
  }

  get assetTagModalAssets(): DetailedAsset[] {
    return this.assets.filter((asset) => {
      if (this.isAssetCategoryHidden(asset)) return false;
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

  // Export selected asset tags to PDF
  downloadAssetTagsPdf(): void {
    const selectedIds = Object.keys(this.assetTagSelected).filter((k) => this.assetTagSelected[Number(k)]).map((k) => Number(k));
    const selectedAssets = this.assets.filter((a) => selectedIds.includes(Number(a.DetailedAssetId ?? -1)));
    if (!selectedAssets.length) {
      this.notify.info('No assets selected');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const startY = this.drawPdfTitle(doc, 'Inventory Tags', `${selectedAssets.length} tag(s) · Generated ${this.formatExportDate(new Date().toISOString())}`);

    autoTable(doc, {
      startY,
      head: [['#', 'Asset Tag']],
      body: selectedAssets.map((asset, index) => [String(index + 1), pdfText(asset.AssetTag || '-')]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: PDF_HEADER_FILL, textColor: PDF_HEADER_TEXT, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: PDF_ZEBRA_FILL },
      columnStyles: { 0: { cellWidth: 40, halign: 'center' } },
      margin: { left: 28, right: 28 }
    });

    this.addPdfPageNumbers(doc);
    doc.save('Inventory_Tags.pdf');
    this.closeAssetTagModal();
  }

  private formatExportDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-CA');
  }

  /** Custom values as field/value pairs, for the nested tables in the stock PDF. */
  private parseCustomValuePairs(raw?: string | null): Array<{ key: string; value: string }> {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed)
          .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
          .map(([key, value]) => ({ key, value: String(value) }));
      }
      return [];
    } catch {
      // Not JSON - surface the raw text so nothing is silently dropped.
      return [{ key: 'Custom Values', value: String(raw) }];
    }
  }

  private getStatusPdfStyle(status?: string | null): { fillColor: [number, number, number]; textColor: [number, number, number] } | null {
    const normalized = (status || '').toLowerCase().trim();
    if (normalized === 'available') {
      return { fillColor: [255, 255, 0], textColor: [0, 0, 0] };
    }
    if (normalized === 'assigned') {
      return { fillColor: [11, 61, 145], textColor: [255, 255, 255] };
    }
    if (normalized.includes('damag')) {
      return { fillColor: [255, 0, 0], textColor: [255, 255, 255] };
    }
    if (normalized.includes('sold')) {
      return { fillColor: [0, 0, 0], textColor: [255, 255, 255] };
    }
    if (normalized === 'new') {
      return { fillColor: [11, 61, 145], textColor: [255, 255, 255] };
    }
    if (normalized === 'good') {
      return { fillColor: [0, 176, 80], textColor: [255, 255, 255] };
    }
    return null;
  }

  /** Draws the blue title band used by every inventory PDF and returns the Y position to continue from. */
  private drawPdfTitle(doc: jsPDF, title: string, subtitle?: string): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 28;
    doc.setFillColor(PDF_BRAND_FILL[0], PDF_BRAND_FILL[1], PDF_BRAND_FILL[2]);
    doc.rect(margin, 24, pageWidth - margin * 2, 32, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PDF_BRAND_TEXT[0], PDF_BRAND_TEXT[1], PDF_BRAND_TEXT[2]);
    doc.text(pdfText(title), pageWidth / 2, 45, { align: 'center' });

    let nextY = 70;
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(pdfText(subtitle), margin, nextY);
      nextY += 14;
    }
    doc.setTextColor(0, 0, 0);
    return nextY;
  }

  private addPdfPageNumbers(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - 28, pageHeight - 16, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);
  }

  private lastPdfY(doc: jsPDF, fallback: number): number {
    const table = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    return table?.finalY ?? fallback;
  }

  /** Writes a section heading, breaking to a new page when there is not enough room left. */
  private drawPdfSectionHeading(doc: jsPDF, text: string, y: number, options: { emphasis: boolean }): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    let top = y;
    if (top + 60 > pageHeight - 40) {
      doc.addPage();
      top = 40;
    }

    const height = options.emphasis ? 20 : 18;
    const fill = options.emphasis ? PDF_SECTION_FILL : PDF_SUBSECTION_FILL;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(margin, top, pageWidth - margin * 2, height, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(options.emphasis ? 10.5 : 9.5);
    const textColor: [number, number, number] = options.emphasis ? [22, 53, 92] : [63, 63, 63];
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(pdfText(text), margin + 8, top + height - 6);
    doc.setTextColor(0, 0, 0);
    return top + height;
  }

  downloadExistingAssetsPdf(): void {
    const exportAssets = this.filteredAssets;
    if (!exportAssets.length) {
      this.notify.info('No detailed assets available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    let cursorY = this.drawPdfTitle(
      doc,
      'Inventory Stock',
      `${exportAssets.length} asset(s) · Generated ${this.formatExportDate(new Date().toISOString())}`
    );

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

    for (const [parentCategory, subGroups] of Array.from(parentGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      cursorY = this.drawPdfSectionHeading(doc, `Category Name: ${parentCategory}`, cursorY + 8, { emphasis: true });

      for (const [subCategory, subAssets] of Array.from(subGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        cursorY = this.drawPdfSectionHeading(doc, `Subcategory: ${subCategory}`, cursorY + 4, { emphasis: false });

        // Fixed column set - custom values are rendered as their own nested table per
        // asset below, so a subcategory with extra fields never widens the main table.
        const headers = [
          'Asset ID',
          'Asset Name',
          'Make / Model',
          'Serial Number',
          'Purchase Cost',
          'Purchase Date',
          'Warranty End',
          'Status'
        ];
        const statusColumnIndex = 7;

        const sortedAssets = [...subAssets].sort((a, b) => String(a.AssetTag || '').localeCompare(String(b.AssetTag || '')));
        const body = sortedAssets.map((asset) =>
          [
            asset.AssetTag || '-',
            asset.Name || '-',
            asset.MakeModel || '-',
            asset.SerialNo || '-',
            asset.PurchaseCost == null ? '-' : String(asset.PurchaseCost),
            this.formatExportDate(asset.PurchaseDate),
            this.formatExportDate(asset.WarrantyEnd),
            asset.Status || '-'
          ].map((cell) => pdfText(cell))
        );

        autoTable(doc, {
          startY: cursorY,
          head: [headers],
          body,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
          headStyles: { fillColor: PDF_HEADER_FILL, textColor: PDF_HEADER_TEXT, fontStyle: 'bold', halign: 'center' },
          alternateRowStyles: { fillColor: PDF_ZEBRA_FILL },
          columnStyles: {
            4: { halign: 'right' },
            [statusColumnIndex]: { halign: 'center' }
          },
          margin: { left: 28, right: 28 },
          didParseCell: (data) => {
            if (data.section !== 'body' || data.column.index !== statusColumnIndex) {
              return;
            }
            const style = this.getStatusPdfStyle(sortedAssets[data.row.index]?.Status);
            if (style) {
              data.cell.styles.fillColor = style.fillColor;
              data.cell.styles.textColor = style.textColor;
            }
          }
        });

        cursorY = this.lastPdfY(doc, cursorY) + 8;

        // Nested detail: one indented Field/Value table per asset that carries custom
        // values, so subcategory-specific fields are reported without touching the
        // main table's layout.
        for (const asset of sortedAssets) {
          const pairs = this.parseCustomValuePairs(asset.CustomValues);
          if (!pairs.length) {
            continue;
          }
          cursorY = this.drawCustomValuesTable(doc, asset, pairs, cursorY);
        }

        cursorY += 6;
      }
    }

    this.addPdfPageNumbers(doc);
    doc.save('Inventory_Stock.pdf');
  }

  /** Indented Field/Value sub-table for one asset's custom values. Returns the next Y. */
  private drawCustomValuesTable(
    doc: jsPDF,
    asset: DetailedAsset,
    pairs: Array<{ key: string; value: string }>,
    startY: number
  ): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    let top = startY;
    if (top + 56 > pageHeight - 40) {
      doc.addPage();
      top = 40;
    }

    const label = `Custom Values - ${asset.AssetTag || asset.Name || 'Asset'}`;
    autoTable(doc, {
      startY: top,
      head: [[{ content: pdfText(label), colSpan: 2, styles: { halign: 'left' } }]],
      body: pairs.map((pair) => [pdfText(pair.key), pdfText(pair.value)]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: PDF_SUBSECTION_FILL, textColor: [63, 63, 63], fontStyle: 'bold' },
      bodyStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: 'bold', textColor: [70, 70, 70] },
        1: { cellWidth: 260 }
      },
      // Indented under the main table so the nesting reads visually.
      margin: { left: 68, right: 28 },
      tableWidth: 410
    });

    return this.lastPdfY(doc, top) + 8;
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
    const rawTag = (selectedCategory?.SubcategoryTagName || '').toString().toUpperCase();
    this.model.AssetTag = '';
    // if (rawTag.length !== 3) {
    //   return;
    // }

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
      this.subCategories = this.visibleChildren(parentCategory);
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
