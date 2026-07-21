import type { CSSProperties } from "react";

const grains = [
  { x: 238, y: 48, delay: "-0.2s" },
  { x: 258, y: 70, delay: "-1.4s" },
  { x: 280, y: 44, delay: "-2.1s" },
  { x: 300, y: 67, delay: "-0.8s" },
  { x: 320, y: 46, delay: "-1.8s" },
];

export function MillFlowVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-label="Paddy milling process illustration">
      <div className="absolute inset-8 rounded-full bg-amber-400/10 blur-3xl" />
      <svg viewBox="0 0 560 520" className="relative w-full overflow-visible" role="img">
        <title>Paddy entering the mill and becoming broken rice, rice bran, and rice husk</title>
        <defs>
          <linearGradient id="machine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F5D77A" stopOpacity=".18" />
            <stop offset="1" stopColor="#C98523" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="hopper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EBCB68" stopOpacity=".32" />
            <stop offset="1" stopColor="#C57B20" stopOpacity=".08" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g className="mill-grid" opacity=".2" stroke="#E7C461" strokeWidth="1">
          {[80, 140, 200, 260, 320, 380, 440].map((y) => <path key={y} d={`M40 ${y}H520`} />)}
          {[80, 160, 240, 320, 400, 480].map((x) => <path key={x} d={`M${x} 35V475`} />)}
        </g>

        <text x="280" y="29" textAnchor="middle" fill="#EACB72" fontSize="12" letterSpacing="3">PADDY IN</text>
        <path d="M213 52h134l-23 82h-88L213 52Z" fill="url(#hopper)" stroke="#E2B94F" strokeWidth="2" />
        <path d="M242 134h76v46h-76z" fill="#D59431" fillOpacity=".1" stroke="#DFAF42" strokeWidth="2" />

        {grains.map((grain, index) => (
          <ellipse
            key={index}
            className="grain-fall"
            cx={grain.x}
            cy={grain.y}
            rx="4"
            ry="9"
            transform={`rotate(${index % 2 ? -25 : 24} ${grain.x} ${grain.y})`}
            fill="#F6D776"
            style={{ animationDelay: grain.delay } as CSSProperties}
          />
        ))}

        <g>
          <path d="M150 180h260l-20 178H170l-20-178Z" fill="url(#machine)" stroke="#C98A2C" strokeWidth="2" />
          <path d="M168 204h224" stroke="#E3B14C" strokeOpacity=".5" />
          <path d="M180 335h200" stroke="#E3B14C" strokeOpacity=".5" />
          <rect x="205" y="226" width="150" height="87" rx="8" fill="#0D160F" stroke="#D59A38" strokeWidth="2" />
          <circle className="mill-wheel" cx="280" cy="269.5" r="28" fill="none" stroke="#F0CC65" strokeWidth="2" strokeDasharray="6 8" />
          <circle cx="280" cy="269.5" r="9" fill="#E0A63F" filter="url(#glow)" />
          <path d="M280 241v57M251.5 269.5h57M260 249l40 41M300 249l-40 41" stroke="#D7A33E" strokeWidth="1.5" />
          <text x="280" y="329" textAnchor="middle" fill="#EBCB72" fontSize="10" letterSpacing="2.6">MILLING</text>
          <path d="M189 358v36M280 358v36M371 358v36" stroke="#D79835" strokeWidth="2" />
        </g>

        <g className="flow-dash" fill="none" strokeWidth="2" strokeDasharray="5 7">
          <path d="M189 393c0 35-74 24-88 59" stroke="#E2B94F" />
          <path d="M280 393v59" stroke="#D8A753" />
          <path d="M371 393c0 35 74 24 88 59" stroke="#B87A3C" />
        </g>

        <g>
          <circle cx="100" cy="456" r="38" fill="#E0B84B" fillOpacity=".12" stroke="#E0B84B" strokeOpacity=".55" />
          <path d="M83 463c12-15 22-20 34-25M88 470c10-9 20-14 31-17" stroke="#F0D071" strokeWidth="2" strokeLinecap="round" />
          <text x="100" y="511" textAnchor="middle" fill="#F0D071" fontSize="11" letterSpacing="1.5">BROKEN RICE</text>

          <circle cx="280" cy="456" r="38" fill="#B87535" fillOpacity=".14" stroke="#C98A45" strokeOpacity=".7" />
          <path d="M260 462c14-20 28-21 40-12-7 15-20 24-40 12Z" fill="#C9904D" fillOpacity=".65" />
          <text x="280" y="511" textAnchor="middle" fill="#D9A45C" fontSize="11" letterSpacing="1.5">RICE BRAN</text>

          <circle cx="460" cy="456" r="38" fill="#8E5B32" fillOpacity=".16" stroke="#A86D3C" strokeOpacity=".75" />
          <path d="M444 466c6-19 15-28 29-31-1 17-10 28-29 31Z" fill="#B37744" fillOpacity=".7" />
          <text x="460" y="511" textAnchor="middle" fill="#C98A56" fontSize="11" letterSpacing="1.5">RICE HUSK</text>
        </g>

        <path d="M56 56h47M56 56v47M504 56h-47M504 56v47" stroke="#D59A38" strokeOpacity=".45" />
      </svg>
    </div>
  );
}
