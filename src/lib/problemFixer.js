// Problem fixer: plain-words guides for the five things owners ring the shop about.
//
// These are general, conservative guides. They never give a chemical amount:
// the amounts come from the dose plan in Test water (worked out from the pool's
// size and the latest readings) and the product label. Every guide says when to
// stop and ask a pool professional.
//
// Target ranges quoted here match healthScore.js: free chlorine 1.0 to 3.0 ppm,
// pH 7.2 to 7.6, cyanuric acid 30 to 50 ppm.

export const SAFETY_BEFORE = [
  'Wear gloves and eye protection when you handle pool chemicals.',
  'Never mix chlorine with acid or with any other chemical. Keep them stored apart, closed and out of reach of children and pets.',
  'Add chemicals to water, never water to chemicals. Follow the label on every product.',
  'Keep everyone out of the pool while you are treating it, until the label says it is safe and the water is clear.',
];

export const SAFETY_EMERGENCY =
  'If someone swallows pool chemicals, breathes in fumes and struggles to breathe, or gets chemicals in their eyes, ring the Poisons Information Centre on 13 11 26. In an emergency ring 000.';

export const SAFETY_SEE_BOTTOM =
  'If you cannot clearly see the bottom of the deep end, keep everyone out of the pool. Murky water hides a person in trouble.';

export const FIXER_NOT_SURE =
  'Still not right after a few days, or not sure what you are looking at? Take a water sample to a pool shop, or ask a pool professional to have a look.';

export const GUIDES = [
  {
    key: 'green',
    title: 'Green water',
    summary: 'The water has turned green, or the walls feel slimy.',
    event: { type: 'green_treatment', title: 'Started treating green water' },
    mustSeeBottom: true,
    why: 'Green water is algae. It takes hold when chlorine runs low, the pump has not been running enough, or the water has been hot and busy.',
    steps: [
      { title: 'Test your water first', body: 'Use Test water. The dose plan then works out what your pool needs. If pH is outside 7.2 to 7.6, fix that first, because chlorine works much better when pH is in range.' },
      { title: 'Clear the baskets and clean the filter', body: 'Empty the skimmer and pump baskets. Backwash a sand or glass filter, or clean a cartridge. A clogged filter cannot catch dead algae.' },
      { title: 'Brush the walls and floor', body: 'Brush every surface so the algae is loose in the water where chlorine can get at it. Brush again each day.' },
      { title: 'Shock with chlorine', body: 'Add a shock dose of chlorine as the product label says for a green pool. If cyanuric acid is above 50 ppm, chlorine is less effective, so tell your pool shop when you take a sample in.' },
      { title: 'Run the pump all day and night', body: 'Keep the pump running continuously until the water is clear. Brush again and check chlorine each day. Keep chlorine up until the water turns from green to clear to sparkling.' },
      { title: 'Clean the filter again, then re-test', body: 'Once the water is clear, clean the filter again, test, and bring chlorine back down to 1.0 to 3.0 ppm before anyone swims.' },
    ],
    shop: 'The water has not improved after 3 days of this, it is black or very dark, or cyanuric acid is very high. A shop can check for metals and may suggest a partial drain.',
  },
  {
    key: 'cloudy',
    title: 'Cloudy water',
    summary: 'The water looks milky, hazy or dull.',
    event: { type: 'treatment', title: 'Started treating cloudy water' },
    mustSeeBottom: true,
    why: 'Cloudy water is tiny particles the filter has not caught. Common causes are low chlorine, high pH, a dirty filter, a pump that is not running long enough, or a recent chemical dose that is still settling.',
    steps: [
      { title: 'Test your water first', body: 'Use Test water. Low chlorine or high pH are the most common causes, and the dose plan shows what to add.' },
      { title: 'Check the filter and baskets', body: 'Empty the baskets. Backwash a sand or glass filter, or clean a cartridge. Check the pressure gauge against where it sits after a clean.' },
      { title: 'Run the pump longer', body: 'Run the pump for 12 to 24 hours straight while the water clears. More circulation means more water through the filter.' },
      { title: 'Give it a day after any dose', body: 'Chemicals you added recently can cloud the water for a few hours. Let the pump run, then look again before adding more.' },
      { title: 'Then consider a clarifier', body: 'If it is still hazy once chlorine, pH and the filter are sorted, a clarifier can help the filter catch fine particles. Follow the label. Do not add a flocculant unless you know how to vacuum to waste, because the label steps matter.' },
    ],
    shop: 'The water has stayed cloudy for more than 3 days with chlorine and pH in range, or you cannot clean the filter.',
  },
  {
    key: 'eyes',
    title: 'Stinging eyes or itchy skin',
    summary: 'Swimmers get red, stinging eyes or itchy skin, or the pool has a strong chlorine smell.',
    event: { type: 'custom', title: 'Looked into stinging eyes or itchy skin' },
    mustSeeBottom: false,
    why: 'A strong "chlorine" smell and stinging eyes are usually not too much chlorine. They are most often chloramines, which form when chlorine meets sweat, sunscreen and body oils, or pH that has drifted too low or too high.',
    steps: [
      { title: 'Test your water first', body: 'Use Test water. Check pH and free chlorine. A pH outside 7.2 to 7.6 irritates eyes and skin, and works against your chlorine.' },
      { title: 'Bring pH back into range', body: 'Follow the dose plan to bring pH to between 7.2 and 7.6, and re-test before adding more.' },
      { title: 'If the smell is strong, shock the pool', body: 'A shock dose of chlorine, as the label says, clears chloramines. Do it in the evening, keep everyone out until chlorine is back in range, and let the pump run.' },
      { title: 'Ask everyone to shower first', body: 'A quick rinse before swimming means far less sweat and sunscreen in the water, which is what makes chloramines.' },
      { title: 'Keep chlorine in range', body: 'Free chlorine between 1.0 and 3.0 ppm. Too low lets chloramines build up. Too high stings too.' },
    ],
    shop: 'Swimmers keep getting irritated even though pH and chlorine are in range, or a swimmer has a rash that does not clear. A doctor is the right person for anything more than mild irritation.',
  },
  {
    key: 'foam',
    title: 'Foam on the water',
    summary: 'There is foam or bubbles on the surface, near the skimmer or jets.',
    event: { type: 'custom', title: 'Looked into foam on the water' },
    mustSeeBottom: false,
    why: 'Foam comes from things in the water that act like soap: sunscreen, body oils, lotions, hair products, some algaecides, and detergents from swimmers or cleaning. Waterfalls and jets whip it up.',
    steps: [
      { title: 'Test your water first', body: 'Use Test water. Foam often shows up when the water is not balanced, especially high calcium or old water that has built up dissolved solids.' },
      { title: 'Skim it off and keep the pump running', body: 'Skim the foam and let the filter work. Do not hose it, which just stirs it back in.' },
      { title: 'Cut back on algaecide', body: 'Some algaecides foam when overused. Check the label and do not add more than it says.' },
      { title: 'Shower before swimming', body: 'A rinse takes off most of the sunscreen and oil that cause foam.' },
      { title: 'Use an anti-foam product only as the label says', body: 'These are a quick fix, not a cure. Look for the cause too.' },
    ],
    shop: 'The foam keeps coming back after a few days. Old water may need a partial drain and refill, and a shop can test for dissolved solids. Check local water restrictions before you drain.',
  },
  {
    key: 'stains',
    title: 'Stains on the pool surface',
    summary: 'Brown, rust, green, blue-green, black or purple marks on the walls or floor.',
    event: { type: 'custom', title: 'Looked into stains on the pool surface' },
    mustSeeBottom: false,
    why: 'Stains are usually either metals in the water (iron makes rust brown, copper makes green or blue-green) or organic material such as leaves (brown, often in patches). The cure is different for each, so work out which one first.',
    steps: [
      { title: 'Note what colour it is and where', body: 'Rust or orange-brown streaks suggest iron. Blue-green or turquoise suggests copper. Brown patches under where leaves collect suggest organic stains. Black or purple spots suggest manganese or organic material.' },
      { title: 'Try a simple test on one small spot', body: 'Rub a crushed vitamin C (ascorbic acid) tablet on the stain. If it fades quickly, it is likely metal. If nothing happens, it is more likely organic, such as leaves. Do not rub chlorine tablets on the surface, because they can bleach or damage it.' },
      { title: 'Keep pH in range and do not shock', body: 'Keep pH between 7.2 and 7.6. If metals are the problem, a big chlorine shock can turn the water brown, so hold off until you know.' },
      { title: 'Take a water sample to a pool shop', body: 'Ask for a metals test. It tells you whether iron or copper is in the water. Common sources are bore or tank water, and corroded heater parts or fittings.' },
      { title: 'Check your surface warranty before using stain removers', body: 'Some surfaces, such as painted, fibreglass and pebble finishes, can be damaged by the wrong product or by acid washing. Look at your warranty, and write down what you do so you have a record.' },
    ],
    shop: 'The stain does not fade, covers a large area, or you are not sure what the surface can take. A pool professional can treat it without damaging the surface.',
  },
];

export const guideByKey = (key) => GUIDES.find((g) => g.key === key) || null;
