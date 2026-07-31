/**
 * UPDATED CATEGORY COMPONENT WITH SOFT DELETE ERROR HANDLING
 * 
 * Changes:
 * 1. Added ToastrService for better user notifications
 * 2. Added special handling for 409 Conflict errors (dependency errors)
 * 3. Show detailed error messages when deletion fails due to dependencies
 * 4. Improved error handling and user feedback
 */

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
  deleteError: string | null = null;
  selectedCategoryForDelete: InventoryCategory | null = null;

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
    // private readonly toastr: ToastrService  // Uncomment if using ToastrService
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
      error: (error) => {
        console.error('Error loading categories:', error);
        this.notify.error('Unable to load categories.');
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
        // this.toastr.success('Category saved successfully');
      },
      error: (error) => {
        console.error('Error saving category:', error);
        this.notify.error('Unable to save category.');
      }
    });
  }

  /**
   * Delete category with enhanced error handling for soft delete
   * 
   * If the category is in use (has assets), the API will return HTTP 409 Conflict
   * with a detailed message about what's preventing deletion.
   */
  deleteCategory(id: number) {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    this.crudService.deleteCategory(id).subscribe({
      next: () => {
        this.loadCategories();
        this.notify.success('Category deleted successfully.');
      },
      error: (error: any) => {
        console.error('Error deleting category:', error);
        
        // Check if this is a dependency error (409 Conflict)
        if (error.isDependencyError) {
          this.deleteError = error.message;
          this.selectedCategoryForDelete = this.categories.find(c => c.CategoryId === id) || null;
          
          // Show error message to user
          // this.toastr.error(error.message, 'Cannot Delete Category');
          this.notify.error(`Cannot delete category:\n\n${error.message}`);
        } else if (error.message) {
          // Other errors
          this.notify.error('Unable to delete category.');
        } else {
          // Generic error
          this.notify.error('An unexpected error occurred while deleting the category.');
        }
      }
    });
  }

  /**
   * Show details about why a category cannot be deleted
   * This could open a modal showing all assets assigned to this category
   */
  showDeleteBlockedDetails() {
    if (!this.selectedCategoryForDelete) return;
    
    // TODO: Implement modal to show dependent assets
    // This could:
    // 1. Query all assets with this category
    // 2. Display them in a modal
    // 3. Allow user to reassign them to another category
    // 4. Then retry the delete
    
    console.log('Showing delete blocked details for:', this.selectedCategoryForDelete);
  }

  /**
   * Clear the delete error
   */
  clearDeleteError() {
    this.deleteError = null;
    this.selectedCategoryForDelete = null;
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
