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
  // blue tint surfaces (used for info cards, unread highlight, etc.)
  primaryTint: '#e8f0fe',
  primaryTintText: '#1a73e8',
  // fixed accent — same in both modes
  primary: '#1a73e8',
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
  primaryTint: '#1a3a6b',
  primaryTintText: '#6ba7f5',
  primary: '#1a73e8',
  success: '#43a047',
  error: '#e53935',
  warning: '#f9a825',
  orange: '#fb8c00',
}
