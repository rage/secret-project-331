"use client"

import type { Preview } from "@storybook/react"

import { tokensGlobal } from "../src/shared-module/components"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: { toc: true },
  },

  tags: ["autodocs"],
}

export default preview

void tokensGlobal
