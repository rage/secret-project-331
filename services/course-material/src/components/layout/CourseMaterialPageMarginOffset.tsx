import { css } from "@emotion/css"

interface CourseMaterialPageMarginOffsetProps {
  marginTop: string
  marginBottom: string
}

export const CourseMaterialPageMarginOffset: React.FC<CourseMaterialPageMarginOffsetProps> = ({
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
