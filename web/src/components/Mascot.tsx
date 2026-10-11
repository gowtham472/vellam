import type { Pose } from '../level.ts';

interface Props {
  readonly pose: Pose;
  readonly size?: number;
  /** A gentle bob, for the places where the mascot is the centre of the page. */
  readonly float?: boolean;
  readonly className?: string;
}

/**
 * The cloud that speaks for the site. It is decoration beside text that says the same
 * thing, so it is hidden from screen readers.
 */
export function Mascot({ pose, size = 96, float = false, className }: Props) {
  return (
    <img
      src={`/mascot/${pose}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={['mascot', float ? 'mascot-float' : '', className ?? ''].join(' ').trim()}
      draggable={false}
    />
  );
}
