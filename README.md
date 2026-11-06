# @lp-labs/form-document-designer

Bounded printable/digital form geometry, validation metadata, value validation, and an explicit
injected fillable-field adapter. No PDF writer or fake fillable export is included.

## Install and quickstart

```sh
npm install @lp-labs/form-document-designer
```

```js
import {
  createFormDocument,
  validateFormValues,
  exportFillableFields,
} from '@lp-labs/form-document-designer';

const form = createFormDocument({
  pageWidth: 612,
  pageHeight: 792,
  fields: [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      bounds: { x: 32, y: 48, width: 240, height: 30 },
      maxLength: 200,
    },
  ],
});
const values = { email: 'person@example.test' };
console.log(validateFormValues(form, values));
const adapter = {
  addField(field) {
    console.log('Adapter receives', field.name, field.value, field.bounds);
  },
  finish() {
    return { format: 'your-adapter-output' };
  },
};
console.log(exportFillableFields(form, values, adapter));
```

## API and types

- `createFormDocument(input, maxFields?): FormDocument` validates geometry/metadata and returns a
  frozen snapshot.
- `validateFormValues(form, values): readonly FieldValidationError[]` validates actual supplied
  values. Unknown value names throw rather than disappearing silently.
- `exportFillableFields(form, values, adapter): Result` requires an injected adapter implementing
  `addField(field)` and `finish()`. It validates values and passes actual values plus field labels,
  types, and page bounds to that adapter. The adapter owns serialization and output-format support.
- `FormField`: unique safe name, visible label, type (`text`, `number`, `email`, `checkbox`,
  `select`), page `bounds`, optional required/length/numeric constraints and select `options`.
- `FieldValidationError`: field, code (`required`, `type`, `length`, `range`, `option`), and message.
- `FillableFieldAdapter<Result>` is the explicit integration seam; the generic result is whatever
  the caller's adapter returns.

## Customization, errors, and limits

All bounds use the same coordinate units as the supplied page dimensions; fields may not extend
outside the page. Email checks are intentionally basic shape checks, not deliverability or complete
standards validation. Select options are literal values. The package neither creates PDF form
widgets nor pretends that field metadata alone is a fillable document.

Maximum 500 fields by default (up to 10,000 when explicitly configured), page dimensions at most
100,000 units, at most 100 select options, 500-character labels/options, and 100,000-character
field length metadata. Schema/accessor/prototype and malformed values throw `TypeError`; invalid
geometry, count, or ranges throw `RangeError`. Validation/export are O(fields + supplied values).

## Modules and development

Independent ESM/CommonJS builds and declarations, zero runtime/peer dependencies.
CommonJS: `const { createFormDocument } = require('@lp-labs/form-document-designer')`.
TypeScript ^5.9.3 and Prettier ^3.6.2 are development-only.
Run `npm run build`, `npm run typecheck`, `npm test`, `npm run format`, `npm run format:check`.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
