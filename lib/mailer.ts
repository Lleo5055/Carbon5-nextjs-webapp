import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export async function sendMail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  await transport.sendMail({
    from: `"Greenio" <${process.env.SMTP_USER}>`,
    to: to.join(', '),
    subject,
    html,
    attachments,
  });
}
