import { css } from "@emotion/css"

const NavContainer: React.FC = ({ children }) => {
  return (
    <div
      className={css`
        flex-grow: 1;
        align-items: center;
      `}
    >
      {children}
    </div>
  )
}

export default NavContainer
