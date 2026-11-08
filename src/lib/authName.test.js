import assert from 'node:assert/strict'
import test from 'node:test'
import { nameFromAuthUser, shouldSyncName, NAME_SYNC_WINDOW_MS } from './authName.js'

const user = (meta, created_at = new Date().toISOString()) => ({ user_metadata: meta, created_at })

test('sign-up form names are used as given', () => {
  assert.deepEqual(nameFromAuthUser(user({ first_name: ' Sam ', last_name: 'Nguyen' })), { firstName: 'Sam', lastName: 'Nguyen' })
})

test('first name alone is fine', () => {
  assert.deepEqual(nameFromAuthUser(user({ first_name: 'Sam' })), { firstName: 'Sam', lastName: null })
})

test('Google given and family names', () => {
  assert.deepEqual(nameFromAuthUser(user({ given_name: 'Jo', family_name: 'Lee', full_name: 'Jo Lee' })), { firstName: 'Jo', lastName: 'Lee' })
})

test('a lone Google full name is split on the first space', () => {
  assert.deepEqual(nameFromAuthUser(user({ full_name: 'Mary Jane Watson' })), { firstName: 'Mary', lastName: 'Jane Watson' })
  assert.deepEqual(nameFromAuthUser(user({ name: 'Cher' })), { firstName: 'Cher', lastName: null })
})

test('names are trimmed, squashed and capped at 80', () => {
  const r = nameFromAuthUser(user({ first_name: 'A'.repeat(200), last_name: '  Van   Der  Berg ' }))
  assert.equal(r.firstName.length, 80)
  assert.equal(r.lastName, 'Van Der Berg')
})

test('no name, junk, or non-strings give null', () => {
  assert.equal(nameFromAuthUser(user({})), null)
  assert.equal(nameFromAuthUser(user({ first_name: '   ', full_name: '' })), null)
  assert.equal(nameFromAuthUser(user({ first_name: { x: 1 }, full_name: 42 })), null)
  assert.equal(nameFromAuthUser(null), null)
})

test('a new account with a blank profile gets its name', () => {
  assert.deepEqual(
    shouldSyncName({ user: user({ first_name: 'Sam' }), profile: { first_name: null, last_name: null } }),
    { firstName: 'Sam', lastName: null },
  )
})

test('an existing name is never overwritten', () => {
  assert.equal(shouldSyncName({ user: user({ first_name: 'Sam' }), profile: { first_name: 'Samuel', last_name: null } }), null)
  assert.equal(shouldSyncName({ user: user({ first_name: 'Sam' }), profile: { first_name: null, last_name: 'Nguyen' } }), null)
})

test('an older account that cleared its name stays cleared', () => {
  const old = user({ first_name: 'Sam' }, new Date(Date.now() - NAME_SYNC_WINDOW_MS - 60000).toISOString())
  assert.equal(shouldSyncName({ user: old, profile: { first_name: null, last_name: null } }), null)
})

test('a missing created_at never syncs', () => {
  assert.equal(shouldSyncName({ user: { user_metadata: { first_name: 'Sam' } }, profile: null }), null)
})
