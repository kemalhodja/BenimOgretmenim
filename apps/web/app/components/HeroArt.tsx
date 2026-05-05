/**
 * Sıcak + akademik: kağıt dokusu, çift ışık, soyut ders/öğrenme motifi.
 */
export function HeroArt() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.45] [background-image:radial-gradient(rgb(30_42_68/0.07)_1.2px,transparent_1.2px)] [background-size:22px_22px]"
      />
      <div className="absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-brand-200/50 via-brand-100/20 to-transparent blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-gradient-to-tr from-warm-200/50 via-warm-100/30 to-transparent blur-3xl" />
      <div className="absolute right-8 top-1/2 hidden h-[min(360px,42vw)] w-[min(360px,42vw)] -translate-y-1/2 sm:block lg:hidden">
        <svg
          viewBox="0 0 400 400"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="h1" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
              <stop stopColor="rgb(44 71 114)" stopOpacity="0.2" />
              <stop offset="0.5" stopColor="rgb(69 104 150)" stopOpacity="0.12" />
              <stop offset="1" stopColor="rgb(183 90 63)" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          <path
            d="M 60 200 Q 200 100 340 200 Q 200 300 60 200"
            stroke="url(#h1)"
            strokeWidth="1.1"
            opacity="0.85"
            fill="none"
          />
          <circle
            cx="200"
            cy="200"
            r="120"
            stroke="url(#h1)"
            strokeWidth="0.8"
            opacity="0.75"
            fill="none"
          />
          <path
            d="M 130 150 L 200 110 L 270 150 M 130 250 L 200 290 L 270 250 M 200 110 L 200 290"
            className="stroke-paper-800/20"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          <circle
            cx="200"
            cy="200"
            r="5"
            className="fill-warm-400/40"
            stroke="rgb(44 71 114 / 0.2)"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    </div>
  );
}
