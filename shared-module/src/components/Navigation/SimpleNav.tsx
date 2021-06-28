import { cx, css } from "@emotion/css"

const stylednav = css`
  position: absolute;
  background: red;
  color: #fff;
  box-shadow: 0 1px rgba(0 0 0 / 0%);
  width: 100%;
  padding: 0px 20px;
  top: 0;
  left: 0;
  vertical-align: top !important;
  height: 70px;
  font-size: 15px;
  font-weight: 400;
`
const section = css`
  padding: 0;
  display: table;
  max-width: 1400px;

  > div {
    display: table-cell;
    vertical-align: middle;
    font-size: 16px;
    height: 50px;
  }
`
const left = css`
  width: 165px;
  text-align: left !important;
`
const center = css`
  width: 70%;
  text-align: center;
`
const right = css`
  width: 165px;
  text-align: right;
  white-space: nowrap;
`

const Navigation: React.FC = ({ children }) => {
  return (
    <nav className={cx(stylednav)}>
      <section className={cx(section)}>
        <div className={cx(left)}>{children}</div>
        <div className={cx(center)}>
          <ul>
            <li>Courses</li>
            <li>Modules</li>
            <li>Email Template</li>
          </ul>
        </div>
        <div className={cx(right)}>
          <ul>
            <li>
              <a>SVG search icon</a>
            </li>
            <li>
              <a>SVG search icon</a>
            </li>
            <li>Translation button</li>
          </ul>
        </div>
      </section>
    </nav>
  )
}

export default Navigation
