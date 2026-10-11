import { useEffect, useId, useRef } from 'react';

export type Mood = 'happy' | 'calm' | 'watch' | 'alert' | 'dizzy' | 'wink' | 'sleepy';

interface Props {
  readonly mood: Mood;
  readonly size?: number;
  /**
   * Follow the pointer with the eyes and lean towards it. Meant for the one large mascot
   * on a page; the small ones in the header and cards stay still.
   */
  readonly interactive?: boolean;
  readonly className?: string;
}

const MAX_GAZE = 7;
const IDLE_AFTER_MS = 3500;

/**
 * The cloud that speaks for the site, drawn as SVG so it stays sharp at any size. It is
 * decoration beside text that says the same thing, so it is hidden from screen readers.
 *
 * The body is five overlapping circles used as a clip, with the colour painted behind
 * them as one gradient; filling each circle separately would show a seam at every overlap.
 */
export function Mascot({ mood, size = 96, interactive = false, className }: Props) {
  const id = useId();
  const root = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = root.current;
    if (!interactive || svg === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastMove = 0;

    const look = (x: number, y: number) => {
      svg.style.setProperty('--gaze-x', `${x.toFixed(2)}px`);
      svg.style.setProperty('--gaze-y', `${y.toFixed(2)}px`);
      svg.style.setProperty('--lean', `${(x * 0.7).toFixed(2)}deg`);
    };

    const onMove = (event: PointerEvent) => {
      lastMove = performance.now();
      const box = svg.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height * 0.42);
      const distance = Math.hypot(dx, dy);
      // The eyes reach their limit when the pointer is a mascot's width away.
      const reach = Math.min(1, distance / box.width);
      look((dx / (distance || 1)) * MAX_GAZE * reach, (dy / (distance || 1)) * MAX_GAZE * reach);
    };

    // Left alone, the cloud glances around every few seconds instead of staring ahead.
    const idle = window.setInterval(() => {
      if (reduced || performance.now() - lastMove < IDLE_AFTER_MS) return;
      const angle = Math.random() * Math.PI * 2;
      look(Math.cos(angle) * MAX_GAZE * 0.7, Math.sin(angle) * MAX_GAZE * 0.45);
    }, 2600);

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.clearInterval(idle);
    };
  }, [interactive]);

  const press = (down: boolean) => {
    root.current?.classList.toggle('mascot-pressed', down);
  };

  return (
    <svg
      ref={root}
      viewBox="0 0 200 180"
      width={size}
      height={size * 0.9}
      aria-hidden="true"
      className={['mascot', `mascot-${mood}`, interactive ? 'mascot-live' : '', className ?? ''].join(' ').trim()}
      onPointerDown={interactive ? () => press(true) : undefined}
      onPointerUp={interactive ? () => press(false) : undefined}
      onPointerLeave={interactive ? () => press(false) : undefined}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="38%" cy="26%" r="85%">
          <stop offset="0" stopColor="#ff6f78" />
          <stop offset="0.42" stopColor="#db2b37" />
          <stop offset="1" stopColor="#a11422" />
        </radialGradient>
        <radialGradient id={`${id}-shine`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-cloud`}>
          <circle cx="100" cy="66" r="48" />
          <circle cx="54" cy="98" r="40" />
          <circle cx="146" cy="98" r="40" />
          <circle cx="74" cy="128" r="37" />
          <circle cx="126" cy="128" r="37" />
          <circle cx="100" cy="100" r="50" />
        </clipPath>
      </defs>

      <ellipse className="mascot-shadow" cx="100" cy="172" rx="56" ry="6" />

      <g className="mascot-body">
        <g clipPath={`url(#${id}-cloud)`}>
          <rect x="0" y="0" width="200" height="180" fill={`url(#${id}-body)`} />
          <ellipse cx="74" cy="52" rx="46" ry="30" fill={`url(#${id}-shine)`} />
          <ellipse cx="118" cy="164" rx="84" ry="24" fill="#7d0d18" opacity="0.2" />
        </g>

        <g className="mascot-face">
          {mood === 'dizzy' ? (
            // Half circles of growing radius, each starting where the last ended, draw one
            // unbroken spiral per eye.
            <>
              <path className="mascot-spiral" d="M84 84a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8 8 0 0 1-16 0" />
              <path className="mascot-spiral mascot-spiral-right" d="M114 84a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8 8 0 0 1-16 0" />
            </>
          ) : (
            <>
              <rect className="mascot-eye" x="80" y="70" width="10" height="28" rx="5" />
              {mood === 'wink' ? (
                <path className="mascot-wink" d="M107 86q8 -8 16 0" />
              ) : (
                <rect className="mascot-eye mascot-eye-right" x="110" y="70" width="10" height="28" rx="5" />
              )}
            </>
          )}
          {mood === 'alert' && <path className="mascot-mark" d="M148 40l8 -14M160 50l14 -8M164 64l15 -1" />}
          {mood === 'sleepy' && <path className="mascot-mark" d="M146 44h12l-12 12h12M166 26h9l-9 9h9" />}
        </g>
      </g>
    </svg>
  );
}
