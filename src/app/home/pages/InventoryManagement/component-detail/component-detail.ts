import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Asset, AssetComponent, OimsCrudService, SubCategory } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-component-detail',
  imports: [SharedModule],
  templateUrl: './component-detail.html',
  styleUrl: './component-detail.scss',
})
export class ComponentDetail implements OnInit {
  @ViewChild('componentModal') componentModalTemplate!: TemplateRef<unknown>;

  components: AssetComponent[] = [];
  assets: Asset[] = [];
  subcategories: SubCategory[] = [];
  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  get filteredComponents() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.components;
    return this.components.filter((c) => {
      const assetName = this.getAssetName(c.AssetId).toLowerCase();
      return assetName.includes(q)
        || String(c.ComponentName || '').toLowerCase().includes(q)
        || String(c.Brand || '').toLowerCase().includes(q)
        || String(c.Quantity ?? '').toString().toLowerCase().includes(q);
    });
  }

  get pagedComponents() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredComponents.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredComponents.length / this.pageSize));
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
  componentModel: AssetComponent = {
    AssetId: 0,
    SubCategoryId: undefined,
    ComponentCode: undefined,
    ComponentName: '',
    Quantity: 1
  };
  isEditing = false;
  editingId: number | null = null;

  constructor(
    private readonly crudService: OimsCrudService,
    private readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadComponents();
    this.crudService.getAssets().subscribe({
      next: (data) => {
        this.assets = data;
        this.cd.detectChanges();
      }
    });
    this.crudService.getSubcategories().subscribe({
      next: (data) => {
        this.subcategories = data;
        this.cd.detectChanges();
      }
    });
  }

  loadComponents() {
    this.crudService.getAssetComponents().subscribe({
      next: (data) => {
        this.components = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.components = [];
        this.cd.detectChanges();
      }
    });
  }

  openModal() {
    this.resetForm();
    this.modalService.open(this.componentModalTemplate, { centered: true, size: 'lg' });
  }

  submitComponent(form: NgForm, modal: NgbModalRef) {
    if (!form.valid) {
      return;
    }

    // ensure component code is generated if not provided
    if (!this.componentModel.ComponentCode) {
      this.componentModel.ComponentCode = this.generateComponentCode(this.componentModel.AssetId, this.componentModel.ComponentName || '', this.componentModel.SubCategoryId);
    }

    const request = this.isEditing && this.editingId
      ? this.crudService.updateAssetComponent(this.editingId, this.componentModel)
      : this.crudService.createAssetComponent(this.componentModel);

    request.subscribe({
      next: () => {
        this.loadComponents();
        modal.close('saved');
        this.resetForm();
      },
      error: () => this.notify.error('Unable to save asset component.')
    });
  }

  editComponent(component: AssetComponent) {
    this.isEditing = true;
    this.editingId = component.ComponentId ?? null;
    this.componentModel = { ...component };
    this.modalService.open(this.componentModalTemplate, { centered: true, size: 'lg' });
  }

  getAssetName(assetId: number): string {
    return this.assets.find((a) => a.AssetId === assetId)?.AssetName || '—';
  }

  deleteComponent(id: number) {
    this.notify.confirmModal('Delete this component?').then((ok) => {
      if (!ok) return;
      this.crudService.deleteAssetComponent(id).subscribe({
        next: () => this.loadComponents(),
        error: () => this.notify.error('Unable to delete asset component.')
      });
    });
  }

  private generateAbbrev(name: string) {
    if (!name) return 'CMP';
    const cleaned = name.replace(/[^A-Za-z]/g, '').toUpperCase();
    // remove vowels to get consonant-heavy abbrev, fallback to first 3 letters
    const noVowels = cleaned.replace(/[AEIOU]/g, '');
    const base = (noVowels || cleaned).slice(0, 3).padEnd(3, 'X');
    return base;
  }

  public generateComponentCode(assetId: number | undefined, componentName: string, subCategoryId?: number | null) {
    const asset = this.assets.find(a => a.AssetId === assetId);
    const prefix = asset?.AssetCode?.split('-')[0] || 'CSV';
    const abbrev = this.generateAbbrev(componentName);

    // find existing components with same prefix-abbrev to determine next sequence
    const pattern = `${prefix}-${abbrev}-`;
    const matches = this.components
      .map(c => c.ComponentCode)
      .filter(Boolean)
      .filter(code => code!.startsWith(pattern)) as string[];

    let next = 1;
    if (matches.length) {
      const nums = matches.map(m => parseInt(m.split('-').pop() || '0', 10)).filter(n => !isNaN(n));
      if (nums.length) next = Math.max(...nums) + 1;
    }

    const seq = String(next).padStart(3, '0');
    return `${prefix}-${abbrev}-${seq}`;
  }

  private resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.componentModel = {
      AssetId: 0,
      ComponentName: '',
      Quantity: 1
    };
  }
}
