import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DetailedAsset, DetailedCategory, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-restore',
  imports: [SharedModule],
  templateUrl: './restore.html',
  styleUrl: './restore.scss'
})
export class RestorePage implements OnInit {
  activeTab: 'categories' | 'assets' | 'sold' = 'categories';
  deletedCategories: DetailedCategory[] = [];
  deletedAssets: DetailedAsset[] = [];
  assets: DetailedAsset[] = [];
  categories: DetailedCategory[] = [];
  isLoadingCategories = false;
  isLoadingAssets = false;
  isLoadingSoldAssets = false;

  constructor(private readonly crud: OimsCrudService, private readonly cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadDeletedCategories();
    this.loadDeletedAssets();
    this.loadAssets();
    this.loadCategories();
  }

  setTab(tab: 'categories' | 'assets' | 'sold') {
    this.activeTab = tab;
  }

  loadDeletedCategories() {
    this.isLoadingCategories = true;
    this.crud.getDeletedDetailedCategories().subscribe({
      next: (data) => {
        this.deletedCategories = data;
        this.isLoadingCategories = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.deletedCategories = [];
        this.isLoadingCategories = false;
        this.cd.detectChanges();
      }
    });
  }

  loadDeletedAssets() {
    this.isLoadingAssets = true;
    this.crud.getDeletedDetailedAssets().subscribe({
      next: (data) => {
        this.deletedAssets = data;
        this.isLoadingAssets = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.deletedAssets = [];
        this.isLoadingAssets = false;
        this.cd.detectChanges();
      }
    });
  }

  loadAssets() {
    this.isLoadingSoldAssets = true;
    this.crud.getDetailedAssets().subscribe({
      next: (data) => {
        this.assets = data || [];
        this.isLoadingSoldAssets = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.assets = [];
        this.isLoadingSoldAssets = false;
        this.cd.detectChanges();
      }
    });
  }

  restoreCategory(id: number) {
    if (!id) return;
    this.crud.restoreDetailedCategory(id).subscribe({
      next: () => {
        this.loadDeletedCategories();
      },
      error: () => {
        this.loadDeletedCategories();
      }
    });
  }

  restoreAsset(id: number) {
    if (!id) return;
    this.crud.restoreDetailedAsset(id).subscribe({
      next: () => {
        this.loadDeletedAssets();
      },
      error: () => {
        this.loadDeletedAssets();
      }
    });
  }

  get soldAssetsForRestore(): DetailedAsset[] {
    return (this.assets || []).filter((asset) => {
      const status = (asset.Status || '').toString().trim().toLowerCase();
      return status.includes('sold') && asset.SoldPrice == null;
    });
  }

  restoreSoldAsset(assetId: number) {
    if (!assetId) return;
    this.crud.updateDetailedAsset(assetId, { Status: 'Good', SoldPrice: null }).subscribe({
      next: () => {
        this.loadAssets();
      },
      error: () => {
        this.loadAssets();
      }
    });
  }

  loadCategories() {
    this.crud.getDetailedCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.cd.detectChanges();
      }
    });
  }

  getCategoryName(categoryId?: number | null): string {
    const match = this.categories.find((category) => category.DetailedCategoryId === categoryId)
      || this.deletedCategories.find((category) => category.DetailedCategoryId === categoryId);
    return match?.Name || '—';
  }
}
