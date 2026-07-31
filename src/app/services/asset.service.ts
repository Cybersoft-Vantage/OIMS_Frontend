import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Category {
  CategoryId: number;
  CategoryName: string;
  Description?: string;
  IsActive: number;
}

export interface SubCategory {
  SubCategoryId: number;
  CategoryId: number;
  SubCategoryName: string;
  Description?: string;
}

export interface AssetStatus {
  StatusId: number;
  StatusName: string;
}

export interface DeleteError {
  detail: string;
}

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private apiUrl = '/assets'; // Adjust based on your API base URL

  constructor(private http: HttpClient) {}

  // Categories
  getCategories(skip = 0, limit = 100): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    }).pipe(catchError(this.handleError));
  }

  getDeletedCategories(skip = 0, limit = 100): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories/deleted`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    }).pipe(catchError(this.handleError));
  }

  createCategory(category: Omit<Category, 'CategoryId'>): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, category)
      .pipe(catchError(this.handleError));
  }

  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${id}`, category)
      .pipe(catchError(this.handleError));
  }

  deleteCategory(id: number): Observable<Category> {
    return this.http.delete<Category>(`${this.apiUrl}/categories/${id}`)
      .pipe(catchError(this.handleDependencyError));
  }

  // SubCategories
  getSubCategories(skip = 0, limit = 100): Observable<SubCategory[]> {
    return this.http.get<SubCategory[]>(`${this.apiUrl}/subcategories`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    }).pipe(catchError(this.handleError));
  }

  getDeletedSubCategories(skip = 0, limit = 100): Observable<SubCategory[]> {
    return this.http.get<SubCategory[]>(`${this.apiUrl}/subcategories/deleted`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    }).pipe(catchError(this.handleError));
  }

  createSubCategory(subCategory: Omit<SubCategory, 'SubCategoryId'>): Observable<SubCategory> {
    return this.http.post<SubCategory>(`${this.apiUrl}/subcategories`, subCategory)
      .pipe(catchError(this.handleError));
  }

  updateSubCategory(id: number, subCategory: Partial<SubCategory>): Observable<SubCategory> {
    return this.http.put<SubCategory>(`${this.apiUrl}/subcategories/${id}`, subCategory)
      .pipe(catchError(this.handleError));
  }

  deleteSubCategory(id: number): Observable<SubCategory> {
    return this.http.delete<SubCategory>(`${this.apiUrl}/subcategories/${id}`)
      .pipe(catchError(this.handleDependencyError));
  }

  // Asset Statuses
  getAssetStatuses(skip = 0, limit = 100): Observable<AssetStatus[]> {
    return this.http.get<AssetStatus[]>(`${this.apiUrl}/statuses`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    }).pipe(catchError(this.handleError));
  }

  getDeletedAssetStatuses(skip = 0, limit = 100): Observable<AssetStatus[]> {
    return this.http.get<AssetStatus[]>(`${this.apiUrl}/statuses/deleted`, {
      params: { skip: skip.toString(), limit: limit.toString() }
    }).pipe(catchError(this.handleError));
  }

  createAssetStatus(status: Omit<AssetStatus, 'StatusId'>): Observable<AssetStatus> {
    return this.http.post<AssetStatus>(`${this.apiUrl}/statuses`, status)
      .pipe(catchError(this.handleError));
  }

  updateAssetStatus(id: number, status: Partial<AssetStatus>): Observable<AssetStatus> {
    return this.http.put<AssetStatus>(`${this.apiUrl}/statuses/${id}`, status)
      .pipe(catchError(this.handleError));
  }

  deleteAssetStatus(id: number): Observable<AssetStatus> {
    return this.http.delete<AssetStatus>(`${this.apiUrl}/statuses/${id}`)
      .pipe(catchError(this.handleDependencyError));
  }

  // Error handlers
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.detail || error.message;
    }
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Special handler for delete operations that checks for dependency errors (409 Conflict)
   */
  private handleDependencyError(error: HttpErrorResponse) {
    if (error.status === 409) {
      // Dependency error - item is in use
      const deleteError: DeleteError = error.error;
      return throwError(() => ({
        isDependencyError: true,
        message: deleteError.detail,
        status: 409
      }));
    }
    // For other errors, use standard error handler
    return this.handleError(error);
  }
}
