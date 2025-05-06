import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"

const PointExportButton: React.FC<
  React.PropsWithChildren<{ courseInstanceId: string; courseInstanceName: string }>
> = ({ courseInstanceId, courseInstanceName }) => {
  const { t } = useTranslation()
  return (
    <Button
      variant="secondary"
      size="medium"
      onClick={() =>
        (window.location.href = `/api/v0/main-frontend/course-instances/${courseInstanceId}/export-points`)
      }
      aria-label={`${t("link-export-points")} (${courseInstanceName})`}
    >
      {t("link-export-points")}
    </Button>
  )
}

export default PointExportButton
