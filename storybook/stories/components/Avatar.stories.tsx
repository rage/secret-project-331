"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Avatar } from "../../src/shared-module/components"

const rowCss = css`
  display: flex;
  align-items: center;
  gap: 12px;
`

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: {
    name: "Firstname Lastname",
    size: 48,
  },
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const Sizes = {
  render: () => (
    <div className={rowCss}>
      <Avatar name="Ada Lovelace" size={32} />
      <Avatar name="Grace Hopper" size={48} />
      <Avatar name="Alan Turing" size={64} />
    </div>
  ),
} satisfies Story
