type BrevoRecipient = string | { email: string; name?: string }

type SendTransactionalEmailInput = {
  sender: BrevoRecipient
  to: BrevoRecipient[]
  subject: string
  htmlContent: string
  textContent?: string
  messageId?: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} server environment variable.`)
  return value
}

function recipient(value: BrevoRecipient) {
  return typeof value === "string" ? { email: value } : value
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": requiredEnv("BREVO_API_KEY"),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: recipient(input.sender),
      to: input.to.map(recipient),
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      ...(input.messageId ? { headers: { "X-ART-TO-INK-Message-Id": input.messageId } } : {}),
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Brevo transactional email failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  return response.json() as Promise<{ messageId?: string }>
}
