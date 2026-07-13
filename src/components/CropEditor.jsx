import React, { useState, useRef, useEffect } from 'react';

const D = 280;   // tamanho de exibição do canvas
// Tamanho de saída: o maior uso é o card da seleção de perfil (108px CSS), que
// em telas 3x precisa de ~324px físicos — 384 dá folga sem pesar (~40 KB).
const OUT = 384;
const MAX_Z = 4; // zoom máximo relativo ao minScale

function clamp(x, y, s, img) {
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  return {
    x: Math.min(0, Math.max(D - w, x)),
    y: Math.min(0, Math.max(D - h, y)),
  };
}

export default function CropEditor({ src, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef   = useRef(null);
  // ref sincronizado com o estado para uso em listeners nativos
  const live = useRef({ x: 0, y: 0, s: 1, mn: 1 });
  const drag = useRef(null);

  const [offset, _setOffset] = useState({ x: 0, y: 0 });
  const [scale,  _setScale]  = useState(1);
  const [minS,   setMinS]    = useState(1);
  const [ready,  setReady]   = useState(false);

  const setOffset = (v) => { live.current.x = v.x; live.current.y = v.y; _setOffset(v); };
  const setScale  = (v) => { live.current.s = v;   _setScale(v); };

  // Carrega a imagem e define escala/posição inicial (cobertura total do canvas)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const s  = Math.max(D / img.naturalWidth, D / img.naturalHeight);
      const x  = (D - img.naturalWidth  * s) / 2;
      const y  = (D - img.naturalHeight * s) / 2;
      live.current = { x, y, s, mn: s };
      setMinS(s);
      _setScale(s);
      _setOffset({ x, y });
      setReady(true);
    };
    img.src = src;
  }, [src]);

  // Re-renderiza o canvas sempre que offset/scale mudam
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, D, D);
    ctx.drawImage(img, offset.x, offset.y, img.naturalWidth * scale, img.naturalHeight * scale);
  }, [offset, scale, ready]);

  // Listeners nativos (wheel e touch exigem passive:false para preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const img = imgRef.current;
      if (!img) return;
      const { x, y, s, mn } = live.current;
      const ns = Math.max(mn, Math.min(s * (e.deltaY < 0 ? 1.1 : 0.91), mn * MAX_Z));
      const r  = ns / s;
      setScale(ns);
      setOffset(clamp(D / 2 - (D / 2 - x) * r, D / 2 - (D / 2 - y) * r, ns, img));
    };

    const onTouchStart = (e) => {
      const t = e.touches[0];
      drag.current = { sx: t.clientX, sy: t.clientY, ox: live.current.x, oy: live.current.y };
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (!drag.current) return;
      const t = e.touches[0];
      const img = imgRef.current;
      if (!img) return;
      setOffset(clamp(
        drag.current.ox + t.clientX - drag.current.sx,
        drag.current.oy + t.clientY - drag.current.sy,
        live.current.s, img
      ));
    };

    const onTouchEnd = () => { drag.current = null; };

    canvas.addEventListener('wheel',      onWheel,      { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true  });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);
    return () => {
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  // Eventos de mouse (sintéticos do React)
  const onMouseDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: live.current.x, oy: live.current.y };
  };
  const onMouseMove = (e) => {
    if (!drag.current) return;
    const img = imgRef.current;
    if (!img) return;
    setOffset(clamp(
      drag.current.ox + e.clientX - drag.current.sx,
      drag.current.oy + e.clientY - drag.current.sy,
      live.current.s, img
    ));
  };
  const onMouseUp = () => { drag.current = null; };

  // Slider de zoom
  const onZoom = (e) => {
    const img = imgRef.current;
    if (!img) return;
    const { x, y, s } = live.current;
    const ns = minS * (1 + parseFloat(e.target.value) * (MAX_Z - 1));
    const r  = ns / s;
    setScale(ns);
    setOffset(clamp(D / 2 - (D / 2 - x) * r, D / 2 - (D / 2 - y) * r, ns, img));
  };

  // Gera o canvas de saída com o recorte atual
  function save() {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement('canvas');
    out.width  = OUT;
    out.height = OUT;
    const f = OUT / D;
    const ctx = out.getContext('2d');
    // Fotos de câmera chegam com milhares de pixels; sem isso o downscale em um
    // passo só sai serrilhado em alguns navegadores.
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      offset.x * f, offset.y * f,
      img.naturalWidth * scale * f, img.naturalHeight * scale * f
    );
    onSave(out.toDataURL('image/jpeg', 0.88));
  }

  const zoomPct = minS > 0 ? (scale / minS - 1) / (MAX_Z - 1) : 0;

  return (
    <div className="ce-backdrop">
      <div className="ce-modal">
        <div className="card-head">
          <span className="card-title">Ajustar foto</span>
        </div>

        <div className="ce-stage">
          <canvas
            ref={canvasRef}
            width={D}
            height={D}
            className="ce-canvas"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
          <div className="ce-dim" />
          <div className="ce-ring" />
        </div>

        <div className="ce-zoom-row">
          <span className="ce-zoom-ico">⊖</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={zoomPct}
            onChange={onZoom}
          />
          <span className="ce-zoom-ico">⊕</span>
        </div>

        <p className="hint ce-hint">Arraste para reposicionar · Scroll ou slider para zoom</p>

        <div className="close-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancelar</button>
          <button className="btn-confirm" onClick={save} disabled={!ready}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
