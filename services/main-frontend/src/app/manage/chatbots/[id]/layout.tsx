"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { getChatbotConfiguration } from "@/services/backend/chatbots"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { manageCourseRoute, organizationFrontPageRoute } from "@/shared-module/common/utils/routes"

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()

  const chatbotQuery = useQuery({
    queryKey: ["chatbot", id],
    queryFn: () => getChatbotConfiguration(assertNotNullOrUndefined(id)),
    enabled: !!id,
  })

  const courseId = chatbotQuery.data?.course_id ?? null
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  const crumbs = useMemo(
    () => [
      courseBreadcrumbInfo.data?.organization_name
        ? {
            isLoading: false as const,
            label: courseBreadcrumbInfo.data.organization_name,
            href: organizationFrontPageRoute(courseBreadcrumbInfo.data?.organization_slug ?? ""),
          }
        : { isLoading: true as const },
      courseBreadcrumbInfo.data?.course_name
        ? {
            isLoading: false as const,
            label: courseBreadcrumbInfo.data.course_name,
            href: manageCourseRoute(courseId ?? ""),
          }
        : { isLoading: true as const },
      chatbotQuery.data?.chatbot_name
        ? {
            isLoading: false as const,
            label: chatbotQuery.data.chatbot_name,
            href: `/manage/chatbots/${id}`,
          }
        : { isLoading: true as const },
    ],
    [
      courseBreadcrumbInfo.data?.organization_slug,
      courseBreadcrumbInfo.data?.organization_name,
      courseBreadcrumbInfo.data?.course_name,
      courseId,
      chatbotQuery.data?.chatbot_name,
      id,
    ],
  )

  useRegisterBreadcrumbs({ key: `chatbot:${id}`, order: 20, crumbs })

  return <>{children}</>
}
