export function escapeMeiliFilterString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function stringEquals(field: string, value: string) {
  return `${field} = "${escapeMeiliFilterString(value)}"`;
}

export function booleanEquals(field: string, value: boolean) {
  return `${field} = ${value}`;
}

export function numberGreaterThanOrEqual(field: string, value: number) {
  return `${field} >= ${value}`;
}

export function numberLessThanOrEqual(field: string, value: number) {
  return `${field} <= ${value}`;
}
