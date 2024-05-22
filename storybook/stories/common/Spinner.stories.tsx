import type { Meta, StoryObj } from "@storybook/react"

import StoryComponent from "../../src/shared-module/common/components/Spinner"

const meta = {
  component: StoryComponent,
  parameters: {
    docs: {
      description: {
        component: "Used to display a loading animation.",
      },
    },
  },
} satisfies Meta<typeof StoryComponent>

export default meta

type StoryType = StoryObj<typeof meta>

export const Medium = {
  args: {
    variant: "medium",
    disableMargin: false,
  },
} satisfies StoryType

export const Small = {
  args: {
    variant: "small",
  },
} satisfies StoryType

export const Large = {
  args: {
    variant: "large",
  },
} satisfies StoryType
