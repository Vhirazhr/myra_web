export type Row = { id: string; owner_id: string; created_at: string; [column: string]: any };
export type Values = Record<
  string,
  string | number | boolean | string[] | Record<string, number> | null
>;
export type Field = {
  key: string;
  label: string;
  type?:
    | "area"
    | "number"
    | "select"
    | "ref"
    | "multi"
    | "date"
    | "datetime-local"
    | "time"
    | "check"
    | "file"
    | "traits";
  options?: string[];
  table?: string;
  bucket?: string;
  accept?: string;
  required?: boolean;
  initial?: string | number | boolean;
  min?: number;
  max?: number;
  step?: string;
  when?: [string, string];
};
export type Spec = {
  table: string;
  singular: string;
  fields: Field[];
  fixed?: Values;
  label?: string;
  readOnly?: boolean;
  description?: string;
};
