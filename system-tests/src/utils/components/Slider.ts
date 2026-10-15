import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

/** The page, or a container locator when the same test id can appear more than once on screen. */
type FieldScope = Page | Locator

export interface SliderRange {
  min: number
  max: number
  step: number
}

/** Refuse to walk a slider further than this instead of hanging on a fine-grained range. */
const MAX_STEP_PRESSES = 250

/** Slack when checking that a target sits on the step grid, to absorb floating point drift. */
const STEP_GRID_TOLERANCE = 1e-9

const VALUE_PRECISION_DIGITS = 6

/**
 * Drives a shared-module `Slider`.
 *
 * `testId` is the `data-testid` passed to the component: it lands on the range input, and the
 * draggable thumb carries the same id suffixed with `-thumb`.
 */
export class Slider {
  private readonly scope: FieldScope
  private readonly testId: string

  public constructor(scope: FieldScope, testId: string) {
    this.scope = scope
    this.testId = testId
  }

  /**
   * The `input[type=range]` holding the value. `VisuallyHidden` clips it rather than hiding it, so
   * it still takes focus and key presses.
   */
  public getInput(): Locator {
    return this.scope.getByTestId(this.testId)
  }

  /** The draggable thumb. It carries the drag and focus state as `data-*` attributes. */
  public getThumb(): Locator {
    return this.scope.getByTestId(`${this.testId}-thumb`)
  }

  /** The bounds and granularity the control was rendered with. */
  public async getRange(): Promise<SliderRange> {
    const input = this.getInput()
    const [min, max, step] = await Promise.all([
      input.getAttribute("min"),
      input.getAttribute("max"),
      input.getAttribute("step"),
    ])
    return {
      min: this.parseRangeAttribute("min", min),
      max: this.parseRangeAttribute("max", max),
      step: this.parseRangeAttribute("step", step),
    }
  }

  /** The current value. */
  public async getValue(): Promise<number> {
    return Number(await this.getInput().inputValue())
  }

  /**
   * Moves the thumb to `value` by keyboard: home, then one arrow press per step.
   *
   * Throws when `value` is out of bounds, off the step grid, or more than {@link MAX_STEP_PRESSES}
   * steps from the minimum, rather than landing quietly on a neighbouring step.
   */
  public async setValue(value: number): Promise<void> {
    const presses = this.countStepPresses(value, await this.getRange())

    await test.step(`Set slider ${this.testId} to ${value}`, async () => {
      const input = this.getInput()
      await input.press("Home")
      // Vertical arrows increment and decrement whatever the text direction; ArrowRight inverts under RTL.
      for (let pressed = 0; pressed < presses; pressed++) {
        await input.press("ArrowUp")
      }

      await this.expectValue(value)
    })
  }

  /** Asserts the current value, within floating point tolerance. */
  public async expectValue(value: number): Promise<void> {
    await test.step(`Expect slider ${this.testId} to be ${value}`, async () => {
      await expect
        .poll(() => this.getValue(), {
          message: `Slider ${this.testId} never reached ${value}`,
        })
        .toBeCloseTo(value, VALUE_PRECISION_DIGITS)
    })
  }

  /** Arrow presses from the minimum to `value`, or a thrown explanation of why it is unreachable. */
  private countStepPresses(value: number, { min, max, step }: SliderRange): number {
    if (value < min || value > max) {
      throw new Error(`Slider ${this.testId}: ${value} is outside ${min}..${max}.`)
    }

    const stepsFromMin = (value - min) / step
    const presses = Math.round(stepsFromMin)
    if (Math.abs(stepsFromMin - presses) > STEP_GRID_TOLERANCE) {
      throw new Error(
        `Slider ${this.testId}: ${value} is not ${min} plus a whole number of ${step} steps.`,
      )
    }
    if (presses > MAX_STEP_PRESSES) {
      throw new Error(
        `Slider ${this.testId}: ${value} is ${presses} steps from ${min}, over the ${MAX_STEP_PRESSES} press limit.`,
      )
    }

    return presses
  }

  private parseRangeAttribute(name: string, raw: string | null): number {
    const parsed = Number(raw)
    if (raw === null || raw.trim() === "" || Number.isNaN(parsed)) {
      throw new Error(`Slider ${this.testId}: ${name} attribute is ${JSON.stringify(raw)}.`)
    }
    return parsed
  }
}
