import { useTranslation } from "react-i18next"

import Button from "../../../../shared-module/common/components/Button"

const PeerReviews = () => {
  const { t } = useTranslation()
  return (
    <div>
      <Button size="medium" variant="primary">
        {t("peer-reviews")}
      </Button>
    </div>
  )
}

export default PeerReviews
