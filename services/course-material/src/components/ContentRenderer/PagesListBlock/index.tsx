import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import GenericLoading from "../../GenericLoading"

import PagesInChapter from "./PagesInChapter"

const PagesListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const chapterId = useContext(PageContext)?.chapter_id

  if (chapterId) {
    return (
      <div className={normalWidthCenteredComponentStyles}>
        <PagesInChapter chapterId={chapterId} />
      </div>
    )
  }
  return <GenericLoading />
}

export default PagesListBlock
