import { CourseMaterialPeerReviewData } from "../../../../shared-module/bindings"

export interface PeerReviewViewProps {
  peer_review_data: CourseMaterialPeerReviewData
}

const PeerReviewView: React.FC<PeerReviewViewProps> = ({ peer_review_data }) => {
  return (
    <div>
      <pre>
        {JSON.stringify(
          peer_review_data.exercise_task_submissions.map((x) => x.data_json),
          undefined,
          2,
        )}
      </pre>
      <pre>
        {JSON.stringify(
          peer_review_data.peer_review_questions.map((x) => x.question),
          undefined,
          2,
        )}
      </pre>
    </div>
  )
}

export default PeerReviewView
