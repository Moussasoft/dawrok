// Modèles d'e-mails transactionnels, traduits et compatibles RTL (arabe).
import { createTranslator } from 'next-intl';
import { MESSAGES, toAppLocale } from '@/i18n/messages';
import type { MailMessage } from './mail';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(opts: { locale: string; title: string; paragraphs: string[]; button: { label: string; url: string }; footer: string }) {
  const dir = opts.locale === 'ar' ? 'rtl' : 'ltr';
  const paragraphs = opts.paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p)}</p>`).join('');
  return `<!doctype html><html lang="${opts.locale}" dir="${dir}"><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td dir="${dir}" style="text-align:${dir === 'rtl' ? 'right' : 'left'}">
<div style="display:inline-block;background:#6366F1;color:#fff;font-weight:800;border-radius:10px;padding:6px 12px;margin-bottom:24px">Daourak</div>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(opts.title)}</h1>
${paragraphs}
<p style="margin:24px 0"><a href="${escapeHtml(opts.button.url)}" style="background:#6366F1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(opts.button.label)}</a></p>
<p style="margin:0;font-size:12px;color:#71717a;word-break:break-all">${escapeHtml(opts.button.url)}</p>
</td></tr></table>
<p style="font-size:12px;color:#a1a1aa;margin-top:16px">${escapeHtml(opts.footer)}</p>
</td></tr></table></body></html>`;
}

function translator(locale: string) {
  const loc = toAppLocale(locale);
  return { loc, t: createTranslator({ locale: loc, messages: MESSAGES[loc], namespace: 'emails' }) };
}

export function resetPasswordEmail(to: string, url: string, locale: string): MailMessage {
  const { loc, t } = translator(locale);
  const paragraphs = [t('resetIntro'), t('resetExpiry')];
  return {
    to,
    subject: t('resetSubject'),
    text: `${t('resetTitle')}\n\n${paragraphs[0]}\n${url}\n\n${paragraphs[1]}\n\n${t('footer')}`,
    html: layout({ locale: loc, title: t('resetTitle'), paragraphs, button: { label: t('resetButton'), url }, footer: t('footer') }),
  };
}

export function invitationEmail(
  to: string,
  url: string,
  locale: string,
  params: { org: string; inviter: string; role: string }
): MailMessage {
  const { loc, t } = translator(locale);
  const paragraphs = [t('inviteIntro', params), t('inviteExpiry')];
  return {
    to,
    subject: t('inviteSubject', { org: params.org }),
    text: `${t('inviteTitle')}\n\n${paragraphs[0]}\n${url}\n\n${paragraphs[1]}\n\n${t('footer')}`,
    html: layout({ locale: loc, title: t('inviteTitle'), paragraphs, button: { label: t('inviteButton'), url }, footer: t('footer') }),
  };
}
