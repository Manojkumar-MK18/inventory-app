import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Gmail SMTP with an app password. Keep sends to reset/verification only (~500/day). */
function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Send a reset email. If SMTP is not configured or sending fails, this does NOT throw —
 * it logs the link so the flow never crashes. Returns true only if the mail was sent.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!smtpConfigured()) {
    console.warn(`[mailer] SMTP not configured. Password reset link for ${to}: ${resetUrl}`);
    return false;
  }
  try {
    await transporter().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: "Reset your password",
      text: `Reset your password using this link (valid 30 minutes):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Reset your password using this link (valid 30 minutes):</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, ignore this email.</p>`,
    });
    return true;
  } catch (e) {
    console.error(`[mailer] Failed to send reset email to ${to}:`, e);
    console.warn(`[mailer] Password reset link for ${to}: ${resetUrl}`);
    return false;
  }
}
