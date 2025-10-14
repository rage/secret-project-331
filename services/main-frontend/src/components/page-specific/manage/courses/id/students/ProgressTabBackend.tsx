// src/components/page-specific/manage/courses/id/students/ProgressTabBackend.tsx
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/router"
import React, { useMemo } from "react"

import { FloatingHeaderTable } from "./StudentsTableTabs"

import { getPoints } from "@/services/backend/course-instances"
import { fetchCourseInstances } from "@/services/backend/courses"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { roundDown } from "@/shared-module/common/utils/numbers"
import { courseInstanceUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"

type ProgressTabBackendProps = {
  courseInstanceId?: string
  courseId?: string
}

const formatFullName = (first?: string | null, last?: string | null) =>
  `${last ?? ""}${last && first ? ", " : ""}${first ?? "(Missing Name)"}`

export const ProgressTabContent: React.FC<ProgressTabBackendProps> = ({
  courseInstanceId,
  courseId,
}) => {
  const router = useRouter()

  // Inputs
  const instanceIdFromQuery =
    typeof router.query?.instanceId === "string" ? router.query.instanceId : undefined
  const instanceIdDirect = courseInstanceId
  const routeCourseId = typeof router.query?.id === "string" ? router.query.id : undefined
  const effectiveCourseId = courseId ?? routeCourseId

  // Do we need to resolve an instance id from a course id?
  const needResolveInstance = !instanceIdFromQuery && !instanceIdDirect && !!effectiveCourseId

  // 1) Instances query (always call the hook; use `enabled` to actually fetch or not)
  const {
    data: instancesRaw,
    isLoading: isLoadingInstances,
    isError: isErrorInstances,
    error: errorInstances,
  } = useQuery({
    queryKey: ["course-instances-by-course", effectiveCourseId],
    enabled: !!effectiveCourseId && needResolveInstance,
    queryFn: async () => {
      const raw = await fetchCourseInstances(String(effectiveCourseId))
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.course_instances)
            ? raw.course_instances
            : []
      return list.map((it: any) => ({
        id: it?.id ?? it?.course_instance_id ?? it?.instance_id,
        start: it?.start_date ?? it?.starts_at ?? it?.created_at ?? null,
      })) as Array<{ id: string; start: string | null }>
    },
  })

  // Compute the resolved instance id (newest)
  const instanceIdFromCourse = useMemo(() => {
    if (!instancesRaw || !instancesRaw.length) {
      return undefined
    }
    const sorted = [...instancesRaw].sort((a, b) => {
      const aT = a.start ? new Date(a.start).getTime() : 0
      const bT = b.start ? new Date(b.start).getTime() : 0
      return bT - aT
    })
    return sorted[0]?.id
  }, [instancesRaw])

  const effectiveInstanceId = instanceIdFromQuery || instanceIdDirect || instanceIdFromCourse

  // 2) Points query (always call; only fetch once we have an instance id)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["progress-points", effectiveInstanceId],
    enabled: !!effectiveInstanceId,
    queryFn: () => getPoints(String(effectiveInstanceId)),
  })

  // ---- Render states (now safe; all hooks already called) ----
  if (!effectiveInstanceId) {
    if (needResolveInstance) {
      if (isLoadingInstances) {
        return <Spinner variant="medium" />
      }
      if (isErrorInstances) {
        return <ErrorBanner variant="readOnly" error={errorInstances as Error} />
      }
      return (
        <ErrorBanner
          variant="readOnly"
          error={
            new Error(
              "No course instances found for this course. Provide ?instanceId=... or wire the instance picker.",
            )
          }
        />
      )
    }
    return (
      <ErrorBanner
        variant="readOnly"
        error={new Error("Missing course instance id. Provide ?instanceId=...")}
      />
    )
  }

  if (isLoading) {
    return <Spinner variant="medium" />
  }
  if (isError) {
    return <ErrorBanner variant="readOnly" error={error as Error} />
  }
  if (!data) {
    return null
  }

  const instanceTotalPoints = data.chapter_points.reduce((a, c) => a + c.score_total, 0)

  const chapterCols = data.chapter_points.map((ch) => ({
    header: `Chapter ${ch.chapter_number}: ${ch.name}`,
    columns: [
      {
        header: "Points",
        id: `ch_${ch.id}_points`,
        meta: { width: 120, minWidth: 100 },
        cell: ({ row }: any) => {
          const val = row.original.chapterPoints[ch.id] ?? 0
          return `${roundDown(val, 2)}/${ch.score_total}`
        },
      },
    ],
  }))

  const columns: any[] = [
    {
      header: "Student",
      id: "student",
      accessorFn: (row: any) => formatFullName(row.firstName, row.lastName),
      meta: { minWidth: 220, width: 240 },
    },
    {
      header: "User ID",
      id: "userId",
      meta: { minWidth: 120, width: 140 },
      cell: ({ row }: any) => {
        const uid = row.original.userId
        return (
          <Link href={courseInstanceUserStatusSummaryRoute(String(effectiveInstanceId), uid)}>
            {uid}
          </Link>
        )
      },
    },
    { header: "Email", accessorKey: "email", meta: { minWidth: 220, width: 260 } },
    {
      header: "Total Points",
      id: "totalPoints",
      meta: { minWidth: 160, width: 180 },
      cell: ({ row }: any) => {
        const tp = row.original.totalPoints
        const pct = instanceTotalPoints > 0 ? (tp / instanceTotalPoints) * 100 : 0
        return `${roundDown(tp, 2)}/${instanceTotalPoints} (${roundDown(pct, 0)}%)`
      },
    },
    ...chapterCols,
  ]

  const rows = data.users.map((u) => {
    const perChapter = data.user_chapter_points[u.user_id] ?? {}
    const total = Object.values(perChapter).reduce((a: number, b: number) => a + b, 0)
    return {
      firstName: u.first_name,
      lastName: u.last_name,
      userId: u.user_id,
      email: u.email,
      totalPoints: total,
      chapterPoints: perChapter,
    }
  })

  return <FloatingHeaderTable columns={columns} data={rows} colorHeaders colorHeaderUnderline />
}

export default ProgressTabContent
