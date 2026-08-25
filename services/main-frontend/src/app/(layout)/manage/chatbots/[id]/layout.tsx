"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { getChatbotConfigurationOptions } from "@/generated/api/@tanstack/react-query.generated"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import {
  chatbotCommandCenterRoute,
  manageCourseRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const chatbotQuery = useQuery({
    ...getChatbotConfigurationOptions({
      path: {
        chatbot_configuration_id: assertNotNullOrUndefined(id),
      },
    }),
    enabled: !!id,
  })

  const courseId = chatbotQuery.data?.course_id ?? null
  const courseBreadcrumbInfo = useCourseBreadcrumbInfoQuery(courseId)

  usePageTitle(chatbotQuery.data?.chatbot_name ?? null)

  const chatbotName = chatbotQuery.data?.chatbot_name

  const crumbs = useMemo(() => {
    const chatbotNameCrumb = chatbotName
      ? {
          isLoading: false as const,
          label: chatbotName,
          href: `/manage/chatbots/${id}`,
        }
      : { isLoading: true as const }

    if (courseId === null) {
      return [
        {
          isLoading: false as const,
          label: t("link-text-chatbot-command-center"),
          href: chatbotCommandCenterRoute(),
        },
        chatbotNameCrumb,
      ]
    }
    return [
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
            href: manageCourseRoute(courseId),
          }
        : { isLoading: true as const },
      chatbotNameCrumb,
    ]
  }, [
    id,
    courseId,
    courseBreadcrumbInfo.data?.organization_slug,
    courseBreadcrumbInfo.data?.organization_name,
    courseBreadcrumbInfo.data?.course_name,
    chatbotName,
    t,
  ])

  useRegisterBreadcrumbs({ key: `chatbot:${id}`, order: 20, crumbs })

  return children
}
