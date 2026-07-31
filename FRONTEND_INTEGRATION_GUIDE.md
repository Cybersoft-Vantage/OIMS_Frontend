# Frontend Integration Guide: Soft Delete with Dependency Checking

## Overview
This guide explains how to integrate the new soft delete feature with dependency checking in your Angular frontend.

## Key Changes

### 1. Service Updates (asset.service.ts)

The service now includes special error handling for delete operations:

```typescript
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
```

### 2. HTTP Status Codes

The backend now returns specific HTTP status codes:

| Status | Meaning | Response |
|--------|---------|----------|
| 200 | Success | Deleted item data |
| 404 | Not Found | Category/SubCategory/Status doesn't exist |
| 409 | Conflict | Item in use - cannot delete |

### 3. Error Response Format

When HTTP 409 is returned (item in use):

```json
{
  "detail": "Cannot delete category. It is assigned to 5 asset(s)."
}
```

## Implementation in Components

### Step 1: Inject ToastrService (Optional but Recommended)

```typescript
import { ToastrService } from 'ngx-toastr'; // or your notification service

constructor(
  private readonly crudService: OimsCrudService,
  private readonly toastr: ToastrService
) {}
```

### Step 2: Enhanced Delete Handler

Replace your delete method with this improved version:

```typescript
deleteCategory(id: number) {
  if (!confirm('Are you sure you want to delete this category?')) {
    return;
  }

  this.crudService.deleteCategory(id).subscribe({
    next: () => {
      this.loadCategories();
      this.toastr.success('Category deleted successfully');
    },
    error: (error: any) => {
      console.error('Error deleting category:', error);
      
      // Check if this is a dependency error (409 Conflict)
      if (error.isDependencyError) {
        this.toastr.error(error.message, 'Cannot Delete Category');
        // You can also:
        // 1. Show a modal with dependent items
        // 2. Offer to reassign dependencies
        // 3. Allow admin to force delete
      } else if (error.message) {
        this.toastr.error(error.message || 'Unable to delete category.');
      } else {
        this.toastr.error('An unexpected error occurred.');
      }
    }
  });
}
```

### Step 3: Show Dependent Items (Advanced)

To show users what's preventing deletion:

```typescript
/**
 * Show details about why a category cannot be deleted
 */
showDeleteBlockedDetails(categoryId: number) {
  this.crudService.getAssets().subscribe({
    next: (assets) => {
      const dependentAssets = assets.filter(a => a.CategoryId === categoryId);
      
      // Show modal with dependent items
      const message = `This category is assigned to the following ${dependentAssets.length} asset(s):\n\n` +
        dependentAssets.map(a => `• ${a.AssetCode} - ${a.AssetName}`).join('\n') +
        `\n\nPlease reassign these assets to another category before deleting.`;
      
      this.toastr.info(message, 'Dependent Assets');
    }
  });
}
```

## HTML Template Updates

### Show Error Messages

```html
<!-- Error Alert -->
<div *ngIf="deleteError" class="alert alert-warning alert-dismissible fade show" role="alert">
  <strong>Cannot Delete:</strong> {{ deleteError }}
  <button type="button" class="btn-close" (click)="clearDeleteError()"></button>
</div>

<!-- Delete Button with Better UX -->
<button class="btn btn-sm btn-danger" 
        (click)="deleteCategory(category.CategoryId)"
        [disabled]="isDeleting">
  <span *ngIf="!isDeleting">Delete</span>
  <span *ngIf="isDeleting">
    <span class="spinner-border spinner-border-sm me-2"></span>
    Deleting...
  </span>
</button>
```

## Complete Example Component

See `category.component.updated.ts` for a complete working example with:
- Error handling for dependency errors
- Toast notifications (optional)
- Loading states
- User-friendly error messages

## Testing Checklist

- [ ] Delete an unused category - should succeed (HTTP 200)
- [ ] Delete a category with assets - should fail with HTTP 409
- [ ] Delete a category with assets - should show error message to user
- [ ] Error message should indicate how many assets are preventing deletion
- [ ] Delete a subcategory with assets/components - should fail appropriately
- [ ] Delete an asset status in use - should fail appropriately
- [ ] Admin endpoints show deleted items - `/assets/categories/deleted`

## Backward Compatibility

These changes are backward compatible:
- Existing delete endpoints return the same success responses
- Failed deletes now return HTTP 409 instead of 400/500
- All query endpoints filter out deleted items by default
- Deleted items are accessible via admin endpoints

## Migration Path

1. Deploy backend changes first
2. Update service layer (asset.service.ts)
3. Update component delete handlers
4. Test with sample data
5. Deploy frontend changes

## Useful Additions (Optional)

### Add Admin Panel to View Deleted Items

```typescript
getDeletedCategories(): Observable<Category[]> {
  return this.assetService.getDeletedCategories();
}

restoreCategory(id: number): Observable<Category> {
  // Call new restore endpoint (if implemented)
  return this.http.post(`/assets/categories/${id}/restore`, {});
}
```

### Batch Delete with Dependency Check

```typescript
async deleteMultiple(ids: number[]): Promise<void> {
  const results = { success: 0, failed: 0, blocked: [] };
  
  for (const id of ids) {
    try {
      await this.deleteCategory(id).toPromise();
      results.success++;
    } catch (error: any) {
      if (error.isDependencyError) {
        results.blocked.push(id);
      }
      results.failed++;
    }
  }
  
  this.showDeleteResults(results);
}
```

## FAQ

**Q: What if I need to permanently delete something?**
A: Soft deleted items are marked but not removed. To permanently delete, use direct database access or implement a purge function (requires admin auth).

**Q: Can I restore a soft-deleted item?**
A: Currently no, but you can implement a restore endpoint following the same pattern as delete.

**Q: How do I see what's preventing deletion?**
A: The error message tells you how many items are blocking deletion. You can implement advanced UI to show specific items.

**Q: Will soft delete affect performance?**
A: Minimal impact. Just add `WHERE IsDeleted = 0` to queries. Soft-deleted items are archived, not active.
