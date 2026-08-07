/**
 * The detailed-asset import contract, in one place.
 *
 * `downloadImportTemplate()` writes these headers, and the import screen checks an
 * uploaded file against them, so the template and the validation can never drift
 * apart. The aliases and the normalisation below mirror `import_detailed_assets`
 * in the backend (app/crud.py) - keep the two in step.
 */
export interface ImportColumn {
  /** Header written into the downloadable template. */
  header: string;
  /** Where the value lands on the asset, in words the UI uses. */
  field: string;
  /** The import fails for a row without this column. */
  required?: boolean;
  /** Other spellings the backend also accepts. */
  aliases?: string[];
  /** Short note about the expected value. */
  hint?: string;
}

export const DETAILED_ASSET_IMPORT_COLUMNS: ImportColumn[] = [
  {
    header: 'ParentCategory',
    field: 'Category',
    aliases: ['DetailedCategoryId', 'DetailedCategory', 'Category'],
    hint: 'Name of a top-level category, or its id'
  },
  { header: 'SubCategory', field: 'Sub Category', hint: 'Name of a subcategory under the parent' },
  { header: 'AssetTag', field: 'Asset Tag', hint: 'Left blank, the asset imports without a tag' },
  { header: 'BrandName', field: 'Brand Name', required: true, aliases: ['Name'] },
  { header: 'Model', field: 'Make / Model', aliases: ['MakeModel'] },
  { header: 'SerialNo', field: 'Serial No', aliases: ['SerialNumber'] },
  { header: 'Specifications', field: 'Specifications', aliases: ['Specification'] },
  { header: 'Status', field: 'Status' },
  { header: 'PurchaseCost', field: 'Purchase Cost', hint: 'Number, e.g. 1200.50' },
  { header: 'PurchaseDate', field: 'Purchase Date', hint: 'YYYY-MM-DD' },
  { header: 'WarrantyEnd', field: 'Warranty End', hint: 'YYYY-MM-DD' },
  { header: 'CustomValues', field: 'Custom Values', hint: 'JSON, e.g. {"cpu":"i7"}' }
];

/** Headers match on letters and digits only, so 'Make / Model' == 'makemodel'. */
export function normalizeImportHeader(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** The column a spreadsheet header will import into, or null when it is ignored. */
export function resolveImportColumn(header: string): ImportColumn | null {
  const normalized = normalizeImportHeader(header);
  if (!normalized) return null;
  return (
    DETAILED_ASSET_IMPORT_COLUMNS.find(
      (column) =>
        normalizeImportHeader(column.header) === normalized ||
        (column.aliases ?? []).some((alias) => normalizeImportHeader(alias) === normalized)
    ) ?? null
  );
}
