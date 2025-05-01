import React from 'react';

export const SolanaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100" // Adjusted viewBox for better aspect ratio
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <linearGradient id="solana-gradient" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stopColor="#14F195" /> {/* Solana Green */}
       <stop offset="100%" stopColor="#9945FF" /> {/* Solana Purple */}
     </linearGradient>
     <path
       fill="url(#solana-gradient)"
       d="M 7.11 59.1 L 40.87 79.06 C 45.53 81.91 51.61 81.91 56.28 79.06 L 89.79 59.25 C 94.46 56.4 97.41 51.29 97.41 45.77 L 97.41 25.98 C 97.41 20.46 94.46 15.35 89.79 12.5 L 56.28 0.58 C 51.61 -1.16 45.53 -1.16 40.87 0.58 L 7.11 20.65 C 2.44 23.5 0 28.6 0 34.12 L 0 54.06 C 0 51.2 2.44 56.25 7.11 59.1 Z"
    />
  </svg>
);
