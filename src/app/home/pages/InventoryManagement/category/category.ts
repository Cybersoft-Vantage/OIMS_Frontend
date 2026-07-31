import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Category as InventoryCategory, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-category',
  imports: [SharedModule],
  templateUrl: './category.html',
  styleUrl: './category.scss',
})
export class Category implements OnInit {
  @ViewChild('categoryModal') categoryModalTemplate!: TemplateRef<unknown>;

  categories: InventoryCategory[] = [];
  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  get filteredCategories() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.categories;
    return this.categories.filter((c) => (c.CategoryName || '').toLowerCase().includes(q) || (c.Description || '').toLowerCase().includes(q));
  }

  get pagedCategories() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredCategories.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredCategories.length / this.pageSize));
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
  categoryModel: InventoryCategory = {
    CategoryName: '',
    Description: '',
    IsActive: 1
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
    this.loadCategories();
  }

  openCategoryModal() {
    this.resetCategoryModal();
    this.modalService.open(this.categoryModalTemplate, { size: 'lg', centered: true });
  }

  loadCategories() {
    this.crudService.getCategories().subscribe({
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

  editCategory(category: InventoryCategory) {
    this.isEditing = true;
    this.editingId = category.CategoryId ?? null;
    this.categoryModel = { ...category, IsActive: category.IsActive ?? 1 };
    this.modalService.open(this.categoryModalTemplate, { centered: true, size: 'lg' });
  }

  submitCategory(form: NgForm, modal: NgbModalRef) {
    if (!form.valid) {
      return;
    }

    const payload = { ...this.categoryModel, IsActive: Number(this.categoryModel.IsActive) };
    const request = this.isEditing && this.editingId
      ? this.crudService.updateCategory(this.editingId, payload)
      : this.crudService.createCategory(payload);

    request.subscribe({
      next: () => {
        this.loadCategories();
        modal.close('saved');
        this.resetCategoryModal();
      },
      error: () => this.notify.error('Unable to save category.')
    });
  }

  deleteCategory(id: number) {
    this.notify.confirmModal('Are you sure you want to delete this category?').then((ok) => {
      if (!ok) return;
      this.crudService.deleteCategory(id).subscribe({
        next: () => {
          this.loadCategories();
          this.notify.success('Category deleted successfully.');
        },
        error: (error: any) => {
          if (error?.isDependencyError) {
            // Item is in use - show specific error message
            this.notify.error(`Cannot delete category:\n\n${error.message}`);
          } else {
            // Other errors
            this.notify.error('Unable to delete category.');
          }
        }
      });
    });
  }

  resetCategoryModal() {
    this.isEditing = false;
    this.editingId = null;
    this.categoryModel = {
      CategoryName: '',
      Description: '',
      IsActive: 1
    };
  }
}
