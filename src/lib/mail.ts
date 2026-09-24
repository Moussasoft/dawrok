// Envoi d'e-mails : SMTP (SMTP_URL) ou API Resend (RESEND_API_KEY).
// Sans fournisseur : affichage dans la console en développement, erreur journalisée en production.
import nodemailer, { type Transporter } from 'nodemailer';

export type MailMessage = { to: string; subject: string; text: string; html?: string };

let transporter: Transporter | null = null;

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_URL || process.env.RESEND_API_KEY);
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const from = process.env.MAIL_FROM || 'Daourak <no-reply@daourak.app>';
  try {
    if (process.env.SMTP_URL) {
      transporter ??= nodemailer.createTransport(process.env.SMTP_URL);
      await transporter.sendMail({ from, ...message });
      return true;
    }
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status} : ${await res.text()}`);
      return true;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[mail:dev] À : ${message.to}\nObjet : ${message.subject}\n\n${message.text}\n`);
      return true;
    }
    console.error('[mail] aucun fournisseur configuré (SMTP_URL ou RESEND_API_KEY) : e-mail non envoyé.');
    return false;
  } catch (e) {
    console.error('[mail] envoi échoué', e);
    return false;
  }
}
