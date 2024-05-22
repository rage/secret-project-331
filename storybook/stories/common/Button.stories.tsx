import type { Meta, StoryObj } from "@storybook/react"

import StoryComponent from "../../src/shared-module/common/components/Button"

const meta = {
  component: StoryComponent,
  parameters: {
    docs: {
      description: {
        component:
          "Extends the native HTML button element with some additional props, such as variant and size. All props available on the regular HTML button also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button.",
      },
    },
  },
} satisfies Meta<typeof StoryComponent>

export default meta

type StoryType = StoryObj<typeof meta>

export const Primary = {
  args: {
    variant: "primary",
    size: "medium",
    children: "I am a button",
  },
} satisfies StoryType

export const Secondary = {
  args: {
    ...Primary.args,
    variant: "secondary",
  },
} satisfies StoryType

export const Tertiary = {
  args: {
    ...Primary.args,
    variant: "tertiary",
  },
} satisfies StoryType

export const Large = {
  args: {
    variant: "primary",
    size: "large",
    children: "I am a button",
  },
} satisfies StoryType

export const Small = {
  args: {
    variant: "primary",
    size: "small",
    children: "I am a button",
  },
} satisfies StoryType
