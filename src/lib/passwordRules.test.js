import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES_ERROR,
  isPasswordRuleError,
  passwordProblem,
} from './passwordRules.js'

test('the minimum matches the Supabase setting (10)', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10)
})

test('a password with every character type and enough length passes', () => {
  assert.equal(passwordProblem('Blue-Pool-42x'), '')
  assert.equal(passwordProblem('Aa1!aaaaaa'), '')
})

test('each missing rule is rejected with the same plain message', () => {
  for (const pw of [
    'Aa1!aaaaa',      // 9 characters
    'blue-pool-42x',  // no upper case
    'BLUE-POOL-42X',  // no lower case
    'Blue-Pool-Xxx',  // no digit
    'BluePool42xyz',  // no symbol
    '',
    undefined,
    null,
  ]) {
    assert.equal(passwordProblem(pw), PASSWORD_RULES_ERROR, String(pw))
  }
})

test('a space or punctuation counts as the symbol', () => {
  assert.equal(passwordProblem('Blue pool 42x'), '')
  assert.equal(passwordProblem('Blue_pool_42x'), '')
})

test('recognises Supabase password-rule errors but not other failures', () => {
  assert.ok(isPasswordRuleError({ code: 'weak_password', message: 'x' }))
  assert.ok(isPasswordRuleError({ message: 'Password should be at least 10 characters.' }))
  assert.ok(isPasswordRuleError({ message: 'Password should contain at least one character of each: abc, ABC, 012, !@#' }))
  assert.ok(isPasswordRuleError({ message: 'Password is known to be weak and easy to guess, please choose a different one.' }))
  assert.ok(!isPasswordRuleError({ message: 'Invalid login credentials' }))
  assert.ok(!isPasswordRuleError({ message: 'User already registered' }))
  assert.ok(!isPasswordRuleError(null))
})
