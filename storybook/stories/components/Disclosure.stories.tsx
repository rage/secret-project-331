"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Disclosure } from "../../src/shared-module/components"

const wrapCss = css`
  max-width: 420px;
`

const meta = {
  title: "Components/Disclosure",
  component: Disclosure,
  args: {
    title: "Intro to Programming",
    defaultExpanded: false,
    children: <p>Per-module completion details go here.</p>,
  },
} satisfies Meta<typeof Disclosure>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {
  render: (args) => (
    <div className={wrapCss}>
      <Disclosure {...args}>
        <p>Per-module completion details go here.</p>
      </Disclosure>
    </div>
  ),
} satisfies Story

export const Expanded = {
  args: { defaultExpanded: true },
  render: (args) => (
    <div className={wrapCss}>
      <Disclosure {...args}>
        <p>Module 1 — completed 4 Jan 14:02</p>
        <p>Module 2 — completed 4 Jan 14:20</p>
      </Disclosure>
    </div>
  ),
} satisfies Story
