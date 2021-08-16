import { css, cx, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import { faBullseye } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"

import Button from "../Button"
import Hamburger from "../Hamburger"

const swingHorizontal = keyframes`
15% {
  transform: translateX(5px);
}

30% {
  transform: translateX(-5px);
}

50% {
  transform: translateX(3px);
}

65% {
  transform: translateX(-3px);
}

80% {
  transform: translateX(2px);
}

100% {
  transform: translateX(0);
}
`

const navbarItems = css`
  height: 90px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  border-bottom: 2px solid #333;
  position: relative;

  h1 {
    margin-bottom: 0;
  }

  @media (max-width: 960px) {
    top: 0;
    width: 100%;
    z-index: 2;
    position: relative;
    display: flex;
    justify-content: flex-end;
  }
`

const navbarLogo = css`
  color: #fff;
  display: flex;
  justify-self: start;
  margin: 0;
  /* margin-left: 20px; */
  cursor: pointer;

  @media (max-width: 960px) {
    position: absolute;
    top: 0;
    left: 0;
    padding-left: 10px;
    transform: translate(50%, 100%);
  }
`

const active = css`
  @media (max-width: 960px) {
    left: 0;
    opacity: 1;
    transition: all 0.5s ease;
  }
`

const navMenu = css`
  display: inline-block;
  grid-gap: 10px;
  list-style: none;
  text-align: center;
  align-items: center;
  /*   width: 100vw; */
  justify-content: end;

  @media (max-width: 960px) {
    display: flex;
    flex-direction: column;
    grid-gap: 0;
    width: 100%;
    height: auto;
    position: absolute;
    top: 105px;
    left: -100%;
    opacity: 1;
    transition: all 0.5s ease;
    padding-left: 0;
    z-index: 99;
    overflow-y: hidden;
  }
`
const navLinks = css`
  color: #333;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  position: relative;
  font-size: 1rem;
  line-height: 1.5rem;
  margin: 0 0.8rem;

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

    @media (max-width: 960px) {
      display: none;
    }
  }

  &:hover {
    text-decoration: none;
    color: #333;

    &:after {
      transform: scaleX(1);
      transform-origin: bottom left;
    }

    @media (max-width: 960px) {
      animation: ${swingHorizontal} 1s ease;
      animation-iteration-count: 1;
      color: #333;
    }
  }

  @media (max-width: 960px) {
    text-align: center;
    padding: 2rem;
    width: 100%;
    display: table;
    color: #333;
    font-weight: 500;
    font-size: 1.2rem;
    margin: 0;
    border-bottom: 2px solid #f1f1f1;
  }
`
const menuIcon = css`
  width: auto;
  height: 15px;
  display: none;
  z-index: 999;

  @media (max-width: 960px) {
    display: block;
    height: auto;
    position: absolute;
    top: 2px;
    right: -20px;
    transform: translate(-100%, 25%);
    font-size: 1.8rem;
    cursor: pointer;
  }
`
const hide = css`
  display: none;
`
const secondaryLink = css`
  display: flex;
  grid-gap: 10px;
  list-style: none;
  text-align: center;
  align-items: center;

  @media (max-width: 960px) {
    display: none;
  }
`

const StyledIcon = styled(FontAwesomeIcon)`
  font-size: 1.8rem;
  color: #333;
`

const Navigation: React.FC = () => {
  const [clicked, setClicked] = useState(false)

  return (
    <div className="wrapper">
      <nav className={cx(navbarItems)}>
        <h1 className={cx(navbarLogo)}>
          <a href="/" aria-label="Kotisivulle" role="button">
            <StyledIcon icon={faBullseye} aria-hidden="true"></StyledIcon>
          </a>
        </h1>
        <div
          className={cx(menuIcon)}
          onClick={() => setClicked(!clicked)}
          role="button"
          aria-label="Avaa valikko"
        >
          <Hamburger />
        </div>
        <ul aria-expanded="true" role="navigation">
          <ol className={clicked ? cx(navMenu, active) : cx(navMenu)}>
            <li className={cx(navLinks)}>Courses</li>
            <li className={cx(navLinks)}>Modules</li>
            <li className={cx(navLinks)}>Mail Template</li>
            <li className={cx(navLinks, hide)}>
              <a> Login Controls</a>
            </li>
            <li className={cx(navLinks, hide)}>
              <Button variant="primary" size="medium">
                Translate
              </Button>
            </li>
          </ol>
        </ul>

        <ul className={cx(secondaryLink)}>
          <li>
            <a> Login Controls</a>
          </li>
          <li>
            <Button variant="primary" size="medium">
              Translate
            </Button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default Navigation
