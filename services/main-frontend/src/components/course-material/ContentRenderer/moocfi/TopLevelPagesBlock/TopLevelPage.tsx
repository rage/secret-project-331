"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchTopLevelPages } from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import TopLevelPage from "@/shared-module/common/components/TopLevelPage"
import { headingFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { coursePageRoute } from "@/utils/course-material/routing"

export interface TopLevelPagesProps {
  courseId: string
}

const Wrapper = styled.div`
  margin-top: 3rem;
  margin-bottom: 4em;
`

const TopLevelPages: React.FC<React.PropsWithChildren<TopLevelPagesProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const getTopLevelPages = useQuery({
    queryKey: [`courses-${courseId}-top-level-pages`],
    queryFn: () =>
      fetchTopLevelPages(courseId).then((pages) =>
        pages.filter((x) => x.url_path !== "/").sort((a, b) => a.order_number - b.order_number),
      ),
  })
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug
  const organizationSlug = params?.organizationSlug
  return (
    <>
      {getTopLevelPages.isError && (
        <ErrorBanner variant={"readOnly"} error={getTopLevelPages.error} />
      )}
      {getTopLevelPages.isLoading && <Spinner variant={"medium"} />}
      {getTopLevelPages.isSuccess && courseSlug && organizationSlug && (
        <>
          {getTopLevelPages.data && (
            <Wrapper>
              <h2
                className={css`
                  font-family: ${headingFont};
                  font-size: clamp(30px, 3.5vw, 46px);
                  font-weight: 700;
                  color: #1a2333;
                  text-align: center;
                  margin-bottom: 1.5rem;
                  opacity: 0.9;
                `}
              >
                {t("information-pages")}
              </h2>
              {getTopLevelPages.data.map((page, index) => {
                const url = coursePageRoute(organizationSlug, courseSlug, page.url_path)
                return (
                  <TopLevelPage
                    title={page.title}
                    url={url}
                    key={page.id}
                    index={Number(index) + 1}
                  />
                )
              })}
            </Wrapper>
          )}
        </>
      )}
    </>
  )
}
export default withErrorBoundary(TopLevelPages)
