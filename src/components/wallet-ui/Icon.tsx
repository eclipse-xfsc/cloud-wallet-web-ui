import { type CSSProperties } from 'react';
export default function Icon({
  name,
  style,
}: {
  name: 'wallet' | 'send' | 'receive' | 'lock' | 'history';
  style?: CSSProperties;
}): JSX.Element {
  const paths = {
    wallet: 'M3 7V5a2 2 0 0 1 2-2h13v4M3 7h17v14H3V7Zm12 6h5v4h-5v-4Z',
    send: 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7',
    receive: 'M12 3v13m-5-5 5 5 5-5M4 14v7h16v-7',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v12H5V10Zm7 4v4',
    history: 'M3 5v5h5M3 10a9 9 0 1 1 1 8M12 7v5l3 2',
  };
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
