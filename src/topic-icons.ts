import type { IconName } from './ui/icons';
/** Topic icons for the top-level categories (pikto; sources in .pikto/provenance.json).
 * A leaf module: atlas.ts and cover.ts both use it, and atlas-spec.ts already depends on atlas.ts. */
export const TOPIC_ICON: Readonly<Record<string, IconName>> = {
  'Environment & Climate': 'topic-environment',
  'Mobility & Transport': 'topic-mobility',
  'People & Society': 'topic-people',
  'Built City & Infrastructure': 'topic-built',
  'Public Space & Leisure': 'topic-public-space',
  Health: 'topic-health',
  Education: 'topic-education',
  Culture: 'topic-culture',
  'Government & Economy': 'topic-government',
  'Other / review needed': 'topic-other',
};
