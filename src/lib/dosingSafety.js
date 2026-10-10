// Safety lines for the dose plan.
//
// One short line per dose step, picked by what is being added, plus one
// plan-level line saying the amounts are a guide. Keep these plain and short:
// they sit under every dose step.

const GLOVES = 'Wear gloves and eye protection.';

const ACID = `${GLOVES} Add acid to the water, never water to acid. Never mix acid with chlorine.`;
const CHLORINE = `${GLOVES} Never mix chlorine with acid or with other chemicals. Keep them stored apart.`;

// key = parameter being corrected, state = 'low' | 'high'
export function safetyLineFor(key, state) {
  switch (key) {
    case 'pH':
      return state === 'high' ? ACID : `${GLOVES} Add soda ash slowly with the pump running. Avoid breathing the dust.`;
    case 'alkalinity':
      return state === 'high' ? ACID : `${GLOVES} Add bicarb slowly with the pump running.`;
    case 'freeChlor':
      return state === 'low' ? CHLORINE : `${GLOVES} Follow the label on any chlorine remover.`;
    case 'cyanuricAcid':
      return `${GLOVES} Follow the label for how to add stabiliser.`;
    case 'calciumHardness':
      return `${GLOVES} Calcium chloride heats up as it dissolves, so dissolve it in a bucket of water first, adding it to the water.`;
    default:
      return `${GLOVES} Follow the label on the product.`;
  }
}

export const DOSE_PLAN_GUIDANCE =
  'These amounts are a guide worked out from your pool size, not a guarantee. Add about half, let the pump run, and re-test before adding more. Keep everyone out of the pool until the chemicals have circulated and the product label says it is safe.';
