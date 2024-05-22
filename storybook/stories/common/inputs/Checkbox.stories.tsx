import type { Meta, StoryObj } from "@storybook/react"

import Component from "../../../src/shared-module/common/components/InputFields/CheckBox"

const meta = {
  component: Component,
  parameters: {
    docs: {
      description: {
        component:
          "Extends the native HTML input type='checkbox' element with some additional props, such as label. All props available on the regular HTML input also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox.",
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
      console.log("Checkbox changed to" + event.target.checked)
    },
    checked: true,
    defaultChecked: true,
    required: false,
  },
} satisfies StoryType
