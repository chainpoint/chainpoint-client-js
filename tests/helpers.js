import { expect } from 'chai'

export function testArrayArg(fn) {
  let emptyArray = () => fn([])
  let notArray = () => fn('not an array')
  expect(emptyArray, 'Did not throw when passed an empty array').to.throw()
  expect(notArray, 'Did not throw when passed a non-array').to.throw()
}
