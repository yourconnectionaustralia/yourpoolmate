// Password rules for sign-up and password change.
//
// These MUST match Supabase Auth > Sign In / Providers > Email:
//   minimum length 10, and the "lowercase, uppercase, digits and symbols"
//   requirement. Supabase enforces them for real; this file only lets the form
//   say so before the round trip, in words a pool owner can act on.
//
// The symbol test accepts any character that isn't a letter or digit. That is
// deliberately a little wider than Supabase's own symbol list: if the two ever
// disagree the server still has the final say and friendlyAuthError() turns its
// reply into the same plain message.

export const MIN_PASSWORD_LENGTH = 10

export const PASSWORD_RULES_HINT =
  `At least ${MIN_PASSWORD_LENGTH} characters, with upper and lower case letters, a number and a symbol.`

export const PASSWORD_RULES_ERROR =
  `Your password needs at least ${MIN_PASSWORD_LENGTH} characters, with upper and lower case letters, a number and a symbol (like ! or ?).`

// Returns '' when the password is fine, otherwise the message to show.
export function passwordProblem(password) {
  const pw = typeof password === 'string' ? password : ''
  if (
    pw.length < MIN_PASSWORD_LENGTH ||
    !/[a-z]/.test(pw) ||
    !/[A-Z]/.test(pw) ||
    !/[0-9]/.test(pw) ||
    !/[^A-Za-z0-9]/.test(pw)
  ) {
    return PASSWORD_RULES_ERROR
  }
  return ''
}

// True when a Supabase auth error is about the password rules (length,
// character types) or the leaked-password check.
export function isPasswordRuleError(error) {
  const raw = error?.message || ''
  const code = error?.code || ''
  return (
    code === 'weak_password' ||
    (/password/i.test(raw) && /at least|should be|should contain|characters|weak|easy to guess|known to be/i.test(raw))
  )
}
