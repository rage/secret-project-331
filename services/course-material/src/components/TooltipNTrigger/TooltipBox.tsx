import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import styled from "@emotion/styled"

export const TooltipBox = styled.div`
  border-radius: 8px;
  min-width: 200px;
  max-width: 400px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  background: ${baseTheme.colors.primary[100]};
  border: 1px solid ${baseTheme.colors.clear[300]};
  padding: 10px 14px;
  color: ${baseTheme.colors.gray[700]};
  font-family: ${primaryFont};
  font-size: 14px;
  line-height: 1.5;
`
