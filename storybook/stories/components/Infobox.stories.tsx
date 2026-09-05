"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Infobox } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 12px;
  max-width: 560px;
`

const meta = {
  title: "Components/Infobox",
  component: Infobox,
  args: {
    tone: "info",
    heading: "Registration is on its way",
    children: "We send the credits to the study registry once the course staff confirm the grade.",
  },
  parameters: {
    docs: {
      description: {
        component:
          "Inline notice with a tone stripe and an icon. The fills darken from `info` through `success` and `warning` to `danger`, so several boxes on one page read as ranked.",
      },
    },
  },
} satisfies Meta<typeof Infobox>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const Tones = {
  render: () => (
    <div className={stackCss}>
      <Infobox heading="Registration is on its way">
        We send the credits to the study registry once the course staff confirm the grade.
      </Infobox>
      <Infobox tone="success" heading="Student number linked">
        Your credits will be registered under 012345678.
      </Infobox>
      <Infobox tone="warning" heading="We need your student number">
        Confirm it from the link we sent to your university address.
      </Infobox>
      <Infobox tone="danger" heading="Registration failed">
        The study registry does not recognise the course code. The course staff have been told.
      </Infobox>
    </div>
  ),
} satisfies Story
