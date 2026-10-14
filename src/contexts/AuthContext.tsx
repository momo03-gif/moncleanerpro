'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '@/lib/types';
import { unregisterNativePush } from '@/lib/native';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => null,
  logout: async () => {},
  isLoading: true,
});

// Dernier compte connecté, pour ouvrir l'app sans réseau (cf. AuthProvider).
const CLE_COMPTE = 'mcp:dernier-compte';
function memoriserCompte(u: User | null) {
  try {
    if (u) localStorage.setItem(CLE_COMPTE, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role }));
    else localStorage.removeItem(CLE_COMPTE);
  } catch { /* stockage indisponible : pas de mode sans réseau, rien de cassé */ }
}
function compteMemorise(): User | null {
  try {
    const brut = localStorage.getItem(CLE_COMPTE);
    return brut ? (JSON.parse(brut) as User) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Source de vérité = la session serveur (cookie httpOnly signé). On hydrate
  // via /api/auth/me au chargement.
  //
  // SANS RÉSEAU : cette demande échouait, l'app concluait « personne n'est
  // connecté » et renvoyait le cleaner vers la connexion — impossible hors
  // ligne. Tout le mode sans réseau ne servait donc que si l'app était DÉJÀ
  // ouverte. On garde sur le téléphone le dernier compte connecté (nom et rôle,
  // aucun secret) et on l'utilise UNIQUEMENT quand le réseau fait défaut —
  // jamais quand le serveur répond que la session est terminée. Ce souvenir ne
  // sert qu'à afficher l'app : toute action réelle repasse par le serveur, qui
  // vérifie la vraie session.
  useEffect(() => {
    let cancelled = false;
    // Ouverture IMMÉDIATE avec le compte gardé (réseau faible : plus d'attente
    // de 6 s) ; la session est vérifiée juste après, en arrière-plan — si le
    // serveur répond qu'elle est terminée, on repasse par la connexion.
    const memo = compteMemorise();
    // Lu ici et non à l'initialisation de l'état : le rendu serveur ne connaît
    // pas ce compte, l'afficher dès le 1er rendu décalerait l'hydratation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (memo) { setUser(memo); setIsLoading(false); }
    const controller = new AbortController();
    const delai = setTimeout(() => controller.abort(), 6000);   // réseau faible
    fetch('/api/auth/me', { signal: controller.signal, cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        const u = (d.user ?? null) as User | null;
        setUser(u);
        memoriserCompte(u);
      })
      .catch(() => { if (!cancelled) setUser(compteMemorise()); })
      .finally(() => { clearTimeout(delai); if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; clearTimeout(delai); controller.abort(); };
  }, []);

  async function login(email: string, password: string): Promise<User | null> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { setUser(null); return null; }
    const data = await res.json();
    setUser(data.user ?? null);
    memoriserCompte(data.user ?? null);
    return data.user ?? null;
  }

  async function logout(): Promise<void> {
    // Détacher l'appareil AVANT de fermer la session : la route a besoin du
    // cookie. Sinon un téléphone partagé garderait les notifications du compte
    // précédent.
    await unregisterNativePush();
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    memoriserCompte(null);
    // Planning, adresses, codes d'accès gardés pour le mode sans réseau : rien ne
    // doit rester sur un téléphone partagé ou prêté. (Les actions pas encore
    // envoyées sont gérées avant, avec l'accord du cleaner — cf. CleanerNav.)
    try {
      const { effacerDonneesHorsLigne } = await import('@/lib/offline/store');
      await effacerDonneesHorsLigne();
    } catch { /* best-effort */ }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

export function redirectPathForRole(role: Role): string {
  return role === 'admin' ? '/admin'
    : role === 'cleaner' ? '/cleaner'
    : role === 'airbnb' ? '/airbnb/accueil'
    : '/hotel';
}
