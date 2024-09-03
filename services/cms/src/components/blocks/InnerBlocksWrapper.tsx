import { css } from "@emotion/css"

const InnerBlocksWrapper: React.FC<React.PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => {
  return (
    <div
      className={css`
        width: 100%;
        border: 1px solid #e2e2e2;
        padding: 1rem;
      `}
    >
      <h4>{title}</h4>
      {children}
    </div>
  )
}

export default InnerBlocksWrapper
