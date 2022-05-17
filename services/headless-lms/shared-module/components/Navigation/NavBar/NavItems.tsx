import { css } from "@emotion/css"

const NavItems: React.FC = ({ children }) => {
  return (
    <ul
      className={css`
        display: flex;
        justify-content: flex-end;
        align-items: center;
        list-style: none;
        & > * {
          margin-left: 20px;
        }
      `}
    >
      {children}
    </ul>
  )
}

export default NavItems
