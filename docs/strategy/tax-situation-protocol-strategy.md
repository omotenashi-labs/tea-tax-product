# The Tax Situation Protocol: Strategy

**Date:** 2026-03-23

---

## The Thesis

Within two years, a meaningful percentage of American taxpayers will start their taxes by talking to an AI agent. "Claude, help me with my taxes" and "ChatGPT, what should I do about my 1099s" are already happening informally - consumers use frontier models alongside their tax software today. The formal integrations are coming fast: TurboTax will partner with Anthropic. H&R Block will partner with OpenAI. Every major provider will race to put AI into their product.

But there is no standard for how an AI agent represents a taxpayer's situation, communicates with a tax provider, or routes a consumer to the right filing option. The tax industry has a standardized format for completed returns (IRS MeF XML) but nothing for the input - the messy, human, pre-return reality of someone's financial life. That gap is about to become the most consequential missing piece of infrastructure in a $30B+ market.

Whoever defines that standard controls how AI interacts with the entire tax ecosystem.

---

## The Problem for Incumbents

The AI front door is shifting. Today, consumers go directly to hrblock.com or turbotax.com. Tomorrow, they ask an AI agent for help. The provider that consumers land on will increasingly be determined by which provider the AI agent routes to - not by brand loyalty and not by last year's habit.

This creates an existential asymmetry. Intuit is a $180B company with a $1B+ annual marketing budget. In a world of bilateral AI partnerships - TurboTax pays Anthropic for preferred placement, TurboTax pays OpenAI for default routing - Intuit wins every bidding war. Every other provider is structurally disadvantaged.

This is not a hypothetical. It is the exact pattern that played out in travel (Expedia/Booking.com disintermediated hotels), food delivery (DoorDash/Uber Eats disintermediated restaurants), and retail (Amazon disintermediated everyone). In every case:

1. A new front door emerged that consumers preferred
2. Providers who didn't control the front door lost pricing power, margin, and the customer relationship
3. The platform that controlled the front door extracted 15-30%+ from every transaction
4. The largest incumbent cut the best deal with the platform; everyone else got commoditized

The tax industry is about to repeat this pattern unless the providers collectively define the interoperability standard before the AI platforms define it for them.

---

## The Precedent: This Is Already Happening

Not a forecast. The AI-platform-as-front-door pattern is playing out across consumer verticals right now, and the velocity is accelerating.

### OpenAI's Agentic Commerce Protocol

In September 2025, OpenAI launched "Buy it in ChatGPT" with Instant Checkout, powered by the **Agentic Commerce Protocol (ACP)** - an open standard co-developed with Stripe that lets AI agents complete purchases inside ChatGPT. By February 2026, over 1 million Shopify merchants were integrated. Etsy is live. PayPal's ACP server is expected to bring tens of millions of additional small businesses onto the platform in 2026. OpenAI charges a **4% transaction fee** on every completed purchase. ChatGPT processes approximately **50 million shopping-related queries per day**.

OpenAI built the standard, got merchant adoption, and now extracts a fee from every transaction. This is the playbook that will be applied to tax filing if the industry doesn't define its own standard first.

### The Pattern Is Everywhere

The same dynamic is playing out across verticals. Kayak launched AI Mode (natural-language trip planning inside ChatGPT) in October 2025. Booking.com has active AI partnerships with OpenAI, Google, Amazon, and Microsoft. DoorDash and Instacart both launched grocery apps inside ChatGPT in December 2025 - Instacart built directly on OpenAI's ACP. Klarna's OpenAI-powered assistant handles 2.3 million conversations per month, replacing the equivalent of 700 full-time agents. In every case, the AI platform defined the integration standard and the consumer-facing companies adopted it.

### Intuit Is Already Building - Closed and Proprietary

Intuit launched **Intuit Assist**, a generative AI-powered assistant spanning TurboTax, QuickBooks, Credit Karma, and Mailchimp - reaching 100 million customers. It finds deductions, performs real-time accuracy checks, delivers personalized tax guidance, and connects users to human experts. Intuit is not waiting for a consortium. They are building their AI moat proprietary and closed, on top of their own data.

Intuit has an AI strategy. H&R Block, Taxwell, April Tax, and UltraTax do not have an equivalent. The open standard is the only structural answer for non-Intuit providers.

---

## The Tax Situation Object

The missing infrastructure is a structured, portable, AI-native representation of a taxpayer's complete financial situation - the tax situation object. Not the return. Not the forms. The human reality that precedes them: income streams, deductions, life events, dependents, prior-year context, documentation, confidence levels.

This object is the protocol layer between AI agents and the tax ecosystem. It is what an AI agent produces when a consumer describes their situation, and what a tax provider consumes to determine the right product, tier, and price for that consumer.

The tax industry already has a standard for the _output_ - IRS MeF XML defines the format for completed returns. But there is no standard for the _input_ - the messy, pre-return reality that precedes filing. Today, every provider has its own proprietary intake format. Data doesn't move between systems. Consumers re-enter information every time they switch. AI agents have no standard way to interact with any provider programmatically. The absence of a shared input format creates the vacuum that bilateral AI deals will fill.

The tax situation object fills that vacuum as an open standard.

**What it enables:**

- Any AI agent (Claude, ChatGPT, Gemini, or a consumer's own local model) can produce a tax situation object from a conversation, a set of documents, or a financial account connection
- Any tax provider can consume that object and immediately determine the right product, tier, and estimated price for that consumer
- Any consumer can carry their structured tax situation to any provider without re-entering data or being locked into last year's choice
- Any credentialed tax professional can receive a pre-structured client instead of a shoebox

**What it protects against:**

- AI platforms defining proprietary tax data formats that providers are forced to adopt on the platform's terms
- Bilateral exclusivity deals that lock smaller providers out of the AI front door
- A single company controlling the routing layer between consumers and the tax ecosystem

---

## The Strategy

### Phase 1: Build the Artifact (Now through April 2026)

Three things need to exist before the first CEO conversation:

**1. The schema specification.** A v0.1 definition of the tax situation object - core fields, types, validation rules, edge case handling, extensibility model. Deliberately minimal: broad enough to be correct, narrow enough that the technical working group in Phase 3 has room to contribute. This needs to be technically rigorous enough that a CTO can evaluate it in an afternoon and say "this is correct." Domain expertise from building TaxAct's Xpert ecosystem - knowing which fields matter, how tier placement actually works, what edge cases exist, where providers diverge - is what makes the schema right on the first try. No one else in the market can do this as fast or as accurately.

**2. A working reference implementation.** An MCP server and OpenAI function definitions that implement the protocol. A demo that takes messy inputs - a photo of a W-2, a voice description of a life event, a bank account connection - and produces a structured tax situation object. This doesn't need to be production-grade. It needs to be tangible enough that a non-technical CEO can see it working and a CTO can see the architecture.

**3. The threat narrative.** A 15-minute deck that creates urgency. The disintermediation pattern. The ACP precedent (4% fee, 1M+ merchants, months). Intuit Assist already live while everyone else watches. The hotel industry's fate - a story Taxwell's CEO lived from the inside. The open-standard alternative. Short enough to present in a single meeting. Sharp enough to keep a CEO up at night.

### Phase 2: The First Two Dominos (May - June 2026)

The post-season strategic window is when tax companies evaluate their tech stack, process what worked and what didn't, and make bets on the future. CEOs come out of April exhausted, newly aware of what's changing, and open to big moves. This is the window.

**H&R Block is the first conversation.** CEO Curtis Campbell was the founder's executive leadership at TaxAct, where the Xpert ecosystem was built. Before TaxAct, he ran product strategy at Intuit and was a GM at AWS. He knows the founder's work, understands Intuit's AI playbook from the inside, and has the platform instincts to recognize what an open standard means for the competitive landscape. H&R Block is the #2 player with the most to lose from Intuit locking up AI partnerships. Campbell has been on both sides. (Full background in appendix.)

**Taxwell is the second conversation.** Their entire C-suite - CEO Dermot Halpin (ex-Expedia), CTO Sugata Mukhopadhyay (ex-TripAdvisor, 20 years), CPO Bastien Martini (ex-TripAdvisor/Viator) - comes from the travel industry that was disintermediated by the exact pattern this strategy describes. When the threat narrative explains what happens when providers don't control the standard, this team doesn't need convincing. They've lived it. Taxwell also serves 90,000+ tax professionals through Drake and TaxWise - their adoption signals to every CPA firm that the standard is real. Direct relationships with all three. (Full backgrounds in appendix.)

**The nod strategy builds momentum.** Each conversation includes an honest acknowledgment that similar conversations are happening with other major players. This creates the coalition dynamic: neither company wants to be the one that sat out while competitors shaped the standard. "Who else should be at the table?" turns each CEO into a recruiter for the consortium.

**The ask is not a contract.** It is a commitment to participate - to have their technical team evaluate the schema, pilot the integration, and have a seat at the table as the standard evolves. The barrier to yes is low. The cost of no is being left out.

### Phase 3: The Consortium Solidifies (July - September 2026)

With H&R Block and Taxwell engaged, the remaining conversations become easier. April Tax, UltraTax, and others face a simple calculus: the standard is being defined with or without them.

This phase formalizes the consortium:

- **Governance structure.** How the schema evolves, how decisions are made, how new members join. Light enough to move fast, formal enough that enterprise legal teams are comfortable.
- **Technical working group.** CTOs and senior engineers from member companies collaborating on the spec. This is where the standard becomes genuinely multi-stakeholder rather than a single company's proposal.
- **Reference integrations.** Each member company builds a proof-of-concept integration with their existing systems. The standard is tested against real-world provider architectures, not just theory.

The protocol steward role - maintaining the spec, building reference implementations, coordinating the working group, providing integration support - is the natural organizational home. This role is essential, neutral, and trusted precisely because it isn't a competitor.

### Phase 4: AI Platform Engagement (Q4 2026)

With multiple major providers adopted or in-progress, the conversation with Anthropic and OpenAI is no longer a pitch. It is an announcement.

_"The tax industry's major providers have adopted an open standard for how AI agents interact with tax data. Here's the protocol. Here's the MCP server. Here's the OpenAI function schema. Your agents should speak it natively."_

Both companies want this. Anthropic's partnership pattern is enterprise-infrastructure focused - Accenture (30,000 trained professionals), Snowflake ($200M deal), Salesforce, Deloitte - and in March 2026 they launched the Claude Partner Network with $100M to support partners building vertical intelligence layers on Claude. Docusign already integrated via MCP. A consortium-backed tax protocol exposed via MCP is exactly the kind of vertical partner they're looking for. OpenAI, meanwhile, has already built this playbook for commerce (ACP) and wants to replicate it across every high-value vertical. A consortium-backed standard gives them the tax domain layer without having to build it themselves.

The tax situation object becomes the canonical tax layer in the AI agent ecosystem - not because a startup pitched it, but because the industry adopted it.

### Phase 5: The Consumer Layer Emerges (2027+)

Once the protocol is adopted by providers and spoken by AI agents, the consumer-facing opportunity materializes on top of infrastructure that already exists. Every provider accepts the format. Every AI agent produces it. The front door described in the original Tea Tax thesis is now buildable on top of an entrenched standard rather than against an entrenched industry.

The exact shape of the consumer play - aggregator, marketplace, routing layer, or something without a name yet - will be informed by how the protocol is actually used and where value is flowing.

---

## Why This Works

### The Founding Team Fit

Enterprise adopters evaluate two things when deciding to trust an open standard: "Does the schema reflect deep domain knowledge?" and "Is the security architecture credible?" The founding team covers both.

**The founder** brings the domain expertise to define the schema correctly on the first try (two years leading TaxAct's Xpert ecosystem, 0-to-1 launch of Xpert Full Service), the relationships to get CEO meetings in weeks instead of quarters (direct lines to H&R Block, Taxwell, April Tax, UltraTax), and the insider knowledge of how these companies make decisions - what gets a fast yes versus what stalls in legal review.

**Lucas Geiger** brings the cryptographic and compliance engineering that makes the protocol trustworthy. A standard handling SSNs and financial data will be scrutinized by every adopter's security team. Zero-knowledge encryption, multi-tenant isolation, AI model privacy, and Circular 230 compliance enforced architecturally - not behaviorally - are what separate a credible spec from an aspirational one. (Full detail in appendix.)

**Both** are neutral. Not a competitor. Not an incumbent. Not an AI company. The only team in the room whose incentive is the standard itself.

### The Game Theory

No single provider can play the protocol steward role - they would never be trusted by competitors. Anthropic and OpenAI won't play it - they don't have tax domain expertise and don't want to build industry-specific infrastructure. The only entity that can occupy this position is one with domain expertise, industry relationships, technical capability, and no competitive conflict.

The consortium dynamic makes adoption self-reinforcing. Each provider that joins makes it riskier for others to stay out. The standard becomes the industry's collective defense against the AI front-door shift - and the cost of not participating is ceding the standard's design to competitors.

### The Moat

1. **First-mover on the schema.** Defining the standard correctly, first, with domain expertise no one else has. Switching schemas once systems are built around them is enormously painful.
2. **Network effects.** Each provider that adopts makes the standard more valuable for AI agents. Each AI agent that speaks the standard makes it more valuable for providers.
3. **Enterprise adoption is irreversible.** Once multiple major providers have integrated, the standard has institutional momentum that a competitor would need to overcome by being dramatically better - while fighting the heaviest form of organizational inertia.

---

## What Needs to Be True

For this strategy to work, five things must hold:

1. **AI agents become a meaningful front door for tax filing within 2-3 years.** If consumers don't shift behavior, the urgency disappears. Current trajectory suggests this is near-certain, but the speed matters.
2. **Incumbents perceive the bilateral-deal threat as real and imminent.** If they believe they can each solve this independently, the consortium logic breaks. The threat narrative needs to land.
3. **The schema can be defined correctly by a small team, fast.** If it requires two years of industry committee work, the window closes. Domain expertise from TaxAct is the accelerant that makes this possible in weeks, not years.
4. **At least two major providers commit to pilot within the first three months of outreach.** The domino strategy requires early momentum. If the first two conversations don't convert, the approach needs to be re-evaluated.
5. **The steward role remains trusted as neutral.** If at any point the consortium members perceive the steward as a competitor or as favoring one member, the entire structure collapses. Neutrality is not a positioning choice - it is an operational constraint.
6. **The consortium itself becomes the credibility anchor.** A two-person startup proposing an industry standard does not have the institutional weight to drive adoption alone. The strategy solves for this by making the incumbents co-owners of the standard - but until the first two providers commit, the standard's authority rests entirely on the founder's domain credibility and relationships. Phase 2 is the highest-risk moment: the standard either gains institutional backing or it doesn't.

---

## Revenue Model

Intentionally unresolved. The strategic priority is adoption.

Revenue models for protocol and infrastructure businesses reveal themselves through usage patterns - where friction exists, where value flows, where participants will pay to have problems solved. Historical precedents suggest the monetization surface will emerge from one or more of:

- Integration tooling and enterprise support (Twilio model)
- Transaction-layer fees as volume flows through the protocol (Visa/Stripe model)
- Data and intelligence products derived from aggregate protocol usage (Bloomberg model)
- Premium services layered on top of the open standard (Red Hat model)

The May conversations should be about participation, not pricing. The revenue conversation happens from a position of strength, once the standard is adopted and the value is visible.

---

## Immediate Execution: Now Through April 2026

| Week          | Deliverable                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-2           | Tax situation object schema v0.1 - core fields, type definitions, validation rules. Informed by TaxAct Xpert domain knowledge and IRS form/schedule mapping.           |
| 3-4           | MCP server reference implementation. OpenAI function schema. Basic demo: document photo + voice input producing a structured object.                                   |
| 5-6           | Threat narrative deck. 15 minutes. The disintermediation pattern, the bilateral-deal risk, the open-standard alternative. Tailored versions for H&R Block and Taxwell. |
| 7-8           | Dry runs. Refine the demo. Pressure-test the schema against edge cases. Prepare for technical scrutiny from the Taxwell CTO.                                           |
| Post-April 15 | First calls. H&R Block CEO. Taxwell CEO and CTO. The season is over. The window is open.                                                                               |

---

## Appendix: Founding Team

### Co-Founder: Lucas Geiger

Cryptography and AI expert specializing in high-regulation compliance environments. Background includes work on decentralized systems, cryptographic protocols, and decentralized identity (OpenLibra, Wireline, Keyscores).

The protocol's hardest technical requirements map directly to his expertise:

- **Zero-knowledge and end-to-end encryption** of the tax situation object, ensuring even the protocol steward cannot access plaintext user data. Consortium members need assurance the steward isn't accumulating a data advantage.
- **Compliance architecture** for Circular 230, FTC consent orders, and IRS data handling requirements - enforced architecturally (credentialed access, granular consent, auditability, revocability), not behaviorally.
- **Cryptographic multi-tenancy.** Competing providers sharing a protocol each need cryptographic assurance that their data is invisible to every other participant and to the steward.
- **AI model privacy.** Ensuring sensitive tax data doesn't leak into model weights, training pipelines, or third-party API calls as the protocol processes data through AI models for extraction and classification.

---

## Appendix: Key Relationships

### Primary Targets

**Curtis Campbell - CEO, H&R Block**
Became CEO January 1, 2026. Previously President of TaxAct (2018-2023), where the founder built the Xpert ecosystem under his leadership. Before TaxAct: VP Product Management & Strategy at Intuit (2014-2017), General Manager at AWS (launched 200+ services), Managing VP at Capital One, 10+ years at Dell. BS from The Citadel, Master of International Business from University of South Carolina. Board Director at Jack Henry & Associates.

_Why he matters:_ Knows the founder's work firsthand. Understands Intuit's AI strategy from the inside. Has platform-scale instincts from AWS. Uniquely positioned to feel the threat (former Intuit, now running #2 player) and recognize the structural answer (open standard from someone whose work he's seen).

**Dermot Halpin - CEO, Taxwell**
Previously President of Expedia EMEA (2001-2008, grew region to £2.5B). Previously President of Vacation Rentals at TripAdvisor. Previously CEO of Autoquake. MBA from INSEAD, BEng from University College Dublin. Runs a company serving 90,000+ tax professionals and 3M DIY filers.

_Why he matters:_ Seven years at Expedia watching it become the front door that disintermediated hotels. Lived the exact playbook this strategy warns about - from the platform side. Will pattern-match immediately on the threat narrative.

**Sugata Mukhopadhyay - Group CTO, Taxwell**
Previously CTO and SVP of Global Engineering at TripAdvisor (2004-2023, nearly 20 years). Cornell University (1995-2000). 24+ years of technology leadership.

_Why he matters:_ The technical validator. Watched Google gradually disintermediate TripAdvisor's discovery layer over two decades. Will evaluate the schema with the rigor of someone who's built and defended large-scale platform architectures. If Sugata says the schema is sound, the rest of the Taxwell C-suite follows.

**Bastien Martini - Chief Product & Marketing Officer, Taxwell**
Previously at TripAdvisor for 12 years, ultimately leading the B2C entity of Viator. Previously COO at DeepReach (adtech). École Polytechnique (2003), MIT (2008). Career started in Revenue Management at Delta Airlines.

_Why he matters:_ Product and marketplace expertise from running Viator (one of the world's largest tours/activities marketplaces). Understands how aggregation and platform dynamics reshape markets from the product side. Will evaluate the protocol through the lens of consumer experience and go-to-market.

### Strategic Intelligence

**Van Cline - Head of Product, Intuit SMB**
Recently accepted this position at Intuit. Previously at TaxAct, where she was the founder's direct manager and mentor. Recruited the founder into the Xpert space.

_Why she matters:_ A direct window into Intuit's current AI investment posture - what Intuit does next shapes the urgency calculus for every other conversation. Also knows the founder's capabilities better than almost anyone, having hired and mentored them through the Xpert build.

### Strategic Advisors

**Shaun Stewart - CEO, New Lab / viagogo**
Previously Global Head of Vacation Rentals at Airbnb (2014-2016). Chief Business Development Officer at Waymo/Google X (2016-2018). General Manager of Jetsetter at Gilt Groupe (acquired by TripAdvisor). Regional Director at Expedia (2002-2010). Cornell hotel management. Currently CEO of New Lab (frontier tech incubator, 150+ startups). Most recently involved with viagogo, the global secondary ticketing marketplace ($4B StubHub acquisition) that operates as the aggregation layer between event ticket sellers and buyers.

_Why he matters:_ Has seen platform aggregation from every angle - Expedia, Airbnb, Waymo, and now viagogo. The viagogo experience is most directly relevant: fragmented providers, platform-controlled front door, fee extraction from both sides. Structurally identical to what happens when AI platforms become the front door for tax. Operational knowledge of how providers resist and eventually adopt aggregation standards.

**Kevin Ryan - Founder & CEO, AlleyCorp**
Previously CEO of DoubleClick (grew from 20-person startup to $3.1B acquisition by Google). Co-founded MongoDB ($26B market cap), Business Insider (sold for $442M to Axel Springer), Gilt Groupe, and Zola. AlleyCorp raised a $250M fund in 2024. Known as the "Godfather of NYC tech." Ernst & Young Entrepreneur of the Year. Hired Shaun Stewart to run Jetsetter within the Gilt Groupe family.

_Why he matters:_ Career is a direct pattern-match. DoubleClick became the infrastructure standard for ad serving before Google bought it for $3.1B. MongoDB became the infrastructure standard for document databases. Both times, Ryan built the neutral standard an ecosystem adopted. Also a potential investor through AlleyCorp ($250M fund) - this is precisely the kind of "infrastructure standard that becomes a platform" play that AlleyCorp funds.
