"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { LINK_QUIET } from "@/components/credit-registration/constants"
import { pageTitleCss } from "@/components/credit-registration/styles"
import AddEmailTemplateDialog from "@/components/email-templates/AddEmailTemplateDialog"
import { getEmailTemplatesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { getCourse as getCourseFromApi } from "@/generated/api/sdk.generated"
import type { Course, EmailTemplate, EmailTemplateType } from "@/generated/api/types.generated"
import { zEmailTemplateType } from "@/generated/api/zod.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { ErrorNotice, Link, LoadingRegion, Table } from "@/shared-module/components"

interface GroupedTemplates {
  templateType: EmailTemplateType
  global: EmailTemplate[]
  courseSpecific: {
    courseId: string
    courseName: string
    templates: EmailTemplate[]
  }[]
}

const TEMPLATE_TYPES = zEmailTemplateType.options

const EmailTemplatesList: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("email-templates-title"))

  const templatesQuery = useQuery({
    ...getEmailTemplatesOptions(),
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
        getCourseFromApi({
          path: {
            course_id: courseId,
          },
        }).then((course) => ({
          courseId,
          course,
        })),
      )
      const results = await Promise.allSettled(coursePromises)
      const fulfilled = results
        .filter(
          (result): result is PromiseFulfilledResult<{ courseId: string; course: Course }> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value)
      return new Map(fulfilled.map(({ courseId, course }) => [courseId, course]))
    },
    enabled: uniqueCourseIds.length > 0 && templatesQuery.isSuccess,
  })

  const groupedTemplates = useMemo<GroupedTemplates[]>(() => {
    if (!templatesQuery.data) {
      return []
    }

    const templates = templatesQuery.data
    const courseMap = coursesQueries.data || new Map<string, Course>()

    return TEMPLATE_TYPES.map((templateType) => {
      const typeTemplates = templates.filter((template) => template.template_type === templateType)

      const global = typeTemplates.filter((template) => !template.course_id)
      const courseSpecific = typeTemplates.filter(
        (template) => template.course_id !== null && template.course_id !== undefined,
      )

      const courseGroups = new Map<string, EmailTemplate[]>()
      courseSpecific.forEach((template) => {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- filtered above to items with non-null course_id
        const courseId = template.course_id!
        if (!courseGroups.has(courseId)) {
          courseGroups.set(courseId, [])
        }
        // oxlint-disable-next-line typescript/no-non-null-assertion -- courseId key was just inserted above when absent
        courseGroups.get(courseId)!.push(template)
      })

      const courseSpecificGrouped = Array.from(courseGroups.entries())
        .map(([courseId, courseTemplates]) => {
          const course = courseMap.get(courseId)
          return {
            courseId,
            courseName: course?.name || courseId,
            templates: courseTemplates,
          }
        })
        .toSorted((a, b) => a.courseName.localeCompare(b.courseName))

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
        case "confirm_email_code":
          return t("email-template-type-confirm-email-code")
        case "generic":
          return t("email-template-type-generic")
        case "credit_registration_account_linking":
          return t("email-template-type-credit-registration-account-linking")
        case "verify_email_address":
          return t("email-template-type-verify-email-address")
        case "credit_registration_action_needed":
          return t("email-template-type-credit-registration-action-needed")
        case "credit_registration_registered":
          return t("email-template-type-credit-registration-registered")
        case "teacher_newsletter":
          return t("email-template-type-teacher-newsletter")
      }
    },
    [t],
  )

  const templateTypeOptions = useMemo(
    () => TEMPLATE_TYPES.map((value) => ({ value, label: getTemplateTypeLabel(value) })),
    [getTemplateTypeLabel],
  )

  const allTemplates = useMemo(() => {
    const templates: {
      template: EmailTemplate
      templateTypeLabel: string
      courseName: string | null
    }[] = []

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

  if (templatesQuery.isError) {
    return <ErrorNotice error={templatesQuery.error} />
  }

  if (templatesQuery.isLoading) {
    return <LoadingRegion />
  }

  if (coursesQueries.isLoading && uniqueCourseIds.length > 0) {
    return <LoadingRegion />
  }

  if (coursesQueries.isError) {
    return <ErrorNotice error={coursesQueries.error} />
  }

  return (
    <div
      className={css`
        max-width: 1400px;
      `}
    >
      <h1
        className={cx(
          pageTitleCss,
          css`
            margin-bottom: var(--space-4);
          `,
        )}
      >
        {t("email-templates-title")}
      </h1>

      <AddEmailTemplateDialog templateTypeOptions={templateTypeOptions} />

      <div
        className={css`
          margin-top: 1rem;
        `}
      >
        <Table
          caption={t("email-templates-title")}
          rows={allTemplates}
          rowKey={({ template }) => template.id}
          rowHover
          columns={[
            {
              header: t("label-template-type"),
              cell: ({ templateTypeLabel }) => templateTypeLabel,
            },
            {
              header: t("label-email-subject"),
              cell: ({ template }) => template.subject || t("email-template-no-subject"),
            },
            {
              header: t("label-language"),
              cell: ({ template }) => template.language || t("email-template-language-default"),
            },
            {
              header: t("label-course") as string,
              cell: ({ courseName }) => courseName || t("email-templates-global"),
            },
            {
              header: t("email-template-last-updated"),
              cell: ({ template }) => dateToString(template.updated_at),
            },
            {
              header: <VisuallyHidden>{t("label-actions")}</VisuallyHidden>,
              cell: ({ template }) => (
                <Link
                  href={`/cms/email-templates/${template.id}/edit`}
                  isCrossService
                  appearance={LINK_QUIET}
                >
                  {t("edit")}
                </Link>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(EmailTemplatesList))
