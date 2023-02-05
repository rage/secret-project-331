import styled from "@emotion/styled"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import PageBox from "../../../../shared-module/components/ExerciseList/PageBox"
import Spinner from "../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../shared-module/styles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExercisesInChapter from "./ExercisesInChapter"

const Wrapper = styled.div`
  margin: 4rem 0;

  summary {
    display: unset;
  }

  details {
    transition: all 0.3s ease-in-out;
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
  console.log("data", pageContext.pageData)

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
  }

  return (
    <Wrapper>
      <details>
        <summary>
          <PageBox pageTitle={t("exercises-in-this-chapter")} accordion={true} />
        </summary>
        <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
      </details>
    </Wrapper>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
