import { css } from "@emotion/css"
import { useQueries, useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ResearchOnCoursesForm from "../components/forms/ResearchOnCoursesForm"
import useUserResearchConsentQuery from "../hooks/useUserResearchConsentQuery"
import { getCourseBreadCrumbInfo } from "../services/backend/courses"
import { getAllResearchConsentAnswersByUserId } from "../services/backend/users"

import Button from "@/shared-module/common/components/Button"

interface Slug {
  name: string
  courseSlug: string
  courseId: string
  orgSlug: string
}

const UserSettings: React.FC<React.PropsWithChildren<Slug>> = () => {
  const { t } = useTranslation()
  const [openResearchForm, setOpenResearchForm] = useState<boolean>(false)
  const getUserConsent = useUserResearchConsentQuery()

  const getAllResearchFormAnswers = useQuery({
    queryKey: [`users-user-research-form-question-answers`],
    queryFn: () => getAllResearchConsentAnswersByUserId(),
  })
  const handleGeneralResearchFormButton = async () => {
    await getUserConsent.refetch()
    setOpenResearchForm(true)
  }

  const handleGeneralResearchFormAfterSubmit = () => {
    setOpenResearchForm(false)
  }

  const allCourseIds = useMemo(() => {
    const data = getAllResearchFormAnswers.data
      ?.map((obj) => obj.course_id)
      .filter((course_id: string, index, currentVal) => currentVal.indexOf(course_id) === index)
    return data ?? []
  }, [getAllResearchFormAnswers.data])

  const breadcrumbQueries =
    allCourseIds &&
    allCourseIds.map((courseId) => {
      return {
        // eslint-disable-next-line i18next/no-literal-string
        queryKey: [`course-${courseId}-breadcrumb-info`, courseId],
        queryFn: () => getCourseBreadCrumbInfo(courseId),
      }
    })
  const courseBreadcrumbInfos = useQueries({ queries: breadcrumbQueries })

  return (
    <>
      <h1>{t("user-settings")}</h1>
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: row;
            padding-top: 30px;
            font-size: 22px;
            line-height: 22px;
            gap: 60px;
          `}
        >
          <div
            className={css`
              width: 400px;
            `}
          >
            {t("title-general-research-consent")}:
          </div>
          <Button size="medium" variant="primary" onClick={handleGeneralResearchFormButton}>
            {t("edit")}
          </Button>
          {openResearchForm && (
            <ResearchOnCoursesForm
              afterSubmit={handleGeneralResearchFormAfterSubmit}
              initialConsentValue={getUserConsent.data?.research_consent}
            />
          )}
        </div>

        {courseBreadcrumbInfos.length !== 0 && (
          <>
            <h2
              className={css`
                padding-top: 20px;
              `}
            >
              {t("title-course-specific-research-consents")}
            </h2>
            <div>
              {courseBreadcrumbInfos.map((course) => {
                return (
                  <div
                    className={css`
                      display: flex;
                      flex-direction: row;
                      padding-top: 30px;
                      font-size: 22px;
                      line-height: 22px;
                      gap: 60px;
                    `}
                    key={course.data?.course_id}
                  >
                    <div
                      className={css`
                        width: 400px;
                      `}
                    >
                      {course.data?.course_name}:
                    </div>
                    <div>
                      <a
                        href={`org/${course.data?.organization_slug}/courses/${course.data?.course_slug}/?show_research_form=1`}
                      >
                        <Button size="medium" variant="primary">
                          {t("edit")}
                        </Button>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default UserSettings
