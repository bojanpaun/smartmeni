export default function SortableHead({ col, label, sortBy, sortDir, onSort }) {
  const active = sortBy === col
  return (
    <span
      onClick={() => onSort(col)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color: active ? 'var(--c-primary)' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{ fontSize: 9, opacity: active ? 1 : 0.35, lineHeight: 1 }}>
        {!active ? '↕' : sortDir === 'asc' ? '↑' : '↓'}
      </span>
    </span>
  )
}
