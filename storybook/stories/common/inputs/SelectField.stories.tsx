import type { Meta, StoryObj } from "@storybook/react"

import Component from "../../../src/shared-module/common/components/InputFields/SelectField"

const meta = {
  component: Component,
  parameters: {
    docs: {
      description: {
        component:
          "Extends the native HTML select element with some additional props, such as label, and options. All props available on the regular HTML select also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select.",
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
      console.log("Select changed to" + event.target.value)
    },
    value: undefined,
    defaultValue: undefined,
    options: [
      { value: "1", label: "Option 1" },
      { value: "2", label: "Option 2" },
      { value: "3", label: "Option 3" },
    ],
    required: false,
  },
} satisfies StoryType
