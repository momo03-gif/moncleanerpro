import { describe, it, expect } from 'vitest';
import { qrWifi, rubriquesVoyageur, rubriquesIntervenant, manquesFiche, reprendreFiche, ficheRemplie, type DonneesFiche } from './ficheLogement';

describe('qrWifi — un scan doit connecter, pas afficher une erreur', () => {
  it('produit le format que lisent iOS et Android', () => {
    expect(qrWifi({ wifiSsid: 'Casa-Sol', wifiPassword: 'bonjour123' }))
      .toBe('WIFI:T:WPA;S:Casa-Sol;P:bonjour123;;');
  });

  it('échappe les caractères qui casseraient le QR', () => {
    // `;` et `:` séparent les champs : une clé qui en contient afficherait un
    // mot de passe tronqué, sans que rien ne le signale.
    expect(qrWifi({ wifiSsid: 'Box;Fibre', wifiPassword: 'a:b;c' }))
      .toBe(String.raw`WIFI:T:WPA;S:Box\;Fibre;P:a\:b\;c;;`);
  });

  it('déclare explicitement un réseau sans mot de passe', () => {
    // Sans `nopass`, le téléphone attend une clé et la connexion échoue.
    expect(qrWifi({ wifiSsid: 'Accueil' })).toBe('WIFI:T:nopass;S:Accueil;;');
  });

  it('respecte une sécurité WEP quand elle est déclarée', () => {
    expect(qrWifi({ wifiSsid: 'Vieux', wifiPassword: 'x', wifiSecurity: 'WEP' }))
      .toBe('WIFI:T:WEP;S:Vieux;P:x;;');
  });

  it('REFUSE de produire un QR sans nom de réseau', () => {
    // Un QR incomplet est pire que pas de QR : le voyageur scanne, rien ne se
    // passe, et il appelle la conciergerie.
    expect(qrWifi({ wifiPassword: 'orpheline' })).toBeNull();
    expect(qrWifi({ wifiSsid: '   ' })).toBeNull();
  });
});

describe('Rubriques — ce qui va sur quelle fiche', () => {
  const logement = {
    name: 'Casa Sol', address: '10 rue de Vaise, Lyon',
    checkoutTime: 'avant 11h', poubelles: 'local au fond de la cour',
    portalCode: '4521A', keyboxCode: '7788', entryDirectives: 'Boîte à gauche de la porte',
    onSiteContactName: 'Carmen', onSiteContactPhone: '06 12 34 56 78',
  };

  it('la fiche VOYAGEUR ne porte jamais les codes d’accès', () => {
    // Le voyageur est déjà entré : les y écrire revient à donner l'accès à tous
    // ceux qui viendront après lui.
    const texte = JSON.stringify(rubriquesVoyageur(logement));
    expect(texte).not.toContain('4521A');
    expect(texte).not.toContain('7788');
    expect(texte).toContain('local au fond de la cour');
  });

  it('la fiche INTERVENANT les porte, elle', () => {
    const texte = JSON.stringify(rubriquesIntervenant(logement));
    expect(texte).toContain('4521A');
    expect(texte).toContain('7788');
    expect(texte).toContain('Carmen');
  });

  it('n’affiche pas une rubrique vide', () => {
    // Des titres suivis de rien donnent l'impression d'un logement mal tenu.
    const r = rubriquesVoyageur({ name: 'X', address: 'Y', checkoutTime: 'avant 11h' });
    expect(r.map(x => x.titre)).toEqual(['Horaires']);
  });
});

describe('manquesFiche — le dire avant l’impression', () => {
  it('liste ce qui manque', () => {
    expect(manquesFiche({ name: 'X', address: 'Y' })).toHaveLength(4);
  });

  it('ne signale rien quand la fiche est complète', () => {
    expect(manquesFiche({
      name: 'X', address: 'Y', wifiSsid: 'Box', checkoutTime: 'avant 11h',
      consignesDepart: 'Laissez les clés sur la table', onSiteContactPhone: '0612345678',
    })).toEqual([]);
  });
});

describe('reprendreFiche', () => {
  const source: DonneesFiche = {
    name: 'Bellecour', address: '2 rue A',
    wifiSsid: 'Livebox-Bellecour', wifiPassword: 'secret', wifiSecurity: 'WPA',
    checkinTime: '16h', checkoutTime: '11h', consignesDepart: 'Clés sur la table',
    poubelles: 'Cour', parking: 'Rue', equipements: 'Lave-linge', aProximite: 'Métro',
  };

  it('recopie les réponses communes', () => {
    const r = reprendreFiche(source);
    expect(r.checkoutTime).toBe('11h');
    expect(r.poubelles).toBe('Cour');
    expect(r.equipements).toBe('Lave-linge');
  });

  // Le wifi du voisin imprimé sur une fiche, c'est un appel garanti.
  it('ne recopie JAMAIS le wifi', () => {
    const r = reprendreFiche(source);
    expect('wifiSsid' in r).toBe(false);
    expect('wifiPassword' in r).toBe(false);
  });

  it('ne propose comme modèle qu’une fiche déjà remplie', () => {
    expect(ficheRemplie(source)).toBe(true);
    expect(ficheRemplie({ name: 'Vide', address: 'x' })).toBe(false);
    expect(ficheRemplie({ name: 'Wifi seul', address: 'x', wifiSsid: 'Box' })).toBe(false);
  });
});
