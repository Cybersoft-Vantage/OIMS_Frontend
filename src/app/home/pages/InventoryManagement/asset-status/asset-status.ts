import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AssetStatus, OimsCrudService } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-asset-status',
  imports: [SharedModule],
  templateUrl: './asset-status.html',
  styleUrl: './asset-status.scss'
})
export class AssetStatusPage implements OnInit {
  @ViewChild('statusModal') statusModalTemplate!: TemplateRef<unknown>;

  statuses: AssetStatus[] = [];
  statusModel: AssetStatus = { StatusName: '' };
  isEditing = false;
  editingId: number | null = null;
  // table controls
  search = '';
  page = 1;
  pageSize = 10;

  get filteredStatuses() {
    const q = this.search?.toLowerCase().trim();
    if (!q) return this.statuses;
    return this.statuses.filter((s) => (s.StatusName || '').toLowerCase().includes(q));
  }

  get pagedStatuses() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredStatuses.slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredStatuses.length / this.pageSize));
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

  constructor(private readonly crud: OimsCrudService, private readonly modalService: NgbModal, private readonly cd: ChangeDetectorRef, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
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

  openModal() {
    this.resetForm();
    this.modalService.open(this.statusModalTemplate, { centered: true });
  }

  editStatus(s: AssetStatus) {
    this.isEditing = true;
    this.editingId = s.StatusId ?? null;
    this.statusModel = { ...s };
    this.modalService.open(this.statusModalTemplate, { centered: true });
  }

  submitStatus(form: NgForm, modal: NgbModalRef) {
    if (!form.valid) return;
    const request = this.isEditing && this.editingId
      ? this.crud.updateAssetStatus(this.editingId, this.statusModel)
      : this.crud.createAssetStatus(this.statusModel);
    request.subscribe({ next: () => { this.load(); modal.close('saved'); this.resetForm(); }, error: () => this.notify.error('Unable to save status.') });
  }

  deleteStatus(id: number) {
    if (!confirm('Are you sure you want to delete this status?')) return;
    this.crud.deleteAssetStatus(id).subscribe({
      next: () => {
        this.load();
        this.notify.success('Status deleted successfully.');
      },
      error: (error: any) => {
        if (error?.isDependencyError) {
          // Item is in use - show specific error message
          this.notify.error(`Cannot delete status:\n\n${error.message}`);
        } else {
          // Other errors
          this.notify.error('Unable to delete status.');
        }
      }
    });
  }

  private resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.statusModel = { StatusName: '' };
  }
}
