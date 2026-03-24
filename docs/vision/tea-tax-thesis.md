# Tea Tax: Product Thesis

## Product Description

**Tea Tax is a free, AI-powered tax filing super-aggregator - the impartial front door for anyone who needs to do their taxes.** Through a white-glove, multi-modal intake experience (AI chat, voice, photo, video, document capture, financial account connections), it transforms an unprepared taxpayer's "shoebox" into a structured, portable tax situation object, then delivers transparent, side-by-side recommendations across every filing option - from Free File Alliance to TurboTax to your local CPA - with honest, community-verified pricing and no hidden fees. **It's the savvy CPA friend everyone wishes they had: impartial, informed, and always on your side.**

### Elevator Pitch

Tea Tax is the Kayak for tax filing. A free, AI-powered intake and recommendation engine that helps anyone figure out the best way to file their taxes - with transparent pricing, honest comparisons, and no allegiance to any provider.

---

## Core Tenet: Taxpayer Privacy Is Sacred

Taxes are among the most important, most personal, and most sensitive aspects of every American's life. The privacy of that information is not a feature - it is a core tenet of integrity baked into every pixel of the platform and every line of the architecture.

**No administrator, employee, or internal system at Tea Tax will ever be able to view a user's tax situation or any data associated with it. Period.** There is no admin dashboard that shows user returns. There is no internal tool that surfaces individual financial data. There is no "god mode." The data belongs to the user, and only the user controls who sees it.

**The only window into a user's tax data is a credentialed tax professional to whom the user has provided explicit, compliant, revocable permission.** That permission is granular (the user chooses what to share), time-bound (access expires), auditable (every access is logged and visible to the user), and revocable at any time. This mirrors the consent model that Circular 230 already demands of credentialed professionals - Tea Tax enforces it architecturally, not behaviorally.

This is not a privacy policy buried in a terms-of-service page. It is a design constraint that shapes the entire platform:

- **Encryption and cryptography are foundational, not bolted on.** Data is encrypted at rest, in transit, and in processing. The architecture is designed so that even Tea Tax's own infrastructure cannot access plaintext user data without the user's active consent flow. Zero-knowledge and end-to-end encryption principles apply wherever technically feasible.
- **Data minimization is a first principle.** The system collects only what is needed, retains only what the user consents to retain, and deletes aggressively when consent is withdrawn. The portable tax situation object is the user's property - they can export it, share it, or destroy it at will.
- **The proprietary local model strategy reinforces privacy.** Processing sensitive tax data on Tea Tax's own fine-tuned models - rather than sending SSNs, W-2s, and financial account data to third-party frontier model APIs - is not just a cost and moat decision. It is a privacy decision. The most sensitive extraction and classification tasks stay on infrastructure Tea Tax controls, under encryption Tea Tax enforces, with no third-party data retention.
- **Privacy is the trust foundation for everything else.** The "we the people" brand promise, the community-driven pricing database, the Plaid integration, the CPA marketplace - none of these work if users don't trust that their data is truly theirs. In a market where incumbents have been fined by the FTC for deception, Tea Tax's privacy posture is a competitive weapon: "Your data is yours. No one at Tea Tax can see it. Not us, not our investors, not our partners. Only the professionals you choose to share it with."[^ftc-intuit][^ftc-hrb]

This tenet is non-negotiable and should be treated as a constitutional principle of the platform - one that cannot be overridden by business convenience, investor pressure, or growth metrics. If a feature requires compromising user privacy, the feature doesn't ship.

---

## Who It's For

People who need to do their taxes this year and may or may not be fully prepared. They likely filed with a competitor last year and should not need to walk back into that competitor's ecosystem just to retrieve their docs. They procrastinate, ask friends and family for recommendations in casual conversation, and have a looming sense that life events (new dependents, a side hustle, a property purchase, an inheritance) will impact their situation in ways they don't fully understand. They fear doing it wrong, they want to maximize their return, and they're tired of opaque pricing that feels like a bait-and-switch.

## The Problem

The tax filing industry is opaque by design. Consumers face three compounding frustrations:

1. **Pricing opacity.** "I start my taxes thinking it'll be free, then they get me in the end with a bill that's ridiculous - it feels like a bait-and-switch." Tier upgrades, add-on fees, and ancillary product bundles are hidden until you're deep in the flow.
2. **Decision paralysis.** There is no impartial way to compare filing options. People rely on word-of-mouth from friends and family instead of informed recommendations tailored to their actual tax situation.
3. **Preparation anxiety.** The average person doesn't know the tax code. They know _something happened_ this year that matters - but they don't know what to do about it, what documents they need, or where to start. The friction of getting organized keeps them frozen.

## What Tea Tax Does

Tea Tax has two inseparable core functions:

### 1. White-Glove, Multi-Modal Intake

The experience should feel like walking into a high-end CPA firm - not a software onboarding flow. The system meets users where they are: unprepared, anxious, holding a metaphorical shoebox of unstructured paperwork.

**Collection methods include:**

- **AI chat interface** - conversational, patient, guiding the user through their tax situation in plain language
- **Voice** - talk through your tax situation like you're explaining it to a friend; the system listens, asks follow-ups, and structures the information for you
- **Phone camera native capture** - snap photos of W-2s, 1099s, receipts directly from a mobile device
- **Video** - record a walkthrough of your paperwork or explain a complex situation visually; the system extracts what it needs
- **Document upload** - drag-and-drop for users who have digital copies
- **OCR services** - extract structured data from uploaded or captured documents
- **Plaid integration** - connect financial accounts to pull rich context about income, expenses, and transactions

The intake is mobile-first and designed for the person who isn't fully prepared. It should feel like the system is taking care of them, not interrogating them. Every piece of data collected is encrypted immediately, processed under data minimization principles, and never visible to Tea Tax administrators - the user is in control from the first interaction.

### 2. Transparent Comparison Engine

Once the system has a picture of the user's tax situation, it delivers an agnostic, side-by-side comparison across every filing option available:

- **TurboTax, H&R Block, FreeTaxUSA, etc**. other online services
- **Free File Alliance members** (TaxSlayer, FreeTaxUSA/TaxHawk, TaxAct, and others - $89K AGI limit, covering 70%+ of taxpayers)
- **Local CPAs and tax professionals**
- **DIY vs. Done-For-Me** swimlanes within each provider

The comparison includes:

- **All-in estimated cost** - base price, tier placement, add-on fees, ancillary product costs, bundle pricing (see [Pricing Data](#the-pricing-data-problem) below)
- **Aggregate, agnostic reviews** - not provider-curated testimonials
- **Fit for the user's specific situation** - complexity, life events, risk tolerance

Default sort is always "best fit for you," never "highest bidder."

### The Pricing Data Problem

Getting accurate, real-time, all-in pricing across every provider is the hardest unsolved execution challenge. Tax software pricing is deliberately opaque - prices change mid-season (TurboTax gets more expensive as the deadline approaches), tier placement depends on forms detected _during_ filing, and add-on fees are contextual and upsold dynamically. Providers have zero incentive to make this transparent.

**The workaround: make the portable object a shopping weapon, and let the people win.**

Rather than trying to acquire complete pricing data top-down, the portable tax situation object should be designed so users can quickly upload it into any SaaS provider's intake flow and fly through to a real quote. The object does the prep; the user shops the market. This turns the object from just a data asset into a _pricing discovery tool_.

But the real unlock is crowdsourced, community-driven pricing data. When a user gets a quote from a provider, they can snapshot that price - provider, tier, tax situation complexity, add-on fees, total cost, timestamp - and share it back to the Tea Tax community. Over time, this builds an aggregated, user-verified, time-stamped pricing database that no provider controls. Agentic SDKs can accelerate this further: an AI agent armed with the tax situation object could programmatically shop multiple providers, capture quotes, and feed the data back - automating what users do manually today.

The vibe is _we the people_. Think Team Blind for tax pricing - anonymous, crowdsourced, unbiased, user-upvoted, and impossible for providers to game. The war against pricing opacity should be won by the community, and it should appeal to anyone across the political spectrum who loathes the tax prep industry's bait-and-switch tactics. Tea Tax doesn't need to crack provider pricing from the inside. It needs to arm the people to expose it from the outside.

---

## The Portable Tax Situation Object

The intake process produces a structured, portable data object that represents the user's complete tax situation. This is a first-class feature, not a technical detail.

Implementation note for launch MVP: this concept is persisted as `tax_objects` and `tax_returns`, with creator-only access enforced by `tax_objects.created_by_user_id`. Sharing roles and memberships are post-launch. Canonical source: `docs/requirements/users-tax-objects-ownership-access-spec.md`.

**Today:** The object powers the intake-to-comparison pipeline. It's what allows Tea Tax to compare providers accurately and route users to the right tier.

**Tomorrow:** The object becomes the universal API between taxpayers and any tax-filing system - human or AI. As agentic tax filing emerges (frontier model SDKs, MCP servers), this object is what an AI agent consumes to file taxes on a user's behalf.

**Conceptual schema:**

```
TaxSituation {
  filingYear, filingStatus, dependents[]
  incomeStreams[] { type, source, amount, documentation[] }
  deductions[] { type, amount, documentation[] }
  lifeEvents[] { type, date, details }
  priorYearContext { estimatedAGI, filingMethod, provider }
  documentationCompleteness: float
  confidenceScores: {}
  rawArtifacts[] { type, source, extractedData }
}
```

The object is the user's property. They can export it, share it with any provider or professional, or delete it entirely at any time. No one at Tea Tax can view it. Sharing with a credentialed professional requires explicit, granular, revocable consent - and every access is logged and visible to the user.

**The analogy:** Plaid didn't become a bank - it became the connection layer between consumers and financial services. Tea Tax's object is the connection layer between taxpayers and tax filing. This is the long-term platform play and the defensible moat.

---

## Product Architecture: Three Verticals

Tea Tax is three distinct product verticals that compose into a single platform. Each vertical has its own scope, build timeline, and success criteria. They are separable as engineering efforts but inseparable as a user experience - the output of each vertical feeds the next.

### 1. The Intake Engine

The front door. A multi-modal, AI-powered intake that meets the user wherever they are - unprepared, anxious, holding a metaphorical shoebox - and produces a structured tax situation object representing their complete financial context.

Collection methods include AI chat, voice, phone camera capture, video, document upload, OCR, and financial account connections (Plaid). The experience is mobile-first, conversational, and designed to feel like a white-glove CPA firm - not a software onboarding flow. Every piece of data is encrypted immediately and never visible to Tea Tax administrators.

The intake engine's output - the portable tax situation object - is the connective tissue between every other vertical. It feeds the comparison engine and the practitioner layer. Its quality determines the quality of everything downstream.

### 2. The Comparison Engine

The transparency layer. Given a user's tax situation object (form makeup, complexity, service level preference), the comparison engine surfaces honest, side-by-side pricing and fit across every filing option available.

This vertical has two distinct data challenges:

**Baseline pricing** is deterministic and form-driven. Each major provider's tier structure is mapped by form/schedule presence, quantity vectors (e.g., multiple W-2s), and service level (DIY, DIWH, DIFM). These mappings are buildable from domain knowledge and verifiable through testing. Published tier prices are trackable over time (they shift through the season). This layer is a solvable engineering and research problem.

**Ancillary pricing** is where the opacity lives. Audit protection, bank products (refund advances, refund transfer fees), identity protection bundles, state filing fees - these are contextually upsold, dynamically bundled, and deliberately opaque. This is the layer the FTC has fined incumbents for. For V1, the comparison engine can surface baseline pricing with honest warnings about ancillary upsells. Over time, crowdsourced community data fills in the gaps on what people actually paid all-in.[^ftc-intuit][^ftc-hrb]

**Aggregated sentiment** is the qualitative counterpart to the pricing vectors. Public review data is abundant, discoverable, and devastating for incumbents - TurboTax sits at 1.2/5 on Trustpilot, and Reddit threads about tax software are viscerally negative. The comparison engine aggregates sentiment across every public source (Trustpilot, BBB, App Store, Google Play, Reddit, Twitter/X) into a provider-level vibe-check score that users can see and track over time (L7, L30, season-over-season trends).

The most powerful derivative of sentiment data is a **bait-and-switch likelihood signal** - derived from the frequency of surprise-charge complaints, the gap between advertised and reported actual pricing, FTC enforcement history, and the pattern of reviews mentioning forced tier upgrades or upsell pressure. This directly quantifies the ick factor that drives the populist energy behind "the people" not trusting incumbents. Price tells you what you'll pay. The ick vector tells you how you'll feel about the experience - and how likely you are to end up paying more than you expected.

Sentiment data is buildable from day one with no partnerships, no proprietary access, and no dependencies. It compounds over time as historical trends accumulate. And it's inherently viral - "TurboTax's bait-and-switch score just hit a season high" is the kind of artifact people share.

The comparison engine surfaces all three vectors together: baseline pricing (what the provider will charge for your situation), ancillary risk (where the hidden costs live), and aggregated sentiment (what real people say about the experience). Default sort is always "best fit for you," never "highest bidder."

### 3. The Practitioner Layer

The human-in-the-loop layer. "Practitioner" is Circular 230's own term for who is authorized to practice before the IRS - CPAs, EAs, and attorneys. The name is deliberate: this layer is built around the credential, not around software.[^c230]

The Practitioner Layer has two components:

**The marketplace** connects consumers directly to credentialed tax practitioners. The tax situation object arrives pre-structured - the practitioner receives a client who's already organized, not a shoebox. Practitioners compete on quality, specialization, and reviews - not on which platform captured the customer first. Profiles are agnostic and practitioner-owned: "Look me up on Tea Tax" becomes the equivalent of a doctor's Zocdoc profile.

**The coordination layer** wraps around the practitioner's existing tools rather than replacing them. Tax firms evaluate and lock in their tech stack (Drake, Lacerte, ProConnect, CCH) post-season from May to September. Switching costs are enormous, especially for established firms. Tea Tax does not ask practitioners to adopt new filing software. Instead, the coordination layer handles everything upstream and around the filing:

- Pre-structured client intake (the tax situation object, already parsed and organized)
- Document library (W-2s, 1099s, receipts extracted and categorized)
- AI-generated insights, flagged edge cases, and pre-researched tax code implications
- Client communications (threaded messaging, notifications, nudges)
- Task queue and workflow management with Circular 230 compliance gates
- Billing and payments
- Export / integration with existing filing software - the tax situation object outputs in formats the practitioner's existing tools can consume

The practitioner files using whatever software they already use. Tea Tax handles everything except the return itself. The practitioner's time is spent on what only they can legally do: judgment, advice, strategy, and sign-off.

This vertical operates across the full filing-to-strategy spectrum:

- **Prep:** The practitioner receives a pre-structured client and files using their existing tools. What used to take hours of intake takes minutes.
- **Advice:** Year-round, forward-looking guidance on how life events and tax code changes impact the client. Regulated under Circular 230 - the AI surfaces insights and context, the credentialed practitioner delivers the advice.[^c230][^irs-ntf-ai]
- **Strategy:** Proactive structuring of financial decisions to optimize long-term tax outcomes. Today gated behind expensive white-glove firms; Tea Tax democratizes access by making each practitioner radically more productive.

The Practitioner Layer is where the Circular 230 contrarian bet pays off. The value chain is splitting: commodity form assembly gets automated, while regulated judgment, review, and sign-off become more valuable. Circular 230 does not guarantee demand for manual prep labor, but it does reinforce demand for credentialed professionals at high-risk decision points - written advice, position-taking, representation, and final accountability. Tea Tax does not compete with that demand - it builds the infrastructure that makes it scalable. And by meeting practitioners where they are (their existing tools, their existing workflows) rather than forcing adoption of a new filing platform, the supply-side GTM becomes dramatically easier.[^c230][^fr-c230-proposed][^irs-c230-release]

### How They Compose

```
User → Intake Engine → Tax Situation Object
                            ↓
                    Comparison Engine → "Here are your options"
                            ↓
              ┌─────────────┼─────────────────┐
              ↓             ↓                 ↓
        File with       Export &          Connect with
      a SaaS provider   shop around       a Practitioner
      (affiliate)       (portable object) (marketplace)
```

V1 ships the Intake Engine and Comparison Engine. The Practitioner Layer is architecturally anticipated but built post-validation. Each vertical can be scoped, staffed, and measured independently while delivering a unified user experience.

---

## Revenue Model

**Kayak model with radical transparency (Credit Karma precedent).**

- **Free for consumers, always.** Zero friction at the "I need to do my taxes" moment. Non-negotiable for virality and the front-door positioning.
- **Revenue from referral fees and qualified lead generation.** When a user chooses a provider through Tea Tax, the provider pays for that qualified, pre-structured lead.
- **The pitch to providers:** "We send you customers who already know their tax situation, are pre-qualified for the right tier, and chose you because they trust our recommendation. Your conversion rate goes up, your support costs go down, and you stop spending on acquisition."
- **Radical transparency as the moat.** If a provider pays for placement, it's clearly labeled. Methodology is published. Trust is the brand.

**Credit Karma is the direct precedent - and a cautionary tale.** Credit Karma became the free, trusted front door for credit decisions and was acquired by Intuit for ~$8B. But the DOJ forced Credit Karma to divest its free tax filing product as a condition of the acquisition (it became Cash App Taxes under Square). Credit Karma now funnels users into TurboTax - the "impartial front door" became a captive pipeline for an incumbent. This validates the market (an acquirer paid $8B for the front door) but also demonstrates the strategic risk: incumbents will try to acquire and neutralize threats to their opacity. Tea Tax's defense is its community-driven, populist identity - being bought by an incumbent would destroy the brand.

---

## V1 Scope

Intake and comparison ship together as inseparable halves of one experience. The magic is the through-line: walk in the front door unprepared, walk out with a clear, honest comparison and the structured data to act on it.

**V1 routing can launch with:**

- **Free File Alliance members** - 8 providers, no direct partnership needed, covers 70%+ of taxpayers with AGI under $89K
- **Affiliate links** to major providers (TurboTax offers 10-15% rev share through CJ Affiliate; H&R Block, TaxAct, FreeTaxUSA have similar programs)
- **"Take your data and shop"** - export the tax situation object and bring it to any provider manually
- **"Connect with a tax pro"** - captures demand for the Practitioner Layer marketplace (post-V1)

_Note: IRS Direct File was reported as discontinued for the 2026 filing season. If reinstated, it becomes an obvious routing destination. Its absence makes the Free File Alliance and the "take your data and shop" portability even more important._[^ap-direct-file]

This provides a working product and revenue path on day one without requiring a single signed distribution partnership. Routing sophistication grows as industry partnerships develop.

**Urgency: the 2026 filing season is the POC window.** Tax filing is aggressively seasonal - ~75% of returns are filed between January and April. V1 needs to launch in-season to validate the core thesis: that people will use this front door, that the intake is delightful enough to complete, and that the recommendation drives action. Missing this season means waiting a full year to test virality. The strategic roadmap (advice, strategy, marketplace) addresses seasonality long-term, but V1 lives and dies in-season.

### V1 Metric Signals

Three numbers determine whether V1 is working. Everything else is noise until these are proven.

**1. Intake Completion Rate.** The percentage of users who start the intake and finish it with a structured tax situation object. This is the product-market fit signal for the intake experience itself - if people don't finish, the white-glove promise is failing. The intake asks for sensitive information from a brand with no track record; every drop-off is a trust failure, a UX failure, or both. Target: 60%+. Below 40% means the experience needs fundamental rework before anything downstream matters.

**2. End-to-End Time to Value.** The elapsed time from first touch to delivered recommendation. The target user is anxious, procrastinating, and holding a metaphorical shoebox - they need to feel progress immediately and reach a clear answer fast. If the intake takes 20 minutes, the product is behaving like the tax software it's trying to replace. **10 minutes or less from "I need to do my taxes" to "here's what you should do."** This constraint should drive every design decision in the intake flow - what to ask, what to infer, what to skip, and when to use document capture or Plaid over conversation.

**3. Recommendation Click-Through Rate.** The percentage of users who receive a recommendation and click through to a provider. This is the revenue model in a single number - no click-through, no referral fee, no business. It validates two things simultaneously: that the recommendation is trustworthy enough to act on, and that the comparison format is compelling enough to drive a decision. Low CTR with high completion means the recommendation engine isn't delivering value or the user doesn't trust the output. Target: 40%+ click-through on the primary recommendation.

These three metrics form a funnel: users who start -> users who finish -> users who act. The product is the funnel. If any stage breaks, the stages below it are meaningless.

---

## Why Now: Five Converging Forces

Tea Tax is not a product that could have existed five years ago, and it may not have this window five years from now. Five forces are converging to create a unique moment:

**1. AI capability inflection.** Multi-modal AI - voice understanding, video processing, document extraction, conversational chat - is production-ready for the first time. The white-glove intake experience at the heart of Tea Tax was technically impossible two years ago. The cost of building it has dropped by orders of magnitude. What once required 50 specialists can now be built by a lean, focused organization in months.

**2. Regulatory pressure on incumbents.** The FTC issued orders in 2024 barring Intuit from advertising TurboTax as "free" unless it's genuinely free for all consumers. A separate FTC action against H&R Block for the same deceptive practices is enforcing changes through 2026. The regulatory environment is actively punishing the exact opacity Tea Tax exists to solve - and creating consumer awareness of the problem in the process. "The FTC literally fined them for this" is a powerful trust-building message.[^ftc-intuit][^ftc-hrb]

**3. IRS Direct File ended (for now).** Direct File was reported as unavailable for the 2026 filing season. Roughly 300,000 users who had a free, impartial alternative now have nowhere to go. This creates a vacuum - and political energy - that Tea Tax can absorb. The loss of Direct File makes an independent, impartial front door more necessary, not less.[^ap-direct-file]

**4. Tax complexity is increasing for everyday filers.** 2026 changes hit hard: the standard deduction shrinks (~$8,300 single), tax brackets rise, and gig worker compliance pressure is increasing as IRS enforcement becomes more data-driven and AI-assisted. More people need help, the help is getting more expensive, and the people who need it most - freelancers, side-hustlers, new business owners - are the least served by the current system.[^senate-finance-werfel][^house-roi-hearing]

**5. Agentic infrastructure is emerging.** MCP, agent SDKs, and structured data protocols exist today. The portable tax situation object has a consumer ecosystem for the first time. AI agents that can interact with external services, consume structured data, and take action on a user's behalf are being built right now. Tea Tax isn't building for a theoretical future - it's building for an infrastructure layer that's arriving this year.

**Taken together:** The technology is ready, the regulators are punishing incumbents, the government alternative is gone, tax complexity is growing, and the agentic ecosystem is emerging. This is the window.

---

## The Narrative: AI as Empowerment, Not Replacement

Tea Tax should be positioned as the gold standard for how AI is steered to help human problems - not as another chapter in the "AI takeover" narrative. The tax industry is the perfect stage for this:

- **For consumers:** AI doesn't replace your judgment about how to file your taxes. It gives you the information, transparency, and structured data to make that judgment confidently for the first time. You walk in overwhelmed; you walk out empowered.
- **For tax professionals:** AI does not eliminate your role. It compresses low-leverage labor and amplifies high-leverage work - risk triage, issue spotting, position defensibility, client communication, and strategic judgment. You can serve more clients, at higher quality, with less drudgery and stronger compliance controls built into the workflow.
- **For the industry:** AI doesn't make tax filing opaque and automated. It makes it transparent and human-centered. The human stays in the loop where it matters (advice, strategy, sign-off), and the AI handles what humans should never have had to do manually in the first place (data entry, document extraction, form classification, tax code lookup).

This is a deliberate counter-narrative to the dominant AI story. The dominant story says: "AI will automate your accountant away." Tea Tax says: **"AI will give every American access to the kind of tax guidance that used to be reserved for the wealthy - and it will make the professionals who deliver that guidance more capable than ever."**

This positioning matters for every stakeholder: consumers trust a product that's explicitly on their side and treats their data as sacred, tax professionals adopt a platform that amplifies rather than threatens them, CPA organizations partner with a company that strengthens their members, regulators view Tea Tax favorably because it keeps credentialed humans in the compliance loop with gold-standard data privacy, and AI partners (Anthropic) get a flagship example of responsible, human-centered AI deployment.

---

## Footnote: Strategic Framework - What Comes After the Aggregator

Tea Tax V1 is inherently **reactionary** - the tax year is done, the consumer needs to file. But the aggregator play is a wedge, not the ceiling. The long-term strategic trajectory follows a spectrum:

```
Tax Filing (transactional) → Tax Advice → Tax Strategy
```

**Tax Filing** is where V1 lives. It's the moment of need: "I need to file." Tea Tax meets users here, builds trust, and captures their tax situation.

**Tax Advice** is the next step: year-round, forward-looking guidance. "What's happening in my life _this year_ that will impact tax time come April _next year_?" New job, marriage, starting a business, buying a home - these events happen throughout the year, and the tax implications are real but invisible until filing season. Tea Tax should become the place users turn to _as life happens_, not just when the deadline looms.

**Tax Strategy** is the golden ticket. Today, proactive tax strategy - structuring decisions to optimize long-term tax outcomes - is gated behind expensive white-glove CPA firms and available almost exclusively to the ultra-wealthy. The legal risk management alone keeps it locked behind high fees. No one is doing this at scale for everyday consumers. An AI-first approach, built on a growing longitudinal picture of a user's financial life, can begin to democratize this - shifting from "here's what you owe" to "here's what you should consider doing _before_ you owe it."

**Regulatory constraint:** Tax advice and strategy are regulated under IRS Circular 230, which governs who can practice before the IRS and provide personalized tax guidance. Circular 230 does not broadly regulate all tax preparation, but it does impose enforceable standards when practitioners represent taxpayers and render written advice. Recent IRS commentary and proposed rulemaking make clear that AI-assisted workflows still require human due diligence, competence, and technological competence. Tea Tax navigates this by keeping the advice and strategy domain explicitly behind the **human-in-the-loop credentialed professional marketplace** - the AI surfaces insights and context, the credentialed pro delivers the advice. This is where the filing → advice → strategy spectrum and the tea tax professional marketplace converge: the marketplace isn't just a distribution play, it's a compliance architecture.[^c230][^fr-c230-proposed][^irs-c230-release][^irs-ntf-ai]

### The Tax Code Listener and Continuous Financial Context

As Tea Tax moves right on the spectrum toward advice and strategy, two infrastructure capabilities become critical:

**A living, AI-native tax code knowledge base.** The U.S. tax code doesn't stand still - legislation is enacted, provisions sunset, thresholds adjust, and new rules take effect mid-year. Tea Tax should maintain a version-controlled, AI-native representation of the tax code (think `.md` files with real-time diffs) that tracks every change over time. When new tax-impact legislation is enacted, the system can immediately cross-reference it against a user's financial profile and surface what changed, how it might impact them, and what they should watch out for. This turns Tea Tax from a point-in-time tool into a persistent, always-current tax intelligence layer - the equivalent of having a CPA who reads every piece of tax legislation the moment it passes and calls you if it matters.

**Persistent Plaid integration as a living financial picture.** In V1, Plaid pulls a snapshot of financial context at intake time. As the product moves toward advice and strategy, that connection becomes persistent - a continuous, consented feed of financial activity that keeps the tax situation object current year-round. Combined with the tax code listener, this creates a powerful feedback loop: the system knows what's happening in the user's financial life _and_ what's changing in the tax code, and can proactively surface the intersection - "You started receiving 1099 income in Q2. Under the current rules, here's what that means for estimated payments. Here's what you might want to do before December 31."

Together, these two capabilities are what make the move from filing to strategy real. Without them, advice is stale and strategy is impossible at scale.

### The Tea Tax Practitioner Marketplace

There is a parallel supply-side opportunity. Today, no open marketplace exists for credentialed tax practitioners. TurboTax has cornered this market over time by funneling contract tax pros into their DIWM (Do It With Me) and DIFM (Do It For Me) swimlanes - taking a significant cut as the middleman while the practitioners themselves don't see a full share of the value they create.

The Practitioner Layer builds a **direct, no-middleman connection** between consumers and the entire credentialed practitioner marketplace. The tax situation object makes this natural: a consumer's structured, complete tax situation can be shared directly with any qualified practitioner, who can price their services transparently and compete on quality, specialization, and reviews - not on which platform captured the customer first.

**Critical industry insight: the supply constraint.** The supply of credentialed tax advice is a massive constraint that should not be underestimated. This becomes particularly acute as the seasonal crescendo builds exponentially in the final weeks before the tax deadline - demand for professional help spikes while the available pool of qualified practitioners is already fully committed. This is a structural problem the industry has never solved, and it compounds the consumer frustration that Tea Tax exists to address.

This supply constraint makes the marketplace strategy even more compelling - and the coordination layer is what makes it work. Tea Tax can build the **definitive professional profile layer** for every credentialed tax practitioner in the market - a practitioner's Tea Tax profile becomes their agnostic, third-party-verified public presence. It includes where they've been contracted (even if that means they worked for TurboTax), their specializations, verified client reviews, and credentialing status. "Look me up on Tea Tax" becomes the thing a practitioner tells a prospective client, the same way a doctor points to their profile on Zocdoc or a contractor points to Angi. The profile is agnostic content the practitioner owns and controls, not locked behind a platform's walled garden.

The moat widens here because this is a two-sided network effect: consumers come for the profiles and reviews, practitioners come because that's where the clients are looking. Once a critical mass of credentialed practitioners have verified profiles on Tea Tax, it becomes the de facto directory.

**Supply-side go-to-market: regional CPA organizations.** The initial distribution strategy for the practitioner marketplace should target direct relationships with state and regional CPA societies and EA (Enrolled Agent) associations. The pitch lands because Tea Tax doesn't ask their members to change tools - keep Drake, keep Lacerte, keep whatever you already use. Tea Tax sends pre-structured clients and provides a coordination layer that makes practitioners 10x more productive with the tools they already have. These organizations want better representation, higher visibility for their members, and tools to compete against the TurboTax pipeline that undercuts their independence. Tea Tax offers them all three. A partnership with a handful of state CPA societies could seed the marketplace with thousands of verified practitioners overnight, giving the supply side a head start before the demand side scales.

This is the full vision: **Tea Tax starts as the front door for filing, becomes the year-round tax advisor, and ultimately operates as both the strategy layer for consumers and the open marketplace and coordination platform for the practitioners who serve them.**

---

## The Contrarian Bet: AI Won't Replace Your Accountant. It Will Make Them Superhuman.

The prevailing narrative in AI tax is that automation will replace the accountant. Every AI tax startup is implicitly making this bet - build a system that removes the human from the loop entirely. Tea Tax makes the opposite bet: **regulation will protect the human's role in advice and strategy, and that protection gets stronger as AI advances, not weaker.**

This isn't wishful thinking - it's structural. Circular 230 exists because tax advice carries legal liability, fiduciary obligations, and compliance risk that require professional accountability. The IRS has already flagged AI as an area requiring heightened professional responsibility. As AI becomes more capable and more widely deployed in sensitive financial domains, the regulatory pressure to ensure human oversight will increase, not decrease. Every capability leap in AI creates more demand for the credentialed human oversight layer - not less.[^c230][^irs-ntf-ai][^fr-c230-proposed]

This means the AI tax startups building toward fully automated preparation hit a **regulatory ceiling** the moment they try to move into advice and strategy. Tea Tax doesn't hit that ceiling because it's designed around it.

### The SuperHuman CPA

The supply constraint doesn't get solved by removing the human. It gets solved by making each human radically more productive. A CPA on the Tea Tax platform, armed with AI, operates with capabilities that have never existed before:

- Every client arrives with a fully structured tax situation object - no more hours lost to shoebox intake
- AI-generated insights, flagged edge cases, and pre-researched tax code implications are ready for review before the CPA opens the file
- Document extraction, classification, and routine prep are already complete
- The tax code listener has surfaced every relevant legislative change for each client's specific profile
- Year-round Plaid integration means the CPA has a living picture of the client's financial life, not a stale snapshot

The CPA's time is spent exclusively on what only they can legally and professionally do: judgment, advice, strategy, and sign-off. The work that Circular 230 protects. The work that justifies the credential.

The math changes completely. A solo practitioner who could handle 200 clients during tax season could handle 2,000 - at the same or higher quality - because all the leverage work is handled by the AI layer. The seasonal supply constraint that crushes the industry every April becomes manageable. The cost per client drops because the CPA's time is used 10x more efficiently. And that is how tax strategy gets democratized - not because AI replaces the expensive CPA, but because AI makes the CPA so productive that what used to cost $500/hr becomes accessible to everyone.

### The Superhuman Practitioner Coordination Layer

The SuperHuman CPA isn't just a metaphor - it implies tooling. For a credentialed practitioner to operate at 10x capacity, they need more than access to AI. They need an intelligent coordination layer that handles everything upstream and around the return: multi-channel client intake (chat, voice, video, document upload), structured data extraction, Circular 230 compliance enforcement baked into the workflow (not bolted on as an afterthought), a task queue that surfaces exactly the decisions that require human judgment, client communications, and billing.

Critically, this is not a filing platform. Practitioners keep the filing software they already use - Drake, Lacerte, ProConnect, CCH, or any other tool they've invested in. Tax firms evaluate and commit to their tech stack post-season (May-September), and the switching costs are enormous - especially for established firms. Asking practitioners to rip out their filing software is a multi-year sales cycle with a low win rate. The coordination layer wraps around their existing tools, sending them pre-structured clients and organized data that their software consumes. This is what makes the supply-side pitch land in a single meeting instead of a multi-quarter enterprise sale.

The architecture is multi-tenant and white-label by design - any practitioner firm can use the coordination layer under their own branding while Tea Tax provides the infrastructure. A solo practitioner, a 10-person firm, and a 200-person regional practice all run on the same platform, scaled to their needs.

The critical design principles: **Circular 230 compliance is architectural, not behavioral.** The system doesn't rely on the AI remembering to flag edge cases (though it does that too). The engagement lifecycle enforces compliance gates - AI can advance a client through intake and preparation, but only a credentialed human can advance through review, advice, and sign-off. The authority boundaries are built into the state machine. This is what makes it possible to scale to thousands of clients per practitioner without introducing compliance risk. **Privacy is equally architectural.** A practitioner on the platform can only see data for clients who have granted them explicit, scoped permission. There is no firm-wide backdoor, no admin override, no "view all clients" mode. The same zero-knowledge and encryption principles that protect user data from Tea Tax administrators extend to the multi-tenant coordination layer - one firm's data is cryptographically invisible to every other firm, and to Tea Tax itself.

The coordination layer creates a supply-side lock-in dynamic through client relationships, workflows, communications, and billing - not through the filing software itself. Combined with the consumer-side front door driving demand into the marketplace, this creates the two-sided platform flywheel.

### Why This Matters for the Thesis

This is not a peripheral point. It is the connective tissue between every major piece of the strategy:

- **The marketplace** becomes essential, not optional - regulation guarantees demand for credentialed humans, and Tea Tax is how they connect to consumers at scale
- **The coordination layer** is what makes the marketplace actually work - it's not enough to connect consumers to practitioners; the practitioners need infrastructure to operate at superhuman scale, and the coordination layer provides it with compliance built in and integration with their existing filing tools
- **The supply-side GTM** (CPA societies, EA associations) has a pitch that resonates instead of threatens: "We're not here to replace your software or your members. Keep Drake. Keep Lacerte. We're here to send them pre-structured clients and give them a coordination layer that makes them 10x more productive, with direct access to clients and no middleman taking a cut."
- **The moat deepens over time** - as AI advances, the value of the platform to both consumers (access to superhuman practitioners) and professionals (AI-powered leverage) increases
- **The seasonal crunch** gets structurally addressed - not by adding more humans, but by multiplying the capacity of each one
- **The proprietary local models** have a clear second customer beyond the consumer: the practitioner, whose workflow they optimize
- **The pricing disruption flows both ways** - consumers pay less because practitioners are more efficient, and practitioners earn more per hour because they're not drowning in low-value prep work

**"AI won't replace your accountant. It will make your accountant superhuman."** That's the supply-side pitch to every CPA org and EA association. It's the answer to every practitioner who's afraid AI will take their job. And it's the structural reason the marketplace moat deepens over time instead of getting disrupted by it. The Practitioner Layer doesn't ask anyone to change their filing software - it wraps around what they already use and makes them radically more productive.

---

## Market Reality Check

### Competitive Landscape

**Editorial comparison sites (NerdWallet, Investopedia, Wirecutter):** These publish annual "best tax software" rankings using affiliate revenue models. NerdWallet alone has $836M in annual revenue and 23-29M monthly users. However, they are media companies - static editorial content, not dynamic intake-driven recommendation engines. None collect the user's actual tax situation and recommend based on it. The gap between "here are the top 5 tools" and "based on YOUR situation, here's the best option" is real and unoccupied. Building an AI-first, multi-modal intake with voice, video, OCR, Plaid integration, and a structured portable data object would require NerdWallet to make a strategic pivot from content company to product/platform company - possible, but unlikely to be fast or natural.

**AI tax startups (Taxu, Magnetic, Black Ore, Filed, Abacus):** Several well-funded AI tax startups exist, but they are all building **tax preparation tools** - not aggregators. They're the providers Tea Tax would route _to_, not competitors for the front-door position. None are doing the recommendation layer.

**Incumbents (TurboTax, H&R Block):** They benefit from opacity and have no incentive to build a transparent comparison tool. TurboTax actively lobbied against IRS Direct File. Their moat is brand lock-in and inertia, not a superior product experience.

### Moat Assessment

The portable tax situation object and the AI-first intake experience are harder to replicate than the comparison engine. The comparison is a feature; the intake is a product capability that requires deep domain expertise - knowing what questions to ask, what data matters, how tier placement works, where the gotchas are. A generalist organization would need to learn this the hard way.

This is a **speed moat, not a permanent one.** Domain expertise from SaaS tax product management is real alpha for getting the intake right on the first try. The IRS MeF XML schema defines standardized formats for completed tax _returns_ (the output), but nothing standardized exists for the pre-return _tax situation_ (the input) - the human's messy life before it becomes a clean filing. That's the object Tea Tax creates and owns.

The community-driven pricing database, once it has critical mass, becomes a second moat - a user-generated data asset that is self-reinforcing and defensible through network effects.

### Data Portability Reality

Switching between major tax providers is technically easier than implied - H&R Block offers direct import from TurboTax (150+ data fields via phone number), and TurboTax can import H&R Block returns via PDF. The lock-in consumers experience is **psychological and inertial**, not technical. The document's "don't want them walking back to retrieve their docs" framing should be understood as an emotional truth about user behavior, not a technical barrier. Tea Tax solves the emotional problem: it gives users confidence to shop the market without needing to go back to their old provider first.

### Potential Acquirers

The front-door position in a $30B+ market attracts interest across several tiers:

**Incumbents (highest risk to brand):** Intuit already paid ~$8B for Credit Karma to own the front door - they'd try again. H&R Block, the perennial #2, would value the aggregator as a weapon against TurboTax's digital dominance. Both carry the highest brand-destruction risk; being acquired by an incumbent undermines the populist trust that makes the product work.

**Financial services platforms:** Block/Square (already owns Cash App Taxes), SoFi (one-stop financial wellness), Robinhood (investor tax pain), PayPal/Venmo (freelancer/gig worker tax complexity). These are less brand-toxic and would use Tea Tax to fill the tax gap in their financial ecosystems.

**Financial data infrastructure:** Plaid is the most philosophically aligned acquirer. Plaid is the connection layer for banking; Tea Tax is the connection layer for tax. The combination creates definitive financial data infrastructure. Cleanest strategic fit of any potential acquirer.

**Payroll/employer side:** ADP, Gusto, Rippling - they already generate W-2s and sit on half the intake data. Tea Tax extends them from "we handle your employer's payroll" to "we help you with your taxes too."

**Big tech:** Google (tax is a massive seasonal search category), Apple (financial health/privacy brand alignment). Both would use it to own the conversion layer between intent and action.

### The AI Partnership Angle

Tea Tax is not just a consumer product - it's potentially a flagship use case for the emerging AI agent ecosystem, with particular strategic alignment to Anthropic.

**MCP as the native protocol for the tax situation object.** Anthropic created the Model Context Protocol (MCP). The portable tax situation object is, by its nature, exactly the kind of structured data MCP was designed to expose. If the object is implemented as an MCP server from day one, any Claude-powered agent can natively consume a user's tax situation. Agentic tax filing - "Claude, file my taxes" - routes through Tea Tax's object as the data layer. This positions Tea Tax as **infrastructure in the AI agent economy**, not just a standalone consumer app. The product becomes the canonical tax data provider for any frontier model agent that needs to interact with the tax domain.

**Flagship use case for responsible AI.** Tax is high-stakes (money, compliance, legal risk), multi-modal (documents, voice, video, chat), trust-critical (financial data, accuracy), and massive market (150M+ annual filers). This checks every box for what an AI company would want as a reference application. "Claude powers the front door for how Americans do their taxes" is an extremely powerful narrative, and it aligns with Anthropic's "AI safety" brand - technology serving people's interests in a domain where consumers have historically been exploited.

**The agentic filing future.** As frontier models become more agentic, the portable tax situation object + MCP becomes the handoff protocol. The spectrum becomes: Tea Tax handles intake → the object is exposed via MCP → an AI agent consumes the object and files, or routes to a credentialed pro for advice/strategy. Tea Tax isn't competing with AI providers - it's the data layer that makes their agents useful in a $30B+ market.

**What a partnership could look like:**

- Preferred API pricing or co-development resources as a flagship partner
- Strategic investment (Anthropic has invested in companies building on their platform)
- Joint go-to-market: "Powered by Claude" as a consumer trust signal
- Tea Tax as the reference implementation for MCP in financial services
- Brand alignment: Anthropic's "AI safety" + Tea Tax's "we the people" + gold-standard data privacy share a common narrative of technology that serves people, not exploits them

### Proprietary Local Models: Reducing Frontier Dependency

The tax domain is unusually well-suited for proprietary, fine-tuned local models. Most of the intelligence the intake requires isn't open-ended general reasoning - it's structured, rule-based, and pattern-driven. Extracting data from a W-2 or 1099 is a classification and extraction task. Determining which tax forms apply to a situation is rule-based logic. Parsing the tax code is structured document understanding. Routine intake questions follow predictable conversational patterns. Fine-tuned smaller models can match or exceed frontier models on these specific tasks.

Building this proprietary model layer strengthens the position on multiple dimensions:

**Trust and privacy.** Tax data is among the most sensitive personal information that exists - SSNs, income, financial accounts, dependents. Processing it locally or on Tea Tax's own infrastructure instead of sending it to third-party APIs is not just a trust differentiator - it is a direct expression of the core privacy tenet. No administrator can see user data, and the most sensitive processing never leaves infrastructure Tea Tax controls. Users should feel that their data stays with them, not with a model provider, not with Tea Tax employees, and not with anyone they haven't explicitly authorized.

**Cost.** Frontier model API calls at scale (150M+ potential filers, multi-modal inputs across voice, video, documents, and chat) would be enormous. Proprietary models for routine tasks collapse the unit economics and make the "free for consumers, always" commitment sustainable at scale.

**Moat (the flywheel).** Models fine-tuned on Tea Tax's growing dataset create a compounding advantage: more users produce better training data, which produce better models, which produce a better intake experience, which attract more users. A competitor can't replicate this by plugging into Claude or GPT - the domain-specific model quality is earned through accumulated usage, not bought off the shelf.

**Negotiating leverage.** Full dependency on any single AI provider gives them pricing power. Proprietary models for core tasks mean Tea Tax uses frontier models where they're genuinely needed (complex situational reasoning, edge cases, novel scenarios) and handles the rest independently. This strengthens negotiating position in any partnership and protects against API pricing changes, rate limits, or strategic shifts by providers.

**Availability.** During the seasonal crescendo in the final weeks before the tax deadline - when demand spikes exponentially and every minute of downtime costs users - Tea Tax can't afford to be rate-limited or hit by third-party API outages. Local models for core functions guarantee availability when it matters most.

**Open source and brand alignment.** "Tea Tax" with open-source, tax-specific models is a natural extension of the populist identity. The community contributes data, the models improve, everyone benefits. This is the "we the people" ethos applied to the AI layer itself.

**The hybrid architecture:**

- **Proprietary local models** for: document extraction, tax form classification, PII handling, routine intake conversation, tax code parsing, pricing data normalization
- **Frontier models** for: complex situational reasoning, conversational quality on edge cases and novel life events, agentic filing capabilities, strategy-layer insights

This actually strengthens the Anthropic partnership rather than undermining it. Tea Tax becomes a more valuable partner because it's not a pure API consumer - it's building the domain-specific intelligence layer that makes Anthropic's general-purpose agent useful in tax. The relationship shifts from vendor-customer to complementary infrastructure.

---

## The Hardest Problem: Distribution and Trust Bootstrapping

Assuming the tech stack is accounted for, the hardest problem is not building the product. It is getting the first 10,000 users to trust a brand-new, unknown product with their Social Security number, W-2s, and financial account connections during a single 4-month window, when 80% of the market defaults to what they used last year.

This is a distribution and trust problem, not a technology problem. It compounds across three dimensions:

### 1. Trust at First Touch

Tea Tax asks for the most sensitive personal information a consumer has - in a domain where trust is the #1 decision factor - from a brand that doesn't exist yet. No track record, no reviews, no word-of-mouth history. This is qualitatively different from launching a new restaurant app or shopping tool. People will hesitate to type their SSN into something they discovered last week. The "we the people" brand, FTC enforcement narrative, and gold-standard privacy architecture (zero-knowledge encryption, no admin access to user data, user-controlled consent) help, but they don't solve the cold trust problem alone.

### 2. Breaking Inertia in a Compressed Window

Tax season is 4 months. You don't get to slowly build awareness over a year. The consumer decision happens once annually, and most people make it passively - "I'll just use TurboTax again." Tea Tax needs a distribution channel or viral moment that reaches people _before_ they default, and the window is narrow. Every day of tax season that passes without traction is a day closer to waiting an entire year to try again.

### 3. The Marketplace Cold Start

V1 can launch as aggregator + affiliate routing (no marketplace required). But the long-term vision - the Practitioner Layer coordination platform, the pro marketplace, the supply-side flywheel - requires both sides. CPA society partnerships are the right GTM strategy, but professional associations are notoriously slow-moving institutions. The community-driven pricing database is a cold start problem nested inside a cold start problem.

### What De-Risks This

**A trust accelerator.** A partnership or endorsement that confers instant credibility. An Anthropic co-branded launch ("Powered by Claude") signals safety and capability. A consumer advocacy org endorsement. A viral moment tied to the FTC enforcement narrative - "The government fined TurboTax for deceiving you. Here's the tool that's actually on your side." The AI empowerment narrative is the trust accelerator: Tea Tax isn't a faceless tech startup asking for your SSN. It's AI steered to help you, built to be transparent, and designed to put you in control of your own tax situation for the first time.

**A single, sharp distribution wedge.** Not "everyone who files taxes" - a specific, reachable, high-pain cohort. Freelancers and gig workers facing the 2026 tax changes are the obvious candidate: they're already anxious, their tax situation just got more complex (shrunken standard deduction, stricter enforcement, and more data-driven IRS compliance initiatives), they over-index on digital-first tools, and they're reachable through creator/freelancer communities (Twitter/X, Reddit, YouTube tax content, freelancer Slack groups). Win this cohort first, then expand.[^senate-finance-werfel][^house-roi-hearing]

**A content/community play that precedes the product.** The Team Blind for tax pricing community could launch _before_ the full product. A subreddit, a simple tool that shows crowdsourced pricing data, a "what did you actually pay TurboTax this year" viral post. Build the audience, build the trust, build the brand - then introduce the intake. The community IS the product in the early days, and the intake is the upgrade path.

**The empowerment narrative as distribution.** The framing of AI as empowerment - not replacement, not surveillance, not automation for its own sake - is inherently shareable. In a media landscape saturated with AI fear, a product that says "AI is here to help you navigate a system designed to confuse you" stands out. This is a story people want to tell each other. It's the kind of positioning that earns media coverage, social sharing, and word-of-mouth - not because of growth hacks, but because the narrative resonates with a frustration that 150 million Americans share every spring.

---

## Citations

[^c230]: IRS, _Treasury Department Circular No. 230_ (31 C.F.R. Part 10): https://www.irs.gov/pub/irs-pdf/pcir230.pdf

[^fr-c230-proposed]: Federal Register, _Regulations Governing Practice Before the Internal Revenue Service_ (REG-116610-20, Dec. 26, 2024): https://www.federalregister.gov/documents/2024/12/26/2024-29371/regulations-governing-practice-before-the-internal-revenue-service

[^irs-c230-release]: IRS Newsroom (IR-2024-315), _Treasury and IRS propose regulations to update rules for tax professionals who can practice before the IRS_ (Dec. 20, 2024): https://www.irs.gov/newsroom/treasury-and-irs-propose-regulations-to-update-rules-for-tax-professionals-who-can-practice-before-the-irs

[^irs-ntf-ai]: IRS National Tax Forum, _Circular 230: Professional Responsibility_ (2024): https://www.irs.gov/pub/irs-npl/2024ntf-circular-230-professional-responsibility.pdf

[^ftc-intuit]: FTC, _FTC Issues Opinion Finding that TurboTax Maker Intuit Inc. Engaged in Deceptive Practices_ (Jan. 2024): https://www.ftc.gov/news-events/news/press-releases/2024/01/ftc-issues-opinion-finding-turbotax-maker-intuit-inc-engaged-deceptive-practices

[^ftc-hrb]: FTC, _FTC Finalizes Order with H&R Block Requiring Them to Pay $7 Million and Overhaul Advertising and Customer Service Practices for 2025 and 2026 Tax Seasons_ (Jan. 2025): https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-order-hr-block-requiring-them-pay-7-million-overhaul-advertising-customer-service

[^ap-direct-file]: AP News, _IRS Direct File won't be available next year for submitting tax returns for free_ (2025): https://apnews.com/article/irs-direct-file-not-available-2026-04f2d0c31bec80b55d122a0e76e08c36

[^senate-finance-werfel]: U.S. Senate Finance Committee, Commissioner Werfel testimony download for _The President's Fiscal Year 2025 IRS Budget and the IRS 2024 Filing Season_ (Apr. 16, 2024): https://www.finance.senate.gov/download/0416-werfel-testimony&download=1

[^house-roi-hearing]: GovInfo, House Ways and Means Subcommittee on Oversight hearing transcript, _IRS Return on Investment and the Need for Modernization_ (Feb. 11, 2025): https://www.govinfo.gov/content/pkg/CHRG-119hhrg59659/html/CHRG-119hhrg59659.htm
