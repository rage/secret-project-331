/* eslint-disable i18next/no-literal-string */
import type { Meta, StoryObj } from "@storybook/react"
import React from "react"

import StoryComponent from "../../src/shared-module/common/components/GenericInfobox"

const meta = {
  component: StoryComponent,
  parameters: {
    docs: {
      description: {
        component: "A box that can be used to display information to the user",
      },
    },
  },
} satisfies Meta<typeof StoryComponent>

export default meta

type StoryType = StoryObj<typeof meta>

export const Example = {
  args: {
    children: "Text inside the box",
  },
} satisfies StoryType
