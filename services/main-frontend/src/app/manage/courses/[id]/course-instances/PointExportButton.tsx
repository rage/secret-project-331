"use client"

import { useTranslation } from "react-i18next"

import { exportCourseInstancePointsCsv } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import { downloadTextFile } from "@/utils/downloadTextFile"

const POINTS_CSV_FILE_SUFFIX = "-points.csv"

const PointExportButton: React.FC<
  React.PropsWithChildren<{ courseInstanceId: string; courseInstanceName: string }>
> = ({ courseInstanceId, courseInstanceName }) => {
  const { t } = useTranslation()
  return (
    <Button
      variant="secondary"
      size="medium"
      onClick={() =>
        void exportCourseInstancePointsCsv({
          path: {
            course_instance_id: courseInstanceId,
          },
        }).then((csv) => downloadTextFile(csv, `${courseInstanceName}${POINTS_CSV_FILE_SUFFIX}`))
      }
      aria-label={`${t("link-export-points")} (${courseInstanceName})`}
    >
      {t("link-export-points")}
    </Button>
  )
}

export default PointExportButton
