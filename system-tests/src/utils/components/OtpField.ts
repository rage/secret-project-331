import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

/** The page, or a container locator when the same test id can appear more than once on screen. */
type FieldScope = Page | Locator

/**
 * Drives a shared-module `OtpField`.
 *
 * `testId` is the `data-testid` passed to the component; it lands on the slot group, not on the
 * individual slots. Slot indices here are zero-based, unlike the one-based `aria-label` the
 * component gives each slot.
 */
export class OtpField {
  private readonly scope: FieldScope
  private readonly testId: string

  public constructor(scope: FieldScope, testId: string) {
    this.scope = scope
    this.testId = testId
  }

  /** The `role="group"` wrapper around the slots. */
  public getGroup(): Locator {
    return this.scope.getByTestId(this.testId)
  }

  /**
   * One slot input. Scoped to the group so the autofill mirror input, which `VisuallyHidden` only
   * clips and Playwright therefore still reports as visible, cannot match.
   */
  public getSlot(index: number): Locator {
    return this.getSlots().nth(index)
  }

  /** How many characters the field accepts. */
  public async getLength(): Promise<number> {
    return await this.getSlots().count()
  }

  /**
   * Types a code, one keystroke per slot.
   *
   * `fill()` cannot do this: every slot is `maxLength={1}` and the component moves focus itself on
   * each accepted character, so a filled string is silently truncated to its first character.
   */
  public async fillCode(code: string): Promise<void> {
    const length = await this.getLength()
    if (code.length > length) {
      throw new Error(
        `OTP field ${this.testId} has ${length} slots, but "${code}" is ${code.length} characters.`,
      )
    }

    await test.step(`Fill OTP field ${this.testId}`, async () => {
      await this.clear()
      for (const [index, character] of Array.from(code).entries()) {
        await this.getSlot(index).press(character)
      }
      await this.expectValue(code)
    })
  }

  /** Empties every slot. A slot already holding a character rejects a new one, so clear before typing. */
  public async clear(): Promise<void> {
    await test.step(`Clear OTP field ${this.testId}`, async () => {
      const length = await this.getLength()
      for (let index = length - 1; index >= 0; index--) {
        await this.getSlot(index).press("Backspace")
      }
      await this.expectValue("")
    })
  }

  /** Asserts the code the field holds, slot by slot. Pass a short code to assert a partial entry. */
  public async expectValue(code: string): Promise<void> {
    await test.step(`Expect OTP field ${this.testId} to hold "${code}"`, async () => {
      const characters = Array.from(code)
      const length = await this.getLength()
      for (let index = 0; index < length; index++) {
        await expect(this.getSlot(index)).toHaveValue(characters[index] ?? "")
      }
    })
  }

  private getSlots(): Locator {
    return this.getGroup().getByRole("textbox")
  }
}
