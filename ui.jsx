const { useState, useEffect, useRef, useMemo } = React;

/* ── Lucide icon (re-scans DOM after each render) ───────────── */
function Icon({ name, className = '', style }) {
  return <i data-lucide={name} className={className} style={style}></i>;
}

/* ── Eyebrow: gold, caps, wide tracking ─────────────────────── */
function Eyebrow({ children, className = '' }) {
  return (
    <div className={`text-gold font-sans font-semibold uppercase text-[12px] sm:text-[13px] tracking-[0.32em] ${className}`}>
      {children}
    </div>
  );
}

/* ── Serif heading with ONE gold word ───────────────────────── */
/* pass text with the gold word wrapped in *asterisks*, e.g. "Твоя жизнь, *звёздами*." */
function SerifTitle({ text, className = '' }) {
  const parts = String(text).split('*');
  return (
    <h2 className={`font-serif text-lav leading-[1.08] tracking-[-0.01em] ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? <span key={i} className="gold-text italic">{p}</span> : <span key={i}>{p}</span>
      )}
    </h2>
  );
}

/* ── Gold CTA button with glow ──────────────────────────────── */
function GoldButton({ children, onClick, className = '', icon = 'sparkles', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`gold-btn group inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 font-sans font-semibold text-[#2A1C05] text-[15px] sm:text-base ${className}`}
    >
      {icon && <Icon name={icon} className="text-[18px]" />}
      <span>{children}</span>
    </button>
  );
}

/* ── Star field (twinkling) ─────────────────────────────────── */
function StarField({ count = 70, className = '' }) {
  const stars = useMemo(() =>
    Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: Math.random() * 1.8 + 0.6,
      d: Math.random() * 5,
      dur: 3 + Math.random() * 4,
      o: 0.35 + Math.random() * 0.6,
    })), [count]);
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {stars.map((st, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: st.x + '%',
            top: st.y + '%',
            width: st.s + 'px',
            height: st.s + 'px',
            borderRadius: '9999px',
            background: i % 7 === 0 ? '#F6E2A6' : '#EDEAF5',
            boxShadow: i % 7 === 0 ? '0 0 6px 1px rgba(246,226,166,.6)' : '0 0 4px rgba(237,234,245,.4)',
            opacity: st.o,
            animation: `twinkle ${st.dur}s ease-in-out ${st.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Zodiac / natal wheel drawn in thin gold lines ──────────── */
function ZodiacWheel({ size = 440, className = '', stroke = '#E3B23C', faint = false }) {
  const c = size / 2;
  const op = faint ? 0.5 : 1;
  const glyphs = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
  const R = [c - 6, c - 40, c - 78, c - 118];
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = R[0];
    const r2 = R[0] - (long ? 16 : 8);
    ticks.push(
      <line key={'t' + i}
        x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1}
        x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2}
        stroke={stroke} strokeWidth={long ? 1.1 : 0.6} opacity={long ? 0.85 : 0.45} />
    );
  }
  const spokes = [];
  const houseGlyphs = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    spokes.push(
      <line key={'s' + i}
        x1={c + Math.cos(a) * R[2]} y1={c + Math.sin(a) * R[2]}
        x2={c + Math.cos(a) * R[1]} y2={c + Math.sin(a) * R[1]}
        stroke={stroke} strokeWidth="0.6" opacity="0.4" />
    );
    const ga = a + (Math.PI / 12);
    const gr = (R[0] + R[1]) / 2;
    houseGlyphs.push(
      <text key={'g' + i}
        x={c + Math.cos(ga) * gr} y={c + Math.sin(ga) * gr}
        fill={stroke} opacity="0.9" fontSize={size * 0.045}
        textAnchor="middle" dominantBaseline="central"
        fontFamily="Playfair Display, serif">{glyphs[i]}</text>
    );
  }
  // inner aspect lines (star pattern)
  const aspects = [];
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    pts.push([c + Math.cos(a) * R[3], c + Math.sin(a) * R[3]]);
  }
  const links = [[0,4],[4,8],[8,0],[2,6],[6,10],[10,2],[1,5],[5,9],[9,1],[3,7],[7,11],[11,3]];
  links.forEach((l, i) => {
    aspects.push(
      <line key={'a' + i} x1={pts[l[0]][0]} y1={pts[l[0]][1]} x2={pts[l[1]][0]} y2={pts[l[1]][1]}
        stroke={stroke} strokeWidth="0.5" opacity="0.3" />
    );
  });
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} className={className}
      style={{ opacity: op, overflow: 'visible' }} aria-hidden="true">
      <g className="spin-slow" style={{ transformOrigin: `${c}px ${c}px` }}>
        {R.map((r, i) => (
          <circle key={'c' + i} cx={c} cy={c} r={r} fill="none" stroke={stroke}
            strokeWidth={i === 0 ? 1.3 : 0.8} opacity={i === 0 ? 0.9 : 0.5} />
        ))}
        {ticks}{spokes}{houseGlyphs}{aspects}
        {pts.map((p, i) => <circle key={'p' + i} cx={p[0]} cy={p[1]} r="1.6" fill={stroke} opacity="0.8" />)}
        <circle cx={c} cy={c} r="2.6" fill={stroke} />
        <circle cx={c} cy={c} r={R[3]} fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.35" />
      </g>
    </svg>
  );
}

/* ── Scroll-reveal wrapper (IntersectionObserver-based, robust) ── */
function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(el);
      }
    }, {
      rootMargin: '0px 0px -8% 0px'
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  
  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'none' : 'translateY(24px)',
    transition: `opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`
  };

  return (
    <Tag ref={ref} className={`${className} ${isVisible ? 'in' : ''}`} style={style}>
      {children}
    </Tag>
  );
}

Object.assign(window, { Icon, Eyebrow, SerifTitle, GoldButton, StarField, ZodiacWheel, Reveal });
