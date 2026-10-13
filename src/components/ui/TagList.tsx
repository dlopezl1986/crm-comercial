export function TagList({ tags, max }: { tags?: string[]; max?: number }) {
  if (!tags?.length) return null;
  const shown = max ? tags.slice(0, max) : tags;
  return (
    <div className="tags">
      {shown.map((t) => <span key={t} className="tag">{t}</span>)}
      {max && tags.length > max && <span className="tag tag--more">+{tags.length - max}</span>}
    </div>
  );
}
