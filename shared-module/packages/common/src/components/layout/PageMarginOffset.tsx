import { css } from "@emotion/css"

interface PageMarginOffsetProps {
  marginTop: string
  marginBottom: string
}

export const PageMarginOffset: React.FC<React.PropsWithChildren<PageMarginOffsetProps>> = ({
  marginBottom,
  marginTop,
  children,
}) => {
  return (
    <div
      className={css`
        margin-top: ${marginTop};
        margin-bottom: ${marginBottom};
      `}
    >
      {children}
    </div>
  )
}
