import styled from "@emotion/styled"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import AccordionIcon from "../../../../shared-module//img/accordion-arrow.svg"
import Spinner from "../../../../shared-module/components/Spinner"
import { baseTheme, headingFont } from "../../../../shared-module/styles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExercisesInChapter from "./ExercisesInChapter"

const Wrapper = styled.div`
  margin: 4rem 0;

  details {
    transition: all 0.3s ease-in-out;
  }

  summary {
    height: 100%;
    border-radius: 2px;
    position: relative;
    padding: 0.6em 1em;
    list-style-type: none;
    color: ${baseTheme.colors.gray[600]};
    text-decoration: none;
    background: #f2f5f7;
    margin: 5px 0 5px 0;
    display: flex;
    justify-content: center;

    span {
      vertical-align: top;
      font-family: ${headingFont};
      font-size: clamp(16px, 1vw, 18px);
      font-weight: 600;
      display: inline-block;
      width: 100%;
      margin: 0.4em 0 0.4em 1.2em;
    }
  }

  details summary svg {
    position: absolute;
    color: ${baseTheme.colors.gray[700]};
    line-height: 0;
    top: 25px;
    left: 3%;
    transition: all 200ms linear;
  }
  details[open] summary svg {
    transform: rotate(90deg);
  }
`

const ExerciseInChapterBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<unknown>>
> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  const chapterId = pageContext.pageData.chapter_id
  const courseInstanceId = pageContext.instance?.id

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
  }

  return (
    <Wrapper>
      <details>
        <summary>
          <AccordionIcon />
          <span>{t("exercises-in-this-chapter")}</span>
        </summary>
        <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
      </details>
    </Wrapper>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
