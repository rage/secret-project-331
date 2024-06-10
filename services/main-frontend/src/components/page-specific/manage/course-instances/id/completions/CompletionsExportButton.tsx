import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface Props {
  courseInstanceId: string
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

const CompletionsExportButton: React.FC<React.PropsWithChildren<Props>> = ({
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  return (
    <StyledLink
      href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/export-completions`}
      // eslint-disable-next-line i18next/no-literal-string
      download={`completions-${courseInstanceId}.csv`}
      aria-label={`${t("link-export-completions")})`}
    >
      {t("link-export-completions")}
    </StyledLink>
  )
}

export default CompletionsExportButton
