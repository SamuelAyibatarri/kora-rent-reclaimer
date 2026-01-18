export async function sendEmailAlert(
  apiKey: string,
  to: string,
  subject: string,
  body: string
) {
  if (!apiKey || !to) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Kora Reclaimer <alerts@kora-reclaimer.dev>",
      to: [to],
      subject,
      text: body
    })
  });
}
