import test from 'node:test'
import assert from 'node:assert/strict'
import { FOUNDING_CAP, foundingOpen } from './founding.js'

test('cap is 300 paid members', () => {
  assert.equal(FOUNDING_CAP, 300)
})

test('offer is open while fewer than 300 have paid', () => {
  assert.equal(foundingOpen(0), true)
  assert.equal(foundingOpen(1), true)
  assert.equal(foundingOpen(299), true)
})

test('offer closes at the 300th paid member', () => {
  assert.equal(foundingOpen(300), false)
  assert.equal(foundingOpen(301), false)
})

test('signups do not use up places: only the paid count matters', () => {
  // 1,000 trial signups and 12 payments is still open.
  assert.equal(foundingOpen(12), true)
})

test('an unusable count closes the offer rather than guessing', () => {
  assert.equal(foundingOpen(null), false)
  assert.equal(foundingOpen(undefined), false)
  assert.equal(foundingOpen(NaN), false)
  assert.equal(foundingOpen(-1), false)
  assert.equal(foundingOpen('5'), false)
})

test('a custom cap is respected', () => {
  assert.equal(foundingOpen(9, 10), true)
  assert.equal(foundingOpen(10, 10), false)
})
