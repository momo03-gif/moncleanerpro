'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getBookedSlotsDB } from '@/lib/appointments';

// ════════════════════════════════════════════════════════════════════════════
//  Prise de rendez-vous en ligne (après validation d'un devis).
//  Calendrier → créneaux → coordonnées → confirmation → succès (+ ICS).
//  Créneaux occupés lus depuis Supabase ; réservation via /api/appointment
//  (enregistrement + notification admin). Charte de l'app.
// ════════════════════════════════════════════════════════════════════════════

// ── Configuration des disponibilités (modifiable) ──
const WORKING_DAYS = [1, 2, 3, 4, 5];                 // 1=lundi … 5=vendredi
const MORNING = ['09:00', '10:00', '11:00'];
const AFTERNOON = ['14:00', '15:00', '16:00', '17:00'];
const SLOT_MIN = 60;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WD_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WD_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateLabel = (d: Date) => `${WD_FULL[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function PageClient() {
  const params = useSearchParams();
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selDate, setSelDate] = useState<Date | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', devisRef: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, boolean>>({});
  const [refCode, setRefCode] = useState('');

  // Pré-remplissage depuis l'URL (devis validé → /rendez-vous?devis=...&nom=...).
  useEffect(() => {
    setForm(f => ({
      ...f,
      firstName: params.get('prenom') ?? f.firstName,
      lastName: params.get('nom') ?? f.lastName,
      email: params.get('email') ?? f.email,
      devisRef: params.get('devis') ?? f.devisRef,
    }));
  }, [params]);

  // Charge les créneaux occupés du mois affiché (grisés).
  const loadBooked = useCallback(async (m: Date) => {
    const from = iso(new Date(m.getFullYear(), m.getMonth(), 1));
    const to = iso(new Date(m.getFullYear(), m.getMonth() + 1, 0));
    const slots = await getBookedSlotsDB(from, to);
    setBooked(new Set(slots.map(s => `${s.date}|${s.time}`)));
  }, []);
  useEffect(() => { loadBooked(month); }, [month, loadBooked]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const canPrev = !(month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth());

  // ── Grille du calendrier ──
  const cells = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1);
    let off = first.getDay() - 1; if (off < 0) off = 6;
    const nb = new Date(y, m + 1, 0).getDate();
    const out: ({ d: number; date: Date } | null)[] = [];
    for (let i = 0; i < off; i++) out.push(null);
    for (let d = 1; d <= nb; d++) out.push({ d, date: new Date(y, m, d) });
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  function pickDate(d: Date) { setSelDate(d); setSelTime(null); }
  function slotUnavailable(d: Date, t: string) {
    if (booked.has(`${iso(d)}|${t}`)) return true;
    // Créneau déjà passé aujourd'hui.
    const now = new Date();
    if (sameDay(d, now)) { const [h, mi] = t.split(':').map(Number); if (h < now.getHours() || (h === now.getHours() && mi <= now.getMinutes())) return true; }
    return false;
  }

  function validate() {
    const fe: Record<string, boolean> = {};
    (['firstName', 'lastName', 'email', 'phone'] as const).forEach(k => { if (!form[k].trim()) fe[k] = true; });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) fe.email = true;
    setFieldErr(fe);
    return Object.keys(fe).length === 0;
  }

  async function confirm() {
    if (!selDate || !selTime) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/appointment', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: `${form.firstName} ${form.lastName}`.trim(),
          clientEmail: form.email, clientPhone: form.phone, message: form.message,
          devisNumber: form.devisRef, date: iso(selDate), time: selTime,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok || data.error) { setErr(data.error || 'Réservation impossible, réessayez.'); if (data.error) loadBooked(month); return; }
      setRefCode(data.refCode || '');
      setStep(4);
    } catch { setBusy(false); setErr('Réservation impossible (connexion). Réessayez.'); }
  }

  function downloadICS() {
    if (!selDate || !selTime) return;
    const start = new Date(selDate); const [h, mi] = selTime.split(':').map(Number);
    start.setHours(h, mi, 0, 0);
    const end = new Date(start.getTime() + SLOT_MIN * 60000);
    const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MonCleanerPro//RDV//FR', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@moncleanerpro', 'DTSTAMP:' + fmt(new Date()), 'DTSTART:' + fmt(start), 'DTEND:' + fmt(end),
      'SUMMARY:Rendez-vous - MonCleanerPro', 'DESCRIPTION:Rendez-vous confirmé' + (form.devisRef ? ` (devis ${form.devisRef})` : ''), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = 'rendez-vous.ics'; a.click(); URL.revokeObjectURL(url);
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const badge = form.devisRef ? `Devis n°${form.devisRef} validé` : 'Devis validé';

  const summaryRows: [string, string][] = selDate && selTime ? [
    ['Date', dateLabel(selDate)], ['Heure', selTime],
    ['Nom', `${form.firstName} ${form.lastName}`.trim()], ['Email', form.email], ['Téléphone', form.phone],
    ...(form.message ? [['Message', form.message] as [string, string]] : []),
  ] : [];

  return (
    <div className="rv-root"><style>{CSS}</style>
      <header className="rv-top"><div className="rv-top-in"><span className="rv-brand">MonCleanerPro</span><span className="rv-toptag">Prise de rendez-vous en ligne</span></div></header>

      <main className="rv-container">
        {step < 4 && (
          <div className="rv-intro">
            <div className="rv-stamp">{badge}</div>
            <h1>Réservez votre rendez-vous</h1>
            <p>Votre devis est enregistré. Choisissez maintenant la date et l’heure qui vous conviennent.</p>
          </div>
        )}

        {step < 4 && (
          <ol className="rv-stepper">
            {[['1', 'Créneau'], ['2', 'Coordonnées'], ['3', 'Confirmation']].map(([n, l], i) => (
              <RvStep key={n} n={n} label={l} state={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''} last={i === 2} />
            ))}
          </ol>
        )}

        {/* ÉTAPE 1 — Calendrier + créneaux */}
        {step === 1 && (
          <>
            <div className="rv-booking">
              <div className="rv-card">
                <div className="rv-calnav">
                  <button className="rv-nav" onClick={() => canPrev && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={!canPrev} aria-label="Mois précédent">‹</button>
                  <span className="rv-month">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
                  <button className="rv-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mois suivant">›</button>
                </div>
                <div className="rv-wd">{WD_SHORT.map(d => <span key={d}>{d}</span>)}</div>
                <div className="rv-days">
                  {cells.map((c, i) => {
                    if (!c) return <span key={i} className="rv-day out" />;
                    const past = c.date < today; const working = WORKING_DAYS.includes(c.date.getDay());
                    const isToday = sameDay(c.date, new Date());
                    const disabled = past || !working;
                    const selected = sameDay(c.date, selDate);
                    return (
                      <button key={i} className={'rv-day' + (disabled ? ' dis' : ' av') + (isToday ? ' today' : '') + (selected ? ' sel' : '')}
                        disabled={disabled} onClick={() => pickDate(c.date)}>{c.d}</button>
                    );
                  })}
                </div>
              </div>
              <div className="rv-card rv-slots">
                <h3>Créneaux disponibles</h3>
                <p className="rv-slotdate">{selDate ? dateLabel(selDate) : ''}</p>
                {!selDate ? (
                  <p className="rv-empty">Choisissez une date dans le calendrier pour afficher les créneaux.</p>
                ) : (
                  <>
                    {[['Matin', MORNING], ['Après-midi', AFTERNOON]].map(([title, list]) => (
                      <div key={title as string} className="rv-slotgroup">
                        <h4>{title as string}</h4>
                        <div className="rv-slotgrid">
                          {(list as string[]).map(t => {
                            const un = slotUnavailable(selDate!, t);
                            return <button key={t} className={'rv-slot' + (un ? ' un' : '') + (selTime === t ? ' sel' : '')} disabled={un} onClick={() => setSelTime(t)} title={un ? 'Créneau indisponible' : ''}>{t}</button>;
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            <div className="rv-actions"><button className="rv-btn rv-primary" disabled={!selDate || !selTime} onClick={() => setStep(2)}>Continuer</button></div>
          </>
        )}

        {/* ÉTAPE 2 — Coordonnées */}
        {step === 2 && (
          <>
            <div className="rv-card">
              <h3 className="rv-formh">Vos coordonnées</h3>
              <div className="rv-form">
                <RvField label="Prénom" req val={form.firstName} on={v => set('firstName', v)} err={fieldErr.firstName} />
                <RvField label="Nom" req val={form.lastName} on={v => set('lastName', v)} err={fieldErr.lastName} />
                <RvField label="Email" req val={form.email} on={v => set('email', v)} err={fieldErr.email} type="email" />
                <RvField label="Téléphone" req val={form.phone} on={v => set('phone', v)} err={fieldErr.phone} type="tel" />
                <RvField label="Référence du devis (optionnel)" val={form.devisRef} on={v => set('devisRef', v)} full ph="Ex. DEV-2026-0142" />
                <div className="rv-field rv-full"><label>Message (optionnel)</label>
                  <textarea value={form.message} onChange={e => set('message', e.target.value)} placeholder="Précisions utiles pour votre rendez-vous…" /></div>
              </div>
            </div>
            <div className="rv-actions two">
              <button className="rv-btn rv-sec" onClick={() => setStep(1)}>Retour</button>
              <button className="rv-btn rv-primary" onClick={() => { if (validate()) setStep(3); }}>Continuer</button>
            </div>
          </>
        )}

        {/* ÉTAPE 3 — Confirmation */}
        {step === 3 && (
          <>
            <h2 className="rv-panelh">Vérifiez votre rendez-vous</h2>
            <div className="rv-ticket">{summaryRows.map(([k, v]) => <div key={k} className="rv-trow"><span>{k}</span><strong>{v}</strong></div>)}
              <div className="rv-tear"><span className="rv-dot" /><span className="rv-dash" /><span className="rv-dot" /></div>
              <div className="rv-trow rv-ref"><span>Référence</span><strong className="rv-refcode">{form.devisRef || (selDate && selTime ? `RDV-${iso(selDate).replace(/-/g, '')}-${selTime.replace(':', '')}` : '')}</strong></div>
            </div>
            <p className="rv-note">En confirmant, vous recevrez un rappel par email avec les détails de votre rendez-vous.</p>
            {err && <p className="rv-err">{err}</p>}
            <div className="rv-actions two">
              <button className="rv-btn rv-sec" onClick={() => setStep(2)} disabled={busy}>Retour</button>
              <button className="rv-btn rv-primary" onClick={confirm} disabled={busy}>{busy ? 'Confirmation…' : 'Confirmer le rendez-vous'}</button>
            </div>
          </>
        )}

        {/* ÉTAPE 4 — Succès */}
        {step === 4 && (
          <div className="rv-success">
            <div className="rv-ok"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg></div>
            <h2 className="rv-panelh">Rendez-vous confirmé</h2>
            <p className="rv-successmsg">Merci {form.firstName}, votre rendez-vous est enregistré. Nous vous contactons pour le confirmer.</p>
            <div className="rv-ticket">{summaryRows.map(([k, v]) => <div key={k} className="rv-trow"><span>{k}</span><strong>{v}</strong></div>)}
              <div className="rv-tear"><span className="rv-dot" /><span className="rv-dash" /><span className="rv-dot" /></div>
              <div className="rv-trow rv-ref"><span>Référence</span><strong className="rv-refcode">{refCode}</strong></div>
            </div>
            <div className="rv-successact">
              <button className="rv-btn rv-primary rv-block" onClick={downloadICS}>Ajouter à mon calendrier</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RvStep({ n, label, state, last }: { n: string; label: string; state: string; last: boolean }) {
  return (
    <>
      <li className={'rv-step ' + state}><span className="rv-stepn">{state === 'done' ? '✓' : n}</span><span className="rv-stepl">{label}</span></li>
      {!last && <li className="rv-conn" />}
    </>
  );
}
function RvField({ label, req, val, on, err, type = 'text', full, ph }: { label: string; req?: boolean; val: string; on: (v: string) => void; err?: boolean; type?: string; full?: boolean; ph?: string }) {
  return (
    <div className={'rv-field' + (full ? ' rv-full' : '')}>
      <label>{label}{req && <span className="rv-req"> *</span>}</label>
      <input type={type} className={err ? 'rv-inerr' : ''} value={val} onChange={e => on(e.target.value)} placeholder={ph} />
    </div>
  );
}

const CSS = `
.rv-root{--paper:#FAFAF8;--sf:#FFF;--ink:#1A1A1A;--soft:#7A7068;--faint:#A8A09A;--gold:#C9A84C;--gold-d:#9A7B22;--gold-w:#F7F0DC;--stamp:#B85A50;--line:#E8E4DC;--line2:#DDD6CA;--green:#5A8A6A;--green-d:#4E7D5E;
  background:var(--paper);color:var(--ink);min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;}
.rv-root *{box-sizing:border-box;}
.rv-top{background:var(--sf);border-bottom:1px solid var(--line);padding:16px 22px;}
.rv-top-in{max-width:860px;margin:0 auto;display:flex;align-items:baseline;justify-content:space-between;gap:6px;flex-wrap:wrap;}
.rv-brand{font-size:19px;font-weight:700;letter-spacing:-.01em;} .rv-toptag{font-size:11px;color:var(--soft);letter-spacing:.06em;text-transform:uppercase;}
.rv-container{max-width:860px;margin:0 auto;padding:42px 22px 90px;}
.rv-intro{text-align:center;max-width:540px;margin:0 auto 30px;}
.rv-stamp{display:inline-block;border:2px solid var(--stamp);color:var(--stamp);padding:5px 15px;border-radius:5px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;transform:rotate(-2deg);margin-bottom:18px;}
.rv-intro h1{margin:0 0 10px;font-size:30px;letter-spacing:-.02em;} .rv-intro p{margin:0;color:var(--soft);font-size:15.5px;}
/* Stepper */
.rv-stepper{display:flex;align-items:flex-start;justify-content:center;max-width:420px;margin:0 auto 34px;padding:0;list-style:none;}
.rv-step{display:flex;flex-direction:column;align-items:center;gap:7px;color:var(--faint);width:90px;flex-shrink:0;}
.rv-stepn{width:32px;height:32px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:600;background:var(--sf);color:var(--soft);transition:.15s;}
.rv-stepl{font-size:12px;font-weight:500;text-align:center;}
.rv-step.active .rv-stepn{border-color:var(--gold);background:var(--gold);color:#1A1A1A;} .rv-step.active .rv-stepl{color:var(--ink);font-weight:600;}
.rv-step.done .rv-stepn{border-color:var(--gold);background:var(--gold-w);color:var(--gold-d);}
.rv-conn{flex:1;height:0;border-top:2px dashed var(--line);margin:16px 4px 0;list-style:none;}
/* Cards */
.rv-card{background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 1px 2px rgba(26,26,26,.05);}
.rv-booking{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;}
@media(max-width:720px){.rv-booking{grid-template-columns:1fr;}}
/* Calendrier */
.rv-calnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.rv-month{font-size:16.5px;font-weight:600;text-transform:capitalize;}
.rv-nav{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:var(--sf);font-size:16px;color:var(--ink);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.rv-nav:hover:not(:disabled){background:var(--gold-w);border-color:var(--gold);} .rv-nav:disabled{opacity:.3;cursor:not-allowed;}
.rv-wd{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1.5px solid var(--ink);padding-bottom:6px;margin-bottom:2px;}
.rv-wd span{text-align:center;font-size:10.5px;color:var(--soft);font-weight:600;letter-spacing:.03em;text-transform:uppercase;}
.rv-days{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line);}
.rv-day{aspect-ratio:1;border:none;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--sf);font-size:13.5px;color:var(--ink);display:flex;align-items:center;justify-content:center;position:relative;font-variant-numeric:tabular-nums;}
.rv-day.out{background:var(--paper);cursor:default;} .rv-day.dis{color:var(--line2);cursor:not-allowed;}
.rv-day.av{cursor:pointer;} .rv-day.av:hover{background:var(--gold-w);}
.rv-day.today{font-weight:700;color:var(--gold-d);} .rv-day.today::after{content:'';position:absolute;bottom:5px;width:4px;height:4px;border-radius:50%;background:var(--stamp);}
.rv-day.sel{background:var(--gold);color:#1A1A1A;font-weight:700;} .rv-day.sel.today::after{background:#1A1A1A;}
/* Créneaux */
.rv-slots h3{margin:0 0 2px;font-size:16px;} .rv-slotdate{font-size:12.5px;color:var(--stamp);margin:0 0 15px;min-height:15px;text-transform:capitalize;}
.rv-empty{color:var(--soft);font-size:14px;padding:34px 6px;text-align:center;}
.rv-slotgroup + .rv-slotgroup{margin-top:16px;} .rv-slotgroup h4{margin:0 0 9px;font-size:11.5px;color:var(--soft);font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
.rv-slotgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;} @media(max-width:480px){.rv-slotgrid{grid-template-columns:repeat(2,1fr);}}
.rv-slot{padding:10px 6px;border:1px solid var(--line);border-radius:6px;background:var(--sf);font-size:13.5px;font-weight:500;color:var(--ink);cursor:pointer;font-variant-numeric:tabular-nums;}
.rv-slot:hover:not(:disabled){border-color:var(--gold);background:var(--gold-w);} .rv-slot.sel{background:var(--gold);border-color:var(--gold);color:#1A1A1A;font-weight:600;}
.rv-slot.un{color:var(--line2);text-decoration:line-through;cursor:not-allowed;background:var(--paper);}
/* Form */
.rv-formh{margin:0 0 18px;font-size:17px;} .rv-form{display:grid;grid-template-columns:1fr 1fr;gap:15px;} @media(max-width:560px){.rv-form{grid-template-columns:1fr;}}
.rv-field{display:flex;flex-direction:column;gap:5px;} .rv-full{grid-column:1/-1;} .rv-field label{font-size:13px;font-weight:600;} .rv-req{color:var(--stamp);}
.rv-field input,.rv-field textarea{padding:11px 13px;border:1px solid var(--line2);border-radius:6px;background:var(--paper);color:var(--ink);font-size:15px;font-family:inherit;width:100%;}
.rv-field textarea{resize:vertical;min-height:70px;}
.rv-field input:focus,.rv-field textarea:focus{outline:none;border-color:var(--gold);background:var(--sf);box-shadow:0 0 0 3px var(--gold-w);}
.rv-inerr{border-color:var(--stamp)!important;}
/* Ticket */
.rv-panelh{font-size:23px;text-align:center;margin:0 0 8px;}
.rv-ticket{background:var(--sf);border:1px solid var(--line);border-radius:10px;padding:22px 24px;box-shadow:0 1px 2px rgba(26,26,26,.05);max-width:520px;margin:18px auto 0;}
.rv-trow{display:flex;justify-content:space-between;gap:16px;font-size:14px;padding:5px 0;} .rv-trow span{color:var(--soft);} .rv-trow strong{font-weight:600;text-align:right;}
.rv-tear{display:flex;align-items:center;gap:6px;margin:15px 0;} .rv-dash{flex:1;height:0;border-top:2px dashed var(--line);} .rv-dot{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--line);background:var(--paper);flex-shrink:0;}
.rv-ref span{font-size:12px;text-transform:uppercase;letter-spacing:.05em;} .rv-refcode{color:var(--gold-d);letter-spacing:.02em;}
.rv-note{text-align:center;color:var(--soft);font-size:13px;margin:16px auto 0;max-width:480px;} .rv-err{color:var(--stamp);text-align:center;font-size:13.5px;margin:14px 0 0;}
/* Actions */
.rv-actions{display:flex;margin-top:24px;} .rv-actions.two{gap:12px;} .rv-actions .rv-primary{margin-left:auto;}
.rv-btn{padding:13px 26px;border-radius:8px;border:none;font-size:15px;font-weight:600;cursor:pointer;transition:transform .08s,background .12s,opacity .12s;} .rv-btn:active{transform:scale(.98);}
.rv-primary{background:var(--green);color:#fff;} .rv-primary:hover:not(:disabled){background:var(--green-d);} .rv-primary:disabled{background:var(--line2);color:var(--faint);cursor:not-allowed;}
.rv-sec{background:transparent;color:var(--ink);border:1px solid var(--line2);} .rv-sec:hover{border-color:var(--ink);}
.rv-block{width:100%;}
/* Succès */
.rv-success{text-align:center;max-width:520px;margin:0 auto;}
.rv-ok{width:52px;height:52px;border-radius:50%;background:#EAF3EC;color:var(--green-d);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
.rv-successmsg{color:var(--soft);font-size:15px;margin:8px 0 0;} .rv-successact{margin-top:24px;}
`;
