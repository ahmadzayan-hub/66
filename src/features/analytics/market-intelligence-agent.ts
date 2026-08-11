import { AgentIdentity } from '../../platform/kernel.js';

/** Market Intelligence agent output (§6). */
export interface MarketOpportunity {
  opportunity: string;
  customerSegment: string;
  customerProblem: string;
  productType: string;
  marketRationale: string;
  expectedPriceBandAed: [number, number];
  differentiationOpportunity: string;
  competitionRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  demandConfidence: number; // 0-1
}

export const UAE_SEASONAL_CALENDAR = [
  'Ramadan', 'Eid al-Fitr', 'Eid al-Adha', 'UAE National Day', "Mother's Day",
  "Father's Day", "Valentine's Day", 'Weddings', 'Graduation', 'Birthdays',
  'Corporate gifting', 'Tourism gifts',
] as const;

/**
 * Market Intelligence agent (§6). Release 1 ships a deterministic knowledge
 * base of UAE opportunities; live trend feeds plug in via the Model Gateway
 * in Release 3 (automated trend intelligence).
 */
export class MarketIntelligenceAgent implements AgentIdentity {
  agentId = 'agent-01-market-intelligence';
  capability = 'generate' as const;

  identifyOpportunity(request: { family: string; productType: string; targetPriceAed: number }): MarketOpportunity {
    return {
      opportunity: `Personalised ${request.productType} for UAE ${request.family.toLowerCase()} segment at accessible-premium price point`,
      customerSegment: 'UAE residents 25-45, gift buyers and self-purchasers, Arabic-first and bilingual',
      customerProblem:
        'Mass-market personalised jewellery ignores Arabic calligraphy quality; premium ateliers are slow and expensive. A gap exists for fast, authentic, manufacturable Arabic personalisation at accessible-premium prices.',
      productType: request.productType,
      marketRationale:
        `Gifting seasons (${UAE_SEASONAL_CALENDAR.slice(0, 4).join(', ')}) drive recurring demand for name-personalised silver. ` +
        `AED ${Math.round(request.targetPriceAed * 0.8)}-${Math.round(request.targetPriceAed * 1.2)} is the strongest conversion band for personalised silver gifts in UAE e-commerce.`,
      expectedPriceBandAed: [Math.round(request.targetPriceAed * 0.8), Math.round(request.targetPriceAed * 1.2)],
      differentiationOpportunity: 'Authentic calligraphy pipeline with engineering-validated engraving — competitors ship distorted Arabic',
      competitionRisk: 'MEDIUM',
      demandConfidence: 0.78,
    };
  }
}
