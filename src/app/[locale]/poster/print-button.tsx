'use client';
import { Printer } from 'lucide-react';

export function PrintButton({ color, label }: { color: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: '10px 20px',
        background: color,
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <Printer size={16} /> {label}
    </button>
  );
}
