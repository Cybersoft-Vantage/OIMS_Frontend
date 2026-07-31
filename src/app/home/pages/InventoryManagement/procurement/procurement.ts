import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from 'src/app/services/auth.service';
import { OimsCrudService, ProcurementRequest, DetailedCategory } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-procurement',
  imports: [SharedModule],
  templateUrl: './procurement.html',
  styleUrl: './procurement.scss',
  changeDetection: ChangeDetectionStrategy.Default
})
export class Procurement implements OnInit {
  private auth = inject(AuthService);
  @ViewChild('procurementModal') procurementModalTemplate!: TemplateRef<unknown>;

  get isAdminOrHR() {
    const role = (this.auth.role || '').toLowerCase();
    return role === 'admin' || role === 'hr';
  }

  requests: ProcurementRequest[] = [];
  categories: DetailedCategory[] = [];
  topCategories: DetailedCategory[] = [];
  subCategories: DetailedCategory[] = [];

  nextReference = 'PR-001';
  model: Partial<ProcurementRequest> = { Reference: this.nextReference, CategoryId: 0, SubCategoryId: undefined, Item: '', Quantity: 1, Status: 'Pending' };
  isEditing = false;
  editingId: number | null = null;

  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  constructor(private readonly crud: OimsCrudService,
    public readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll() {
    this.crud.getProcurements().subscribe({
      next: (d) => { this.requests = d || []; this.nextReference = this.calculateNextReference(this.requests); this.cd.detectChanges(); },
      error: () => { this.requests = []; this.nextReference = this.calculateNextReference(this.requests); this.cd.detectChanges(); }
    });
    this.crud.getDetailedCategories().subscribe({ next: (d) => { this.categories = d || []; this.topCategories = this.categories.filter((c) => !c.ParentId); this.cd.detectChanges(); } });
  }

  openCreate() {
    this.isEditing = false;
    this.editingId = null;
    this.subCategories = [];
    this.model = {
      Reference: this.nextReference,
      CategoryId: 0,
      SubCategoryId: undefined,
      Item: '',
      Quantity: 1,
      Status: 'Pending'
    };
    this.modalService.open(this.procurementModalTemplate, { size: 'lg' });
  }

  openEdit(req: ProcurementRequest) {
    this.isEditing = true;
    this.editingId = req.ProcurementId || null;
    this.model = { ...req };
    this.subCategories = this.getChildCategories(req.CategoryId);
    this.modalService.open(this.procurementModalTemplate, { size: 'lg' });
  }

  save(form: any) {
    if (!this.model.Reference) {
      this.model.Reference = this.nextReference;
    }

    if (this.isEditing && this.editingId) {
      this.crud.updateProcurement(this.editingId, this.model as any).subscribe({
        next: () => { this.loadAll(); this.modalService.dismissAll(); this.cd.detectChanges(); },
        error: () => { /* handle error */ }
      });
    } else {
      this.crud.createProcurement(this.model as any).subscribe({
        next: () => { this.loadAll(); this.modalService.dismissAll(); },
        error: () => { /* handle error */ }
      });
    }
  }

  delete(req: ProcurementRequest) {
    if (!req.ProcurementId) return;
    if (!confirm('Delete this request?')) return;
    this.crud.deleteProcurement(req.ProcurementId).subscribe({ next: () => { this.loadAll(); } });
  }

  calculateNextReference(requests: ProcurementRequest[]) {
    let max = 0;
    for (const request of requests) {
      const ref = request.Reference || '';
      const match = ref.match(/^PR-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!Number.isNaN(num) && num > max) {
          max = num;
        }
      }
    }
    return `PR-${String(max + 1).padStart(3, '0')}`;
  }

  getCategoryName(categoryId?: number | null) {
    return this.categories.find((c) => c.DetailedCategoryId === categoryId)?.Name || '';
  }

  getSubcategoryName(categoryId?: number | null) {
    if (!categoryId) return '';
    for (const category of this.categories) {
      if (category.children) {
        const child = category.children.find((c) => c.DetailedCategoryId === categoryId);
        if (child) {
          return child.Name || '';
        };
      }
    }
    return '';
  }

  onCategoryChange(categoryId?: number | null) {
    this.subCategories = this.getChildCategories(categoryId);
    this.model.SubCategoryId = undefined;
  }

  getChildCategories(categoryId?: number | null) {
    if (!categoryId) return [];
    const category = this.categories.find((c) => c.DetailedCategoryId === categoryId);
    return category?.children || [];
  }

  filteredRequests() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.requests;
    return this.requests.filter(r =>
      String(r.Reference || '').toLowerCase().includes(q)
      || String(r.Item || '').toLowerCase().includes(q)
      || String(r.Status || '').toLowerCase().includes(q)
    );
  }

  get pagedRequests() {
    const list = this.filteredRequests();
    const start = (this.page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  totalPages() { return Math.max(1, Math.ceil(this.filteredRequests().length / this.pageSize)); }
  prevPage() { this.page = Math.max(1, this.page - 1); }
  nextPage() { this.page = Math.min(this.totalPages(), this.page + 1); }
  gotoPage(n: number) { this.page = n; }

  // helper to get child categories for selected detailed category
  subcategoriesFor(categoryId?: number | null) {
    return this.getChildCategories(categoryId);
  }
}
