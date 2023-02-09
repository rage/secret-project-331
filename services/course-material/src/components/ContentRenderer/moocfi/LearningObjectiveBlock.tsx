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
import { baseTheme, headingFont } from "../../../shared-module/styles"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

// Restricts the width even further than the centered. Centered still used to get some padding on left and right on mobile screens.
const Wrapper = styled.div`
  margin: 2rem auto;
  max-width: 1000px;
  background: #f0f5f5;
  padding: 1.5rem 2.2rem;
  height: auto;
`
const Header = styled.div`
  text-align: center;
  min-height: 55px;
  display: flex;
  padding: 1rem 0;
  border-bottom: 3px ${baseTheme.colors.green[200]} dashed;

  h2 {
    font-size: 24px;
    font-weight: 500;
    line-height: 1.2;
    color: ${baseTheme.colors.gray[700]};
    display: inline-block;
  }
`
const Content = styled.div`
  padding: 1rem 0;
  background: rgba(229, 224, 241, 0.05);
  display: grid;
  grid-template-columns: 1fr;

  ${respondToOrLarger.md} {
    padding: 1.5rem 2rem 1rem 0;
  }
`
const StyledObjectives = styled.div`
  display: grid;
  width: 100%;
  grid-template-columns: 20px 1fr;
  padding-bottom: 12px;
  span {
    font-family: ${headingFont};
    font-weight: 500;
    margin-left: 15px;
    font-size: 18px;
    line-height: 1.3;
    font-style: normal;
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

  //It is assumed that LearningBlock accepts only list - it can be updated to accept paragraph
  const data = props.data.innerBlocks[0]

  return (
    <BreakFromCentered sidebar={false}>
      <Centered variant="default">
        <Wrapper>
          <Header>
            <h2>{heading}</h2>
          </Header>
          <Content>
            <div>
              {data &&
                data.innerBlocks?.map(({ attributes, clientId }) => (
                  <StyledObjectives key={clientId}>
                    <StyledCheck />
                    <span>{attributes.content}</span>
                  </StyledObjectives>
                ))}
            </div>
          </Content>
        </Wrapper>
      </Centered>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LearningObjectiveSectionBlock)
