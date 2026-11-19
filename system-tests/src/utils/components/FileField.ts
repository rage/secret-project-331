import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

/** The page, or a container locator when the same test id can appear more than once on screen. */
type FieldScope = Page | Locator

type FileSelection = Parameters<Locator["setInputFiles"]>[0]

/**
 * Drives a shared-module `FileField`.
 *
 * `testId` is the `data-testid` passed to the component: it lands on the visible button, and the
 * native file input carries the same id suffixed with `-input`.
 */
export class FileField {
  private readonly scope: FieldScope
  private readonly testId: string

  public constructor(scope: FieldScope, testId: string) {
    this.scope = scope
    this.testId = testId
  }

  /** The visible trigger. The field's `<label for>` points here, not at the file input. */
  public getButton(): Locator {
    return this.scope.getByTestId(this.testId)
  }

  /** The native file input. It is `aria-hidden` and out of the tab order, so only the id finds it. */
  public getFileInput(): Locator {
    return this.scope.getByTestId(`${this.testId}-input`)
  }

  /** The live region naming the current selection. It has no test id, only its place in the row. */
  public getSummary(): Locator {
    return this.getButton().locator("xpath=..").getByRole("status")
  }

  /**
   * Selects files without going through the OS picker.
   *
   * Takes whatever `Locator.setInputFiles` takes: a path, several paths, or an in-memory
   * `{ name, mimeType, buffer }` payload for content that has no file on disk.
   */
  public async upload(files: FileSelection): Promise<void> {
    await test.step(`Upload to file field ${this.testId}`, async () => {
      await this.getFileInput().setInputFiles(files)
      await this.expectSelectedFileCount(Array.isArray(files) ? files.length : 1)
    })
  }

  /** Drops the current selection, returning the field to its empty summary. */
  public async clear(): Promise<void> {
    await test.step(`Clear file field ${this.testId}`, async () => {
      await this.getFileInput().setInputFiles([])
      await this.expectSelectedFileCount(0)
    })
  }

  /** Asserts the summary text shown for the current selection. */
  public async expectSummary(text: string | RegExp): Promise<void> {
    await test.step(`Expect file field ${this.testId} summary`, async () => {
      await expect(this.getSummary()).toHaveText(text)
    })
  }

  private async expectSelectedFileCount(count: number): Promise<void> {
    await expect
      .poll(
        () =>
          this.getFileInput().evaluate(
            (element) => (element as HTMLInputElement).files?.length ?? 0,
          ),
        { message: `File field ${this.testId} did not end up holding ${count} file(s)` },
      )
      .toBe(count)
  }
}
