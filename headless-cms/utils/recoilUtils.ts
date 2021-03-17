import { atom } from 'recoil'

export const itemWithId = (id) =>
  atom({
    key: `item-${id}`,
    default: {},
  })
