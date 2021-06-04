import { css } from "@emotion/css"
import ContentRenderer from "./ContentRenderer"
import { CoursePage } from "../services/backend"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import DebugModal from "./DebugModal"
import { useState } from "react"

interface Props {
  data: CoursePage
}

const Page: React.FC<Props> = ({ data }) => {
  // Make data editable so that we can edit it in the debug view
  const [editedData, setEditedData] = useState(data)
  return (
    <>
      <div
        className={css`
          position: absolute;
          top: 10px;
          right: 10px;
        `}
      >
        <DebugModal data={editedData} updateDataOnClose={setEditedData} readOnly={false} />
      </div>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {editedData.title}
      </h1>
      <ContentRenderer data={editedData.content} />
    </>
  )
}

export default Page
