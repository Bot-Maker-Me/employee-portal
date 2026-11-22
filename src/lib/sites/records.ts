/**
 * Column definitions for the searchable reference tables (Drug Database,
 * Intervention Codes, per-pharmacy Formulary). Client-safe: no server imports.
 *
 * The order of `fields` is also the column order for bulk paste/CSV import.
 */
export type RecordEntity = "drug_database" | "intervention_codes" | "pharmacy_formulary";

export type RecordField = {
  key: string;
  label: string;
  max: number;
  required?: boolean;
  mono?: boolean;
  /** Shown in the table (false = only in the edit form). */
  list?: boolean;
  multiline?: boolean;
};

export type RecordConfig = {
  entity: RecordEntity;
  /** "org" rows carry `organization`; "pharmacy" rows carry `pharmacy_id`. */
  scope: "org" | "pharmacy";
  singular: string;
  plural: string;
  fields: RecordField[];
  orderBy: string;
};

export const RECORD_CONFIGS: Record<RecordEntity, RecordConfig> = {
  drug_database: {
    entity: "drug_database",
    scope: "org",
    singular: "drug",
    plural: "drugs",
    orderBy: "drug_name",
    fields: [
      { key: "drug_name", label: "Drug name", max: 200, required: true },
      { key: "generic_name", label: "Generic name", max: 200 },
      { key: "din", label: "DIN", max: 20, mono: true },
      { key: "strength", label: "Strength", max: 80 },
      { key: "dosage_form", label: "Form", max: 80 },
      { key: "schedule", label: "Schedule", max: 40 },
      { key: "notes", label: "Notes", max: 1000, list: false, multiline: true },
    ],
  },
  intervention_codes: {
    entity: "intervention_codes",
    scope: "org",
    singular: "code",
    plural: "codes",
    orderBy: "code",
    fields: [
      { key: "code", label: "Code", max: 12, required: true, mono: true },
      { key: "description", label: "Description", max: 300, required: true },
      { key: "category", label: "Category", max: 60 },
      { key: "notes", label: "When to use", max: 1000, multiline: true },
    ],
  },
  pharmacy_formulary: {
    entity: "pharmacy_formulary",
    scope: "pharmacy",
    singular: "formulary item",
    plural: "formulary items",
    orderBy: "chemical_name",
    fields: [
      { key: "chemical_name", label: "Chemical name", max: 200, required: true },
      { key: "preferred_brand", label: "Preferred brand", max: 200 },
      { key: "preferred_din", label: "Preferred DIN", max: 20, mono: true },
      { key: "alternate_brand", label: "Alternate brand", max: 200 },
      { key: "alternate_din", label: "Alternate DIN", max: 20, mono: true },
      { key: "notes", label: "Notes", max: 1000, multiline: true },
    ],
  },
};

export type RecordRow = { id: string } & Record<string, string>;

/** Strips characters that have meaning inside a PostgREST `or=(...)` filter. */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()*%\\"':]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Parses pasted rows (tab-separated from Excel, or CSV). Quoted CSV cells may
 * contain commas and doubled quotes. Blank lines are skipped.
 */
export function parsePastedRows(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}
