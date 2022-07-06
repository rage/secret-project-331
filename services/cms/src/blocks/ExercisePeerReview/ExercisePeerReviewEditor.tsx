import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import PeerReviewEditor from "../../shared-module/components/PeerReviewEditor"

const ExercisePeerReviewEditor: React.FC<BlockEditProps<Record<string, never>>> = ({
  clientId,
}) => {
  return (
    <div id={clientId}>
      <PeerReviewEditor />
    </div>
  )
}

export default ExercisePeerReviewEditor
