export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs">
      {items.map((i) => (
        <button key={i.id} className={`tabs__item ${value === i.id ? 'active' : ''}`} onClick={() => onChange(i.id)}>
          {i.label}{i.count != null && <span className="tabs__count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}
