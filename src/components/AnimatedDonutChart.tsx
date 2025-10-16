import React, { useEffect, useRef, useState } from 'react';
import styles from './AnimatedDonutChart.module.css';

type Slice = { label: string; value: number; color: string };

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(angleInRadians), y: cy + r * Math.sin(angleInRadians) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  const d = ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  return d;
}

export default function AnimatedDonutChart({ slices }: { slices: Slice[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [anim, setAnim] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(true);
      });
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let start: number | null = null;
    function step(ts: number) {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / 900);
      setAnim(t);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    if (visible) rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible]);

  const total = slices.reduce((s, x) => s + x.value, 0);
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = 120;

  let angle = 0;

  return (
    <div ref={ref} className={`${styles.container} ${styles.fadeIn} ${visible ? styles.visible : ''}`}>
      <div className={styles.chartWrapper}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* background ring */}
          <circle cx={cx} cy={cy} r={r + 18} fill="rgba(0,0,0,0.25)" />

          {slices.map((s, i) => {
            const startAngle = angle;
            const sweep = (s.value / total) * 360;
            const endAngle = angle + sweep;
            const pathD = describeArc(cx, cy, r, startAngle, endAngle);
            // length approx for dash array animation (circumference * fraction)
            const circumference = 2 * Math.PI * r;
            const frac = sweep / 360;
            const targetLen = circumference * frac;
            const drawLen = targetLen * anim;
            angle = endAngle;
            return (
              <g key={i}>
                <path d={pathD} stroke={s.color} strokeWidth={28} strokeLinecap="round" fill="none"
                  strokeDasharray={`${drawLen} ${Math.max(1, circumference)}`} strokeOpacity={0.95} />
                <path d={pathD} stroke={s.color} strokeWidth={6} strokeLinecap="round" fill="none" strokeOpacity={0.9} />
              </g>
            );
          })}

          {/* inner hole */}
          <circle cx={cx} cy={cy} r={r - 38} fill="#0b0b0b" />

          {/* center number */}
          <text x={cx} y={cy - 6} fontSize={32} fontWeight={700} textAnchor="middle" fill="#9ef6f1">
            {Math.round(total * anim)}%
          </text>
          <text x={cx} y={cy + 22} fontSize={12} textAnchor="middle" fill="#b9f9f7">
            of SMEs
          </text>
        </svg>
      </div>

      <div className={styles.legend}>
        {slices.map((s, i) => (
          <div key={i} className={`${styles.legendItem} ${styles.fadeIn} ${visible ? styles.visible : ''}`} style={{ transitionDelay: `${i * 80}ms` }}>
            <div className={styles.labelColor} style={{ background: s.color }} />
            <div>
              <div style={{ fontWeight: 700 }}>{s.label}</div>
              <div style={{ color: '#9aa', fontSize: 13 }}>{s.value}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
