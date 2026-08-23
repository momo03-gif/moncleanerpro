import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { senderFor } from '@/lib/mailFrom';
import { getSessionUser } from '@/lib/session';

// nodemailer nécessite le runtime Node (pas Edge)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Autorisation : la session ADMIN fait foi. Avant, la seule garde était l'entête
    // `x-mail-key` — les factures l'envoyaient, pas les devis, donc tout envoi de
    // devis repartait en 401 dès que MAIL_API_KEY était défini (cas de la prod).
    // La clé reste acceptée pour les appelants NON navigateur (scripts, cron).
    const session = await getSessionUser();
    const requiredKey = process.env.MAIL_API_KEY;
    const keyOk = !!requiredKey && req.headers.get('x-mail-key') === requiredKey;
    if (session?.role !== 'admin' && !keyOk) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    // `purpose` permet a l appelant de choisir la boite d expedition ;
    // par defaut, devis et factures partent de devis@.
    const { to, subject, text, html, purpose } = await req.json();
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json({ error: 'Champs manquants (to, subject, text).' }, { status: 400 });
    }

    const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = senderFor(purpose === 'rendezvous' ? 'rendezvous' : 'devis');

    if (!user || !pass) {
      return NextResponse.json({ error: "L'envoi d'email n'est pas configuré (SMTP)." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // SSL sur 465, STARTTLS sinon
      auth: { user, pass },
    });

    await transporter.sendMail({ from, replyTo: from, to, subject, text, html });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('send-invoice error:', e);
    return NextResponse.json({ error: (e as Error)?.message ?? "Erreur lors de l'envoi." }, { status: 500 });
  }
}
