import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { Fragment, useContext, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../../contexts/PageContext"
import {
  fetchStudentCountries,
  fetchStudentCountry,
  postStudentCountry,
} from "../../../services/backend"
import SelectField from "../../../shared-module/common/components/InputFields/SelectField"
import Spinner from "../../../shared-module/common/components/Spinner"
import useToastMutation from "../../../shared-module/common/hooks/useToastMutation"
import useUserInfo from "../../../shared-module/common/hooks/useUserInfo"
import { baseTheme } from "../../../shared-module/common/styles"
import { assertNotNullOrUndefined } from "../../../shared-module/common/utils/nullability"

import { countryList } from "./../util/Countries"
import WorldMap from "./worldMap.svg"

const Wrapper = styled.div`
  display: relative;
  height: auto;
  background: #f7f8f9;
  display: grid;
  padding: 2rem 0 1rem 2rem;

  h3 {
    color: ${baseTheme.colors.gray[700]};
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #edf0f2;
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

interface CountryCountPair {
  code: string
  count: number
}

export type MapProps = React.HTMLAttributes<HTMLDivElement> & MapExtraProps

const Map: React.FC<React.PropsWithChildren<React.PropsWithChildren<MapProps>>> = () => {
  let countryCodeCount: CountryCountPair[] = useMemo(() => [], [])

  const [map, setMap] = useState<SVGLineElement | null>(null)
  const { t } = useTranslation()

  const pageState = useContext(PageContext)
  const courseId = pageState.pageData?.course_id
  const courseInstanceId = pageState.instance?.id

  const userInfo = useUserInfo()
  const userId = userInfo.data?.user_id

  const getCountries = useQuery({
    queryKey: [`course-${courseId}-courseInstanceId-${courseInstanceId}-countries`],
    queryFn: () => {
      return fetchStudentCountries(
        assertNotNullOrUndefined(courseId),
        assertNotNullOrUndefined(courseInstanceId),
      )
    },
  })

  const getCountry = useQuery({
    queryKey: [`course-${courseInstanceId}-country`],
    queryFn: () => {
      return fetchStudentCountry(assertNotNullOrUndefined(courseInstanceId))
    },
    enabled: !!courseInstanceId,
  })

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
        getCountry.refetch()
      },
    },
  )

  const isPath = (child: RouteElement): child is SVGLineElement => {
    return child.tagName === "g" || child.tagName === "path"
  }

  useEffect(() => {
    const getMap = async () => {
      const mapElement: SVGLineElement = await getElementBySelectorAsync(".world-map")
      setMap(mapElement)
    }

    getMap()

    const eventHandler = (evt: Event) => {
      const formattedIdentifier = countryCodeCount.map((obj) => obj.code.substring(1))

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
        const text = countryList.find((country) => country.value === formattedSelectedCountryCode)
          ?.label

        const count = countryCodeCount.find((country) => country.code === `.${selectedCountryCode}`)
          ?.count

        if (evt.type === "mouseover") {
          svgElement.innerHTML = `<title style=''>${text} - ${count} student</title>`
        } else if (evt.type === "mouseout") {
          svgElement.innerHTML = ""
        }
      }
    }

    if (map) {
      const children = Array.from(map.children)
      children?.forEach((child: RouteElement) => {
        // HOVER STATE SHOULD ONLY WORK FOR HIGHLIGHTED COUNTRIES....
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
  }, [countryCodeCount, map])

  const handleCountryChange = (event: React.ChangeEvent<HTMLFormElement>) => {
    if (!event.currentTarget.country) {
      return
    }

    const country: string = event.currentTarget.country.value.toLowerCase()
    return uploadStudentCountry.mutate(country)
  }

  let studentCountryAdded = false
  let formattedCountryCodes
  let activeStudentCountry = ""
  let countryTableData

  if (getCountry.isPending) {
    return <Spinner variant={"small"} />
  }

  if (getCountry.isSuccess && getCountry.data) {
    studentCountryAdded = getCountry.data.user_id === userId
    activeStudentCountry = getCountry.data.country_code
  }

  if (getCountries.isSuccess && getCountries.data.length !== 0 && activeStudentCountry) {
    const storedCountryCodes = Object.entries(getCountries.data).map(([key, value]) => ({
      code: `.${key}`,
      count: value,
    }))

    countryCodeCount = [...storedCountryCodes]

    const codes = countryCodeCount.map((item) => item.code)
    formattedCountryCodes = codes.join(",")

    // Logic for generating Popular Countries table
    // Sort table based on countries count (ascending)
    countryTableData = [...countryCodeCount].sort((a, b) => b.count - a.count).slice(0, 6)

    // Check if active user country is in the sorted TableData and if not add it.
    const userCountryCodeCount = countryCodeCount.find(
      (item) => item.code === `.${activeStudentCountry}`,
    )
    const isFoundInSortedArray = countryTableData.find(
      (country) => country.code === `.${activeStudentCountry}`,
    )

    if (!isFoundInSortedArray && userCountryCodeCount) {
      countryTableData = [...countryTableData, userCountryCodeCount]
    }
  }

  return (
    <Fragment>
      <Wrapper>
        {getCountry.isSuccess && studentCountryAdded && (
          <>
            <Fragment>
              <h3>{t("student-in-this-region")}</h3>
              <StyledMap codes={formattedCountryCodes} className="world-map" />
            </Fragment>
          </>
        )}
        {!studentCountryAdded && (
          <>
            <CotentWrapper>
              <h3>{t("add-country-to-map")}</h3>
              <span
                className={css`
                  display: inline-block;
                  color: ${baseTheme.colors.gray[600]};
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
                    background: ${baseTheme.colors.gray[600]};
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
                  color: ${baseTheme.colors.gray[400]};
                  width: 30rem;
                  font-size: 15px;
                  line-height: 120%;
                  padding-bottom: 2.4rem;
                  padding-left: 2px;
                `}
              >
                {t("map-disclaimer")}
              </span>
            </CotentWrapper>
          </>
        )}
      </Wrapper>
      {studentCountryAdded && (
        <table
          className={css`
            width: 100%;
            margin-top: 1rem;
            text-align: left;
            border-collapse: collapse;

            tr {
              border-bottom: 2px solid ${baseTheme.colors.gray[100]};
            }

            th {
              color: ${baseTheme.colors.gray[500]};
              padding: 0.4rem 0;
              font-weight: 600;
              font-size: 18px;
            }

            td {
              color: ${baseTheme.colors.gray[400]};
              padding: 0.4rem 0;
              font-size: 18px;
            }
          `}
        >
          <tr>
            <th>{t("popular-regions")}</th>
            <th>{t("number-of-student")}</th>
          </tr>
          {countryTableData?.map(({ code, count }) => {
            const formattedCode = code.replace(/\./g, "").toUpperCase()
            const country = countryList.find((c) => c.value === formattedCode)?.label
            return (
              <tr key={code}>
                <td>{country}</td>
                <td>{count}</td>
              </tr>
            )
          })}
        </table>
      )}
    </Fragment>
  )
}

export default Map
