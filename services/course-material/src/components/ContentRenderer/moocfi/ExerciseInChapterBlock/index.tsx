import styled from "@emotion/styled"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"

import ExercisesInChapter from "./ExercisesInChapter"

import AccordionIcon from "@/shared-module/common//img/accordion-arrow.svg"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Wrapper = styled.div`
  margin: 0 0 5rem 0;

  details {
    transition: all 0.3s ease-in-out;
  }

  summary {
    height: 100%;
    border-radius: 2px;
    position: relative;
    padding: 0.6em 1em;
    color: ${baseTheme.colors.gray[600]};
    text-decoration: none;
    background: #f2f5f7;
    margin: 5px 0 5px 0;
    display: flex;
    flex-direction: columns;
    align-items: center;
    list-style: none;
    &:hover {
      background: #edf2f5;
    }
    cursor: pointer;

    span {
      vertical-align: top;
      font-family: ${headingFont};
      font-size: 1.25rem;
      font-weight: 600;
      display: inline-block;
      width: 100%;
      line-height: 150%;
      margin: 0.4em 0 0.4em 0.6em;
    }
  }

  details > summary::marker,
  details > summary::-webkit-details-marker {
    display: none;
  }

  details summary svg {
    color: ${baseTheme.colors.gray[700]};
    line-height: 0;
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
