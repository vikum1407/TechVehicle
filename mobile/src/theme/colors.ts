export type Colors = typeof lightColors

export const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceAlt: '#fafafa',
  text: '#1a1a1a',
  textBody: '#333333',
  textSub: '#555555',
  textMuted: '#888888',
  textFaint: '#aaaaaa',
  border: '#eeeeee',
  borderMid: '#dddddd',
  borderStrong: '#cccccc',
  // navy tint surfaces (used for info cards, unread highlight, etc.)
  primaryTint: '#e7edf3',
  primaryTintText: '#1d3a5f',
  // brand primary — navy
  primary: '#1d3a5f',
  // brand accent — amber (verified badges, due-soon chips, highlights)
  accent: '#e3a008',
  accentTint: '#fbf0d9',
  accentTintText: '#8a6300',
  success: '#43a047',
  error: '#e53935',
  warning: '#f9a825',
  orange: '#fb8c00',
}

export const darkColors: Colors = {
  background: '#111111',
  surface: '#1c1c1e',
  surfaceAlt: '#2c2c2e',
  text: '#f2f2f7',
  textBody: '#e5e5ea',
  textSub: '#ebebf0',
  textMuted: '#98989e',
  textFaint: '#636366',
  border: '#2c2c2e',
  borderMid: '#3a3a3c',
  borderStrong: '#48484a',
  primaryTint: '#1e3348',
  primaryTintText: '#6e9bc7',
  // brand primary — lifted navy for contrast against dark backgrounds
  primary: '#4a729e',
  // brand accent — brighter amber for dark backgrounds
  accent: '#f0b429',
  accentTint: '#3a2e10',
  accentTintText: '#f0b429',
  success: '#43a047',
  error: '#e53935',
  warning: '#f9a825',
  orange: '#fb8c00',
}
