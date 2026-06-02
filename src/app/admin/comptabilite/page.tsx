import { FINANCIAL } from '@/lib/mockData';

export default function ComptabilitePage() {
  const income = FINANCIAL.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
  const expense = FINANCIAL.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
  const balance = income - expense;

  const sorted = [...FINANCIAL].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Comptabilité</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Suivi financier</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs mb-3" style={{ color: '#A8A09A' }}>Revenus</p>
          <p className="text-2xl font-bold" style={{ color: '#5A8A6A' }}>+{income}€</p>
        </div>
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs mb-3" style={{ color: '#A8A09A' }}>Dépenses</p>
          <p className="text-2xl font-bold" style={{ color: '#B85A50' }}>-{expense}€</p>
        </div>
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#C9A84C', borderColor: '#C9A84C' }}>
          <p className="text-xs mb-3" style={{ color: '#7A6030' }}>Bénéfice net</p>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{balance}€</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Transactions</h2>
        </div>

        {sorted.map((f, i) => (
          <div key={f.id} className={`px-5 py-4 flex items-center gap-4 ${i < sorted.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: f.type === 'income' ? '#5A8A6A18' : '#B85A5018' }}>
              <span style={{ color: f.type === 'income' ? '#5A8A6A' : '#B85A50' }}>{f.type === 'income' ? '↑' : '↓'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{f.description}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{f.date} · {f.category}</p>
            </div>
            <span className="font-semibold text-sm shrink-0" style={{ color: f.type === 'income' ? '#5A8A6A' : '#B85A50' }}>
              {f.type === 'income' ? '+' : '-'}{f.amount}€
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
