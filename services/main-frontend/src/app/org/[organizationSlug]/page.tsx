"use client"

import { css } from "@emotion/css"
import { useSetAtom } from "jotai"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useEffect, useId } from "react"
import { useTranslation } from "react-i18next"

import useOrganizationQueryBySlug from "@/hooks/useOrganizationQueryBySlug"
import DebugModal from "@/shared-module/common/components/DebugModal"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { manageOrganizationRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"
import { viewParamsAtom } from "@/state/course-material/params"

import CourseList from "./CourseList"
import ExamList from "./ExamList"

const Organization: React.FC = () => {
  const { t } = useTranslation()
  const { organizationSlug } = useParams<{ organizationSlug: string }>()
  const organizationQuery = useOrganizationQueryBySlug(organizationSlug)
  usePageTitle(organizationQuery.data?.name ?? null)
  const setViewParams = useSetAtom(viewParamsAtom)

  useEffect(() => {
    setViewParams(null)
  }, [setViewParams])

  const coursesSectionHeadingId = useId()
  const examsSectionHeadingId = useId()

  return (
    <div>
      <QueryResult query={organizationQuery}>
        {(organization) => (
          <>
            <h1
              className={css`
                font-size: clamp(26px, 3vw, 30px);
                font-weight: 600;
              `}
            >
              {organization.name}
            </h1>
            <OnlyRenderIfPermissions
              action={{
                type: "edit",
              }}
              resource={{
                type: "organization",
                id: organization.id,
              }}
            >
              <Link
                href={manageOrganizationRoute(organization.id)}
                aria-label={`${t("link-manage")}`}
              >
                {t("manage")}
              </Link>
            </OnlyRenderIfPermissions>
            {organization.organization_image_url && (
              <img
                className={css`
                  max-width: 20rem;
                  max-height: 20rem;
                `}
                src={organization.organization_image_url}
                alt={t("image-alt-what-to-display-on-organization")}
              />
            )}
            <section aria-labelledby={coursesSectionHeadingId}>
              <h2
                id={coursesSectionHeadingId}
                className={css`
                  font-size: clamp(26px, 3.6vw, 36px);
                  margin-bottom: 10px;
                `}
              >
                {t("course-list")}
              </h2>
              {/* TODO: Implement perPage dropdown? */}
              <CourseList organizationId={organization.id} organizationSlug={organizationSlug} />
            </section>

            {/* TODO: We should render ExamList once we can filter away exams etc. */}
            <OnlyRenderIfPermissions
              action={{ type: "create_courses_or_exams" }}
              resource={{ id: organization.id, type: "organization" }}
            >
              <section aria-labelledby={examsSectionHeadingId}>
                <h2 id={examsSectionHeadingId}>{t("exam-list")}</h2>
                <ExamList organizationId={organization.id} organizationSlug={organizationSlug} />
              </section>
            </OnlyRenderIfPermissions>
          </>
        )}
      </QueryResult>

      <DebugModal data={organizationQuery.data} />
    </div>
  )
}

export default withErrorBoundary(Organization)
