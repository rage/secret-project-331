import { t } from "i18next"

import Button from "../../../../shared-module/components/Button"

const PeerReviews = () => {
  return (
    <div>
      <a href={`/cms/peer-reviews/${peerReview.id}`}>
        <Button>{t("edit-default-peer-review")}</Button>
      </a>
    </div>
  )
}

export default PeerReviews
