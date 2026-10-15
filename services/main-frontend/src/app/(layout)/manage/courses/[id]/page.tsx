"use client"

import { redirect, useParams } from "next/navigation"

import { manageCourseOverviewRoute } from "@/shared-module/common/utils/routes"

/** Sends a course's bare management URL to its overview tab. */
export default function CourseManagementIndexPage() {
  const params = useParams<{ id: string }>()
  // During render, not in an effect: a replace landing after hydration would undo a tab picked
  // meanwhile.
  redirect(manageCourseOverviewRoute(params.id))
}
