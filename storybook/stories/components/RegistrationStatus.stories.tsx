"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  RegistrationStatusBadge,
  RegistrationStatusHeadline,
} from "../../src/shared-module/components"

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`

const stackCss = css`
  display: grid;
  gap: 16px;
`

const labels = {
  done: "Registered in Sisu",
  current: "Being registered",
  "action-needed": "We need your student number",
  failed: "Registration failed",
  superseded: "Replaced by a later attempt",
  upcoming: "Not started",
} as const

const meta = {
  title: "Components/RegistrationStatus",
  component: RegistrationStatusBadge,
  parameters: {
    docs: {
      description: {
        component:
          "One credit-registration state in two forms: `RegistrationStatusBadge` for list rows and table cells, `RegistrationStatusHeadline` for a page that exists to report the state. Both take their tone and icon from the same maps, so the two forms cannot drift.",
      },
    },
  },
} satisfies Meta<typeof RegistrationStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Badges = {
  render: () => (
    <div className={rowCss}>
      {Object.entries(labels).map(([state, label]) => (
        <RegistrationStatusBadge key={state} state={state as keyof typeof labels}>
          {label}
        </RegistrationStatusBadge>
      ))}
    </div>
  ),
} satisfies Story

export const CompactBadges = {
  render: () => (
    <div className={rowCss}>
      {Object.entries(labels).map(([state, label]) => (
        <RegistrationStatusBadge key={state} size="compact" state={state as keyof typeof labels}>
          {label}
        </RegistrationStatusBadge>
      ))}
    </div>
  ),
} satisfies Story

export const Headlines = {
  render: () => (
    <div className={stackCss}>
      {Object.entries(labels).map(([state, label]) => (
        <RegistrationStatusHeadline key={state} state={state as keyof typeof labels}>
          {label}
        </RegistrationStatusHeadline>
      ))}
    </div>
  ),
} satisfies Story
