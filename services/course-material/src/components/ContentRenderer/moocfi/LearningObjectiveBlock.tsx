import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import useIsPageChapterFrontPage from "../../../hooks/useIsPageChapterFrontPage"
import Check from "../../../img/checkmark.svg"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../shared-module/components/Centering/Centered"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import { sanitizeCourseMaterialHtml } from "../../../utils/sanitizeCourseMaterialHtml"

// Restricts the width even further than the centered. Centered still used to get some padding on left and right on mobile screens.
const Wrapper = styled.div`
  margin: 2rem auto;
  max-width: 1000px;
  height: auto;
`
const Header = styled.div`
  background: #44827e;
  text-align: center;
  min-height: 55px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem;

  h2 {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    text-transform: uppercase;
    color: #ffffff;
  }
`
const Content = styled.div`
  padding: 2rem 2rem 3rem 2rem;
  background: rgba(229, 224, 241, 0.05);
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 20px;
  column-gap: 5px;
  border-right: 1px solid #e5e0f1;
  border-left: 1px solid #e5e0f1;
  border-bottom: 1px solid #e5e0f1;

  @media (max-width: 767.98px) {
    padding: 1rem 1rem 2rem 1rem;
    grid-template-columns: 1fr;
    row-gap: 25px;
  }
`
const StyledObjectives = styled.div`
  display: grid;
  grid-template-columns: 20px 1fr;
  span {
    margin-left: 15px;
    font-size: 18px;
    line-height: 1.3;
    font-style: normal;
    font-weight: 400;
    color: #535a66;
  }
`
const StyledCheck = styled(Check)`
  margin-top: 8px;
`

interface LearningObjectiveProps {
  title: string
}

const LearningObjectiveSectionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<LearningObjectiveProps>>
> = (props) => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const pageId = pageContext.pageData?.id

  const isPageChapterFrontPageQuery = useIsPageChapterFrontPage(pageId)

  let heading = ""
  if (isPageChapterFrontPageQuery.data !== undefined) {
    heading = isPageChapterFrontPageQuery.data.is_chapter_front_page
      ? t("title-what-youll-learn-in-this-chapter")
      : t("title-what-youll-learn-in-this-page")
  }
  return (
    <BreakFromCentered sidebar={false}>
      <Centered variant="default">
        <Wrapper>
          <Header>
            <h2
              className={css`
                text-transform: uppercase;
              `}
            >
              {heading}
            </h2>
          </Header>
          <Content>
            {props.data.innerBlocks.map(({ attributes, clientId }) => {
              // @ts-expect-error: innerblocks should only by lists
              const values = attributes.values
              const parser = new DOMParser()
              // eslint-disable-next-line i18next/no-literal-string
              const listItem = parser.parseFromString(values, "text/html")
              const children: string[] = [].slice
                .call(listItem.body.childNodes)
                .map(({ innerHTML }) => innerHTML)
              return children.map((childHtml) => (
                <StyledObjectives key={clientId}>
                  <StyledCheck />
                  <span
                    dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(childHtml) }}
                  />
                </StyledObjectives>
              ))
            })}
          </Content>
        </Wrapper>
      </Centered>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LearningObjectiveSectionBlock)
