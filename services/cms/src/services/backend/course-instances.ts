import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type CourseInstance } from "@/generated/api"
import { z } from "@/generated/api/zod"
import { zCourseInstance } from "@/generated/api/zod.generated"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const response = await cmsClient.get(`/course-instances/${courseInstanceId}`, {
    headers: { "Content-Type": "application/json" },
  })
  return parseCmsResponse(response, zCourseInstance)
}

export const fetchCourseInstances = async (courseId: string): Promise<Array<CourseInstance>> => {
  const response = await cmsClient.get(`/courses/${courseId}/course-instances`, {
    responseType: "json",
  })
  return parseCmsResponse(response, z.array(zCourseInstance))
}
