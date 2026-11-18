interface TableCell {
  tag?: string
  scope?: string
  [key: string]: unknown
}

interface TableRow {
  cells: TableCell[]
}

export interface TableBodyAttributes {
  body?: TableRow[]
}

/** True when every body row starts with a row header cell; false for an empty body. */
export const hasRowHeaders = (body: TableRow[] | undefined): boolean =>
  Boolean(body?.length) &&
  (body ?? []).every((row) => row.cells[0]?.tag === "th" && row.cells[0].scope === "row")

/** Returns the body with the first cell of each row made a row header (th, scope=row) or a plain td. */
export const setRowHeaders = (body: TableRow[] | undefined, enabled: boolean): TableRow[] =>
  (body ?? []).map((row) => ({
    ...row,
    cells: row.cells.map((cell, index) => {
      if (index !== 0) {
        return cell
      }
      const { scope: _scope, ...rest } = cell
      return enabled ? { ...rest, tag: "th", scope: "row" } : { ...rest, tag: "td" }
    }),
  }))
