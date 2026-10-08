// duplicate of mobile/src/constants/districts.ts — keep in sync, ids identical, never rename.
// Spec: 02-data-model.md §8.2. si/ta labels are a first-pass translation (standard
// administrative district names) — flagged for Vikum's review in docs/mart/DECISIONS-MADE.md.
export type District = { id: string; en: string; si: string; ta: string }

export const DISTRICTS: District[] = [
  { id: 'ampara',        en: 'Ampara',        si: 'අම්පාර',          ta: 'அம்பாறை' },
  { id: 'anuradhapura',  en: 'Anuradhapura',  si: 'අනුරාධපුරය',      ta: 'அநுராதபுரம்' },
  { id: 'badulla',       en: 'Badulla',       si: 'බදුල්ල',           ta: 'பதுளை' },
  { id: 'batticaloa',    en: 'Batticaloa',    si: 'මඩකලපුව',        ta: 'மட்டக்களப்பு' },
  { id: 'colombo',       en: 'Colombo',       si: 'කොළඹ',            ta: 'கொழும்பு' },
  { id: 'galle',         en: 'Galle',         si: 'ගාල්ල',            ta: 'காலி' },
  { id: 'gampaha',       en: 'Gampaha',       si: 'ගම්පහ',           ta: 'கம்பஹா' },
  { id: 'hambantota',    en: 'Hambantota',    si: 'හම්බන්තොට',      ta: 'அம்பாந்தோட்டை' },
  { id: 'jaffna',        en: 'Jaffna',        si: 'යාපනය',           ta: 'யாழ்ப்பாணம்' },
  { id: 'kalutara',      en: 'Kalutara',      si: 'කළුතර',           ta: 'களுத்துறை' },
  { id: 'kandy',         en: 'Kandy',         si: 'මහනුවර',         ta: 'கண்டி' },
  { id: 'kegalle',       en: 'Kegalle',       si: 'කෑගල්ල',          ta: 'கேகாலை' },
  { id: 'kilinochchi',   en: 'Kilinochchi',   si: 'කිලිනොච්චිය',     ta: 'கிளிநொச்சி' },
  { id: 'kurunegala',    en: 'Kurunegala',    si: 'කුරුණෑගල',       ta: 'குருநாகல்' },
  { id: 'mannar',        en: 'Mannar',        si: 'මන්නාරම',        ta: 'மன்னார்' },
  { id: 'matale',        en: 'Matale',        si: 'මාතලේ',           ta: 'மாத்தளை' },
  { id: 'matara',        en: 'Matara',        si: 'මාතර',            ta: 'மாத்தறை' },
  { id: 'monaragala',    en: 'Monaragala',    si: 'මොණරාගල',       ta: 'மொணராகலை' },
  { id: 'mullaitivu',    en: 'Mullaitivu',    si: 'මුලතිව්',          ta: 'முல்லைத்தீவு' },
  { id: 'nuwara_eliya',  en: 'Nuwara Eliya',  si: 'නුවරඑළිය',       ta: 'நுவரெலியா' },
  { id: 'polonnaruwa',   en: 'Polonnaruwa',   si: 'පොළොන්නරුව',    ta: 'பொலன்னறுவை' },
  { id: 'puttalam',      en: 'Puttalam',      si: 'පුත්තලම',         ta: 'புத்தளம்' },
  { id: 'ratnapura',     en: 'Ratnapura',     si: 'රත්නපුර',         ta: 'இரத்தினபுரி' },
  { id: 'trincomalee',   en: 'Trincomalee',   si: 'ත්‍රිකුණාමලය',    ta: 'திருகோணமலை' },
  { id: 'vavuniya',      en: 'Vavuniya',      si: 'වව්නියාව',        ta: 'வவுனியா' },
]
