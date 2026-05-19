export type FieldType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "DATE"
  | "PERCENT"
  | "CHECKBOX"
  | "CURRENCY";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Текст",
  NUMBER: "Число",
  SELECT: "Список",
  DATE: "Дата",
  PERCENT: "Процент",
  CHECKBOX: "Да / нет",
  CURRENCY: "Сумма",
};

export const FIELD_TYPES_ALL: FieldType[] = [
  "TEXT",
  "NUMBER",
  "SELECT",
  "DATE",
  "PERCENT",
  "CHECKBOX",
  "CURRENCY",
];
