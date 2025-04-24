/* eslint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import { CheckCircle, MovementArrowsUpDown, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { forwardRef, InputHTMLAttributes } from "react"
import {
  Autocomplete,
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select,
  SelectValue,
  useFilter,
} from "react-aria-components"

import SearchIcon from "@/shared-module/common/img/search-icon.svg"

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SearchableSelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
  onChangeByValue?: (value: string, name?: string) => void
  className?: string
}

const SearchableSelect = forwardRef<HTMLSelectElement, SearchableSelectProps>(
  ({ label, options, onChangeByValue, error, className, ...rest }) => {
    const { contains } = useFilter({ sensitivity: "base" })

    const handleChange = (key: React.Key) => {
      const value = String(key)
      onChangeByValue?.(value, rest.name)
    }

    return (
      <div
        className={cx(
          css`
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1rem;
          `,
          className,
        )}
      >
        <Select onSelectionChange={handleChange} selectedKey={rest.name}>
          {label && (
            <Label
              className={css`
                font-size: 14px;
                font-weight: 500;
                color: #1a2333;
                cursor: default;
              `}
            >
              {label}
            </Label>
          )}
          <Button
            className={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 12px;
              background: #fff;
              border: 1px solid #ccc;
              border-radius: 6px;
              font-size: 16px;
              cursor: pointer;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            `}
          >
            <SelectValue
              className={css`
                flex: 1;
              `}
            />
            <MovementArrowsUpDown
              className={css`
                width: 1rem;
                height: 1rem;
              `}
            />
          </Button>

          <Popover
            className={css`
              background: white;
              border-radius: 6px;
              border: 1px solid #ccc;
              box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
              max-height: 250px;
              padding: 0.5rem;
              display: flex;
              flex-direction: column;
            `}
          >
            <Autocomplete filter={contains}>
              <SearchField
                aria-label="Search"
                className={css`
                  display: flex;
                  align-items: center;
                  border: 1px solid #d1d5db;
                  border-radius: 9999px;
                  padding: 4px 8px;
                  margin-bottom: 0.5rem;
                `}
              >
                <SearchIcon
                  className={css`
                    width: 1rem;
                    height: 1rem;
                    margin-right: 6px;
                    color: #555;
                  `}
                />
                <Input
                  placeholder="Search..."
                  className={css`
                    flex: 1;
                    border: none;
                    outline: none;
                    font-size: 14px;
                    background: transparent;
                    color: #333;
                  `}
                />
                <Button
                  className={css`
                    background: transparent;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    color: #777;
                  `}
                >
                  <XmarkCircle
                    className={css`
                      width: 1rem;
                      height: 1rem;
                    `}
                  />
                </Button>
              </SearchField>
              <ListBox
                className={css`
                  overflow-y: auto;
                  flex: 1;
                `}
                items={options}
              >
                {(item) => (
                  <ListBoxItem
                    id={item.value}
                    textValue={item.label}
                    isDisabled={item.disabled}
                    className={css`
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      padding: 8px 10px;
                      border-radius: 4px;
                      cursor: ${item.disabled ? "not-allowed" : "pointer"};
                      background: transparent;
                      color: ${item.disabled ? "#ccc" : "#1a2333"};
                      &:focus {
                        background: #1e90ff;
                        color: white;
                      }
                    `}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.label}</span>
                        {isSelected && (
                          <CheckCircle
                            className={css`
                              width: 1rem;
                              height: 1rem;
                              color: #1e90ff;
                            `}
                          />
                        )}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </ListBox>
            </Autocomplete>
          </Popover>
        </Select>
        {error && (
          <span
            className={css`
              color: red;
              font-size: 12px;
              margin-top: 4px;
            `}
          >
            {error}
          </span>
        )}
      </div>
    )
  },
)

SearchableSelect.displayName = "SearchableSelect"

export default SearchableSelect
