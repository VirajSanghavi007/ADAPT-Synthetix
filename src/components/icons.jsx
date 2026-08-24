const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

export function IconLayers({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  )
}

export function IconBridge({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M3 17c3-6 15-6 18 0" />
      <path d="M3 17h18" />
      <path d="M7 17v3M12 17v3M17 17v3" />
    </svg>
  )
}

export function IconGlobe({ className }) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.6 2.3 4 5.3 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.3-4-8.5s1.4-6.2 4-8.5Z" />
    </svg>
  )
}

export function IconShield({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3.5 19 6v6c0 4.6-3 7.6-7 8.5-4-.9-7-3.9-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function IconMic({ className }) {
  return (
    <svg className={className} {...base}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </svg>
  )
}

export function IconSliders({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M5 21V10M5 6V3M12 21v-4M12 13V3M19 21v-8M19 9V3" />
      <circle cx="5" cy="13" r="2.2" />
      <circle cx="12" cy="16" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
    </svg>
  )
}

export function IconWave({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M3 12h2l2-6 3 15 3-12 2 3h6" />
    </svg>
  )
}

export function IconDoc({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 13h5M9.5 16.5h5" />
    </svg>
  )
}

export function IconHand({ className }) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="6" r="2.4" />
      <path d="M7 21v-6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v6" />
      <path d="M9 21v-4M15 21v-4" />
    </svg>
  )
}

export function IconHeart({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="M12 20.5s-7.5-4.7-9.3-9.5C1.6 7.7 3.4 5 6.4 5c1.9 0 3.3 1 4.6 2.6C12.3 6 13.7 5 15.6 5c3 0 4.8 2.7 3.7 6-1.8 4.8-9.3 9.5-9.3 9.5Z" />
    </svg>
  )
}

export function IconCap({ className }) {
  return (
    <svg className={className} {...base}>
      <path d="m2 9 10-5 10 5-10 5-10-5Z" />
      <path d="M6 11v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5" />
      <path d="M22 9v6" />
    </svg>
  )
}

export function IconBriefcase({ className }) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  )
}
