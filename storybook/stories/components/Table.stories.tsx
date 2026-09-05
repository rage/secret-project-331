"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Badge, Table } from "../../src/shared-module/components"

interface Registration {
  id: string
  student: string
  course: string
  state: string
  updated: string
}

const rows: Registration[] = [
  {
    id: "1",
    student: "Aino Virtanen",
    course: "Credit registration import outcomes, Module CRS-IMPORT-103",
    state: "Registered",
    updated: "6 Sep 09:51",
  },
  {
    id: "2",
    student: "Björn Lindqvist",
    course: "Introduction to Programming, Part 1",
    state: "Failed",
    updated: "6 Sep 08:12",
  },
]

const wrapCss = css`
  max-width: 720px;
`

const meta = {
  title: "Components/Table",
  component: Table,
  parameters: {
    docs: {
      description: {
        component:
          'Presentational table. Columns declare their own sizing: `width` (which switches the table to a fixed layout), `minWidth`, `grow` and `nowrap`. `density="compact"` is for operator tables, and `emptyState` fills the body when there are no rows.',
      },
    },
  },
} satisfies Meta<typeof Table<Registration>>

export default meta

type Story = StoryObj<typeof meta>

export const Default = {
  args: {
    caption: "Registrations",
    rows,
    rowKey: (row: Registration) => row.id,
    columns: [
      { header: "Student", cell: (row: Registration) => row.student },
      { header: "Course", cell: (row: Registration) => row.course },
      { header: "State", cell: (row: Registration) => row.state },
      { header: "Updated", cell: (row: Registration) => row.updated },
    ],
  },
  render: (args) => (
    <div className={wrapCss}>
      <Table {...args} />
    </div>
  ),
} satisfies Story

export const SizedColumns = {
  args: {
    ...Default.args,
    columns: [
      { header: "Student", cell: (row: Registration) => row.student, minWidth: "10rem" },
      { header: "Course", cell: (row: Registration) => row.course, grow: true },
      {
        header: "State",
        cell: (row: Registration) => (
          <Badge tone={row.state === "Failed" ? "danger" : "success"} size="compact">
            {row.state}
          </Badge>
        ),
        nowrap: true,
      },
      { header: "Updated", cell: (row: Registration) => row.updated, nowrap: true, align: "end" },
    ],
  },
  render: Default.render,
} satisfies Story

export const Compact = {
  args: { ...SizedColumns.args, density: "compact" },
  render: Default.render,
} satisfies Story

export const Empty = {
  args: { ...Default.args, rows: [], emptyState: "No registrations on this course yet." },
  render: Default.render,
} satisfies Story
