import type { Meta, StoryObj } from "@storybook/react"

import Component from "../../../src/shared-module/common/components/InputFields/TimePickerField"

const meta = {
  component: Component,
  parameters: {
    docs: {
      description: {
        component:
          "Extends the native HTML input type='time' element with some additional props, such as label. All props available on the regular HTML input also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/time.",
      },
    },
  },
} satisfies Meta<typeof Component>

export default meta

type StoryType = StoryObj<typeof meta>

export const Example = {
  args: {
    label: "Example",
    onChange: (event) => {
      console.log("Time changed to" + event.target.value)
    },
    value: undefined,
    defaultValue: undefined,
    min: undefined,
    max: undefined,
    required: false,
  },
} satisfies StoryType
