function validateLogin(input) {
  const value = {};
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value, errors: { body: 'Login data must be an object' } };
  }

  for (const field of Object.keys(input)) {
    if (field !== 'username' && field !== 'password') errors[field] = 'Field is not allowed';
  }
  if (typeof input.username !== 'string' || !input.username.trim()) {
    errors.username = 'Username is required';
  } else {
    value.username = input.username.trim().toLowerCase();
  }
  if (typeof input.password !== 'string' || !input.password.length) {
    errors.password = 'Password is required';
  } else if (Buffer.byteLength(input.password, 'utf8') > 72) {
    errors.password = 'Password must be at most 72 bytes';
  } else {
    // Do not normalize passwords: compare exactly what the user entered.
    value.password = input.password;
  }

  return { value, errors };
}

module.exports = { validateLogin };
