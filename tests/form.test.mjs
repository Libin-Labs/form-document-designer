import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormDocument, exportFillableFields, validateFormValues } from '../dist/esm/index.js';

const form = {
  pageWidth: 600,
  pageHeight: 800,
  fields: [
    {
      name: 'email',
      label: 'Email address',
      type: 'email',
      required: true,
      bounds: { x: 20, y: 30, width: 300, height: 32 },
      maxLength: 100,
    },
    {
      name: 'quantity',
      label: 'Quantity',
      type: 'number',
      bounds: { x: 20, y: 80, width: 100, height: 32 },
      minimum: 1,
      maximum: 10,
    },
    {
      name: 'color',
      label: 'Color',
      type: 'select',
      bounds: { x: 20, y: 130, width: 200, height: 32 },
      options: ['blue', 'green'],
    },
  ],
};

test('snapshots geometry and validates actual submitted values', () => {
  const snapshot = createFormDocument(form);
  assert.ok(Object.isFrozen(snapshot.fields[0].bounds));
  assert.deepEqual(
    validateFormValues(snapshot, { email: 'person@example.test', quantity: 3, color: 'blue' }),
    [],
  );
  assert.deepEqual(
    validateFormValues(snapshot, { email: '', quantity: 0, color: 'red' }).map(
      (issue) => issue.code,
    ),
    ['required', 'range', 'option'],
  );
});

test('requires a real injected adapter and supplies entered values', () => {
  const calls = [];
  const result = exportFillableFields(
    form,
    { email: 'person@example.test', quantity: 2, color: 'green' },
    {
      addField: (field) => calls.push(field),
      finish: () => ({ format: 'adapter-output', count: calls.length }),
    },
  );
  assert.deepEqual(result, { format: 'adapter-output', count: 3 });
  assert.equal(calls[0].value, 'person@example.test');
  assert.deepEqual(calls[0].bounds, form.fields[0].bounds);
  assert.throws(
    () => exportFillableFields(form, { email: '' }, { addField() {}, finish() {} }),
    TypeError,
  );
  assert.throws(() => exportFillableFields(form, {}, null), TypeError);
});

test('validates required, types, lengths, email shape, and checkbox false', () => {
  const typed = createFormDocument({
    pageWidth: 100,
    pageHeight: 100,
    fields: [
      {
        name: 'flag',
        label: 'Flag',
        type: 'checkbox',
        required: true,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
      },
      {
        name: 'short',
        label: 'Short',
        type: 'text',
        minLength: 3,
        bounds: { x: 10, y: 0, width: 20, height: 10 },
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        bounds: { x: 0, y: 20, width: 30, height: 10 },
      },
    ],
  });
  assert.deepEqual(
    validateFormValues(typed, { flag: false, short: 'a', email: 'bad' }).map((error) => error.code),
    ['length', 'type'],
  );
});

test('rejects out-of-page fields, invalid names, duplicate names and excessive count', () => {
  assert.throws(
    () =>
      createFormDocument({
        pageWidth: 10,
        pageHeight: 10,
        fields: [
          { name: 'x', label: 'X', type: 'text', bounds: { x: 9, y: 0, width: 2, height: 1 } },
        ],
      }),
    RangeError,
  );
  assert.throws(
    () =>
      createFormDocument({
        pageWidth: 10,
        pageHeight: 10,
        fields: [
          {
            name: 'bad name',
            label: 'X',
            type: 'text',
            bounds: { x: 0, y: 0, width: 1, height: 1 },
          },
        ],
      }),
    TypeError,
  );
  assert.throws(
    () =>
      createFormDocument({
        pageWidth: 600,
        pageHeight: 800,
        fields: [form.fields[0], form.fields[0]],
      }),
    TypeError,
  );
  assert.throws(() => createFormDocument(form, 1), RangeError);
});

test('rejects malformed schemas and validation limits', () => {
  assert.throws(
    () =>
      createFormDocument({
        pageWidth: 100,
        pageHeight: 100,
        fields: [
          {
            name: 'x',
            label: 'X',
            type: 'select',
            bounds: { x: 0, y: 0, width: 1, height: 1 },
            options: [],
          },
        ],
      }),
    RangeError,
  );
  assert.throws(
    () =>
      createFormDocument({
        pageWidth: 100,
        pageHeight: 100,
        fields: [
          {
            name: 'x',
            label: 'X',
            type: 'text',
            bounds: { x: 0, y: 0, width: 1, height: 1 },
            minLength: 4,
            maxLength: 2,
          },
        ],
      }),
    RangeError,
  );
  assert.throws(() => validateFormValues(form, { email: 'x', extra: true }), TypeError);
});
