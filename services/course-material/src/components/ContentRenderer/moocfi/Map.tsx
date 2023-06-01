import styled from "@emotion/styled"
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"

import SelectField from "../../../shared-module/components/InputFields/SelectField"

import { countryList } from "./../util/Countries"
import WorldMap from "./worldMap.svg"

const countryClasses = [".fr", ".us", ".fi", ".ng"]
const formattedClasses = countryClasses.join(",")

const Wrapper = styled.div`
  display: relative;
  height: auto;
  background: #ecf0fa;
  display: grid;
  padding: 2rem 0 0 2rem;
  h3 {
    color: #687eaf;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #dde2ee;
    font-weight: 500;
    font-size: 22px;
  }
`

const StyledMap = styled(WorldMap)<string>`
  ${formattedClasses} {
    fill: #374461 !important;
    opacity: 1;
  }
`
export type RouteElement = Element | SVGLineElement

export interface MapExtraProps {
  content?: string
}

export type MapProps = React.HTMLAttributes<HTMLDivElement> & MapExtraProps

const Map: React.FC<React.PropsWithChildren<React.PropsWithChildren<MapProps>>> = () => {
  const studentCountry = []
  const { t } = useTranslation()

  const isPath = (child: RouteElement): child is SVGLineElement => {
    return child.tagName === "g" || child.tagName === "path"
  }

  useEffect(() => {
    const map = document.querySelector(".world-map")

    const eventHandler = (evt: Event) => {
      const formattedIdentifier = countryClasses.map((str) => str.substring(1))

      let svgElement = null
      if (evt.target instanceof Element) {
        svgElement = evt.target
      } else {
        return
      }

      const classListArr: string[] = Array.from(svgElement.classList)
      const parentElementClassList: DOMTokenList | undefined = svgElement.parentElement?.classList
      const parentElementClassListArr: string[] | undefined =
        parentElementClassList && Array.from(parentElementClassList)

      const getCountryCodeFromClassList = classListArr?.pop()
      const getCountryCodeFromParentClassList = parentElementClassListArr?.pop()

      const selectedCountryCode = getCountryCodeFromClassList
        ? getCountryCodeFromClassList
        : getCountryCodeFromParentClassList

      const findCountry = formattedIdentifier.find((code) => code === selectedCountryCode)

      if (svgElement && findCountry) {
        const formattedSelectedCountryCode = selectedCountryCode?.toUpperCase()
        const text = countryList.find(
          (country) => country.value === formattedSelectedCountryCode,
        )?.label

        if (evt.type === "mouseover") {
          svgElement.innerHTML = `<title style=''>${text}</title>`
        } else if (evt.type === "mouseout") {
          svgElement.innerHTML = ""
        }
      }
    }

    if (map !== null) {
      const children = Array.from(map.children)
      children?.forEach((child: RouteElement) => {
        // HOVER SHOULD ONLY WORK FOR HIGHLIGHTED COUNTRIES....
        if (isPath(child)) {
          child.addEventListener("mouseover", eventHandler)
          child.addEventListener("mouseout", eventHandler)

          return () => {
            child.removeEventListener("mouseover", eventHandler)
            child.removeEventListener("mouseout", eventHandler)
          }
        }
      })
    }
  }, [])

  const handleCountryChange = (value: unknown) => {
    return studentCountry.push(value)
  }
  return (
    <Wrapper>
      {!countryClasses ? (
        <>
          <div id="tooltip"></div>
          <SelectField
            id={`country`}
            label={`Please select your country`}
            onChange={(e) => {
              handleCountryChange(e)
            }}
            options={countryList}
            defaultValue={countryList[90].label}
          />
        </>
      ) : (
        <>
          <h3>{t("student-in-this-region")}</h3>
          <StyledMap students={formattedClasses} className="world-map" />
        </>
      )}
    </Wrapper>
  )
}

export default Map
