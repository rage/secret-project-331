import { css, cx } from "@emotion/css"

import { baseTheme } from "../../../../../shared-module/styles"

const highlightItemStyle = css`
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: middle;
  padding: 0 0.5rem;
  text-align: center;
`

// eslint-disable-next-line i18next/no-literal-string
const highlightItemLeftBorder = css`
  border-left: 2px solid ${baseTheme.colors.grey[100]};
`

interface HighlightItemProps {
  highlightColor: string
  highlightDescription: string
  highlightText: string | number
  leftBorder?: boolean
}

const HighlightItem: React.FC<HighlightItemProps> = ({
  highlightColor,
  highlightDescription,
  highlightText,
  leftBorder,
}) => {
  const wrapperClassName = leftBorder
    ? cx(highlightItemStyle, highlightItemLeftBorder)
    : highlightItemStyle
  return (
    <div className={wrapperClassName}>
      <div
        className={css`
          color: ${highlightColor};
          flex: 2;
          font-size: 2em;
          font-weight: bold;
          text-align: center;
        `}
      >
        {highlightText}
      </div>
      <div
        className={css`
          align-items: center;
          display: flex;
          flex: 1 0 auto;
          justify-content: middle;
          padding: 0 0.5rem;
          text-align: center;
        `}
      >
        {highlightDescription}
      </div>
    </div>
  )
}

export default HighlightItem
