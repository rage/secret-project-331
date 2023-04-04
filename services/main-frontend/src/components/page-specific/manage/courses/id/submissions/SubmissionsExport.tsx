//copy-paste from /main-frontend/src/components/page-specific/manage/course-instances/id/completions/CompletionsExportButton.tsx
// refactor?
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../../../shared-module/styles"

interface Props {
  courseId: string
}

// eslint-disable-next-line i18next/no-literal-string
const StyledLink = styled.a`
  border: 2px solid ${baseTheme.colors.blue[300]};
  padding: 0.5rem 1rem;
  background: #fff;
  display: inline-block;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  font-size: 18px;
  color: ${baseTheme.colors.blue[600]};
  margin-top: 1rem;

  &:hover {
    cursor: pointer;
    background: ${baseTheme.colors.blue[100]};
  }
`

const SubmissionsExportButton: React.FC<React.PropsWithChildren<Props>> = ({ courseId }) => {
  const { t } = useTranslation()
  return (
    <StyledLink
      href={`/api/v0/main-frontend/courses/${courseId}/export-submissions`}
      // eslint-disable-next-line i18next/no-literal-string
      //download={`submissions-${courseId}.csv`}
      aria-label={`${t("link-export-submissions")})`}
    >
      {t("link-export-submissions")}
    </StyledLink>
  )
}

export default SubmissionsExportButton
