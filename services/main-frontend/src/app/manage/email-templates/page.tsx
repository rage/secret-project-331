"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getCourse } from "@/services/backend/courses"
import { fetchAllEmailTemplates } from "@/services/backend/email-templates"
import { Course, EmailTemplate, EmailTemplateType } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface GroupedTemplates {
  templateType: EmailTemplateType
  global: EmailTemplate[]
  courseSpecific: Array<{
    courseId: string
    courseName: string
    templates: EmailTemplate[]
  }>
}

const EmailTemplatesList: React.FC = () => {
  const { t } = useTranslation()

  const templatesQuery = useQuery({
    queryKey: ["all-email-templates"],
    queryFn: () => fetchAllEmailTemplates(),
  })

  const uniqueCourseIds = useMemo(() => {
    if (!templatesQuery.data) {
      return []
    }
    return Array.from(
      new Set(
        templatesQuery.data
          .map((template) => template.course_id)
          .filter((courseId): courseId is string => courseId !== null && courseId !== undefined),
      ),
    )
  }, [templatesQuery.data])

  const coursesQueries = useQuery({
    queryKey: ["courses", uniqueCourseIds],
    queryFn: async () => {
      const coursePromises = uniqueCourseIds.map((courseId) =>
        getCourse(courseId).then((course) => ({ courseId, course })),
      )
      const results = await Promise.all(coursePromises)
      return new Map(results.map(({ courseId, course }) => [courseId, course]))
    },
    enabled: uniqueCourseIds.length > 0 && templatesQuery.isSuccess,
  })

  const groupedTemplates = useMemo<GroupedTemplates[]>(() => {
    if (!templatesQuery.data) {
      return []
    }

    const templates = templatesQuery.data
    const courseMap = coursesQueries.data || new Map<string, Course>()

    const templateTypes: EmailTemplateType[] = [
      // eslint-disable-next-line i18next/no-literal-string
      "reset_password_email",
      // eslint-disable-next-line i18next/no-literal-string
      "delete_user_email",
      // eslint-disable-next-line i18next/no-literal-string
      "generic",
    ]

    return templateTypes.map((templateType) => {
      const typeTemplates = templates.filter((t) => t.template_type === templateType)

      const global = typeTemplates.filter((t) => !t.course_id)
      const courseSpecific = typeTemplates.filter(
        (t) => t.course_id !== null && t.course_id !== undefined,
      )

      const courseGroups = new Map<string, EmailTemplate[]>()
      courseSpecific.forEach((template) => {
        const courseId = template.course_id!
        if (!courseGroups.has(courseId)) {
          courseGroups.set(courseId, [])
        }
        courseGroups.get(courseId)!.push(template)
      })

      const courseSpecificGrouped = Array.from(courseGroups.entries())
        .map(([courseId, templates]) => {
          const course = courseMap.get(courseId)
          return {
            courseId,
            courseName: course?.name || courseId,
            templates,
          }
        })
        .sort((a, b) => a.courseName.localeCompare(b.courseName))

      return {
        templateType,
        global,
        courseSpecific: courseSpecificGrouped,
      }
    })
  }, [templatesQuery.data, coursesQueries.data])

  const getTemplateTypeLabel = React.useCallback(
    (type: EmailTemplateType): string => {
      switch (type) {
        case "reset_password_email":
          return t("email-template-type-reset-password-email")
        case "delete_user_email":
          return t("email-template-type-delete-user-email")
        case "generic":
          return t("email-template-type-generic")
      }
    },
    [t],
  )

  const allTemplates = useMemo(() => {
    const templates: Array<{
      template: EmailTemplate
      templateTypeLabel: string
      courseName: string | null
    }> = []

    groupedTemplates.forEach((group) => {
      group.global.forEach((template) => {
        templates.push({
          template,
          templateTypeLabel: getTemplateTypeLabel(group.templateType),
          courseName: null,
        })
      })
      group.courseSpecific.forEach((courseGroup) => {
        courseGroup.templates.forEach((template) => {
          templates.push({
            template,
            templateTypeLabel: getTemplateTypeLabel(group.templateType),
            courseName: courseGroup.courseName,
          })
        })
      })
    })

    return templates
  }, [groupedTemplates, getTemplateTypeLabel])

  const formatDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date
    return d.toLocaleDateString()
  }

  if (templatesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={templatesQuery.error} />
  }

  if (templatesQuery.isLoading) {
    return <Spinner variant={"medium"} />
  }

  if (coursesQueries.isLoading && uniqueCourseIds.length > 0) {
    return <Spinner variant={"medium"} />
  }

  if (coursesQueries.isError) {
    return <ErrorBanner variant={"readOnly"} error={coursesQueries.error} />
  }

  return (
    <div
      className={css`
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      `}
    >
      <h1
        className={css`
          margin-bottom: 2rem;
          font-size: 2rem;
          font-weight: 600;
        `}
      >
        {t("email-templates-title")}
      </h1>

      <div
        className={css`
          overflow-x: auto;
        `}
      >
        <table
          className={css`
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;

            th,
            td {
              padding: 0.75rem;
              text-align: left;
              border-bottom: 1px solid ${baseTheme.colors.clear[300]};
            }

            th {
              background-color: ${baseTheme.colors.clear[100]};
              font-weight: 600;
              position: sticky;
              top: 0;
            }

            tr:hover {
              background-color: ${baseTheme.colors.clear[200]};
            }

            td {
              vertical-align: top;
            }
          `}
        >
          <thead>
            <tr>
              <th>{t("label-template-type")}</th>
              <th>{t("label-email-subject")}</th>
              <th>{t("label-language")}</th>
              <th>{t("label-course") as string}</th>
              <th>{t("email-template-last-updated")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allTemplates.map(({ template, templateTypeLabel, courseName }) => (
              <tr key={template.id}>
                <td>{templateTypeLabel}</td>
                <td>{template.subject || t("email-template-no-subject")}</td>
                <td>{template.language || t("email-template-language-default")}</td>
                <td>{courseName || t("email-templates-global")}</td>
                <td>{formatDate(template.updated_at)}</td>
                <td>
                  <Link
                    href={`/cms/email-templates/${template.id}/edit`}
                    className={css`
                      color: ${baseTheme.colors.blue[600]};
                      text-decoration: none;
                      font-weight: 500;

                      &:hover {
                        text-decoration: underline;
                      }
                    `}
                  >
                    {t("edit")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(EmailTemplatesList))
