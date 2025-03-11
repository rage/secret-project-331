import type { Meta, StoryObj } from "@storybook/react"

import StoryComponent from "../../src/shared-module/common/components/Accordion"

const meta = {
  component: StoryComponent,
  parameters: {
    docs: {
      description: {
        component: "An expandable accordion component that can show/hide content.",
      },
    },
  },
} satisfies Meta<typeof StoryComponent>

export default meta

type StoryType = StoryObj<typeof meta>

export const Accordion = {
  args: {
    children: (
      <details>
        <summary>Click to expand</summary>
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      </details>
    ),
  },
} satisfies StoryType

export const OpenByDefault = {
  args: {
    open: true,
    children: (
      <details>
        <summary>This accordion starts expanded</summary>
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      </details>
    ),
  },
} satisfies StoryType
