export type FormFieldType = 'text' | 'number' | 'email' | 'checkbox' | 'select';

export interface FieldBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FormField {
  readonly name: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly bounds: FieldBounds;
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly options?: readonly string[];
}

export interface FormDocument {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly fields: readonly FormField[];
}

export interface FieldValidationError {
  readonly field: string;
  readonly code: 'required' | 'type' | 'length' | 'range' | 'option';
  readonly message: string;
}

export interface FillableFieldValue {
  readonly name: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly bounds: FieldBounds;
  readonly value: string | number | boolean | null;
  readonly required: boolean;
}

/** Adapter integrations own the actual output format and must implement both operations. */
export interface FillableFieldAdapter<Result> {
  addField(field: FillableFieldValue): void;
  finish(): Result;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`${name} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new TypeError(`${name} cannot contain symbol keys.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor))
      throw new TypeError(`${name} cannot contain accessors.`);
  }
  return value as Record<string, unknown>;
}

function boundedNumber(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`);
  return value;
}

function plainText(value: unknown, name: string, maximum = 500): string {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u001f]/u.test(value))
    throw new TypeError(`${name} must be plain text of at most ${maximum} characters.`);
  return value;
}

/** Validates and snapshots page geometry and field validation metadata. */
export function createFormDocument(input: FormDocument, maxFields = 500): FormDocument {
  const form = record(input, 'form');
  if (!Number.isSafeInteger(maxFields) || maxFields < 1 || maxFields > 10_000)
    throw new RangeError('maxFields must be an integer from 1 to 10000.');
  const pageWidth = boundedNumber(form.pageWidth, 'pageWidth', 1, 100_000);
  const pageHeight = boundedNumber(form.pageHeight, 'pageHeight', 1, 100_000);
  if (!Array.isArray(form.fields) || form.fields.length > maxFields)
    throw new RangeError(`fields must be an array with at most ${maxFields} items.`);
  const names = new Set<string>();
  const fields = form.fields.map((item) => {
    const field = record(item, 'field');
    const name = plainText(field.name, 'field name', 128);
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/u.test(name) || names.has(name))
      throw new TypeError('Field names must be unique safe identifiers.');
    names.add(name);
    const label = plainText(field.label, 'label');
    if (!label) throw new TypeError('Labels must not be empty.');
    if (
      typeof field.type !== 'string' ||
      !['text', 'number', 'email', 'checkbox', 'select'].includes(field.type)
    )
      throw new TypeError('Unknown field type.');
    const bounds = record(field.bounds, 'bounds');
    const x = boundedNumber(bounds.x, 'x', 0, pageWidth);
    const y = boundedNumber(bounds.y, 'y', 0, pageHeight);
    const width = boundedNumber(bounds.width, 'width', 0.01, pageWidth);
    const height = boundedNumber(bounds.height, 'height', 0.01, pageHeight);
    if (x + width > pageWidth || y + height > pageHeight)
      throw new RangeError(`Field "${name}" extends beyond the page.`);
    const required = field.required ?? false;
    if (typeof required !== 'boolean') throw new TypeError('required must be boolean.');
    const minLength =
      field.minLength === undefined
        ? undefined
        : boundedNumber(field.minLength, 'minLength', 0, 100_000);
    const maxLength =
      field.maxLength === undefined
        ? undefined
        : boundedNumber(field.maxLength, 'maxLength', 0, 100_000);
    if (
      (minLength !== undefined && !Number.isSafeInteger(minLength)) ||
      (maxLength !== undefined && !Number.isSafeInteger(maxLength))
    )
      throw new RangeError('Length limits must be safe integers.');
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength)
      throw new RangeError('minLength cannot exceed maxLength.');
    const minimum =
      field.minimum === undefined
        ? undefined
        : boundedNumber(
            field.minimum,
            'minimum',
            -Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER,
          );
    const maximum =
      field.maximum === undefined
        ? undefined
        : boundedNumber(
            field.maximum,
            'maximum',
            -Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER,
          );
    if (minimum !== undefined && maximum !== undefined && minimum > maximum)
      throw new RangeError('minimum cannot exceed maximum.');
    let options: readonly string[] | undefined;
    if (field.type === 'select') {
      if (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100)
        throw new RangeError('Select fields require 1 to 100 options.');
      const clean = field.options.map((option) => plainText(option, 'option'));
      if (new Set(clean).size !== clean.length)
        throw new TypeError('Select options must be unique.');
      options = Object.freeze(clean);
    } else if (field.options !== undefined)
      throw new TypeError('options are only valid for select fields.');
    const type = field.type as FormFieldType;
    return Object.freeze({
      name,
      label,
      type,
      bounds: Object.freeze({ x, y, width, height }),
      required,
      ...(minLength === undefined ? {} : { minLength }),
      ...(maxLength === undefined ? {} : { maxLength }),
      ...(minimum === undefined ? {} : { minimum }),
      ...(maximum === undefined ? {} : { maximum }),
      ...(options === undefined ? {} : { options }),
    });
  });
  return Object.freeze({ pageWidth, pageHeight, fields: Object.freeze(fields) });
}

/** Validates supplied values against each field's declarative metadata. */
export function validateFormValues(
  input: FormDocument,
  values: Readonly<Record<string, unknown>>,
): readonly FieldValidationError[] {
  const form = createFormDocument(input);
  const data = record(values, 'values');
  const known = new Set(form.fields.map((field) => field.name));
  if (Object.keys(data).some((key) => !known.has(key)))
    throw new TypeError('Values contain an unknown field.');
  const errors: FieldValidationError[] = [];
  for (const field of form.fields) {
    const value = data[field.name];
    const empty = value === undefined || value === null || value === '';
    const issue = (code: FieldValidationError['code'], message: string) =>
      errors.push(Object.freeze({ field: field.name, code, message }));
    if (empty) {
      if (field.required) issue('required', 'A value is required.');
      continue;
    }
    if (field.type === 'checkbox') {
      if (typeof value !== 'boolean') issue('type', 'Expected a boolean value.');
      continue;
    }
    if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value))
        issue('type', 'Expected a finite number.');
      else if (
        (field.minimum !== undefined && value < field.minimum) ||
        (field.maximum !== undefined && value > field.maximum)
      )
        issue('range', 'Number is outside the configured range.');
      continue;
    }
    if (typeof value !== 'string') {
      issue('type', 'Expected a string value.');
      continue;
    }
    if (
      (field.minLength !== undefined && value.length < field.minLength) ||
      (field.maxLength !== undefined && value.length > field.maxLength)
    )
      issue('length', 'Text length is outside the configured range.');
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value))
      issue('type', 'Expected a basic email-shaped value.');
    if (field.type === 'select' && !field.options!.includes(value))
      issue('option', 'Value is not one of the configured options.');
  }
  return Object.freeze(errors);
}

/** Supplies actual field values and geometry to an injected fillable-field adapter. */
export function exportFillableFields<Result>(
  input: FormDocument,
  values: Readonly<Record<string, unknown>>,
  adapter: FillableFieldAdapter<Result>,
): Result {
  if (!adapter || typeof adapter.addField !== 'function' || typeof adapter.finish !== 'function')
    throw new TypeError('A fillable-field adapter with addField and finish methods is required.');
  const form = createFormDocument(input);
  const errors = validateFormValues(form, values);
  if (errors.length)
    throw new TypeError(
      `Cannot export invalid values: ${errors.map((error) => error.field).join(', ')}.`,
    );
  const data = record(values, 'values');
  for (const field of form.fields) {
    adapter.addField(
      Object.freeze({
        name: field.name,
        label: field.label,
        type: field.type,
        bounds: field.bounds,
        value: (data[field.name] ?? null) as string | number | boolean | null,
        required: field.required ?? false,
      }),
    );
  }
  return adapter.finish();
}
