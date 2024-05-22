import type { Meta, StoryObj } from "@storybook/react"

import StoryComponent from "../../src/shared-module/common/components/ErrorBanner"

const meta = {
  component: StoryComponent,
  parameters: {
    docs: {
      description: {
        component:
          "Use this component to display an error banner. The error can be either a string or an Error object.",
      },
    },
  },
} satisfies Meta<typeof StoryComponent>

export default meta

type StoryType = StoryObj<typeof meta>

export const Example = {
  args: {
    error: "This is an error message.",
  },
} satisfies StoryType
