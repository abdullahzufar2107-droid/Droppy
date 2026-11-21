// Kumpulan ikon SVG inline (gaya outline, 24x24). Warna mengikuti `currentColor`.
const o = (inner, sw = 2) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const f = (inner) => `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${inner}</svg>`;

export const icons = {
  // Logo: dua balon chat (outline teal)
  logo: `<svg viewBox="0 0 48 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4h20a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-2v6l-7-6H20a5 5 0 0 1-5-5V9a5 5 0 0 1 5-5z"/><path d="M8 15h16a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H15l-7 5v-5a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5z" fill="#fff"/><path d="M12 24h.01M17 24h.01M22 24h.01" stroke-width="3"/></svg>`,

  grid: o('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>', 1.8),
  compass: o('<circle cx="12" cy="12" r="9.5"/><polygon points="15.8 8.2 13.6 13.6 8.2 15.8 10.4 10.4 15.8 8.2"/>', 1.8),
  people: f('<circle cx="9" cy="8" r="3.6"/><path d="M2.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6v.5h-13z"/><circle cx="17" cy="9" r="2.8" opacity=".85"/><path d="M16.2 13.6c3.2-.3 5.8 1.7 5.8 4.9v1.5h-4.6v-1.4c0-1.9-.5-3.5-1.2-5z" opacity=".85"/>'),
  chart: o('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8.5 16.5v-5M12 16.5V7.5M15.5 16.5v-3"/>', 1.8),
  phoneFilled: f('<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>'),

  chevronLeft: o('<path d="M15 5l-7 7 7 7"/>', 2.2),
  chevronUp: o('<path d="M5 15l7-7 7 7"/>', 2),
  gear: o('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>', 1.6),
  search: o('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>', 1.9),
  plus: o('<path d="M12 5v14M5 12h14"/>', 2.4),
  kebab: f('<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>'),
  dots: f('<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>'),

  phone: o('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', 1.8),
  video: f('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5z"/><path d="M17.5 10.2l3.6-2.3a.8.8 0 0 1 1.2.7v6.8a.8.8 0 0 1-1.2.7l-3.6-2.3z"/>'),
  mic: f('<path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5.5a3.5 3.5 0 0 0-7 0V11a3.5 3.5 0 0 0 3.5 3.5z"/><path d="M6 11a1 1 0 1 1 2 0 4 4 0 0 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.9V19h2.2a1 1 0 1 1 0 2H8.8a1 1 0 1 1 0-2H11v-2.1A6 6 0 0 1 6 11z"/>'),
  cloudUp: f('<path d="M12 4a6 6 0 0 1 5.7 4.1A4.5 4.5 0 0 1 17.5 17H7a5 5 0 0 1-.9-9.9A6 6 0 0 1 12 4zm0 5-3.2 3.3a.9.9 0 0 0 1.3 1.3l1-1V16a.9.9 0 1 0 1.8 0v-3.4l1 1a.9.9 0 0 0 1.3-1.3z"/>'),
  send: f('<path d="M21.6 2.4a1 1 0 0 0-1-.2L2.8 9.1a1 1 0 0 0-.1 1.8l7 3.3 3.3 7a1 1 0 0 0 1.8-.1l6.9-17.8a1 1 0 0 0-.1-.9zM10.9 12.6l-3.6-1.7 9.3-3.6z"/>'),

  edit: o('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>', 1.8),
  doc: o('<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 12h6M9 16h6M9 8h3"/>', 1.9),
  image: o('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>', 1.9),
  moreDots: f('<circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/>'),

  bell: f('<path d="M12 2.5a6 6 0 0 0-6 6c0 6.2-2.5 7.7-2.5 7.7h17S18 14.7 18 8.5a6 6 0 0 0-6-6zM10.1 19a2 2 0 0 0 3.8 0z"/>'),
  userPlus: f('<circle cx="9" cy="7.5" r="4"/><path d="M1.5 20.5c0-3.6 3-6 7.5-6s7.5 2.4 7.5 6z"/><path d="M19 8v2.5h2.5a.9.9 0 1 1 0 1.8H19v2.5a.9.9 0 1 1-1.8 0v-2.5h-2.5a.9.9 0 1 1 0-1.8h2.5V8a.9.9 0 1 1 1.8 0z"/>'),
  alert: f('<path d="M10.3 3.9 1.8 18.1A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5M12 16.8h.01" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
  trash: f('<path d="M9 3h6l1 1.5h4a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h4zM5.5 8.5h13l-.9 11a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8z"/>'),
  users: f('<circle cx="9" cy="8" r="3.6"/><path d="M2 20c0-3.7 3-6 7-6s7 2.3 7 6z"/><circle cx="17.5" cy="9" r="2.8"/><path d="M17 13.6c3-.2 5.5 1.7 5.5 5V20h-4.4v-1.6c0-1.9-.5-3.5-1.1-4.8z"/>'),
  copy: o('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 1.9),
  close: o('<path d="M6 6l12 12M18 6 6 18"/>', 2),
};
