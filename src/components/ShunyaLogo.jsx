import logo from '../assets/shunya-logo.svg';
import { OUTLINES } from './shunyaOutline';

export default function ShunyaLogo() {
  return (
    <span className="shunya-logo" aria-hidden="true">
      <img src={logo} width="130" height="130" alt="" />
      <svg viewBox="0 0 130 130" fill="none" focusable="false">
        <rect x=".75" y=".75" width="128.5" height="128.5" rx="26" pathLength="1" />
        {OUTLINES.map((path, index) => (
          <path key={path} d={path} pathLength="1" style={{ '--trace-delay': 55 * index + 'ms' }} />
        ))}
      </svg>
    </span>
  );
}
