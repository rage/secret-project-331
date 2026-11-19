import type { Locator, Page } from "@playwright/test"

/**
 * The table row with a cell whose text is exactly `cellText`, in any table under `scope`.
 *
 * Matches the cell alone: a row's accessible name also carries every other cell and action button,
 * which change with unrelated UI work. Pick a `cellText` unique to one row (an email, a title).
 */
export function tableRowByCell(scope: Page | Locator, cellText: string): Locator {
  // `has` is resolved from the row, so the inner locator must not repeat `scope`'s own chain.
  const page = "page" in scope ? scope.page() : scope
  return scope
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: cellText, exact: true }) })
}
