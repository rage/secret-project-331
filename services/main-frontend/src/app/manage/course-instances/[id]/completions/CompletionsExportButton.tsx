"use client"

import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { exportCourseInstanceCompletionsCsv } from "@/generated/api/sdk.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { downloadTextFile } from "@/utils/downloadTextFile"

interface Props {
  courseInstanceId: string
}

const COMPLETIONS_CSV_FILE_PREFIX = "completions-"
const CSV_FILE_SUFFIX = ".csv"

// eslint-disable-next-line i18next/no-literal-string
const StyledButton = styled.button`
  border: 2px solid ${baseTheme.colors.blue[300]};
  padding: 0.5rem 1rem;
  background: #fff;
  display: inline-block;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 18px;
  color: ${baseTheme.colors.blue[600]};
  margin-top: 1rem;

  &:hover {
    cursor: pointer;
    background: ${baseTheme.colors.blue[100]};
  }
`

const CompletionsExportButton: React.FC<React.PropsWithChildren<Props>> = ({
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  return (
    <StyledButton
      type="button"
      onClick={() =>
        void exportCourseInstanceCompletionsCsv({
          path: {
            course_instance_id: courseInstanceId,
          },
          throwOnError: true,
        }).then((csv) =>
          downloadTextFile(
            csv,
            `${COMPLETIONS_CSV_FILE_PREFIX}${courseInstanceId}${CSV_FILE_SUFFIX}`,
          ),
        )
      }
      aria-label={`${t("link-export-completions")})`}
    >
      {t("link-export-completions")}
    </StyledButton>
  )
}

export default CompletionsExportButton
