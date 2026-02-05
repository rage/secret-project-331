"use client"

import { redirect } from "next/navigation"

import { manageCourseStatsOverviewRoute } from "@/shared-module/common/utils/routes"

/** Redirects /stats to default stats subtab. */
export default async function StatsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params
  redirect(manageCourseStatsOverviewRoute(courseId))
}
