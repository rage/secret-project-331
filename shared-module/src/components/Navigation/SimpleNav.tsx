import { cx, css } from "@emotion/css"

const stylednav = css`
  position: absolute;
  background: #f1f1f1;
  color: #333;
  box-shadow: 0 1px rgba(0 0 0 / 0%);
  width: 100%;
  padding: 0px 20px;
  top: 0;
  left: 0;
  vertical-align: top !important;
  height: auto;
  font-size: 15px;
  font-weight: 400;
`
const section = css`
  padding: 0 !important;
  display: table;
  max-width: 1400px;
  margin-right: auto;
  margin-left: auto;
  width: 100%;

  > div {
    display: table-cell;
    vertical-align: middle;
    font-size: 16px;
    height: 50px;
    pointer-events: all;
  }
`
const left = css`
  width: 165px;
  text-align: left !important;
`
const right = css`
  width: 165px;
  text-align: right;
  white-space: nowrap;
`
const menuLink = css`
  padding: 0 15px;
  font-size: 17px;
  font-weight: 500;
  line-height: 70px;
  vertical-align: middle;
  display: inline-block;
  letter-spacing: -0.013em;
  position: relative;
`

const Navigation: React.FC = ({ children }) => {
  return (
    <nav className={cx(stylednav)}>
      <section className={cx(section)}>
        <div className={cx(left)}>Logo</div>
        <div className={cx(right)}>
          <a className={cx(menuLink)}>SVG search icon</a>
          <a className={cx(menuLink)}>Login controls</a>
          <a className={cx(menuLink)}>Button</a>
        </div>
      </section>
    </nav>
  )
}

export default Navigation
