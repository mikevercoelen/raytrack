import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('1234567890', 12)

export function pad (n: number): string {
  return String('0000000' + n).slice(-7)
}

export function generateId(): number {
  const id = nanoid()
  return parseInt(id)
}

export function getArrAverage (arr: number[]): number {
  return arr.reduce((a, c) => a + c, 0) / arr.length
}
