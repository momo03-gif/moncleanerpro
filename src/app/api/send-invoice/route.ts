import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// nodemailer nécessite le runtime Node (pas Edge)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Garde optionnelle : si MAIL_API_KEY est défini, on l'exige
    const requiredKey = process.env.MAIL_API_KEY;
    if (requiredKey && req.headers.get('x-mail-key') !== requiredKey) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const { to, subject, text, html } = await req.json();
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json({ error: 'Champs manquants (to, subject, text).' }, { status: 400 });
    }

    const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!user || !pass) {
      return NextResponse.json({ error: "L'envoi d'email n'est pas configuré (SMTP)." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // SSL sur 465, STARTTLS sinon
      auth: { user, pass },
    });

    await transporter.sendMail({ from, to, subject, text, html });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('send-invoice error:', e);
    return NextResponse.json({ error: e?.message ?? "Erreur lors de l'envoi." }, { status: 500 });
  }
}
