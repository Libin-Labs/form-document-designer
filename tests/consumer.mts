import {
  createFormDocument,
  exportFillableFields,
  validateFormValues,
  type FieldBounds,
  type FieldValidationError,
  type FillableFieldAdapter,
  type FillableFieldValue,
  type FormDocument,
  type FormField,
  type FormFieldType,
} from '@lp-labs/form-document-designer';
const type: FormFieldType = 'text';
const bounds: FieldBounds = { x: 0, y: 0, width: 100, height: 20 };
const field: FormField = { name: 'name', label: 'Name', type, bounds };
const form: FormDocument = createFormDocument({ pageWidth: 200, pageHeight: 200, fields: [field] });
const errors: readonly FieldValidationError[] = validateFormValues(form, { name: 'A' });
const adapter: FillableFieldAdapter<string[]> = {
  addField(value: FillableFieldValue) {
    void value;
  },
  finish() {
    return [];
  },
};
const result: string[] = exportFillableFields(form, { name: 'A' }, adapter);
void errors;
void result;
// @ts-expect-error field type must be supported
const invalid: FormFieldType = 'date';
void invalid;
