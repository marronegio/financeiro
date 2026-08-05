import React, { useEffect, useState } from 'react';
import { FiCalendar } from 'react-icons/fi';

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

// Escolha do dia do mês por calendário — sem digitação. Não é uma data completa
// (não existe "mês" aqui), então o que abre é a grade de 1 a 31 do jeito que um
// calendário mostra: sete colunas, o dia escolhido em destaque.
export default function DiaMesPicker({ value, onChange, titulo = 'Dia do fechamento', hint }) {
  const [open, setOpen] = useState(false);
  const dia = parseInt(value, 10);
  const escolhido = dia >= 1 && dia <= 31 ? dia : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={'dia-chip' + (escolhido ? '' : ' vazio')}
        onClick={() => setOpen(true)}
        aria-label={escolhido ? `${titulo}: dia ${escolhido}. Trocar` : `Escolher o ${titulo.toLowerCase()}`}
      >
        <FiCalendar className="dia-chip-ico" aria-hidden="true" />
        {escolhido ? `Dia ${escolhido}` : 'Escolher dia'}
      </button>

      {open && (
        <div className="ob-backdrop" onClick={() => setOpen(false)}>
          <div className="ob-card dia-card" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
            <h2 className="ob-title">{titulo}</h2>
            {hint && <p className="ob-desc">{hint}</p>}

            <div className="dia-grid">
              {DIAS.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={'dia-cell' + (d === escolhido ? ' on' : '')}
                  aria-pressed={d === escolhido}
                  onClick={() => {
                    onChange(String(d));
                    setOpen(false);
                  }}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="ob-actions">
              <button className="ob-skip" onClick={() => setOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
