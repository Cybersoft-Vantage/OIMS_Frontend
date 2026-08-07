import { Component } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService } from 'src/app/services/oims-crud.service';
import { DETAILED_ASSET_IMPORT_COLUMNS, ImportColumn, resolveImportColumn } from './import-columns';

/** One column of the uploaded file, and the asset field it will import into. */
interface DetectedColumn {
  header: string;
  field: string | null;
}

@Component({
  selector: 'app-inventory-import',
  imports: [SharedModule],
  templateUrl: './import.html',
  styleUrl: './import.scss'
})
export class InventoryImport {
  selectedFile?: File;
  fileValidationError?: string;
  resultMessage?: string;
  errors: Array<{ row?: number; error: string }> = [];
  previewHeaders: string[] = [];
  previewRows: Array<Record<string, string>> = [];
  previewLimit = 5;

  /** Columns of the chosen file, paired with the field each one imports into. */
  detectedColumns: DetectedColumn[] = [];
  /** Template columns marked required that the chosen file does not provide. */
  missingRequiredColumns: ImportColumn[] = [];
  readonly expectedColumns = DETAILED_ASSET_IMPORT_COLUMNS;

  get ignoredColumns(): DetectedColumn[] {
    return this.detectedColumns.filter((column) => !column.field);
  }

  get hasHeaderProblems(): boolean {
    return this.missingRequiredColumns.length > 0 || this.ignoredColumns.length > 0;
  }

  constructor(private readonly crud: OimsCrudService, private readonly notify: NotificationService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length ? input.files[0] : undefined;
    this.resultMessage = undefined;
    this.errors = [];
    this.previewHeaders = [];
    this.previewRows = [];
    this.detectedColumns = [];
    this.missingRequiredColumns = [];
    this.fileValidationError = undefined;

    if (!this.selectedFile) {
      return;
    }

    const filename = this.selectedFile.name.toLowerCase();
    if (!filename.endsWith('.csv') && !filename.endsWith('.xlsx')) {
      this.fileValidationError = 'Only CSV or XLSX files are supported. Please select a valid inventory import file.';
      this.selectedFile = undefined;
      return;
    }

    if (filename.endsWith('.csv')) {
      this.loadCsvPreview(this.selectedFile);
    }
  }

  private loadCsvPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (!text) {
        this.fileValidationError = 'CSV file appears to be empty or unreadable.';
        return;
      }

      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim().length > 0);
      if (!lines.length) {
        this.fileValidationError = 'CSV file appears to be empty.';
        return;
      }

      const headerLine = lines[0];
      const headers = headerLine.split(',').map((header) => header.trim()).filter((header) => header.length > 0);
      if (!headers.length) {
        this.fileValidationError = 'CSV header row is missing or malformed.';
        return;
      }

      this.previewHeaders = headers;
      this.checkHeaders(headers);
      this.previewRows = lines.slice(1, 1 + this.previewLimit).map((line) => {
        const values = line.split(',').map((value) => value.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ?? '';
        });
        return row;
      });
    };
    reader.onerror = () => {
      this.fileValidationError = 'Unable to read the selected CSV file.';
    };
    reader.readAsText(file);
  }

  /**
   * Resolves each header of the chosen file to the field it imports into, using the
   * same matching rules as the backend, so mistyped or renamed columns surface here
   * rather than as a wall of per-row errors after uploading.
   */
  private checkHeaders(headers: string[]): void {
    this.detectedColumns = headers.map((header) => {
      const column = resolveImportColumn(header);
      return { header, field: column ? column.field : null };
    });

    const matched = new Set(
      this.detectedColumns.map((column) => column.field).filter((field): field is string => !!field)
    );
    this.missingRequiredColumns = DETAILED_ASSET_IMPORT_COLUMNS.filter(
      (column) => column.required && !matched.has(column.field)
    );
  }

  upload(): void {
    if (!this.selectedFile) {
      this.notify.warn('Please select a file first.');
      return;
    }
    if (this.missingRequiredColumns.length) {
      const names = this.missingRequiredColumns.map((column) => column.header).join(', ');
      this.notify.error(`The file is missing required column(s): ${names}`);
      return;
    }
    if (this.fileValidationError) {
      this.notify.error(this.fileValidationError);
      return;
    }

    this.crud.uploadDetailedAssets(this.selectedFile).subscribe({
      next: (response) => {
        this.resultMessage = `Imported ${response.created} of ${response.processed} rows.`;
        this.errors = Array.isArray(response.errors) ? response.errors.map((e: any) => ({ row: e.row, error: e.error })) : [];
      },
      error: (err) => {
        this.resultMessage = undefined;
        const message = err?.error?.detail || err?.message || 'Upload failed.';
        this.errors = [{ error: String(message) }];
      }
    });
  }
}
