import type { Meta, StoryObj } from "@storybook/react"

import Component from "../../../src/shared-module/common/components/InputFields/DateTimeLocal"

const meta = {
  component: Component,
  parameters: {
    docs: {
      description: {
        component:
          "Extends the native HTML input type='datetime-local' element with some additional props, such as label. All props available on the regular HTML input also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local.",
      },
    },
  },
} satisfies Meta<typeof Component>

export default meta

type StoryType = StoryObj<typeof meta>

export const Example = {
  args: {
    label: "Example",
    value: undefined,
    onChange: (event) => {
      console.log("Datepicker changed to" + event.target.value)
    },
    min: "2023-01-01T00:00",
    max: "2023-12-31T23:59",
    defaultValue: "2023-01-01T00:00",
    required: false,
  },
} satisfies StoryType
