/** The text sent with the share sheet; the code is useless without knowing where to type it. */
export function inviteMessage(code: string, expiresAt: number, ownerName: string): string {
  const until = new Date(expiresAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return [
    `${ownerName} invited you to share the baby log on Calendaby.`,
    `Open https://calendaby.vercel.app, sign in, go to Profile > Family and enter this code: ${code}`,
    `It only works once, until ${until}.`,
  ].join('\n\n')
}
