import { css, cx } from "@emotion/css"

import { baseTheme, headingFont } from "../../../../../shared-module/styles"

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
          font-family: ${headingFont};
          color: ${highlightColor};
          flex: 2;
          font-size: 2.5em;
          font-weight: bold;
          text-align: center;
        `}
      >
        {highlightText}
      </div>
      <div
        className={css`
          display: flex;
          line-height: 1.3;
          font-size: 1.1rem;
          font-weight: 500;
          flex: 1 0 auto;
          font-family: ${headingFont};
          justify-content: middle;
          text-align: center;
        `}
      >
        {highlightDescription}
      </div>
    </div>
  )
}

export default HighlightItem
