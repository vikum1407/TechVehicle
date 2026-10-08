// duplicate of mobile/src/constants/martRules.ts — keep in sync. Spec: 04-screens.md §20.4.
// Wording status (per the handoff package): first draft written by Claude, Vikum to review
// (especially rule 7's "not responsible for disputes" line) before public launch, ideally
// with a legal read-through too. English only for now — si/ta come in Step 3.7.
// If this text changes in a way that needs re-consent, bump MART_RULES_VERSION — every
// user who already accepted the old version will be asked again at their next post/message/offer.
export const MART_RULES_VERSION = 1

export const MART_RULES = {
  intro: 'Vocksy Mart is for car parts in Sri Lanka. Please follow these rules. Ads that break them can be removed.',
  items: [
    { title: 'No stolen parts', desc: 'Sell only parts you have the right to sell.' },
    { title: 'No fake parts sold as original', desc: 'Say honestly if a part is used, copied or repaired.' },
    { title: 'No illegal items', desc: 'Nothing that is against Sri Lankan law.' },
    { title: 'Real photos and honest details', desc: 'Use your own photos. Write the true condition and price.' },
    { title: 'No spam', desc: 'One ad per item. No repeated or unrelated ads.' },
    { title: 'Be respectful in chat', desc: 'No threats, abuse or harassment.' },
    { title: 'Stay safe on payment', desc: 'Meet in a public place and check the part before you pay. Vocksy does not handle payments or disputes.' },
  ],
}
