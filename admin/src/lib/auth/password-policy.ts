/**
 * The password rule, shared by the first-administrator CLI, the Users
 * module and the account page. Pure, so a form can show it as the user types.
 */

export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_RULE = `At least ${MIN_PASSWORD_LENGTH} characters, with upper and lower case letters and a digit.`;

export function describePasswordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Password must contain both upper and lower case letters.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one digit.";
  }
  return null;
}
