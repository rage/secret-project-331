import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchTopLevelPages } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import TopLevelPage from "../../../../shared-module/components/TopLevelPage"
import { headingFont } from "../../../../shared-module/styles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface TopLevelPagesProps {
  courseId: string
}

const Wrapper = styled.div`
  margin: 4rem 0 3rem 0;
`

const TopLevelPages: React.FC<TopLevelPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const getTopLevelPages = useQuery(`courses-${courseId}-top-level-pages`, () =>
    fetchTopLevelPages(courseId),
  )
  return (
    <>
      {getTopLevelPages.isError && (
        <ErrorBanner variant={"readOnly"} error={getTopLevelPages.error} />
      )}
      {(getTopLevelPages.isLoading || getTopLevelPages.isIdle) && <Spinner variant={"medium"} />}
      {getTopLevelPages.isSuccess && (
        <>
          {getTopLevelPages.data && (
            <Wrapper>
              <h2
                className={css`
                  font-family: ${headingFont};
                  font-size: clamp(28px, 3vw, 2.5rem);
                  color: #1a2333;
                  text-align: center;
                  margin-bottom: 1rem;
                `}
              >
                {t("top-level-pages")}
              </h2>
              {getTopLevelPages.data.map((page, index) => (
                <TopLevelPage
                  title={page.title}
                  url={page.url_path}
                  key={page.id}
                  index={Number(index) + 1}
                />
              ))}
            </Wrapper>
          )}
        </>
      )}
    </>
  )
}
export default withErrorBoundary(TopLevelPages)
