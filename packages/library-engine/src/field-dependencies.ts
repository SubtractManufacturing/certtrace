import type {
  FieldDefinitionV1,
  FieldOptionV1,
  FieldSchemaV1,
  FieldValueV1,
} from "@certtrace/types";

type MaterialFieldValues = Record<string, FieldValueV1>;

function dependencyValues(value: FieldValueV1 | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [String(value)];
}

export function isFieldVisible(field: FieldDefinitionV1, values: MaterialFieldValues): boolean {
  const dependency = field.dependsOn;
  const visibleWhen = dependency?.visibleWhen;
  if (!visibleWhen) {
    return true;
  }

  const parentValues = dependencyValues(values[dependency.fieldKey]);
  return parentValues.some((value) => visibleWhen.includes(value));
}

export function availableFieldOptions(
  field: FieldDefinitionV1,
  values: MaterialFieldValues,
): FieldOptionV1[] {
  const options = field.options ?? [];
  const dependency = field.dependsOn;
  if (!dependency?.filterOptionsBy) {
    return options;
  }

  const allowedIds = new Set(
    dependencyValues(values[dependency.fieldKey]).flatMap(
      (value) => dependency.filterOptionsBy?.[value] ?? [],
    ),
  );
  return options.filter((option) => allowedIds.has(option.id));
}

export function sanitizeDependentSelectValues(
  schema: FieldSchemaV1,
  values: MaterialFieldValues,
): MaterialFieldValues {
  const sanitized = { ...values };

  for (let pass = 0; pass < schema.fields.length; pass += 1) {
    let changed = false;

    for (const field of schema.fields) {
      const value = sanitized[field.key];
      if (value === undefined) {
        continue;
      }

      if (!field.dependsOn?.filterOptionsBy) {
        continue;
      }

      const allowedIds = new Set(
        availableFieldOptions(field, sanitized).map((option) => option.id),
      );
      if (Array.isArray(value)) {
        const filtered = value.filter((entry) => allowedIds.has(entry));
        if (filtered.length !== value.length) {
          if (filtered.length === 0) {
            delete sanitized[field.key];
          } else {
            sanitized[field.key] = filtered;
          }
          changed = true;
        }
      } else if (typeof value !== "string" || !allowedIds.has(value)) {
        delete sanitized[field.key];
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return sanitized;
}

function isEmptyFieldValue(value: FieldValueV1 | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (typeof value === "number") {
    return false;
  }
  return value.length === 0;
}

export function validateMaterialValues(
  schema: FieldSchemaV1,
  fields: MaterialFieldValues,
  identifiers: Record<string, string>,
): string[] {
  const errors: string[] = [];

  for (const field of schema.fields) {
    if (field.required && isFieldVisible(field, fields) && isEmptyFieldValue(fields[field.key])) {
      errors.push(`${field.label} is required`);
    }
  }

  for (const kind of schema.identifierKinds) {
    if (kind.required && !identifiers[kind.key]?.trim()) {
      errors.push(`${kind.label} is required`);
    }
  }

  return errors;
}
