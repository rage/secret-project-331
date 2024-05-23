import type { Meta, StoryObj } from "@storybook/react"

import Component from "../../../src/shared-module/common/components/InputFields/TextField"

const meta = {
  component: Component,
  parameters: {
    docs: {
      description: {
        component:
          "Extends the native HTML input type='text' element with some additional props, such as label. All props available on the regular HTML input also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/text.",
      },
    },
  },
} satisfies Meta<typeof Component>

export default meta

type StoryType = StoryObj<typeof meta>

export const Example = {
  args: {
    label: "Example",
    placeholder: "Placeholder",
    onChange: (event) => {
      console.log("Textfield changed to" + event.target.value)
    },
    value: undefined,
    defaultValue: undefined,
    required: false,
  },
} satisfies StoryType
