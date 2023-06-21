import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../../contexts/PageContext"
import { fetchStudentCountries, postStudentCountry } from "../../../services/backend"
import SelectField from "../../../shared-module/components/InputFields/SelectField"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import useUserInfo from "../../../shared-module/hooks/useUserInfo"
import { assertNotNullOrUndefined } from "../../../shared-module/utils/nullability"

import { countryList } from "./../util/Countries"
import WorldMap from "./worldMap.svg"

const Wrapper = styled.div`
  display: relative;
  height: auto;
  background: #ecf0fa;
  display: grid;
  padding: 2rem 0 1rem 2rem;
  h3 {
    color: #687eaf;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #dde2ee;
    font-weight: 500;
    font-size: 22px;
  }
`

const CotentWrapper = styled.div`
  padding-right: 20px;

  h3 {
    margin-bottom: 10px;
  }
`

const StyledForm = styled.form`
  display: flex;
`

const StyledMap = styled(WorldMap)`
  ${({ codes }) => codes} {
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
  let countryCodes: string[] = useMemo(() => [".fi", ".us"], [])
  const { t } = useTranslation()

  const pageState = useContext(PageContext)
  const courseId = pageState.pageData?.course_id
  const courseInstanceId = pageState.instance?.id

  const userInfo = useUserInfo()
  const userId = userInfo.data?.user_id

  // change to nullish hook
  const getCountries = useQuery(
    [`course-${courseId}-country`],
    () => {
      return fetchStudentCountries(assertNotNullOrUndefined(courseId))
    },
    { enabled: !!courseId },
  )

  const getElementBySelectorAsync = (selector: string): Promise<SVGLineElement> =>
    new Promise((resolve) => {
      const getElement = () => {
        const element: SVGLineElement | null = document.querySelector(selector)
        if (element) {
          resolve(element)
        } else {
          requestAnimationFrame(getElement)
        }
      }
      getElement()
    })

  const uploadStudentCountry = useToastMutation(
    (country: string) => {
      if (!country) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("Student country undefined")
      }

      if (!courseId) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("Course Id undefined")
      }

      if (!courseInstanceId) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("Course instance id undefined")
      }

      return postStudentCountry(courseId, courseInstanceId, country)
    },
    {
      notify: true,
      successMessage: t("country-added-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        getCountries.refetch()
      },
    },
  )

  const isPath = (child: RouteElement): child is SVGLineElement => {
    return child.tagName === "g" || child.tagName === "path"
  }

  const [map, setMap] = useState<SVGLineElement | null>(null)

  useEffect(() => {
    const getMap = async () => {
      const mapElement: SVGLineElement = await getElementBySelectorAsync(".world-map")
      setMap(mapElement)
    }

    getMap()

    const eventHandler = (evt: Event) => {
      const formattedIdentifier = countryCodes.map((str) => str.substring(1))

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

    if (map) {
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
  }, [countryCodes, map])

  const handleCountryChange = (event: React.ChangeEvent<HTMLFormElement>) => {
    if (!event.currentTarget.country) {
      return
    }

    const country: string = event.currentTarget.country.value.toLowerCase()
    return uploadStudentCountry.mutate(country)
  }

  let studentCountryAdded = false
  let formattedCountryCodes

  if (getCountries.isSuccess && getCountries.data.length !== 0) {
    studentCountryAdded = getCountries.data.some((country) => country.user_id === userId)
    const storedCountryCodes = getCountries.data.map((country) => `.${country.country_code}`)
    countryCodes = [...countryCodes, ...new Set(storedCountryCodes)]
    formattedCountryCodes = countryCodes.join(",")
  }

  return (
    <Wrapper>
      {!studentCountryAdded ? (
        <>
          <CotentWrapper>
            <h3>{t("add-country-to-map")}</h3>
            <span
              className={css`
                display: inline-block;
                color: #374461;
                width: 40rem;
                font-size: 18px;
                line-height: 120%;
                padding: 0.5rem 0 1rem 0;
                line-height: 130%;
                opacity: 0.8;
              `}
            >
              {t("map-instruction")}
            </span>
            <StyledForm
              onSubmit={handleCountryChange}
              className={css`
                input[type="submit"] {
                  border: none;
                  color: #fff;
                  cursor: pointer;
                  width: 100px;
                  font-size: 17px;
                  padding: 8px 10px 10px 10px;
                  transition: background 0.2s ease-in-out;
                  background: #374461;
                  margin: auto 0 1rem 15px;
                  border: 1px solid #374461;
                }
              `}
            >
              <SelectField
                id={`country`}
                label={`Country`}
                onChange={() => null}
                options={countryList}
                defaultValue={countryList[90].label}
              />
              <input type="submit" value={t("submit")} />
            </StyledForm>
            <span
              className={css`
                display: inline-block;
                color: #878d9d;
                width: 30rem;
                font-size: 15px;
                line-height: 120%;
                padding-bottom: 2.4rem;
                padding-left: 2px;
              `}
            >
              {t("use-of-info")}
            </span>
          </CotentWrapper>
        </>
      ) : (
        <>
          <h3>{t("student-in-this-region")}</h3>
          <StyledMap codes={formattedCountryCodes} className="world-map" />
        </>
      )}
    </Wrapper>
  )
}

export default Map
