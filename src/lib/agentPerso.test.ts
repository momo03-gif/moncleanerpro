import { describe, it, expect } from 'vitest';
import { emailAgentPerso, prestataireDeAgentPerso } from './agentPerso';

const PID = '5d3630e5-5539-4b04-ad15-2511a1577013';

describe('agent « moi-même » d’un prestataire', () => {
  it('reconnaît sa fiche à son adresse réservée', () => {
    expect(prestataireDeAgentPerso(emailAgentPerso(PID))).toBe(PID);
    expect(prestataireDeAgentPerso(emailAgentPerso(PID).toUpperCase())).toBe(PID);
  });
  it('ne prend pas un vrai agent ni une adresse imitée pour sa fiche', () => {
    expect(prestataireDeAgentPerso('agent@entreprise.fr')).toBeNull();
    expect(prestataireDeAgentPerso(`prestataire-${PID}@agent.invalid.fr`)).toBeNull();
    expect(prestataireDeAgentPerso(`x-prestataire-${PID}@agent.invalid`)).toBeNull();
    expect(prestataireDeAgentPerso(null)).toBeNull();
  });
});
