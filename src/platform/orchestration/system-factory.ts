import { AuditLog } from '../audit/audit-log.js';
import { EventBus } from '../event-bus/event-bus.js';
import { IssueLog } from './issue-log.js';
import { DesignOrchestrator, PipelineDependencies } from './orchestrator.js';
import { DesignVersionStore } from '../../features/design-studio/versioning.js';
import { CreativeDesignAgent } from '../../features/design-studio/agents/creative-agent.js';
import { BrandDnaAgent } from '../../features/brand/brand-agent.js';
import { MasterArtworkRegistry } from '../../features/arabic-design/master-artwork.js';
import { ManufacturingAgent, RuleBook } from '../../features/manufacturing/manufacturing-agent.js';
import { SafetyAgent } from '../../features/safety/safety-agent.js';
import { CostAgent } from '../../features/costing/cost-engine.js';
import { CommercialAgent } from '../../features/commercial/commercial-agent.js';
import { OriginalityAgent } from '../../features/originality/originality-agent.js';
import { QaAgent } from '../../features/qa/qa-agent.js';
import { ApprovalService } from '../../features/approvals/approval-service.js';
import { MaterialRepository, seedMaterials } from '../../features/materials/materials.js';
import { SvgExporter } from '../../features/cad/exporters/svg-exporter.js';
import { MarketingAgent } from '../../features/marketing/marketing-agent.js';
import { MarketIntelligenceAgent } from '../../features/analytics/market-intelligence-agent.js';
import { ModelGateway, ModelProvider, StubProvider } from '../model-gateway/gateway.js';
import { AnthropicProvider } from '../model-gateway/providers/anthropic-provider.js';

export interface BeyondStyleOS {
  audit: AuditLog;
  bus: EventBus;
  issues: IssueLog;
  versions: DesignVersionStore;
  artworks: MasterArtworkRegistry;
  approvals: ApprovalService;
  materials: MaterialRepository;
  ruleBook: RuleBook;
  gateway: ModelGateway;
  orchestrator: DesignOrchestrator;
  svgExporter: SvgExporter;
  marketing: MarketingAgent;
  marketIntelligence: MarketIntelligenceAgent;
  deps: PipelineDependencies;
}

/** Composition root: wires the Release 1 OS together. */
export function createSystem(): BeyondStyleOS {
  const audit = new AuditLog();
  const bus = new EventBus(audit);
  const issues = new IssueLog();
  const versions = new DesignVersionStore();
  const artworks = new MasterArtworkRegistry(audit);
  const approvals = new ApprovalService(audit);
  const materials = new MaterialRepository();
  seedMaterials(materials);
  const ruleBook = new RuleBook();

  // Real LLM provider is opt-in via ANTHROPIC_API_KEY; absent that, the
  // gateway serves only the deterministic stub and every agent behaves
  // exactly as in a key-less environment (local dev, CI, tests).
  const providers: ModelProvider[] = [];
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) providers.push(new AnthropicProvider(anthropicKey));
  providers.push(new StubProvider());
  const gateway = new ModelGateway(providers, audit);

  const deps: PipelineDependencies = {
    audit,
    bus,
    issues,
    versions,
    artworks,
    approvals,
    agents: {
      creative: new CreativeDesignAgent(anthropicKey ? gateway : undefined, materials.all().map((m) => m.materialId)),
      brand: new BrandDnaAgent(),
      manufacturing: new ManufacturingAgent(ruleBook),
      safety: new SafetyAgent(materials),
      cost: new CostAgent(materials),
      commercial: new CommercialAgent(),
      originality: new OriginalityAgent(),
      qa: new QaAgent(artworks),
    },
  };

  return {
    audit,
    bus,
    issues,
    versions,
    artworks,
    approvals,
    materials,
    ruleBook,
    gateway,
    orchestrator: new DesignOrchestrator(deps),
    svgExporter: new SvgExporter(artworks),
    marketing: new MarketingAgent(artworks),
    marketIntelligence: new MarketIntelligenceAgent(),
    deps,
  };
}
