import { useEffect, useState } from 'react';
import { OUTLINES } from './shunyaOutline';

const SEEN = 'zerohour-splash-seen';

// Intro: on a black screen the Shunya logo is drawn as a thin white outline, holds for a moment,
// then the whole screen fades into the page. Shown once per browser session.
export default function Splash() {
  const [phase, setPhase] = useState(() => {
    try { if (sessionStorage.getItem(SEEN)) return 'gone'; } catch { /* ignore */ }
    return 'show';
  });

  useEffect(() => {
    if (phase === 'gone') return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setPhase('hide'), reduce ? 500 : 2000);
    const t2 = setTimeout(() => {
      setPhase('gone');
      try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }
    }, reduce ? 800 : 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div className={'splash ' + phase} aria-hidden="true">
      <svg className="outline" viewBox="0 0 130 130" fill="none">
        {OUTLINES.map((d, i) => (
          <path key={i} d={d} pathLength="1" style={{ animationDelay: 0.3 + i * 0.06 + 's' }} />
        ))}
      </svg>
    </div>
  );
}
