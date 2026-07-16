import { TextStyle } from 'react-native'

export const typography: Record<string, TextStyle> = {
  heading: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subhead: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 15,
    fontWeight: '600',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
  },
  numeric: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
}
