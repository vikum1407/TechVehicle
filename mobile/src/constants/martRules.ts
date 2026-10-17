// duplicate of backend/src/data/martRules.ts — keep in sync. Spec: 04-screens.md §20.4.
// Wording status (per the handoff package): first draft written by Claude, Vikum to review
// (especially rule 7's "not responsible for disputes" line) before public launch, ideally
// with a legal read-through too. si/ta added Step 3.7 — same first-draft status as the
// English text, not native-speaker-checked, flagged in docs/mart/DECISIONS-MADE.md.
// If this text changes in a way that needs re-consent, bump MART_RULES_VERSION — every
// user who already accepted the old version will be asked again at their next post/message/offer.
// A pure wording/translation pass (like adding si/ta here) does not change the agreed
// meaning, so it does NOT need a version bump on its own.
export const MART_RULES_VERSION = 1

type Lang = 'en' | 'si' | 'ta'
type LocalizedText = { en: string; si: string; ta: string }
type LocalizedRule = { en: { title: string; desc: string }; si: { title: string; desc: string }; ta: { title: string; desc: string } }

const INTRO: LocalizedText = {
  en: 'Vocksy Mart is for car parts in Sri Lanka. Please follow these rules. Ads that break them can be removed.',
  si: 'Vocksy Mart ශ්‍රී ලංකාවේ වාහන කොටස් සඳහා වේ. කරුණාකර මෙම නීති අනුගමනය කරන්න. ඒවා කඩ කරන දැන්වීම් ඉවත් කළ හැක.',
  ta: 'Vocksy Mart இலங்கையில் வாகன பாகங்களுக்காக. இந்த விதிகளைப் பின்பற்றவும். இவற்றை மீறும் விளம்பரங்கள் அகற்றப்படலாம்.',
}

const ITEMS: LocalizedRule[] = [
  {
    en: { title: 'No stolen parts', desc: 'Sell only parts you have the right to sell.' },
    si: { title: 'සොරකම් කළ කොටස් තහනම්', desc: 'ඔබට විකිණීමේ අයිතිය ඇති කොටස් පමණක් විකුණන්න.' },
    ta: { title: 'திருடப்பட்ட பாகங்கள் தடை', desc: 'விற்பனை செய்ய உரிமை உள்ள பாகங்களை மட்டும் விற்கவும்.' },
  },
  {
    en: { title: 'No fake parts sold as original', desc: 'Say honestly if a part is used, copied or repaired.' },
    si: { title: 'අව්‍යාජ ලෙස විකුණන ව්‍යාජ කොටස් තහනම්', desc: 'කොටසක් භාවිතා කළ, පිටපත් කළ හෝ අලුත්වැඩියා කළ දැයි අවංකව පවසන්න.' },
    ta: { title: 'அசலாக விற்கப்படும் போலி பாகங்கள் தடை', desc: 'ஒரு பாகம் பயன்படுத்தப்பட்டதா, நகலெடுக்கப்பட்டதா அல்லது சரிசெய்யப்பட்டதா என்பதை நேர்மையாகச் சொல்லுங்கள்.' },
  },
  {
    en: { title: 'No illegal items', desc: 'Nothing that is against Sri Lankan law.' },
    si: { title: 'නීති විරෝධී අයිතම තහනම්', desc: 'ශ්‍රී ලංකා නීතියට පටහැනි කිසිවක් නැත.' },
    ta: { title: 'சட்டவிரோத பொருட்கள் தடை', desc: 'இலங்கை சட்டத்திற்கு எதிரான எதுவும் இல்லை.' },
  },
  {
    en: { title: 'Real photos and honest details', desc: 'Use your own photos. Write the true condition and price.' },
    si: { title: 'තත්ත්ව ඡායාරූප සහ අවංක විස්තර', desc: 'ඔබේම ඡායාරූප භාවිතා කරන්න. සැබෑ තත්ත්වය සහ මිල ලියන්න.' },
    ta: { title: 'உண்மையான புகைப்படங்களும் நேர்மையான விவரங்களும்', desc: 'உங்கள் சொந்த புகைப்படங்களைப் பயன்படுத்துங்கள். உண்மையான நிலையையும் விலையையும் எழுதுங்கள்.' },
  },
  {
    en: { title: 'No spam', desc: 'One ad per item. No repeated or unrelated ads.' },
    si: { title: 'ස්පෑම් තහනම්', desc: 'එක් අයිතමයකට එක් දැන්වීමක්. පුනරාවර්තන හෝ අදාළ නොවන දැන්වීම් නැත.' },
    ta: { title: 'ஸ்பேம் தடை', desc: 'ஒரு பொருளுக்கு ஒரு விளம்பரம். மீண்டும் மீண்டும் அல்லது தொடர்பில்லாத விளம்பரங்கள் இல்லை.' },
  },
  {
    en: { title: 'Be respectful in chat', desc: 'No threats, abuse or harassment.' },
    si: { title: 'කතාබසේ ගරුබිරුසුම් සිටින්න', desc: 'තර්ජන, අපවාද හෝ හිරිහැර නැත.' },
    ta: { title: 'அரட்டையில் மதிப்புடன் இருங்கள்', desc: 'அச்சுறுத்தல்கள், துஷ்பிரயோகம் அல்லது தொந்தரவு இல்லை.' },
  },
  {
    en: { title: 'Stay safe on payment', desc: 'Meet in a public place and check the part before you pay. Vocksy does not handle payments or disputes.' },
    si: { title: 'ගෙවීමේදී ආරක්ෂිතව සිටින්න', desc: 'පොදු ස්ථානයක හමුවී ගෙවීමට පෙර කොටස පරීක්ෂා කරන්න. Vocksy ගෙවීම් හෝ ගැටුම් හැසිරවීම් නොකරයි.' },
    ta: { title: 'பணம் செலுத்துவதில் பாதுகாப்பாக இருங்கள்', desc: 'பொது இடத்தில் சந்தித்து, பணம் செலுத்தும் முன் பாகத்தை சரிபார்க்கவும். Vocksy பணம் செலுத்துதல் அல்லது சர்ச்சைகளை கையாளாது.' },
  },
]

// English-only fallback shape, for any caller not yet updated to pick a language.
export const MART_RULES = {
  intro: INTRO.en,
  items: ITEMS.map(r => r.en),
}

export function getLocalizedMartRules(language: Lang) {
  return {
    intro: INTRO[language] || INTRO.en,
    items: ITEMS.map(r => r[language] || r.en),
  }
}
