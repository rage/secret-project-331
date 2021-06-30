import { useState } from "react"
import { Link } from "@reach/router"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBullseye } from "@fortawesome/free-solid-svg-icons"
import { cx, css } from "@emotion/css"

import Hamburger from "../Hamburger"

const StyledIcon = css`
  font-size: 1.2rem;
  color: #333;
`
const NavbarItems = css`
  height: 90px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1rem;
  padding: 0 6rem;
  border-bottom: 1.8px solid #333;

  h1 {
    width: 165px;
    text-align: left !important;
  }
`
const NavbarLogo = css`
  color: #fff;
  display: flex;
  justify-self: start;
  cursor: pointer;
`

/*ul {
  margin-bottom: 0;
  margin-right: 0 !important;
   CSS Reset
}*/

const NavMenu = css`
  display: grid;
  grid-template-columns: repeat(3, auto);
  grid-gap: 20px;
  list-style: none;
  text-align: center;
  align-items: center;
  width: 100vw;
  justify-content: end;
  margin-right: 2rem;
`
const NavLink = css`
  color: #333;
  font-family: "Josefin Sans", sans-serif;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  position: relative;
  font-size: 1.2rem;
  line-height: 1.5rem;
  margin: 0.5rem 1.5rem;

  &:after {
    content: "";
    position: absolute;
    width: 100%;
    transform: scaleX(0);
    height: 2px;
    bottom: 0;
    left: 0;
    background-color: #333;
    transform-origin: bottom right;
    transition: transform 0.4s cubic-bezier(0.86, 0, 0.07, 1);
  }

  &:hover::after {
    transform: scaleX(1);
    transform-origin: bottom le;
  }

  &:hover {
    transform: scaleX(1);
    transform-origin: bottom left;
  }
`
const NavLinkMobile = css`
  display: none;
`
const MenuIcon = css`
  width: auto;
  height: 30px;
`
const Container = css`
  display: relative;
`
const ToolTip = css`
  background: black;
  /*   display: none; */
  top: 100px;
  right: 42px;
  border-radius: 8px;
  position: absolute;
  padding: 5px 15px;
  margin-bottom: 10px;
  margin-left: -95px;
  cursor: default;
  animation: show 0.4s ease-in-out forwards;

  &:after {
    bottom: 100%;
    left: 50%;
    border: solid transparent;
    content: " ";
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
    border-color: rgba(0, 151, 167, 0);
    border-bottom-color: rgba(255, 255, 255, 0.53);
    border-width: 12px;
    margin-left: -12px;
  }

  li {
    text-decoration: none;
    list-style: none;
    margin: 0;
    /*   padding: 0 10px; */

    Button {
      text-decoration: none;
      list-style: none;
      border: none;
      margin: 0;
      padding: 0;
      font-family: "Josefin Sans", sans-serif;
      font-size: 16px;
    }

    Button:hover {
      color: #333;
      background-color: none;
    }
  }
`

const Hide = css`
  display: none;
`

const Navigation: React.FC = (props) => {
  const [clicked, setClicked] = useState(false)

  const onClickHandler = () => {
    setClicked(!clicked)
  }

  return (
    <nav className={cx(NavbarItems)}>
      <h1 className={cx(NavbarLogo)}>
        <Link to="/" aria-label="Kotisivulle" role="button">
          <FontAwesomeIcon
            className={cx(StyledIcon)}
            icon={faBullseye}
            aria-hidden="true"
          ></FontAwesomeIcon>
        </Link>
      </h1>
      <ul className={clicked ? cx(NavMenu) : cx(NavMenu)} role="list">
        <li className="container">
          <Link className={cx(NavLink)} to="/faq" aria-label="Kurssi valikko" role="button">
            FAQ
          </Link>
          <ul className={clicked ? cx(ToolTip) : cx(Hide)}>Login controls</ul>
        </li>
        <li>
          <div
            className={cx(MenuIcon)}
            onClick={onClickHandler}
            role="button"
            aria-label="Avaa valikko"
          >
            <Hamburger />
          </div>
        </li>
        {/*  <LoginControls /> */}
      </ul>
    </nav>
  )
}

export default Navigation
