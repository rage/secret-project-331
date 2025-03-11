import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"

import StoryComponent from "../../src/shared-module/common/components/Accordion"
import {
  AccordionProvider,
  useAccordionContext,
} from "../../src/shared-module/common/components/Accordion/accordionContext"

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

const AccordionWithControls = () => {
  const { expandAll, collapseAll } = useAccordionContext()

  return (
    <div>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <button
          className={css`
            margin-right: 1rem;
          `}
          onClick={expandAll}
        >
          Expand All
        </button>
        <button onClick={collapseAll}>Collapse All</button>
      </div>

      <div
        className={css`
          display: grid;
          gap: 1rem;
        `}
      >
        <StoryComponent>
          <details>
            <summary>First Section</summary>
            <ul>
              <li>Item 1.1</li>
              <li>Item 1.2</li>
            </ul>
          </details>
        </StoryComponent>

        <StoryComponent>
          <details>
            <summary>Second Section</summary>
            <ul>
              <li>Item 2.1</li>
              <li>Item 2.2</li>
            </ul>
          </details>
        </StoryComponent>
      </div>
    </div>
  )
}

export const WithExpandCollapseControls = {
  render: () => (
    <AccordionProvider>
      <AccordionWithControls />
    </AccordionProvider>
  ),
} satisfies StoryType
