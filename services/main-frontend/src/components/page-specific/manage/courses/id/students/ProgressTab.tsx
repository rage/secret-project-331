// ProgressTab.tsx
import { useQuery } from "@tanstack/react-query"
import React from "react"

import { FloatingHeaderTable } from "./StudentsTableTabs"

import { getProgress } from "@/services/backend/courses/students"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

export const ProgressTabContent: React.FC<{ courseId: string }> = ({ courseId }) => {
  const query = useQuery({
    queryKey: ["progress-tab", courseId],
    queryFn: () => getProgress(courseId),
  })

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  const { user_details, chapters, user_exercise_states } = query.data as {
    user_details: Array<{
      user_id: string
      first_name?: string | null
      last_name?: string | null
      email?: string | null
    }>
    chapters: Array<{
      id: string
      name?: string | null
      chapter_number?: number | null
    }>
    user_exercise_states: Array<{
      user_id: string
      exercise_id: string
      score_given?: number | null
    }>
  }

  // --- helpers ---
  const formatUserName = (u: { first_name?: string | null; last_name?: string | null }) => {
    const first = (u.first_name ?? "").trim()
    const last = (u.last_name ?? "").trim()
    if (!first || !last) {
      return "(Missing Name)"
    }
    return `${last}, ${first}`
  }

  // sort chapters for deterministic column order
  const sortedChapters = [...chapters].sort(
    (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0),
  )

  // --- columns: Student | Total (Points/Attempts) | per-chapter (Points/Attempts)
  const dynamicColumns = [
    {
      header: "Student",
      columns: [{ header: "", accessorKey: "student" }],
    },
    {
      header: "Total",
      columns: [
        { header: "Points", accessorKey: "total_points" },
        { header: "Attempts", accessorKey: "total_attempted", meta: { altBg: true } },
      ],
    },
    ...sortedChapters.map((ch) => ({
      header: `${ch.chapter_number}: ${ch.name ?? "-"}`,
      columns: [
        { header: "Points", accessorKey: `ch_${ch.id}_points` },
        { header: "Attempts", accessorKey: `ch_${ch.id}_attempts`, meta: { altBg: true } },
      ],
    })),
  ]

  // --- aggregate totals per user from exercise states
  const totalsByUser: Record<string, { total_points: number; total_attempted: number }> = {}
  for (const s of user_exercise_states) {
    const uid = s.user_id
    if (!totalsByUser[uid]) {
      totalsByUser[uid] = { total_points: 0, total_attempted: 0 }
    }
    totalsByUser[uid].total_attempted += 1
    totalsByUser[uid].total_points += typeof s.score_given === "number" ? s.score_given : 0
  }

  const rows = user_details.map((u) => {
    const totals = totalsByUser[u.user_id] ?? { total_points: 0, total_attempted: 0 }
    const row: any = {
      student: formatUserName(u),
      total_points: totals.total_points,
      total_attempted: totals.total_attempted,
    }

    // placeholders for chapter cells (once we have exercise->chapter mapping)
    for (const ch of sortedChapters) {
      row[`ch_${ch.id}_points`] = undefined
      row[`ch_${ch.id}_attempts`] = undefined
    }
    return row
  })

  return (
    <FloatingHeaderTable
      columns={dynamicColumns}
      data={rows}
      colorHeaders
      colorColumns
      colorHeaderUnderline
      progressMode
    />
  )
}
