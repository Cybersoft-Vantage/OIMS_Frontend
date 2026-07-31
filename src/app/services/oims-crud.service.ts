import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Category {
  CategoryId?: number;
  CategoryName: string;
  Description?: string | null;
  IsActive?: number | string;
}

export interface SubCategory {
  SubCategoryId?: number;
  CategoryId: number;
  SubCategoryName: string;
  Description?: string | null;
}

export interface AssetStatus {
  StatusId?: number;
  StatusName: string;
}

export interface Asset {
  AssetId?: number;
  AssetCode?: string | null;
  CategoryId?: number | null;
  SubCategoryId?: number | null;
  AssetName?: string | null;
  Brand?: string | null;
  Model?: string | null;
  SerialNumber?: string | null;
  MacAddress?: string | null;
  PurchaseDate?: string | null;
  PurchasePrice?: number | null;
  StatusId?: number | null;
  CurrentEmployeeId?: number | null;
  Remarks?: string | null;
  IsAvailable?: number | null;
}

export interface AssetComponent {
  ComponentId?: number;
  AssetId: number;
  SubCategoryId?: number | null;
  ComponentCode?: string | null;
  ComponentName?: string | null;
  Brand?: string | null;
  Model?: string | null;
  SerialNumber?: string | null;
  Quantity?: number | null;
  Remarks?: string | null;
}

export interface EmployeeDetail {
  EmployeeId?: number;
  UserId: string;
  FullName: string;
  Department?: string | null;
  Designation?: string | null;
  Email?: string | null;
  Phone?: string | null;
  ProfileImage?: string | null;
  IsActive?: number | null;
  Role?: string | null;
  AssetCount?: number;
  CreatedAt?: string;
}

export interface AssetAssignment {
  AssignmentId?: number;
  AssetId: number;
  EmployeeId: number;
  AssignedDate?: string | null;
  ReturnedDate?: string | null;
  AssignedBy?: string | null;
  ReturnedBy?: string | null;
  Remarks?: string | null;
  IsReturned?: number | boolean | null;
}

export interface AssetHistory {
  HistoryId?: number;
  AssetId: number;
  EmployeeId?: number | null;
  Action: string;
  Notes?: string | null;
  ActionDate?: string | null;
  AssetCode?: string | null;
  AssetName?: string | null;
  EmployeeName?: string | null;
}

export interface DetailedAssetImportResult {
  processed: number;
  created: number;
  errors: Array<{ row?: number; error: string }>;
}

export interface DependencyError {
  isDependencyError: true;
  message: string;
  status: 409;
}

export interface DetailedCategory {
  DetailedCategoryId?: number;
  Name: string;
  ParentId?: number | null;
  Description?: string | null;
  CustomSchema?: string | null;
  children?: DetailedCategory[];
}

export interface DetailedAsset {
  DetailedAssetId?: number;
  AssetTag?: string | null;
  Name: string;
  DetailedCategoryId?: number | null;
  SubCategory?: string | null;
  MakeModel?: string | null;
  SerialNo?: string | null;
  Specifications?: string | null;
  Status?: string | null;
  PurchaseCost?: number | null;
  PurchaseDate?: string | null;
  WarrantyEnd?: string | null;
  CustomValues?: string | null;
  IsDeleted?: number | boolean | null;
  DeletedAt?: string | null;
}

export interface DetailedAssetHistory {
  HistoryId?: number;
  DetailedAssetId: number;
  EmployeeId?: number | null;
  Action: string;
  Notes?: string | null;
  ActionDate?: string | null;
  AssetTag?: string | null;
  AssetName?: string | null;
  EmployeeName?: string | null;
}

export interface ProcurementRequest {
  ProcurementId?: number;
  Reference?: string | null;
  CategoryId?: number | null;
  SubCategoryId?: number | null;
  Item: string;
  Quantity: number;
  Status?: string | null;
  CreatedAt?: string | null;
}

export interface SoftwareLicense {
  LicenseId?: number;
  SoftwareName: string;
  Vendor?: string | null;
  LicenseKey?: string | null;
  Seats?: number | null;
  PurchaseDate?: string | null;
  RenewalDate?: string | null;
  Status?: string | null;
  Notes?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OimsCrudService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Handle HTTP 409 Conflict errors (when item is in use)
   */
  private handleDependencyError(error: HttpErrorResponse) {
    if (error.status === 409) {
      // Item in use - return structured error
      return throwError(() => ({
        isDependencyError: true,
        message: error.error?.detail || 'This item cannot be deleted because it is in use.',
        status: 409
      } as DependencyError));
    }
    // Other errors - return as is
    return throwError(() => error);
  }

  getCategories() {
    return this.http.get<Category[]>(`${this.apiUrl}/assets/categories`);
  }

  createCategory(payload: Category) {
    return this.http.post<Category>(`${this.apiUrl}/assets/categories`, payload);
  }

  updateCategory(id: number, payload: Partial<Category>) {
    return this.http.put<Category>(`${this.apiUrl}/assets/categories/${id}`, payload);
  }

  deleteCategory(id: number) {
    return this.http.delete<Category>(`${this.apiUrl}/assets/categories/${id}`)
      .pipe(catchError(error => this.handleDependencyError(error)));
  }

  getSubcategories() {
    return this.http.get<SubCategory[]>(`${this.apiUrl}/assets/subcategories`);
  }

  createSubcategory(payload: SubCategory) {
    return this.http.post<SubCategory>(`${this.apiUrl}/assets/subcategories`, payload);
  }

  updateSubcategory(id: number, payload: Partial<SubCategory>) {
    return this.http.put<SubCategory>(`${this.apiUrl}/assets/subcategories/${id}`, payload);
  }

  deleteSubcategory(id: number) {
    return this.http.delete<SubCategory>(`${this.apiUrl}/assets/subcategories/${id}`)
      .pipe(catchError(error => this.handleDependencyError(error)));
  }

  getAssetStatuses() {
    return this.http.get<AssetStatus[]>(`${this.apiUrl}/assets/statuses`);
  }

  createAssetStatus(payload: AssetStatus) {
    return this.http.post<AssetStatus>(`${this.apiUrl}/assets/statuses`, payload);
  }

  updateAssetStatus(id: number, payload: Partial<AssetStatus>) {
    return this.http.put<AssetStatus>(`${this.apiUrl}/assets/statuses/${id}`, payload);
  }

  deleteAssetStatus(id: number) {
    return this.http.delete<AssetStatus>(`${this.apiUrl}/assets/statuses/${id}`)
      .pipe(catchError(error => this.handleDependencyError(error)));
  }

  getAssets() {
    return this.http.get<Asset[]>(`${this.apiUrl}/assets/`);
  }

  createAsset(payload: Asset) {
    return this.http.post<Asset>(`${this.apiUrl}/assets/`, payload);
  }

  updateAsset(id: number, payload: Partial<Asset>) {
    return this.http.put<Asset>(`${this.apiUrl}/assets/${id}`, payload);
  }

  deleteAsset(id: number) {
    return this.http.delete<Asset>(`${this.apiUrl}/assets/${id}`);
  }

  getAssetComponents() {
    return this.http.get<AssetComponent[]>(`${this.apiUrl}/assets/components`);
  }

  assignAsset(payload: AssetAssignment) {
    return this.http.post<AssetAssignment>(`${this.apiUrl}/assets/assignments`, payload);
  }

  getAssetAssignments() {
    return this.http.get<AssetAssignment[]>(`${this.apiUrl}/assets/assignments`);
  }

  returnAsset(assignmentId: number, payload: Partial<AssetAssignment>) {
    return this.http.put<AssetAssignment>(`${this.apiUrl}/assets/assignments/${assignmentId}/return`, payload);
  }

  createAssetComponent(payload: AssetComponent) {
    return this.http.post<AssetComponent>(`${this.apiUrl}/assets/components`, payload);
  }

  updateAssetComponent(id: number, payload: Partial<AssetComponent>) {
    return this.http.put<AssetComponent>(`${this.apiUrl}/assets/components/${id}`, payload);
  }

  deleteAssetComponent(id: number) {
    return this.http.delete<AssetComponent>(`${this.apiUrl}/assets/components/${id}`);
  }

  getAssetHistory() {
    return this.http.get<AssetHistory[]>(`${this.apiUrl}/assets/history`);
  }

  uploadDetailedAssets(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<DetailedAssetImportResult>(`${this.apiUrl}/detailed/assets/import`, formData);
  }

  getEmployees() {
    return this.http.get<EmployeeDetail[]>(`${this.apiUrl}/employees/`);
  }

  getEmployeeByUserId(userId: string) {
    return this.http.get<EmployeeDetail>(`${this.apiUrl}/employees/user/${encodeURIComponent(userId)}`);
  }

  createEmployee(payload: EmployeeDetail) {
    return this.http.post<EmployeeDetail>(`${this.apiUrl}/employees/`, payload);
  }

  updateEmployee(id: number, payload: Partial<EmployeeDetail>) {
    return this.http.put<EmployeeDetail>(`${this.apiUrl}/employees/${id}`, payload);
  }

  deleteEmployee(id: number) {
    return this.http.delete<EmployeeDetail>(`${this.apiUrl}/employees/${id}`);
  }

  // Detailed categories / assets
  getDetailedCategories() {
    return this.http.get<DetailedCategory[]>(`${this.apiUrl}/detailed/categories`);
  }

  createDetailedCategory(payload: DetailedCategory) {
    return this.http.post<DetailedCategory>(`${this.apiUrl}/detailed/categories`, payload);
  }

  getDetailedCategory(id: number) {
    return this.http.get<DetailedCategory>(`${this.apiUrl}/detailed/categories/${id}`);
  }

  updateDetailedCategory(id: number, payload: Partial<DetailedCategory>) {
    return this.http.put<DetailedCategory>(`${this.apiUrl}/detailed/categories/${id}`, payload);
  }

  deleteDetailedCategory(id: number) {
    return this.http.delete<DetailedCategory>(`${this.apiUrl}/detailed/categories/${id}`)
      .pipe(catchError(error => this.handleDependencyError(error)));
  }

  getDeletedDetailedCategories() {
    return this.http.get<DetailedCategory[]>(`${this.apiUrl}/detailed/categories/deleted`);
  }

  restoreDetailedCategory(id: number) {
    return this.http.post<DetailedCategory>(`${this.apiUrl}/detailed/categories/${id}/restore`, {});
  }

  getDeletedDetailedAssets() {
    return this.http.get<DetailedAsset[]>(`${this.apiUrl}/detailed/assets/deleted`);
  }

  restoreDetailedAsset(id: number) {
    return this.http.post<DetailedAsset>(`${this.apiUrl}/detailed/assets/${id}/restore`, {});
  }

  getDetailedAssets() {
    return this.http.get<DetailedAsset[]>(`${this.apiUrl}/detailed/assets`);
  }

  getDetailedAsset(id: number) {
    return this.http.get<DetailedAsset>(`${this.apiUrl}/detailed/assets/${id}`);
  }

  createDetailedAsset(payload: DetailedAsset) {
    return this.http.post<DetailedAsset>(`${this.apiUrl}/detailed/assets`, payload);
  }

  updateDetailedAsset(id: number, payload: Partial<DetailedAsset>) {
    return this.http.put<DetailedAsset>(`${this.apiUrl}/detailed/assets/${id}`, payload);
  }

  deleteDetailedAsset(id: number) {
    return this.http.delete<DetailedAsset>(`${this.apiUrl}/detailed/assets/${id}`)
      .pipe(catchError(error => this.handleDependencyError(error)));
  }

  // Detailed assignments / history
  assignDetailedAsset(payload: { DetailedAssetId: number; EmployeeId: number; AssignedDate?: string | null; AssignedBy?: string | null; Remarks?: string | null; }) {
    return this.http.post<any>(`${this.apiUrl}/detailed/assignments`, payload);
  }

  assignDetailedAssetsBulk(payload: { DetailedAssetIds: number[]; EmployeeId: number; AssignedDate?: string | null; AssignedBy?: string | null; Remarks?: string | null; }) {
    return this.http.post<{ assignments: any[]; failed_asset_ids: number[] }>(`${this.apiUrl}/detailed/assignments/bulk`, payload);
  }

  getDetailedAssignments(detailedAssetId?: number) {
    const params: any = {};
    if (detailedAssetId != null) {
      params.detailed_asset_id = detailedAssetId;
    }
    return this.http.get<any[]>(`${this.apiUrl}/detailed/assignments`, { params });
  }

  returnDetailedAsset(assignmentId: number, payload: Partial<{ ReturnedDate?: string | null; Remarks?: string | null; ReturnedBy?: string | null; Status?: string | null }>) {
    return this.http.put<any>(`${this.apiUrl}/detailed/assignments/${assignmentId}/return`, payload);
  }

  getDetailedHistory(detailedAssetId?: number) {
    const params: any = {};
    if (detailedAssetId != null) {
      params.detailed_asset_id = detailedAssetId;
    }
    return this.http.get<DetailedAssetHistory[]>(`${this.apiUrl}/detailed/history`, { params });
  }

  createDetailedHistory(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/detailed/history`, payload);
  }

  // Procurement endpoints
  getProcurements() {
    return this.http.get<ProcurementRequest[]>(`${this.apiUrl}/procurements/`);
  }

  createProcurement(payload: Partial<ProcurementRequest>) {
    return this.http.post<ProcurementRequest>(`${this.apiUrl}/procurements/`, payload);
  }

  updateProcurement(id: number, payload: Partial<ProcurementRequest>) {
    return this.http.put<ProcurementRequest>(`${this.apiUrl}/procurements/${id}`, payload);
  }

  deleteProcurement(id: number) {
    return this.http.delete<ProcurementRequest>(`${this.apiUrl}/procurements/${id}`);
  }

  // Licensing
  getLicenses() {
    return this.http.get<SoftwareLicense[]>(`${this.apiUrl}/licenses/`);
  }

  createLicense(payload: Partial<SoftwareLicense>) {
    return this.http.post<SoftwareLicense>(`${this.apiUrl}/licenses/`, payload);
  }

  updateLicense(id: number, payload: Partial<SoftwareLicense>) {
    return this.http.put<SoftwareLicense>(`${this.apiUrl}/licenses/${id}`, payload);
  }

  deleteLicense(id: number) {
    return this.http.delete<SoftwareLicense>(`${this.apiUrl}/licenses/${id}`);
  }

  // Maintenance: vendors & workorders
  getVendors() {
    return this.http.get<any[]>(`${this.apiUrl}/maintenance/vendors`);
  }

  createVendor(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/maintenance/vendors`, payload);
  }

  updateVendor(id: number, payload: any) {
    return this.http.put<any>(`${this.apiUrl}/maintenance/vendors/${id}`, payload);
  }

  getWorkOrders() {
    return this.http.get<any[]>(`${this.apiUrl}/maintenance/workorders`);
  }

  createWorkOrder(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/maintenance/workorders`, payload);
  }

  updateWorkOrder(id: number, payload: any) {
    return this.http.put<any>(`${this.apiUrl}/maintenance/workorders/${id}`, payload);
  }

  getWorkOrdersForAsset(detailedAssetId: number) {
    return this.http.get<any[]>(`${this.apiUrl}/maintenance/assets/${detailedAssetId}/workorders`);
  }
}
