# Simulated CEO Interview — v0 PRD Evaluation

**Date:** 2026-03-24
**Format:** Simulated reactions from CEOs of tax preparation supply chain companies evaluating the Tea Tax v0 PRD
**Purpose:** Stress-test the PRD against real adoption barriers

---

## CEO, #2 National Provider

**Profile:** Former president of a mid-market tax SaaS company where the founder built the product. Former VP Product at the dominant incumbent. Former GM at a major cloud platform.

### Does it solve a problem for my business?

Yes — but it's a problem I'm not sure my board has internalized yet. I know firsthand what the dominant incumbent's AI strategy looks like from the inside. I built product there. The bilateral deal risk is real. If a frontier AI company cuts an exclusive integration with the market leader, we lose the AI front door before we even realize it's moved.

The structured intake object is interesting. We spend enormous engineering effort on our own intake — and it's proprietary and locked to our platform. If an open standard meant AI agents could route pre-qualified, tier-placed consumers directly to us, that's a net positive for acquisition cost.

### Is it competitive for my business?

That's the tension. The protocol makes it _easier_ for consumers to compare us to everyone else. Transparency is great for the industry narrative, but our pricing premium is partially sustained by the friction of comparison. If every AI agent can instantly surface that a budget competitor handles the same return for $40 less, that pressures our margins.

On the other hand, if I _don't_ join and the protocol gets adopted anyway, I'm the provider who isn't interoperable. That's worse.

### Would you join the consortium?

I'd commit to evaluating the schema with my tech team. I would not commit to adoption at the first meeting. I need to see:

1. **Who else is at the table.** If the professional software provider is in and we're out, that's a problem. If it's just a two-person startup with a spec, I need more social proof.
2. **What the governance looks like.** I will not adopt a standard where a single entity controls the roadmap. We need a credible multi-stakeholder governance model before my legal team signs off.
3. **How the tier mapping works.** If the protocol's knowledge base determines that a consumer "should" be in our free tier when our own logic would upsell them to a premium tier, that's a revenue conflict. I need to understand who controls the tier mapping rules and whether providers can override them.

### What would change my mind?

If two things happened simultaneously: (a) the professional software provider committed, creating the coalition dynamic, and (b) the governance model gave us a meaningful seat — not just advisory, but voting power on schema evolution. Also, if the protocol explicitly did _not_ make tier recommendations to consumers and only provided the structured data for the provider to tier-place themselves, that removes the revenue conflict.

---

## CEO, Professional Tax Software Provider

**Profile:** Former president of a major travel aggregator's international division. Runs a company serving 90,000+ tax professionals through desktop filing software, plus 3M DIY filers.

### Does it solve a problem for my business?

I lived this exact playbook in the travel industry. I watched hotels lose their direct relationship with consumers because they didn't control the booking standard. When someone asks an AI agent "help me file my taxes" and the agent routes them to the market leader because the incumbent paid for the integration — my 90,000 tax professionals and their clients don't even get considered.

The protocol solves the discoverability problem for my professional channel. Today, a consumer who needs a CPA has no structured way to describe their situation and get matched. The tax situation object makes my practitioners findable and accessible through any AI agent — not just through our own products.

### Is it competitive for my business?

For our DIY product, the transparency cuts both ways — same concern as the #2 national provider. For our professional channel (desktop filing software), it's almost entirely upside. If CPAs using our software can receive pre-structured clients through the protocol, that makes our product more valuable, not less. The protocol doesn't replace filing software — it feeds clients _into_ filing software.

The real question is whether the protocol helps or hurts our professional prep pricing. If the knowledge base surfaces that a CPA charges $400 for something the market leader handles for $120, that's uncomfortable. But honestly, our professionals are already losing that comparison — the protocol just makes it visible. Better to compete on quality and specialization than pretend the price gap doesn't exist.

### Would you join the consortium?

Faster than the #2 national provider would. I've seen what happens when you wait. In the travel industry, the hotels that joined the platform early got favorable terms. The ones that held out eventually joined anyway — on worse terms and with less influence.

My CTO will want to evaluate the schema rigorously. He spent 20 years at a major travel platform watching a search engine gradually disintermediate their discovery layer. He'll be skeptical of the schema's completeness but supportive of the direction. If the schema passes his review, I'm in.

### What would change my mind (if I were hesitant)?

The professional channel value proposition needs to be more explicit in the protocol. Right now the PRD focuses on the provider tier mapping — which provider's _software product_ a consumer should use. But 90,000 of my customers are _practitioners_, not software products. The protocol should also enable: "Based on your tax situation, you need a CPA who specializes in K-1 partnerships and multi-state filing. Here are three within 20 miles." If the protocol only routes to SaaS products and not to human practitioners, it's solving half the problem.

---

## CEO, Mid-Market Tax SaaS Provider

**Profile:** Running a mid-market tax SaaS company competing against the dominant incumbent and #2 provider on features and price.

### Does it solve a problem for my business?

This is existential for us. We don't have the marketing budget to compete for the AI front door. If the dominant incumbent cuts exclusive deals with frontier AI companies, we're invisible. An open standard that gives every provider equal access to AI agent routing is the only structural answer for a company our size.

The tier mapping is where I see the most immediate value. Today, consumers don't know we exist unless they search for us specifically. If an AI agent evaluates a consumer's tax situation against the knowledge base and determines they qualify for our free tier — when the market leader would charge $89 for the same return — that's a qualified lead we could never have reached through traditional marketing.

### Is it competitive for my business?

Entirely. We compete on price and simplicity. Transparency is our friend. The more visible the comparison, the better we look.

### Would you join the consortium?

Yesterday. My concern is not whether to join — it's whether the consortium will actually have teeth. If the larger providers join with enough governance power to water down the transparency features, the standard becomes a lowest-common-denominator exercise that protects incumbents instead of enabling competition.

### What would change my mind (if I were hesitant)?

Nothing — I'm already in. But I'd push hard on governance to ensure smaller providers have proportional voice. If the governance model is "one company, one vote" regardless of market share, I'm comfortable. If it's weighted by revenue, the incumbents control the standard and I get nothing.

---

## CTO, Professional Tax Software Provider

**Profile:** Former CTO at a major travel platform (20 years). The technical validator.

### Technical evaluation of the PRD

The conceptual schema is directionally right but underspecified for a v0.1. Specific gaps:

1. **No field-level types.** What are the valid `filingStatus` values? What are the valid income stream `type` enums? A CTO evaluating this needs concrete types, not descriptive labels. I need to see JSON Schema, Zod, or protobuf — something I can run a validator against.

2. **The knowledge base structure is undefined.** You say it encodes form dependencies, tier mappings, and validation rules — but in what format? Is it a rule engine? A graph? Structured YAML? The representation determines whether this is evaluable in an afternoon or a quarter-long research project. If it's "markdown documents with domain knowledge," that's not a knowledge base — it's documentation.

3. **Versioning strategy is missing.** Tax code changes annually. Provider tier structures change mid-season. How does the schema version? How does the knowledge base version? Semantic versioning? Calendar-based? If I integrate against v0.1 and you ship v0.2 that changes field names, what's my migration path?

4. **The reference implementation scope is too broad.** "Accept messy inputs: a photo of a W-2, a voice description of a life event, a bank account connection" — that's OCR, speech-to-text, and financial account integration. For a v0 demo, pick one. Document OCR (W-2 photo → structured fields) is the most convincing single demo because it's tangible, verifiable, and directly relevant to every provider's intake pipeline.

5. **No error model.** What happens when the knowledge base can't classify a situation? What's the confidence threshold below which the system says "I don't know"? Tax has genuine ambiguity — some situations legitimately could tier differently depending on provider-specific rules. The protocol needs a way to express uncertainty, not just classification.

### Would this pass my review?

Not yet. But the direction is right and the gaps are fillable. If the founder showed me concrete types for the top 5 filing scenarios (W-2 only, freelance, investments, multi-state, rental), a machine-readable knowledge base with verifiable form dependency chains, and a single-modality demo (W-2 OCR → structured object → validation → tier placement), I'd sign off on technical credibility in an afternoon.

The fine-tuned model direction (v1) is the right long-term architecture. Context window reliability is a real concern for production tax workloads. But for v0, a frontier model with the knowledge base in context is sufficient for demos — the reliability threshold for a demo is lower than for production.

---

## Composite: Regional CPA Firm Owner (5-person firm)

**Profile:** Running a small firm, files 800 returns per season using professional desktop filing software. Drowning in April.

### Does it solve a problem for my business?

Maybe. My problem isn't technology — it's that I can't serve more clients in April without hiring people I don't need in July. If this protocol means clients show up with their situation already structured — income categorized, documents extracted, deductions identified — that saves me hours per client on intake. That's real.

But I'm not joining a "consortium." I'm a five-person firm. I use my filing software because it works and I know it. If this protocol feeds me pre-structured clients _through my existing software_, I'm interested. If it requires me to adopt new software, integrate new APIs, or change my workflow during season, hard no.

### Would you adopt the protocol?

I'd adopt it if it came through my filing software vendor. If my vendor joins the consortium and builds protocol support into their product, I get the benefits automatically. I'm not going to independently integrate with an open standard — I'm going to use whatever my filing software supports.

### What would make this valuable to you?

Three things: (1) Clients arrive with their W-2s and 1099s already extracted and verified — I just review, not re-enter. (2) The protocol's validation has already flagged missing documents, so I'm not chasing clients for their K-1 in March. (3) My workflow doesn't change — the structured data imports into the same interface I already use.

What I _don't_ want: a system that tells my clients they don't need me. If the protocol's comparison engine routes simple filers to a free software tier instead of to my firm, that's a tool working against my business.

---

## Synthesis: What the Interviews Reveal

### The protocol would get adopted if:

1. **Governance is credible and multi-stakeholder.** Every CEO asked about this. No one will adopt a standard controlled by a single entity, no matter how neutral that entity claims to be.

2. **The tier mapping is provider-controlled, not protocol-controlled.** The biggest revenue concern is that the protocol's knowledge base makes tier placement decisions that override the provider's own logic. Resolution: the protocol provides the structured data and form classification; the _provider_ applies their own tier rules. The knowledge base validates completeness and correctness, not placement.

3. **The professional channel is a first-class use case.** The professional software provider and the CPA firm both flagged this. Routing to SaaS products is only half the market. Routing to credentialed practitioners based on specialization and situation complexity is the other half — and the one with the strongest supply-side lock-in dynamics.

4. **The CTO bar is met on specificity.** The CTO's feedback is the real v0 gate: concrete types, machine-readable knowledge base, versioning strategy, single-modality demo, and an error/uncertainty model.

### The protocol would get rejected if:

1. **It recommends providers or tiers to consumers.** The moment the protocol tells a consumer "you should use a budget competitor instead of us," every premium provider walks. The protocol should structure and validate — not recommend.

2. **Governance favors the steward or large players.** The mid-market provider's concern is real: if governance is revenue-weighted, smaller providers are structurally excluded and the standard becomes an incumbent cartel.

3. **It requires workflow changes during tax season.** No practitioner will adopt new technology between January and April. Protocol adoption must flow through existing filing software via vendor relationships.

4. **The schema ships without concrete types.** A conceptual sketch does not survive first contact with a CTO. v0.1 must be machine-readable and validatable, not aspirational.

### PRD changes suggested by the interviews:

| Change                                                                      | Source                            | Impact                                                         |
| --------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| Add concrete field types, enums, and validation schemas to v0.1 spec        | CTO                               | Blocks CTO credibility without it                              |
| Define knowledge base representation format (machine-readable, not docs)    | CTO                               | Blocks technical evaluation without it                         |
| Add versioning strategy for schema and knowledge base                       | CTO                               | Required for any integration commitment                        |
| Scope reference implementation to single modality (W-2 OCR) for v0          | CTO                               | Reduces v0 scope to achievable demo                            |
| Add error/uncertainty model to schema                                       | CTO                               | Tax has genuine ambiguity; protocol needs to express it        |
| Clarify that tier placement is provider-controlled, not protocol-controlled | #2 provider CEO, pro software CEO | Removes primary revenue objection from premium providers       |
| Add practitioner routing as a first-class protocol use case                 | Pro software CEO, CPA firm        | Unlocks the 90K+ professional channel and supply-side adoption |
| Define governance model principles in the strategy context                  | #2 provider CEO, mid-market CEO   | Prerequisite for any consortium commitment                     |
| Ensure protocol integrates through existing filing software, not around it  | CPA firm                          | Practitioner adoption flows through vendor relationships       |
