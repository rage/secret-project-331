import { css, cx } from "@emotion/css"
import { faBullseye } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState } from "react"

import { primaryFont } from "../../utils"
import Hamburger from "../Hamburger"

const StyledIcon = css`
  font-size: 1.8rem;
  color: #333;
`
const NavbarItems = css`
  background: #f9f9f9;
  height: 90px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1rem;
  padding: 0 4rem;
  border-bottom: 2px solid #333;

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

const NavMenu = css`
  display: grid;
  grid-template-columns: repeat(2, auto);
  grid-gap: 10px;
  list-style: none;
  text-align: center;
  align-items: center;
  width: 100vw;
  justify-content: end;
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
const MenuIcon = css`
  display: flex;
`
const ToolTip = css`
  background: #fff;
  border-color: #cacaca;
  top: 100px;
  right: 20px;
  width: auto;
  padding: 0;
  border-radius: 4px;
  position: absolute;
  margin-bottom: 10px;
  margin-left: -95px;
  cursor: default;
  box-shadow: 0 1px 4px rgb(0 0 0 / 15%);
  animation: show 3s ease-in-out forwards;
  z-index: 9001;

  &::after {
    bottom: 100%;
    left: 50%;
    border: solid transparent;
    content: " ";
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
    border-color: rgba(0, 151, 167, 0);
    border-bottom-color: #fff;
    border-width: 12px;
    margin-left: -12px;
  }

  li {
    text-decoration: none;
    padding: 12px 34px;
    border-bottom: 2px solid #e1e1e1;
    list-style: none;
    margin: 0;
    font-family: ${primaryFont};

    &:last-child {
      border-bottom: none;
    }

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

const Navigation: React.FC = () => {
  const [clicked, setClicked] = useState(false)

  const onClickHandler = () => {
    setClicked(!clicked)
  }

  return (
    <nav className={cx(NavbarItems)}>
      <h1 className={cx(NavbarLogo)}>
        <a href="/" aria-label="Kotisivulle" role="button">
          <FontAwesomeIcon
            className={cx(StyledIcon)}
            icon={faBullseye}
            aria-hidden="true"
          ></FontAwesomeIcon>
        </a>
      </h1>
      <ul className={clicked ? cx(NavMenu) : cx(NavMenu)} role="list">
        <li className="container">
          <a className={cx(NavLink)} href="/faq" aria-label="Kurssi valikko" role="button">
            FAQ
          </a>
          <ul className={clicked ? cx(ToolTip) : cx(Hide)}>
            <li>Login controls</li>
            <li>Authors</li>
            <li>License</li>
          </ul>
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
      </ul>
    </nav>
  )
}

export default Navigation
