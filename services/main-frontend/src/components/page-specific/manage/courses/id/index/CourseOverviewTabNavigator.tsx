import { css } from "@emotion/css"
import { Paper, Tab, Tabs, Typography } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { withSignedIn } from "../../../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"
import Layout from "../../../../../Layout"
import CourseChangeRequests from "../change-request/CourseChangeRequests"
import CourseCourseInstances from "../course-instances/CourseCourseInstances"
import CourseExercises from "../exercises/CourseExercises"
import CourseFeedback from "../feedback/CourseFeedback"
import CourseLanguageVersionsPage from "../language-versions/CourseLanguageVersions"
import CoursePages from "../pages/CoursePages"
import CourseStatsPage from "../stats/CourseStatsPage"

import CourseOverview from "./CourseOverview"

export interface CourseOverviewTabsProps {
  courseId: string
}

const CourseOverviewTabs: { [key: string]: React.FC<CourseOverviewTabsProps> } = {
  overview: CourseOverview,
  pages: CoursePages,
  feedback: CourseFeedback,
  "change-requests": CourseChangeRequests,
  exercises: CourseExercises,
  "course-instances": CourseCourseInstances,
  "language-versions": CourseLanguageVersionsPage,
  stats: CourseStatsPage,
}

interface CourseOverviewTabNavigatorProps {
  query: SimplifiedUrlQuery<"id">
}

enum Section {
  Overview = "overview",
  Pages = "pages",
  Feedback = "feedback",
  Exercises = "exercises",
  ChangeRequests = "change-requests",
  CourseInstances = "course-instances",
  LanguageVersions = "language-versions",
  Stats = "stats",
}

const CourseOverviewTabNavigator: React.FC<CourseOverviewTabNavigatorProps> = ({ query }) => {
  const [currentTab, setCurrentTab] = useState(Section.Overview)
  const router = useRouter()
  const { t } = useTranslation()
  const courseId = query.id

  const PATHNAME = `/manage/courses/${courseId}`

  useEffect(() => {
    if (router.query.page) {
      // If page is non-existent as Section, we fall back to Overview page
      setCurrentTab(router.query.page[0] as Section)
    }
  }, [router])

  const PageToRender = CourseOverviewTabs[currentTab]
    ? CourseOverviewTabs[currentTab]
    : CourseOverviewTabs[Section.Overview]

  return (
    <Layout navVariant="complex">
      <Paper square>
        <Tabs variant="fullWidth" value={currentTab}>
          {Object.values(Section).map((value) => {
            return (
              <Tab
                key={value}
                value={value}
                label={<Typography>{t(`link-${value}`)}</Typography>}
                onClick={() => {
                  router.push(`${PATHNAME}/${value}`, undefined, { shallow: true })
                }}
              />
            )
          })}
        </Tabs>
      </Paper>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <PageToRender courseId={courseId} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseOverviewTabNavigator)),
)
