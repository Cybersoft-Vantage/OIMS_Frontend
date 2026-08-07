import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { NgForm } from '@angular/forms';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService, DetailedAsset, EmployeeDetail } from 'src/app/services/oims-crud.service';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-maintenance',
  imports: [SharedModule],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.scss'
})
export class Maintenance implements OnInit {
  activeTab: 'workorders' | 'vendors' | 'history' | 'sold' = 'workorders';
  workOrders: any[] = [];
  vendors: any[] = [];
  assets: DetailedAsset[] = [];
  employees: EmployeeDetail[] = [];
  selectedWorkOrder: any = null;
  selectedVendor: any = null;
  maintenanceModel: any = {
    DetailedAssetId: undefined,
    Status: 'damaged',
    ReportedByEmployeeId: undefined,
    ReportedByName: '',
    VendorId: undefined,
    RepairCost: undefined,
    Notes: ''
  };
  maintenanceStates = new Set(['damaged', 'damage', 'maintenance']);
  maintenanceWorkOrderStates = new Set(['open', 'in progress', 'repaired', 'completed']);
  vendorModel: any = { Name: '', ContactName: '', Email: '', Phone: '', Address: '' };
  statusOptions = ['damaged', 'maintenance'];
  workOrderStatusOptions = ['open', 'in progress', 'repaired', 'completed'];
  historySearch = '';
  historyStatusFilter = '';
  historyVendorFilter: number | null = null;
  historyPage = 1;
  historyPageSize = 10;
  returnedByMap: Record<number, string> = {};
  soldModel: { DetailedAssetId?: number; SoldPrice?: number | null } = { DetailedAssetId: undefined, SoldPrice: null };
  soldEditModel: { DetailedAssetId?: number; AssetTag?: string; Name?: string; Status?: string; SoldPrice?: number | null } = {
    DetailedAssetId: undefined,
    AssetTag: '',
    Name: '',
    Status: '',
    SoldPrice: null
  };
  isSavingSold = false;

  private workOrderModalRef: NgbModalRef | null = null;
  private soldModalRef: NgbModalRef | null = null;

  constructor(private readonly crud: OimsCrudService, private readonly cd: ChangeDetectorRef, private readonly notify: NotificationService, private readonly modalService: NgbModal) {}

  ngOnInit(): void {
    this.loadWorkOrders();
    this.loadVendors();
    this.loadAssets();
    this.loadEmployees();
  }

  setTab(tab: 'workorders' | 'vendors' | 'history' | 'sold') {
    this.activeTab = tab;
    if (tab === 'sold') {
      this.loadAssets();
    }
  }

  isSoldTab(): boolean {
    return this.activeTab === 'sold';
  }

  loadWorkOrders(): void {
    this.crud.getWorkOrders().subscribe({
      next: (data) => {
        this.workOrders = data;
        // ensure employees are loaded so we can map names
        if (this.employees && this.employees.length) {
          this.mapReportedByNames();
        } else {
          this.loadEmployees();
        }
        // If some workorders reference assets not present in `this.assets`, fetch them so history shows all records
        const existingIds = new Set((this.assets || []).map((a) => a.DetailedAssetId).filter(Boolean));
        const referencedIds = new Set((this.workOrders || []).map((w) => w.DetailedAssetId).filter(Boolean));
        const missingIds: number[] = [];
        for (const id of referencedIds) {
          if (!existingIds.has(id)) missingIds.push(id as number);
        }
        for (const mid of missingIds) {
          this.crud.getDetailedAsset(mid).subscribe({ next: (asset) => { if (asset) { this.assets.push(asset); this.cd.detectChanges(); } }, error: () => {} });
        }
        this.cd.detectChanges();
        this.loadReturnedByForAssets();
      },
      error: () => { this.workOrders = []; this.cd.detectChanges(); }
    });
  }

  loadVendors(): void {
    this.crud.getVendors().subscribe({
      next: (data) => { this.vendors = data; this.cd.detectChanges(); },
      error: () => { this.vendors = []; this.cd.detectChanges(); }
    });
  }

  loadAssets(): void {
    this.crud.getDetailedAssets().subscribe({
      next: (data) => { this.assets = data; this.cd.detectChanges(); this.loadReturnedByForAssets(); },
      error: () => { this.assets = []; this.cd.detectChanges(); }
    });
  }

  loadEmployees(): void {
    this.crud.getEmployees().subscribe({
      next: (data) => { this.employees = data; this.cd.detectChanges(); this.mapReportedByNames(); this.loadReturnedByForAssets(); },
      error: () => { this.employees = []; this.cd.detectChanges(); }
    });
  }

  mapReportedByNames(): void {
    if (!this.workOrders || !this.workOrders.length || !this.employees) return;
    for (const wo of this.workOrders) {
      if ((!wo.ReportedByName || wo.ReportedByName === '') && wo.ReportedByEmployeeId) {
        const emp = this.employees.find((e) => e.EmployeeId === wo.ReportedByEmployeeId);
        if (emp) wo.ReportedByName = emp.FullName;
      }
    }
    this.cd.detectChanges();
  }

  saveVendor(form: NgForm): void {
    if (!form.valid) return;
    const action = this.selectedVendor ? this.crud.updateVendor(this.selectedVendor.VendorId, this.vendorModel) : this.crud.createVendor(this.vendorModel);
    action.subscribe({
      next: () => {
        form.resetForm();
        this.selectedVendor = null;
        this.vendorModel = { Name: '', ContactName: '', Email: '', Phone: '', Address: '' };
        this.loadVendors();
      },
      error: () => this.notify.error('Unable to save vendor.')
    });
  }

  editVendor(vendor: any): void {
    this.selectedVendor = vendor;
    this.vendorModel = {
      Name: vendor.Name,
      ContactName: vendor.ContactName,
      Email: vendor.Email,
      Phone: vendor.Phone,
      Address: vendor.Address
    };
    this.cd.detectChanges();
  }

  cancelVendorEdit(): void {
    this.selectedVendor = null;
    this.vendorModel = { Name: '', ContactName: '', Email: '', Phone: '', Address: '' };
  }

  createWorkOrder(form: NgForm): void {
    if (!form.valid) return;
    const payload = {
      DetailedAssetId: this.maintenanceModel.DetailedAssetId,
      Status: this.maintenanceModel.Status,
      ReportedByEmployeeId: this.maintenanceModel.ReportedByEmployeeId,
      ReportedByName: this.getReportedByName(),
      VendorId: this.maintenanceModel.VendorId,
      RepairCost: this.maintenanceModel.RepairCost,
      Notes: this.maintenanceModel.Notes
    };
    // If editing an existing work order, call update instead
    if (this.selectedWorkOrder) {
      this.crud.updateWorkOrder(this.selectedWorkOrder.WorkOrderId, payload).subscribe({
        next: () => {
          form.resetForm();
          this.selectedWorkOrder = null;
          this.maintenanceModel = {
            DetailedAssetId: undefined,
            Status: 'damaged',
            ReportedByEmployeeId: undefined,
            ReportedByName: '',
            VendorId: undefined,
            RepairCost: undefined,
            Notes: ''
          };
          if (this.workOrderModalRef) {
            this.workOrderModalRef.close();
            this.workOrderModalRef = null;
          }
          this.loadWorkOrders();
          this.loadAssets();
        },
        error: (err) => this.notify.error(err?.error?.detail || 'Unable to update work order.')
      });
      return;
    }

    this.crud.createWorkOrder(payload).subscribe({
      next: () => {
        form.resetForm();
        this.maintenanceModel = {
          DetailedAssetId: undefined,
          Status: 'damaged',
          ReportedByEmployeeId: undefined,
          ReportedByName: '',
          VendorId: undefined,
          RepairCost: undefined,
          Notes: ''
        };
        if (this.workOrderModalRef) {
          this.workOrderModalRef.close();
          this.workOrderModalRef = null;
        }
        this.loadWorkOrders();
        this.loadAssets();
      },
      error: (err) => this.notify.error(err?.error?.detail || 'Unable to create work order.')
    });
  }

  selectWorkOrder(wo: any): void {
    if (!wo) return;
    this.selectedWorkOrder = wo;
    this.maintenanceModel = {
      DetailedAssetId: wo.DetailedAssetId,
      Status: wo.Status || 'damaged',
      ReportedByEmployeeId: wo.ReportedByEmployeeId,
      ReportedByName: wo.ReportedByName || '',
      VendorId: wo.VendorId,
      RepairCost: wo.RepairCost,
      Notes: wo.Notes || ''
    };
    this.cd.detectChanges();
  }

  openWorkOrderModal(template: any, work?: any) {
    if (work) {
      this.selectWorkOrder(work);
    } else {
      this.selectedWorkOrder = null;
      this.maintenanceModel = {
        DetailedAssetId: undefined,
        Status: 'damaged',
        ReportedByEmployeeId: undefined,
        ReportedByName: '',
        VendorId: undefined,
        RepairCost: undefined,
        Notes: ''
      };
    }
    this.workOrderModalRef = this.modalService.open(template, { centered: true, size: 'lg' });
  }

  get workOrdersFiltered() {
    if (!this.workOrders) return [];
    const excluded = new Set(['repaired', 'completed', 'closed', 'done']);
    return this.workOrders.filter((w: any) => {
      const s = (w.Status || '').toString().toLowerCase();
      return !excluded.has(s);
    });
  }

  getAssetReportedBy(assetId?: number | null): string {
    if (!assetId) return '—';
    const wo = this.workOrders.find((w) => w.DetailedAssetId === assetId);
    return wo?.ReportedByName || '—';
  }

  loadReturnedByForAssets(): void {
    // Build a map of latest ReturnedBy per asset
    this.returnedByMap = {};
    const maintenanceAssetIds = this.maintenanceAssets.map((a) => a.DetailedAssetId).filter(Boolean) as number[];
    for (const id of maintenanceAssetIds) {
      this.crud.getDetailedAssignments(id).subscribe({
        next: (assigns) => {
          if (!assigns || !assigns.length) {
            this.returnedByMap[id] = '';
            this.cd.detectChanges();
            return;
          }
          const returned = assigns.filter((a: any) => a.IsReturned == 1 || a.IsReturned === true);
          if (!returned.length) {
            this.returnedByMap[id] = '';
            this.cd.detectChanges();
            return;
          }
          // pick the earliest returned entry (first return) — that usually represents the assignee returning the asset
          const returnedAsc = returned.sort((x: any, y: any) => (x.ReturnedDate || '') > (y.ReturnedDate || '') ? 1 : -1);
          const original = returnedAsc[0];
          // Prefer the assignment's EmployeeId (the person who had the asset) as the "Returned By" name
          let name = '';
          const assignee = original.EmployeeId;
          if (assignee) {
            const empAssignee = this.employees.find((e) => e.EmployeeId === assignee);
            if (empAssignee) {
              name = empAssignee.FullName;
            }
          }

          if (!name) {
            // Fallback: try to interpret the ReturnedBy field on the original returned record
            let raw = (original.ReturnedBy || '').toString().trim();
            raw = raw.replace(/^returned by[:\-\s]*/i, '').replace(/^return to[:\-\s]*/i, '').replace(/^returned[:\-\s]*/i, '').trim();
            if (raw) {
              const asNum = parseInt(raw as any, 10);
              if (!isNaN(asNum)) {
                const emp = this.employees.find((e) => e.EmployeeId === asNum);
                name = emp ? emp.FullName : raw;
              } else {
                const byUserId = this.employees.find((e) => (e.UserId || '').toString().toLowerCase() === raw.toLowerCase());
                if (byUserId) {
                  name = byUserId.FullName;
                } else {
                  const byFull = this.employees.find((e) => (e.FullName || '').toString().toLowerCase() === raw.toLowerCase());
                  if (byFull) {
                    name = byFull.FullName;
                  } else {
                    const partial = this.employees.find((e) => (e.FullName || '').toString().toLowerCase().includes(raw.toLowerCase()));
                    name = partial ? partial.FullName : raw;
                  }
                }
              }
            }
          }

          this.returnedByMap[id] = name || '';
          this.cd.detectChanges();
        },
        error: () => {
          this.returnedByMap[id] = '';
          this.cd.detectChanges();
        }
      });
    }
  }

  completeWorkOrder(workOrder: any): void {
    const payload = { Status: 'repaired' };
    this.crud.updateWorkOrder(workOrder.WorkOrderId, payload).subscribe({
      next: () => {
        this.loadWorkOrders();
        this.loadAssets();
      },
      error: () => this.notify.error('Unable to update work order.')
    });
  }

  getReturnedBy(assetId?: number | null): string {
    if (!assetId) return '—';
    const raw = this.returnedByMap[assetId];
    if (!raw) return '—';
    // If raw looks like an id number, map to employee full name
    const asNum = parseInt(raw as any, 10);
    if (!isNaN(asNum)) {
      const emp = this.employees.find((e) => e.EmployeeId === asNum);
      return emp ? emp.FullName : raw;
    }
    // If raw is a username or already a name, try to map by username or return as-is
    const byName = this.employees.find((e) => (e.UserId || '').toString() === raw.toString() || (e.FullName || '').toString() === raw.toString());
    return byName ? byName.FullName : raw || '—';
  }

  getAssetName(assetId?: number | null): string {
    if (!assetId) {
      return '—';
    }
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.Name || '—';
  }

  getVendorName(vendorId?: number | null): string | undefined {
    if (!vendorId) {
      return undefined;
    }
    return this.vendors.find((vendor) => vendor.VendorId === vendorId)?.Name;
  }

  getRepairCostLabel(repairCost: number | string): string {
    const value = typeof repairCost === 'string' ? Number(repairCost) : repairCost;
    if (Number.isNaN(value) || value == null) {
      return '—';
    }
    return 'Rs ' + value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }

  getReportedByName(): string {
    if (this.maintenanceModel.ReportedByEmployeeId) {
      const employee = this.employees.find((e) => e.EmployeeId === this.maintenanceModel.ReportedByEmployeeId);
      return employee?.FullName || this.maintenanceModel.ReportedByName || '';
    }
    return this.maintenanceModel.ReportedByName || '';
  }

  get maintenanceAssets(): DetailedAsset[] {
    const workOrderIds = new Set((this.workOrders || []).map((w) => w.DetailedAssetId).filter(Boolean));
    return this.assets.filter((asset) => this.isUnderMaintenance(asset) || workOrderIds.has(asset.DetailedAssetId));
  }

  isUnderMaintenance(asset: DetailedAsset): boolean {
    const status = (asset.Status || '').toString().toLowerCase();
    // Match substrings to catch variations like "Damaged - Awaiting Repair" or "Under Maintenance"
    return status.includes('damag') || status.includes('maint');
  }

  isSold(asset: DetailedAsset): boolean {
    const status = (asset.Status || '').toString().trim().toLowerCase();
    return status.includes('sold') || asset.SoldPrice != null;
  }

  get soldAssets(): DetailedAsset[] {
    return this.assets.filter((asset) => this.isSold(asset));
  }

  get assignableAssetsForSold(): DetailedAsset[] {
    return this.assets.filter((asset) => !this.isSold(asset));
  }

  openAddSoldAssetModal(template: any): void {
    this.soldModel = { DetailedAssetId: undefined, SoldPrice: null };
    this.soldModalRef = this.modalService.open(template, { centered: true });
  }

  openEditSoldAssetModal(template: any, asset: DetailedAsset): void {
    if (!asset?.DetailedAssetId) {
      return;
    }
    this.soldEditModel = {
      DetailedAssetId: asset.DetailedAssetId,
      AssetTag: asset.AssetTag || '—',
      Name: asset.Name || '—',
      Status: asset.Status || 'Sold',
      SoldPrice: asset.SoldPrice == null ? null : Number(asset.SoldPrice)
    };
    this.soldModalRef = this.modalService.open(template, { centered: true });
  }

  saveSoldAsset(): void {
    if (!this.soldModel.DetailedAssetId || this.isSavingSold) {
      return;
    }
    this.isSavingSold = true;
    this.crud.updateDetailedAsset(this.soldModel.DetailedAssetId, {
      Status: 'Sold',
      SoldPrice: this.soldModel.SoldPrice == null ? null : Number(this.soldModel.SoldPrice)
    }).subscribe({
      next: () => {
        this.notify.success('Asset marked as sold successfully.');
        this.isSavingSold = false;
        this.soldModel = { DetailedAssetId: undefined, SoldPrice: null };
        this.soldModalRef?.close('saved');
        this.soldModalRef = null;
        this.loadAssets();
      },
      error: () => {
        this.isSavingSold = false;
        this.notify.error('Unable to mark asset as sold.');
      }
    });
  }

  saveEditedSoldPrice(): void {
    if (!this.soldEditModel.DetailedAssetId || this.isSavingSold) {
      return;
    }
    this.isSavingSold = true;
    this.crud.updateDetailedAsset(this.soldEditModel.DetailedAssetId, {
      Status: 'Sold',
      SoldPrice: this.soldEditModel.SoldPrice == null ? null : Number(this.soldEditModel.SoldPrice)
    }).subscribe({
      next: () => {
        this.notify.success('Sold price updated.');
        this.isSavingSold = false;
        this.soldModalRef?.close('saved');
        this.soldModalRef = null;
        this.loadAssets();
      },
      error: () => {
        this.isSavingSold = false;
        this.notify.error('Unable to update sold price.');
      }
    });
  }

  getAssetTag(assetId?: number | null): string {
    if (!assetId) {
      return '—';
    }
    return this.assets.find((asset) => asset.DetailedAssetId === assetId)?.AssetTag || '—';
  }

  getAssetWorkOrderReference(assetId?: number | null): string {
    if (!assetId) {
      return '—';
    }
    const workOrder = this.workOrders.find((wo) => wo.DetailedAssetId === assetId);
    return workOrder ? workOrder.Reference : 'None';
  }

  get maintenanceHistoryRows(): any[] {
    const workRows = this.workOrders || [];
    const existingIds = new Set(workRows.map((row) => row.DetailedAssetId).filter(Boolean));
    const additionalAssets = this.maintenanceAssets
      .filter((asset) => !existingIds.has(asset.DetailedAssetId))
      .map((asset) => ({
        Reference: 'N/A',
        DetailedAssetId: asset.DetailedAssetId,
        Status: asset.Status,
        ReportedByName: this.getAssetReportedBy(asset.DetailedAssetId),
        VendorName: '—'
      }));
    return [...workRows, ...additionalAssets];
  }

  get filteredMaintenanceHistoryRows(): any[] {
    const query = this.historySearch?.toString().toLowerCase().trim();
    return this.maintenanceHistoryRows.filter((row) => {
      if (this.historyStatusFilter) {
        const statusValue = (row.Status || '').toString().toLowerCase();
        if (statusValue !== this.historyStatusFilter.toLowerCase()) {
          return false;
        }
      }
      if (this.historyVendorFilter) {
        if (row.VendorId !== this.historyVendorFilter && row.VendorId !== Number(this.historyVendorFilter)) {
          return false;
        }
      }
      if (!query) return true;
      return [
        row.Reference,
        this.getAssetName(row.DetailedAssetId),
        this.getAssetTag(row.DetailedAssetId),
        row.Status,
        row.ReportedByName,
        row.VendorName,
        this.getReturnedBy(row.DetailedAssetId)
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  get pagedMaintenanceHistoryRows(): any[] {
    const start = (this.historyPage - 1) * this.historyPageSize;
    return this.filteredMaintenanceHistoryRows.slice(start, start + this.historyPageSize);
  }

  get maintenanceHistoryTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMaintenanceHistoryRows.length / this.historyPageSize));
  }

  goToHistoryPage(page: number): void {
    this.historyPage = Math.max(1, Math.min(this.maintenanceHistoryTotalPages, page));
  }

  clearHistorySearch(): void {
    this.historySearch = '';
    this.historyPage = 1;
  }

  get hasHistoryFilters(): boolean {
    return !!this.historySearch?.trim() || !!this.historyStatusFilter || this.historyVendorFilter != null;
  }

  resetHistoryFilters(): void {
    this.historySearch = '';
    this.historyStatusFilter = '';
    this.historyVendorFilter = null;
    this.historyPage = 1;
  }

  statusLabel(status: string): string {
    return status ? status.toString().replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown';
  }
   
}
