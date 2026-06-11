import 'server-only'
import { Resend } from 'resend'
import { getSupabaseClient } from '@/lib/db/supabase/client'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function generateAndSendOTP(email: string): Promise<void> {
  const token = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await getSupabaseClient()
    .from('otp_tokens')
    .upsert({ email, token, expires_at: expiresAt })
  if (error) throw new Error(error.message)

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Your Paisa Buddy login code</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  @media (prefers-color-scheme: dark) {
    .email-bg { background-color: #17161A !important; }
    .email-card { background-color: #211F24 !important; }
    .email-text { color: #EDEBEF !important; }
    .email-text-secondary { color: #A8A3AD !important; }
    .email-text-muted { color: #706B77 !important; }
    .email-line { border-color: #322E36 !important; }
    .email-code-bg { background-color: #17161A !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div class="email-bg" style="background-color: #F4F6F2; padding: 32px 16px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 460px; margin: 0 auto;">
      <tr>
        <td style="padding: 0 0 28px; text-align: center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
            <tr>
              <td valign="middle" style="padding-right: 10px;">
                <svg width="38" height="38" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill="#1A936F"/>
                  <path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F"/>
                  <path d="M32 16 L 32 11" stroke="#0F5132" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="32" cy="36" r="22" fill="#E4F1EA" stroke="#1A936F" stroke-width="2.5"/>
                  <circle cx="32" cy="36" r="17" stroke="#1A936F" stroke-width="1.5" stroke-opacity="0.3"/>
                  <circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fill-opacity="0.7"/>
                  <circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fill-opacity="0.7"/>
                  <circle cx="25.5" cy="34" r="2.6" fill="#0F5132"/>
                  <circle cx="38.5" cy="34" r="2.6" fill="#0F5132"/>
                  <path d="M25 41 Q32 47 39 41" stroke="#0F5132" stroke-width="2.6" stroke-linecap="round" fill="none"/>
                </svg>
              </td>
              <td valign="middle">
                <span class="email-text" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.02em; color: #16201A; line-height: 1;">Paisa <span style="color: #1A936F;">Buddy</span></span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-card" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden;">
            <tr>
              <td style="height: 4px; background: linear-gradient(90deg, #0F5132, #1A936F); font-size: 0; line-height: 0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 32px;">
                <p class="email-text" style="margin: 0 0 6px; font-size: 20px; font-weight: 800; color: #16201A; line-height: 1.3;">Your login code</p>
                <p class="email-text-secondary" style="margin: 0 0 28px; font-size: 15px; color: #5C6B62; line-height: 1.5;">Enter this code in the app to sign in to your account.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td class="email-code-bg" style="background-color: #F4F6F2; border-radius: 14px; padding: 24px 20px; text-align: center; cursor: pointer; -webkit-user-select: all; user-select: all;">
                      <span style="font-family: 'SF Mono', 'Menlo', 'Consolas', 'Courier New', monospace; font-weight: 700; font-size: 34px; letter-spacing: 0.35em; color: #0F5132; line-height: 1; white-space: nowrap; -webkit-user-select: all; user-select: all;">${token}</span>
                    </td>
                  </tr>
                </table>
                <p class="email-text-muted" style="margin: 10px 0 0; font-size: 12px; color: #94A199; line-height: 1.5; text-align: center;">
                  Tap the code to select it &nbsp;&middot;&nbsp; Expires in <strong style="color: #5C6B62;">10 minutes</strong>
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 28px 0;">
                  <tr>
                    <td class="email-line" style="border-top: 1px solid #E7ECE5; font-size: 0; line-height: 0; height: 1px;">&nbsp;</td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td valign="top" style="width: 20px; padding-right: 10px; padding-top: 1px;">
                      <svg width="18" height="18" viewBox="0 0 256 256" fill="#94A199" xmlns="http://www.w3.org/2000/svg">
                        <path d="M208,40H48A16,16,0,0,0,32,56V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40ZM128,160a12,12,0,1,1,12-12A12,12,0,0,1,128,160Zm8-72v32a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0Z"/>
                      </svg>
                    </td>
                    <td>
                      <p class="email-text-muted" style="margin: 0; font-size: 12.5px; color: #94A199; line-height: 1.5;">
                        If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 28px 20px 0; text-align: center;">
          <p class="email-text-muted" style="margin: 0 0 4px; font-size: 12px; color: #94A199; line-height: 1.5;">
            Sent by <strong style="color: #5C6B62;">Paisa Buddy</strong> &middot; Track every paisa, effortlessly.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`

  if (process.env.NODE_ENV === 'development') {
    console.log(`\n[OTP] ${email} → ${token}\n`)
    return
  }

  const { error: emailError } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: 'Your Paisa Buddy login code',
    html,
    text: `Your login code is: ${token}\n\nThis code expires in 10 minutes. Do not share it.`,
  })
  if (emailError) throw new Error(emailError.message)
}

export async function verifyOTP(email: string, token: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('otp_tokens')
    .select()
    .eq('email', email)
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return false

  await getSupabaseClient().from('otp_tokens').delete().eq('email', email)
  return true
}
