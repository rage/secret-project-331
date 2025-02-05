import type { Meta, StoryObj } from "@storybook/react"
import React from "react"

import StoryComponent from "../../src/shared-module/common/components/Dialog"

const meta = {
  component: StoryComponent,
  parameters: {
    docs: {
      description: {
        component:
          "A wrapper component for the native HTML dialog element with some additional props. All props available on the regular HTML dialog also work with this component. See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog.",
      },
    },
  },
} satisfies Meta<typeof StoryComponent>

export default meta

type StoryType = StoryObj<typeof meta>

export const Example = {
  args: {
    open: false,
    onClose: () => {
      console.log("onClose")
    },
    closeable: true,
    noPadding: false,
    width: "normal",
    children: (
      <>
        <h1>Heading inside dialog</h1>
        <p>Paragraph inside dialog</p>
      </>
    ),
  },
} satisfies StoryType
