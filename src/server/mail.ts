import nodemailer from "nodemailer";
import { env, isProd, isTest } from "./env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailProvider {
  send(msg: MailMessage): Promise<void>;
}

const inbox: MailMessage[] = [];

export class MemoryMailer implements MailProvider {
  async send(msg: MailMessage) {
    inbox.push(msg);
    console.log(`[mail:memory] to=${msg.to} subject=${msg.subject}`);
  }
}

export function getMailbox(to?: string) {
  return to ? inbox.filter((m) => m.to === to) : [...inbox];
}

export function clearMailbox() {
  inbox.length = 0;
}

class ConsoleMailer implements MailProvider {
  async send(msg: MailMessage) {
    console.log(`[mail:console] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
  }
}

class SmtpMailer implements MailProvider {
  private transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });

  async verify() {
    try {
      await this.transporter.verify();
      console.log("[mail] SMTP connection verified");
    } catch (e) {
      console.error("[mail] SMTP verify failed", e);
    }
  }

  async send(msg: MailMessage) {
    const from = env.smtpUser || env.smtpFrom;
    await this.transporter.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html ?? `<pre>${msg.text}</pre>`,
    });
  }
}

function createMailer(): MailProvider {
  if (isTest) return new MemoryMailer();
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    const smtp = new SmtpMailer();
    void smtp.verify();
    return smtp;
  }
  return new ConsoleMailer();
}

export const mailer: MailProvider = createMailer();

export function brandedEmail(opts: { title: string; intro: string; buttonLabel?: string; buttonUrl?: string; extra?: string }) {
  const button = opts.buttonUrl
    ? `<p style="margin:28px 0"><a href="${opts.buttonUrl}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${opts.buttonLabel}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f6f3;padding:24px;color:#1f2420">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
    <div style="font-weight:700;color:#0f766e;font-size:18px">LogoPed</div>
    <h1 style="font-size:20px;margin:20px 0 12px">${opts.title}</h1>
    <p>${opts.intro}</p>
    ${button}
    ${opts.extra ? `<p style="color:#5b625e;font-size:13px">${opts.extra}</p>` : ""}
    <p style="color:#5b625e;font-size:12px;margin-top:32px">ООО «ЛогоПед» · support@logoped.site · logoped.site</p>
  </div></body></html>`;
  return html;
}

export async function sendCodeEmail(to: string, code: string, purpose: string, link?: string) {
  const titles: Record<string, string> = {
    verify: "Подтвердите почту — LogoPed",
    login: "Код входа — LogoPed",
  };
  const extra = `Если кнопка не работает, введите код на сайте: <b style="letter-spacing:4px">${code}</b>. Код действует 15 минут, ссылка — 24 часа.`;
  await dispatchMail({
    to,
    subject: titles[purpose] ?? "Сообщение — LogoPed",
    text: `${link ? `Подтвердите почту: ${link}\n` : ""}Код: ${code}\nДействителен 15 минут.`,
    html: brandedEmail({
      title: "Подтверждение почты",
      intro: "Нажмите кнопку, чтобы подтвердить адрес и открыть кабинет.",
      buttonLabel: "Подтвердить почту",
      buttonUrl: link,
      extra,
    }),
  });
}

export async function sendResetEmail(to: string, link: string) {
  await dispatchMail({
    to,
    subject: "Восстановление пароля — LogoPed",
    text: `Ссылка для сброса пароля (1 час): ${link}`,
    html: brandedEmail({
      title: "Восстановление пароля",
      intro: "Ссылка действует один час. Если вы не запрашивали сброс, просто проигнорируйте письмо.",
      buttonLabel: "Задать новый пароль",
      buttonUrl: link,
    }),
  });
}

export async function dispatchMail(msg: MailMessage) {
  try {
    const { enqueueMail } = await import("./queue");
    await enqueueMail({
      ...msg,
      attempts: 3,
    } as MailMessage);
  } catch (e) {
    console.warn("[mail] queue unavailable, sending directly", e);
    await mailer.send(msg);
  }
}

if (!isProd && env.smtpHost) {
  void 0;
}
