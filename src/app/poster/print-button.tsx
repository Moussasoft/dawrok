'use client';
export function PrintButton({ color }: { color: string }) {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: '10px 20px',
        background: color,
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Imprimer
    </button>
  );
}
