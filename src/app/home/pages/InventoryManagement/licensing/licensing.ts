import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { OimsCrudService, SoftwareLicense } from 'src/app/services/oims-crud.service';

@Component({
  selector: 'app-licensing',
  imports: [SharedModule],
  templateUrl: './licensing.html',
  styleUrl: './licensing.scss'
})
export class Licensing implements OnInit {
  @ViewChild('licenseModal') licenseModalTemplate!: TemplateRef<unknown>;

  licenses: SoftwareLicense[] = [];
  model: Partial<SoftwareLicense> = {
    SoftwareName: '',
    Vendor: '',
    LicenseKey: '',
    Seats: 1,
    PurchaseDate: '',
    RenewalDate: '',
    Status: 'Active',
    Notes: ''
  };
  isEditing = false;
  editingId: number | null = null;
  search = '';
  page = 1;
  pageSize = 10;

  constructor(
    private readonly crud: OimsCrudService,
    public readonly modalService: NgbModal,
    private readonly cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadLicenses();
  }

  loadLicenses(): void {
    this.crud.getLicenses().subscribe({
      next: (data) => {
        this.licenses = data || [];
        this.cd.detectChanges();
      },
      error: () => {
        this.licenses = [];
        this.cd.detectChanges();
      }
    });
  }

  openCreate(): void {
    this.isEditing = false;
    this.editingId = null;
    this.model = {
      SoftwareName: '',
      Vendor: '',
      LicenseKey: '',
      Seats: 1,
      PurchaseDate: '',
      RenewalDate: '',
      Status: 'Active',
      Notes: ''
    };
    this.modalService.open(this.licenseModalTemplate, { size: 'lg' });
  }

  openEdit(license: SoftwareLicense): void {
    this.isEditing = true;
    this.editingId = license.LicenseId || null;
    this.model = { ...license };
    this.modalService.open(this.licenseModalTemplate, { size: 'lg' });
  }

  save(): void {
    const payload = {
      ...this.model,
      Seats: this.model.Seats ? Number(this.model.Seats) : 1
    };

    if (this.isEditing && this.editingId) {
      this.crud.updateLicense(this.editingId, payload).subscribe({
        next: () => { this.loadLicenses(); this.modalService.dismissAll(); }
      });
    } else {
      this.crud.createLicense(payload).subscribe({
        next: () => { this.loadLicenses(); this.modalService.dismissAll(); }
      });
    }
  }

  delete(license: SoftwareLicense): void {
    if (!license.LicenseId || !confirm('Delete this license?')) {
      return;
    }
    this.crud.deleteLicense(license.LicenseId).subscribe({ next: () => this.loadLicenses() });
  }

  filteredLicenses() {
    const q = this.search?.toLowerCase().trim();
    if (!q) {
      return this.licenses;
    }
    return this.licenses.filter((license) =>
      String(license.SoftwareName || '').toLowerCase().includes(q)
      || String(license.Vendor || '').toLowerCase().includes(q)
      || String(license.Status || '').toLowerCase().includes(q)
      || String(license.RenewalDate || '').toLowerCase().includes(q)
    );
  }

  get pagedLicenses() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredLicenses().slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredLicenses().length / this.pageSize));
  }

  prevPage() { this.page = Math.max(1, this.page - 1); }
  nextPage() { this.page = Math.min(this.totalPages(), this.page + 1); }
  gotoPage(n: number) { this.page = n; }

  get renewalBadgeClass(): string {
    return 'bg-success';
  }
}
