import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Asset, Category, SubCategory, AssetStatus, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-asset',
  imports: [SharedModule],
  templateUrl: './asset.html',
  styleUrl: './asset.scss'
})
export class AssetPage implements OnInit {
  @ViewChild('assetModal') assetModalTemplate!: TemplateRef<unknown>;

  constructor(private readonly crud: OimsCrudService,
    private readonly modalService: NgbModal,
    private cd: ChangeDetectorRef,
    private readonly notify: NotificationService) { }

  ngOnInit(): void {
    this.loadAll();
    // this.cd.detectChanges();
  }

  assets: Asset[] = [];
  categories: Category[] = [];
  subcategories: SubCategory[] = [];
  statuses: AssetStatus[] = [];

  assetModel: Asset = {
    AssetCode: '',
    AssetName: '',
    CategoryId: 0,
    SubCategoryId: undefined,
    Brand: '',
    Model: '',
    SerialNumber: '',
    MacAddress: '',
    PurchaseDate: '',
    PurchasePrice: 0,
    StatusId: 0,
    Remarks: ''
  };

  isEditing = false;
  editingId: number | null = null;

  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  get filteredAssets() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.assets;
    return this.assets.filter((a) => {
      const categoryName = this.getCategoryName(a.CategoryId).toLowerCase();
      const statusName = this.getStatusName(a.StatusId).toLowerCase();
      return String(a.AssetCode || '').toLowerCase().includes(q)
        || String(a.AssetName || '').toLowerCase().includes(q)
        || String(a.Brand || '').toLowerCase().includes(q)
        || String(a.Model || '').toLowerCase().includes(q)
        || String(a.SerialNumber || '').toLowerCase().includes(q)
        || String(a.MacAddress || '').toLowerCase().includes(q)
        || String(a.PurchaseDate || '').toLowerCase().includes(q)
        || String(a.PurchasePrice ?? '').toString().toLowerCase().includes(q)
        || String(a.Remarks || '').toLowerCase().includes(q)
        || categoryName.includes(q)
        || statusName.includes(q);
    });
  }

  get pagedAssets() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAssets.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredAssets.length / this.pageSize));
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

  loadAll() {
    this.crud.getAssets().subscribe({
      next: (d) => {
        this.assets = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.cd.detectChanges();
      }
    });

    this.crud.getCategories().subscribe({
      next: (d) => {
        this.categories = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.cd.detectChanges();
      }
    });

    this.crud.getSubcategories().subscribe({
      next: (d) => {
        this.subcategories = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.subcategories = [];
        this.cd.detectChanges();
      }
    });

    this.crud.getAssetStatuses().subscribe({
      next: (d) => {
        this.statuses = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.statuses = [];
        this.cd.detectChanges();
      }
    });
  }

  getCategoryName(categoryId?: number | null): string {
    return this.categories.find((c) => c.CategoryId === categoryId)?.CategoryName || '—';
  }

  getStatusName(statusId?: number | null): string {
    return this.statuses.find((s) => s.StatusId === statusId)?.StatusName || '—';
  }

  openModal() {
    this.resetForm();
    this.modalService.open(this.assetModalTemplate, { centered: true, size: 'lg' });
  }

  editAsset(asset: Asset) {
    this.isEditing = true;
    this.editingId = asset.AssetId ?? null;
    this.assetModel = { ...asset };
    this.modalService.open(this.assetModalTemplate, { centered: true, size: 'lg' });
  }

  submitAsset(form: NgForm, modal: NgbModalRef) {
    if (!form.valid) return;

    const payload: Asset = {
      ...this.assetModel,
      MacAddress: this.assetModel.MacAddress?.trim() || null,
      SerialNumber: this.assetModel.SerialNumber?.trim() || null,
      Brand: this.assetModel.Brand?.trim() || null,
      Model: this.assetModel.Model?.trim() || null,
      Remarks: this.assetModel.Remarks?.trim() || null,
      PurchaseDate: this.assetModel.PurchaseDate?.trim() || null,
      PurchasePrice: this.assetModel.PurchasePrice ?? null
    };

    const request = this.isEditing && this.editingId
      ? this.crud.updateAsset(this.editingId, payload)
      : this.crud.createAsset(payload);

    request.subscribe({ next: () => { this.loadAll(); modal.close('saved'); this.resetForm(); }, error: () => this.notify.error('Unable to save asset.') });
    // request.subscribe({
    //   next: () => {
    //     this.crud.getAssets().subscribe({
    //       next: (data) => {
    //         this.assets = [...data];
    //         modal.close();
    //         this.resetForm();
    //       },
    //       error: () => {
    //         alert('Unable to load assets.');
    //       }
    //     });
    //   },
    //   error: () => {
    //     alert('Unable to save asset.');
    //   }
    // });
  }

  deleteAsset(id: number) {
    if (!confirm('Delete this asset?')) return;
    this.crud.deleteAsset(id).subscribe({ next: () => this.loadAll(), error: () => this.notify.error('Unable to delete asset.') });
  }

  private resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.assetModel = {
      AssetCode: '',
      AssetName: '',
      CategoryId: 0,
      Brand: '',
      Model: '',
      SerialNumber: '',
      MacAddress: '',
      PurchaseDate: '',
      PurchasePrice: 0,
      StatusId: 0,
      Remarks: ''
    };
  }
}
