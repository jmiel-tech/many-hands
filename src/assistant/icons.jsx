const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Sparkle = (p) => (<svg width="24" height="24" strokeWidth="1.8" {...svgProps} {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>);
export const ArrowUp = (p) => (<svg width="18" height="18" strokeWidth="2.4" {...svgProps} {...p}><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>);
export const Stop = (p) => (<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...p}><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" /></svg>);
export const Check = (p) => (<svg width="18" height="18" strokeWidth="2.2" {...svgProps} {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>);
export const Ban = (p) => (<svg width="18" height="18" strokeWidth="2" {...svgProps} {...p}><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></svg>);
export const Chevron = (p) => (<svg width="16" height="16" strokeWidth="2.2" {...svgProps} {...p}><path d="M9 6l6 6-6 6" /></svg>);
