// ProgressTab.tsx
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getProgress } from "@/services/backend/courses/students"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

type ProgressUser = {
  user_id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type ProgressChapter = {
  id: string
  name?: string | null
  chapter_number?: number | null
}

type ProgressExerciseState = {
  user_id: string
  exercise_id: string
  score_given?: number | null
}

type ChapterCellKey = `ch_${string}_${"points" | "attempts"}`

type ProgressRow = {
  student: string
  total_points: number
  total_attempted: number
} & Partial<Record<ChapterCellKey, number | undefined>>

export const ProgressTabContent: React.FC<{ courseId: string }> = ({ courseId }) => {
  const { t } = useTranslation()

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
    user_details: ProgressUser[]
    chapters: ProgressChapter[]
    user_exercise_states: ProgressExerciseState[]
  }

  // --- helpers ---
  const formatUserName = (u: { first_name?: string | null; last_name?: string | null }) => {
    const first = (u.first_name ?? "").trim()
    const last = (u.last_name ?? "").trim()
    if (!first || !last) {
      return t("missing-name")
    }
    return `${last}, ${first}`
  }

  const sortedChapters = [...chapters].sort(
    (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0),
  )

  // --- columns: Student | Total (Points/Attempts) | per-chapter (Points/Attempts)
  const dynamicColumns = [
    {
      header: t("label-student"),
      // eslint-disable-next-line i18next/no-literal-string
      columns: [{ header: "", accessorKey: "student" }],
    },
    {
      header: t("total"),
      columns: [
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("points"), accessorKey: "total_points" },
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("attempts"), accessorKey: "total_attempted", meta: { altBg: true } },
      ],
    },
    ...sortedChapters.map((ch) => ({
      header: `${ch.chapter_number}: ${ch.name ?? "-"}`,
      columns: [
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("points"), accessorKey: `ch_${ch.id}_points` },
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("attempts"), accessorKey: `ch_${ch.id}_attempts`, meta: { altBg: true } },
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

  const rows: ProgressRow[] = user_details.map((u) => {
    const totals = totalsByUser[u.user_id] ?? { total_points: 0, total_attempted: 0 }

    const row: ProgressRow = {
      student: formatUserName(u),
      total_points: totals.total_points,
      total_attempted: totals.total_attempted,
    }

    // placeholders for dynamic chapter cells
    for (const ch of sortedChapters) {
      // eslint-disable-next-line i18next/no-literal-string
      const pointsKey: ChapterCellKey = `ch_${ch.id}_points`
      // eslint-disable-next-line i18next/no-literal-string
      const attemptsKey: ChapterCellKey = `ch_${ch.id}_attempts`
      row[pointsKey] = undefined
      row[attemptsKey] = undefined
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
