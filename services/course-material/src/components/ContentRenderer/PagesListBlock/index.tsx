import React, { useContext } from "react"
import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import GenericLoading from "../../GenericLoading"
import PagesInChapter from "./PagesInChapter"

const PagesListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const chapterId = useContext(PageContext)?.chapter_id

  if (chapterId) {
    return <PagesInChapter chapterId={chapterId} />
  }
  return <GenericLoading />
}

export default PagesListBlock
