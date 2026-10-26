const APP_URL = 'https://calendaby.vercel.app'

/** The text sent with the share sheet. The link fills in the code; the code is spelled out in case the link is not tappable. */
export function inviteMessage(code: string, expiresAt: number, ownerName: string): string {
  const until = new Date(expiresAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return [
    `${ownerName} invited you to share the baby log on Calendaby.`,
    `Open ${APP_URL}/?join=${code} and sign in. Or open ${APP_URL}, go to Profile > Family and enter this code: ${code}`,
    `It only works once, until ${until}.`,
  ].join('\n\n')
}
