import { Component } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OimsCrudService } from 'src/app/services/oims-crud.service';

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

  constructor(private readonly crud: OimsCrudService, private readonly notify: NotificationService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length ? input.files[0] : undefined;
    this.resultMessage = undefined;
    this.errors = [];
    this.previewHeaders = [];
    this.previewRows = [];
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

  upload(): void {
    if (!this.selectedFile) {
      this.notify.warn('Please select a file first.');
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
