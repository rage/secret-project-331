import { css, cx, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import { faBullseye } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"

import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"
import { runCallbackIfEnterPressed } from "../../utils/accessibility"
import Button from "../Button"
import Hamburger from "../Hamburger"
import LoginControls from "../LoginControls"

import { NavigationProps } from "."

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
  position: relative;
  display: flex;
  height: 90px;
  align-items: center;
  font-size: 1rem;

  padding: 0em 4em;
  background: ${baseTheme.colors.neutral[100]};
  border-bottom: 2px solid #333;
  z-index: 10000;

  h1 {
    margin-bottom: 0;
  }

  justify-content: flex-end;
  top: 0;
  ${respondToOrLarger.lg} {
    justify-content: space-between;
    top: auto;
  }
`

const navbarLogo = css`
  color: ${baseTheme.colors.grey[800]};
  display: flex;
  justify-self: start;
  margin: 0;
  cursor: pointer;
  padding-left: 10px;

  position: absolute;
  top: 0;
  left: 0;
  transform: translate(50%, 100%);
  ${respondToOrLarger.lg} {
    position: static;
    top: auto;
    left: auto;
    transform: none;
  }
`

const active = css`
  left: 0;
  opacity: 1;
  transition: all 0.5s ease;
  ${respondToOrLarger.lg} {
    left: auto;
    transition: all;
  }
`

const navMenu = css`
  display: flex;
  flex-direction: column;
  grid-gap: 0;
  width: 100%;
  height: auto;
  position: absolute;
  top: 90px;
  left: -100%;
  text-align: center;
  align-items: center;
  margin-top: 0;
  transition: all 0.5s ease;
  padding-left: 0;
  z-index: 99;
  overflow-y: hidden;

  justify-content: end;
  background: ${baseTheme.colors.neutral[100]};

  ${respondToOrLarger.lg} {
    display: inline-block;
    grid-gap: 10px;
    list-style: none;
    margin-top: 1em;
    width: auto;
    position: static;
    top: auto;
    left: auto;
    transition: none;
  }
`
const navLinks = css`
  color: ${baseTheme.colors.grey[800]};
  text-decoration: none;
  position: relative;
  line-height: 1.5rem;
  font-size: 1rem;
  text-align: center;

  &:after {
    content: "";
    position: absolute;
    width: 100%;
    transform: scaleX(0);
    height: 2px;
    bottom: 0;
    left: 0;
    background-color: ${baseTheme.colors.grey[800]};
    transform-origin: bottom right;
    transition: transform 0.4s cubic-bezier(0.86, 0, 0.07, 1);

    display: none;
    ${respondToOrLarger.lg} {
      display: inline-block;
    }
  }

  &:hover {
    text-decoration: none;
    color: ${baseTheme.colors.grey[800]};

    &:after {
      transform: scaleX(1);
      transform-origin: bottom left;
    }
    animation: ${swingHorizontal} 1s ease;
    animation-iteration-count: 1;
    ${respondToOrLarger.lg} {
      animation: none 0 ease;
    }
  }

  font-weight: 500;
  margin: 0;
  width: 100%;
  padding: 2rem;
  display: table;
  border-bottom: 2px solid #f1f1f1;
  ${respondToOrLarger.lg} {
    font-weight: 600;
    margin: 0 0.8rem;
    width: auto;
    padding: 0;
    display: inline-block;
    border-bottom: 0;
  }
`
const menuIcon = css`
  font-size: 1.8rem;
  z-index: 999;
  cursor: pointer;
  height: auto;

  display: block;
  transform: translate(-100%, 25%);
  position: absolute;
  top: 2px;
  right: -20px;
  ${respondToOrLarger.lg} {
    display: none;
    height: 15px;
    position: static;
    top: auto;
    right: auto;
    transform: none;
  }
`
const hide = css`
  ${respondToOrLarger.lg} {
    display: none;
  }
`
const secondaryLink = css`
  display: none;
  grid-gap: 10px;
  list-style: none;
  text-align: center;
  align-items: center;
  ${respondToOrLarger.lg} {
    display: flex;
  }
`

const StyledIcon = styled(FontAwesomeIcon)`
  font-size: 1.8rem;
  color: ${baseTheme.colors.grey[800]};
`

const Navigation: React.FC<NavigationProps> = ({ returnToPath }) => {
  const [clicked, setClicked] = useState(false)
  const callback = () => setClicked(!clicked)
  return (
    <div className="wrapper">
      <nav className={cx(navbarItems)}>
        <div className={cx(navbarLogo)}>
          <a href="/" aria-label="Home page" role="button">
            <StyledIcon icon={faBullseye} aria-label="Front page" aria-hidden="true"></StyledIcon>
          </a>
        </div>
        <div
          className={cx(menuIcon)}
          onClick={callback}
          onKeyDown={(e) => runCallbackIfEnterPressed(e, callback)}
          tabIndex={0}
          role="button"
          aria-label="Open menu"
        >
          <Hamburger />
        </div>

        <ol className={clicked ? cx(navMenu, active) : cx(navMenu)}>
          <li className={cx(navLinks)}>Courses</li>
          <li className={cx(navLinks)}>Modules</li>
          <li className={cx(navLinks)}>Mail Template</li>
          <LoginControls styles={[navLinks, hide]} returnToPath={returnToPath} />
          <li className={cx(navLinks, hide)}>
            <Button variant="primary" size="medium">
              Translate
            </Button>
          </li>
        </ol>

        <div className={cx(secondaryLink)}>
          <LoginControls styles={[secondaryLink]} returnToPath={returnToPath} />
          <div>
            <Button variant="primary" size="medium">
              Translate
            </Button>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default Navigation
