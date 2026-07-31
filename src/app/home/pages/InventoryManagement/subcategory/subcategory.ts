import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Category, OimsCrudService, SubCategory } from 'src/app/services/oims-crud.service';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-subcategory',
  imports: [SharedModule],
  templateUrl: './subcategory.html',
  styleUrl: './subcategory.scss',
})
export class Subcategory implements OnInit {
  @ViewChild('subcategoryModal') subcategoryModalTemplate!: TemplateRef<unknown>;

  subcategories: SubCategory[] = [];
  categories: Category[] = [];
  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  get filteredSubcategories() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.subcategories;
    return this.subcategories.filter((s) => {
      const categoryName = this.getCategoryName(s.CategoryId).toLowerCase();
      return categoryName.includes(q)
        || String(s.SubCategoryName || '').toLowerCase().includes(q)
        || String(s.Description || '').toLowerCase().includes(q);
    });
  }

  get pagedSubcategories() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredSubcategories.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredSubcategories.length / this.pageSize));
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
  subcategoryModel: SubCategory = {
    CategoryId: 0,
    SubCategoryName: '',
    Description: ''
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
    this.loadSubcategories();
    this.crudService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.cd.detectChanges();
      }
    });
  }

  loadSubcategories() {
    this.crudService.getSubcategories().subscribe({
      next: (data) => {
        this.subcategories = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.subcategories = [];
        this.cd.detectChanges();
      }
    });
  }

  openModal() {
    this.resetForm();
    this.modalService.open(this.subcategoryModalTemplate, { centered: true, size: 'lg' });
  }

  submitSubcategory(form: NgForm, modal: NgbModalRef) {
    if (!form.valid) {
      return;
    }

    const request = this.isEditing && this.editingId
      ? this.crudService.updateSubcategory(this.editingId, this.subcategoryModel)
      : this.crudService.createSubcategory(this.subcategoryModel);

    request.subscribe({
      next: () => {
        this.loadSubcategories();
        modal.close('saved');
        this.resetForm();
      },
      error: () => this.notify.error('Unable to save subcategory.')
    });
  }

  editSubcategory(subcategory: SubCategory) {
    this.isEditing = true;
    this.editingId = subcategory.SubCategoryId ?? null;
    this.subcategoryModel = { ...subcategory };
    this.modalService.open(this.subcategoryModalTemplate, { centered: true, size: 'lg' });
  }

  getCategoryName(categoryId: number): string {
    return this.categories.find((c) => c.CategoryId === categoryId)?.CategoryName || '—';
  }

  deleteSubcategory(id: number) {
    this.notify.confirmModal('Are you sure you want to delete this subcategory?').then((ok) => {
      if (!ok) return;
      this.crudService.deleteSubcategory(id).subscribe({
        next: () => {
          this.loadSubcategories();
          this.notify.success('Subcategory deleted successfully.');
        },
        error: (error: any) => {
          if (error?.isDependencyError) {
            // Item is in use - show specific error message
            this.notify.error(`Cannot delete subcategory:\n\n${error.message}`);
          } else {
            // Other errors
            this.notify.error('Unable to delete subcategory.');
          }
        }
      });
    });
  }

  private resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.subcategoryModel = {
      CategoryId: 0,
      SubCategoryName: '',
      Description: ''
    };
  }
}
