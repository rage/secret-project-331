import type { Locator, Page } from "@playwright/test"

import { Checkbox, type CheckboxOptions } from "./Checkbox"

/** Options for {@link Switch}. */
export type SwitchOptions = CheckboxOptions

const DEFAULT_NAME = "Switch"

/**
 * Drives a shared-module `Switch`, a checkbox input exposed with the `switch` role.
 *
 * Behaves like {@link Checkbox}; only the way it is located differs.
 */
export class Switch extends Checkbox {
  /** The switch labelled exactly `label` within `scope`. */
  public static override labelled(page: Page, label: string, scope: Page | Locator = page): Switch {
    return new Switch(scope.getByRole("switch", { name: label, exact: true }), { name: label })
  }

  public constructor(input: Locator, opts: SwitchOptions = {}) {
    super(input, { name: opts.name ?? DEFAULT_NAME })
  }
}
