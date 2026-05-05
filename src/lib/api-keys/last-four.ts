/** Returns the last four characters of a secret, padding with bullets if shorter. */
export function lastFour(secret: string): string {
  return secret.slice(-4).padStart(4, "•");
}
