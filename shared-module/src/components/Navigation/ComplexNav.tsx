import React, { useState } from "react"
import { Link } from "@reach/router"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBullseye, faSearch } from "@fortawesome/free-solid-svg-icons"
import styled from "@emotion/styled"

import Hamburger from "../Hamburger"
import Button from "../Button"
import "./Navbar.css"

const StyledIcon = styled(FontAwesomeIcon)`
  font-size: 1.6rem;
  color: #333;
`

const Navigation: React.FC = (props) => {
  const [clicked, setClicked] = useState(false)

  return (
    <div className="wrapper">
      <nav className="NavbarItems">
        <h1 className="navbar-logo">
          <Link to="/" aria-label="Kotisivulle" role="button">
            <StyledIcon icon={faBullseye} aria-hidden="true"></StyledIcon>
          </Link>
        </h1>
        <div
          className="menu-icon"
          onClick={() => setClicked(!clicked)}
          role="button"
          aria-label="Avaa valikko"
        >
          <Hamburger />
        </div>
        <ul
          aria-expanded='true'
          role="navigation"
        >
          <ol className={clicked ? "nav-menu active" : "nav-menu"}>
          <li className="nav-links">Courses</li>
          <li className="nav-links">Modules</li>
          <li className="nav-links">Mail Template</li>
          <li className="nav-links hide"><a> Login Controls</a></li> 
          <li className="nav-links hide" ><Button variant='primary'>Translate</Button></li>
          </ol>
        </ul>

        <ul className="secondary-link">
          <li><a> Login Controls</a></li> 
          <li><Button variant='primary'>Translate</Button></li>
        </ul>
        
      </nav>
    </div>
  )
}


export default Navigation
