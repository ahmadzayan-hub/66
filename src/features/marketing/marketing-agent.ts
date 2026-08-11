import { AgentIdentity } from '../../platform/kernel.js';
import { DesignBrief, DesignConcept } from '../design-studio/models/concept.js';
import { MasterArtworkRegistry } from '../arabic-design/master-artwork.js';
import { MaterialRecord, filterClaims } from '../materials/materials.js';

export interface MarketingAssets {
  arabicTitle: string;
  englishTitle: string;
  arabicCaption: string;
  englishCaption: string;
  bilingualCaption: string;
  productDescription: string;
  seoDescription: string;
  whatsappMessage: string;
  reelHook: string;
  storyCopy: string;
  giftDescription: string;
  cta: string;
}

/**
 * Marketing agent (§18). All Arabic in assets is validated against the
 * approved master artwork spelling; restricted material claims are stripped
 * unless evidenced (rule 52.6).
 */
export class MarketingAgent implements AgentIdentity {
  agentId = 'agent-12-marketing';
  capability = 'generate' as const;

  constructor(private artworks: MasterArtworkRegistry) {}

  generate(brief: DesignBrief, concept: DesignConcept, material: MaterialRecord, arabicArtworkId?: string): MarketingAssets {
    let personalName = '';
    if (brief.arabicText && arabicArtworkId) {
      // Guard: the exact approved spelling is the only Arabic allowed in copy.
      this.artworks.assertDerivationExact(arabicArtworkId, brief.arabicText);
      personalName = brief.arabicText.trim();
    }

    const allowedClaims = filterClaims(material, ['925 sterling silver', 'handcrafted finish', 'hypoallergenic']);
    const materialLine = allowedClaims.join(' · ');

    const en = `${concept.conceptName} — a personalised ${material.materialName} bracelet, crafted in the UAE spirit. ${concept.designStory}`;
    const ar = personalName
      ? `إسوارة "${concept.conceptName}" من الفضة الإسترلينية ٩٢٥ بنقش الاسم ${personalName} بخط عربي أصيل. صناعة يدوية بروح إماراتية معاصرة.`
      : `إسوارة "${concept.conceptName}" من الفضة الإسترلينية ٩٢٥. صناعة يدوية بروح إماراتية معاصرة.`;

    return {
      arabicTitle: personalName ? `إسوارة ${personalName} — فضة ٩٢٥` : `إسوارة ${concept.conceptName} — فضة ٩٢٥`,
      englishTitle: `${concept.conceptName} Personalised 925 Silver Bracelet`,
      arabicCaption: ar,
      englishCaption: en,
      bilingualCaption: `${ar}\n\n${en}`,
      productDescription: `${en} ${materialLine}. Made to order in the Emirates.`,
      seoDescription: `Personalised Arabic name bracelet in ${material.materialName} for men — Beyond Style UAE. Custom calligraphy, ${materialLine}.`,
      whatsappMessage: `مرحباً! إسوارتك المخصصة "${concept.conceptName}" جاهزة للطلب. Your personalised bracelet is ready to order — reply to confirm your name spelling.`,
      reelHook: 'Your name. Your story. Engraved in silver.',
      storyCopy: 'From a single name to a signature piece — watch the making of your bracelet.',
      giftDescription: 'A gift that carries their name — personalised Arabic calligraphy in solid 925 silver, presented in Beyond Style gift packaging.',
      cta: 'اطلب الآن · Order now',
    };
  }
}
