import { css } from "@emotion/css"

export interface VisibleBlockWrapperProps {
  blockName: string
}

const VisibleBlockWrapper: React.FC<React.PropsWithChildren<VisibleBlockWrapperProps>> = ({
  blockName,
  children,
}) => {
  return (
    <div
      className={css`
        padding: 1rem 0.5rem;
        padding-top: 0;
        margin: 1rem 0;
        border: 1px solid black;
      `}
    >
      <h2>{blockName}</h2>
      {children}
    </div>
  )
}

export default VisibleBlockWrapper
