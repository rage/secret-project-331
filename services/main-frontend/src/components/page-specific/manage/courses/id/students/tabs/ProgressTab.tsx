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

type UserChapterProgress = {
  user_id: string
  chapter_id: string
  chapter_number?: number | null
  chapter_name?: string | null
  exercises_attempted?: number | null
  points_obtained?: number | null
}

type ChapterAvailability = {
  chapter_id: string
  chapter_number?: number | null
  chapter_name?: string | null
  points_available?: number | null
  exercises_available?: number | null
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

  const { user_details, chapters, user_chapter_progress, chapter_availability } = query.data as {
    user_details: ProgressUser[]
    chapters: ProgressChapter[]
    user_chapter_progress: UserChapterProgress[]
    chapter_availability: ChapterAvailability[]
  }

  // --- maxima lookups (per chapter, not per user)
  const maxPointsByChapter: Record<string, number | undefined> = {}
  const maxAttemptsByChapter: Record<string, number | undefined> = {}
  for (const ca of chapter_availability ?? []) {
    if (!ca?.chapter_id) {
      continue
    }
    if (typeof ca.points_available === "number") {
      maxPointsByChapter[ca.chapter_id] = ca.points_available
    }
    if (typeof ca.exercises_available === "number") {
      maxAttemptsByChapter[ca.chapter_id] = ca.exercises_available
    }
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

  const round2 = (n: number) => Math.round(n * 100) / 100

  const sortedChapters = [...chapters].sort(
    (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0),
  )

  // --- columns: Student | Total | per-chapter with maxima in subheaders
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
    ...sortedChapters.map((ch) => {
      const ptsMax = maxPointsByChapter[ch.id]
      const attMax = maxAttemptsByChapter[ch.id]
      return {
        header: `${ch.name ?? "-"}`,
        columns: [
          {
            header: `${t("points")} /${ptsMax ?? "0"}`,
            // eslint-disable-next-line i18next/no-literal-string
            accessorKey: `ch_${ch.id}_points`,
          },
          {
            header: `${t("attempts")} /${attMax ?? "0"}`,
            // eslint-disable-next-line i18next/no-literal-string
            accessorKey: `ch_${ch.id}_attempts`,
            meta: { altBg: true },
          },
        ],
      }
    }),
  ]

  // --- aggregate per-user, per-chapter
  const byUserChapter: Record<string, Record<string, { points: number; attempts: number }>> = {}
  for (const p of user_chapter_progress) {
    const uid = p.user_id
    const chId = p.chapter_id
    if (!byUserChapter[uid]) {
      byUserChapter[uid] = {}
    }
    byUserChapter[uid][chId] = {
      points: round2(typeof p.points_obtained === "number" ? p.points_obtained : 0),
      attempts: typeof p.exercises_attempted === "number" ? p.exercises_attempted : 0,
    }
  }

  // --- totals from same source
  const totalsByUser: Record<string, { total_points: number; total_attempted: number }> = {}
  for (const [uid, chapterMap] of Object.entries(byUserChapter)) {
    let tp = 0
    let ta = 0
    for (const v of Object.values(chapterMap)) {
      tp += v.points
      ta += v.attempts
    }
    totalsByUser[uid] = { total_points: round2(tp), total_attempted: ta }
  }

  // --- rows
  const rows: ProgressRow[] = user_details.map((u) => {
    const totals = totalsByUser[u.user_id] ?? { total_points: 0, total_attempted: 0 }
    const row: ProgressRow = {
      student: formatUserName(u),
      total_points: totals.total_points,
      total_attempted: totals.total_attempted,
    }

    for (const ch of sortedChapters) {
      // eslint-disable-next-line i18next/no-literal-string
      const pointsKey: ChapterCellKey = `ch_${ch.id}_points`
      // eslint-disable-next-line i18next/no-literal-string
      const attemptsKey: ChapterCellKey = `ch_${ch.id}_attempts`
      const cell = byUserChapter[u.user_id]?.[ch.id]
      row[pointsKey] = cell ? cell.points : 0
      row[attemptsKey] = cell ? cell.attempts : 0
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
