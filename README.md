# Control Harmonisation Simulator

An interactive model of a question every multi-jurisdiction compliance programme has to answer: how far should a group harmonise its control set across markets before local obligations legitimately force variation?

The tool is a single self-contained React application. It takes a selection of territories, derives the obligations that selection triggers given a fixed activity profile, lets you build a control set against them, and then scores two different things that are usually conflated: how well the control set covers its obligations, and how common that control set is across markets.

## The argument

One harmonised control should evidence as many obligations as possible. That is where a global programme earns its efficiency: a single access recertification cycle can answer ISO/IEC 27001, SOC 2, SOX, PCI DSS, NIS2 and DORA at once, so there is one process to operate, one to improve and one to degrade.

But total harmonisation is a design failure, not an achievement. Some obligations are genuinely local: retention periods, breach notification timelines and matrices, rider employment and algorithmic management rules, strong customer authentication, in-country storage mandates. A control set that is identical everywhere has flattened those differences rather than resolved them.

The tool therefore scores harmonisation against an **efficient band** rather than rewarding maximisation. Below the band, effort duplicates across markets with no legal driver. Above it, obligations that are local by design have been standardised away. Six controls in the model are marked local by design and accept per-territory variants; variation anywhere else is flagged as cost without a legal driver.

## The six views

### 1. Territory selection

58 modelled territories covering the DoorDash, Wolt and Deliveroo operating footprint: US federal plus eight representative states, Canada federal plus Quebec, Mexico, 24 EU member states, Norway and Iceland, the United Kingdom, the Wolt non-EU markets (Serbia, Georgia, Azerbaijan, Kazakhstan, Uzbekistan, Albania, North Macedonia, Kosovo, Israel, Japan), the Deliveroo markets (Ireland, France, Italy, Belgium, UAE, Kuwait, Qatar, Singapore), and Australia, New Zealand and India.

Selection is additive and available two ways: individual territories, or one-click blocs (EU, EEA, UK, North America, GCC, APAC, full footprint). Two maps are provided. The **tile map** arranges stylised tiles by region for fast selection. The **projection map** draws real world borders from embedded Natural Earth geometry, including United States state and Canadian provincial boundaries, and fills each territory as it is selected; very small territories carry markers so they stay clickable.

Each territory carries risk indicators drawn from a shared registry: SOX reach from the US-listed parent, the US state privacy patchwork, biometric and consumer health data statutes, EU adequacy dependency, rider-status litigation history, NIS2 transposition lag, probable lead supervisory authority seats, the Italian Garante rider enforcement precedent, DORA scope through the Finnish payment institution, data localisation regimes, and pending privacy reform.

**Argentina and South Africa** are modelled as prospective markets with no current group entity. They sit deliberately outside the full-footprint bloc, so market entry can still be simulated after selecting everything the group operates in today. Their tiles are drawn with dashed borders.

### 2. Exposure mapping

The territory selection combines with the group's fixed activity profile to derive the applicable obligation set. The activities are: three-sided marketplace operations, card payment acceptance, the licensed Finnish payment institution, merchant advertising, last-mile logistics, AI and algorithmic management of riders, age-restricted delivery, a US-listed parent, and a development centre.

46 obligations are modelled across six categories:

- **Privacy and data protection (24):** EU GDPR; UK GDPR and DPA 2018; Data (Use and Access) Act 2025; CCPA as amended by CPRA; state comprehensive privacy laws; Illinois BIPA; Washington My Health My Data Act; New York SHIELD Act; PIPEDA; Quebec Law 25; Singapore PDPA; UAE PDPL; Israel Protection of Privacy Law; Japan APPI; Australia Privacy Act 1988; New Zealand Privacy Act 2020; Mexico LFPDPPP; Argentina Law 25,326; South Africa POPIA; Qatar PDPPL; Kuwait DPPR; Kazakhstan personal data law; India DPDP Act; and a category obligation for local data protection regimes.
- **Cybersecurity and resilience (3):** NIS2 national transpositions, UK NIS Regulations 2018, DORA.
- **Payments (5):** PSD2 and strong customer authentication, FIN-FSA authorisation conditions, UK Payment Services Regulations, PCI DSS v4.0.1, US state money-transmitter licensing.
- **AI and platform work (2):** EU AI Act, EU Platform Work Directive.
- **Corporate and financial (3):** SOX IT general controls, FTC Act section 5, age-restricted delivery rules.
- **Voluntary frameworks (9):** ISO/IEC 27001:2022, 27002:2022, 27701, 27017 and 27018, 42001, ISO 22301, SOC 2, NIST CSF 2.0, CIS Controls v8.1.

Each obligation shows why it applies: which of the selected jurisdictions triggered it, and which group activities engage it. 20 obligations carry a visible **verify** label marking a point that could not be confirmed from primary sources and must be checked before reliance.

### 3. Controls and compliance score

14 control domains, each holding three controls, each control offering four implementation options of increasing strength: 42 controls and 168 authored option ladders.

| Domain | Controls |
| --- | --- |
| Access control | Identity lifecycle; Privileged access; Access review and recertification |
| Logging and monitoring | Log collection and retention; Threat detection and alerting; Monitoring operations |
| Change management | Change approval workflow; Environment segregation and release; Pipeline and configuration controls |
| Supplier and third-party risk | Due diligence and onboarding; Ongoing monitoring and concentration; Register, contracts and exit |
| Incident management and reporting | Response readiness; **Regulatory notification**; Crisis management |
| Data protection operations | Records and impact assessments; Subject rights operations; **Lawful basis, consent and notices** |
| Retention and records | **Retention schedules**; Deletion and legal hold; Backup and archive alignment |
| AI oversight | Model inventory and risk screening; **Rider-affecting decision oversight**; AI management system |
| Payments security | Cardholder data scope; **Authentication and fraud**; Safeguarding and institution conditions |
| Resilience and continuity | Continuity planning; Testing and exercising; Severe scenario and threat-led testing |
| Financial reporting ITGC | Scoping and mapping; ITGC operation; Independent testing |
| Transfers and data localisation | Transfer mechanisms; **Localisation architecture**; Transfer risk assessments |
| Awareness and training | Baseline awareness; Role-based training; Effectiveness measurement |
| Asset and data inventory | Asset inventory; Data inventory and classification; Inventory-driven control linkage |

Controls in bold are **local by design** and accept per-territory variants.

Domains are carved by **evidence artefact family** rather than by regulation or by technology: each domain produces a distinct kind of proof that an auditor or regulator asks for by name. An access recertification record, a data protection impact assessment, a register of ICT arrangements, a retention schedule and a notification matrix are five different documents produced by five different processes on five different cadences. Carving by artefact is what allows one domain answer to serve many regulators.

Each control is set on **two axes**:

- **Implementation**, options 1 to 4, from a weak or absent baseline to a mature practice.
- **Assurance depth**, A1 to A4: self-declared, self-assessed, internally tested, independently assured. Assurance discounts the evidence a control contributes, at 40, 70, 80 and 100 per cent of the option's weight.

Splitting these axes captures something a single maturity slider cannot: a control can be well designed and poorly evidenced, and regulators care about the difference.

Scoring is **territory-aware**. An obligation counts evidence at the level operated in the weakest territory it applies to. If retention runs at option 3 group-wide but option 1 in one market, every obligation touching that market sees option 1. This is the auditor's view, since certification scope is only as strong as the weakest market inside it, and it is what makes local variants consequential rather than cosmetic.

The compliance score is weighted coverage: evidence earned over evidence required across the derived obligation set. Evidence beyond an obligation's requirement is **retained rather than discarded** and reported as surplus: the harmonisation dividend, the quantity that later shows up as changes being absorbed without touching a control. Outstanding gaps are listed explicitly with the obligation, its jurisdictions, its current evidence position, and the controls that would strengthen it most.

### 4. Harmonisation score

Commonality is the share of selected territories operating each control at its most common option, averaged across the controls in use, rendered on a band gauge with the efficient band shaded and the ends labelled fragmented and over-standardised.

Beneath the gauge, a per-control commonality table classifies every control three ways:

- **Local by design:** variance here is healthy and expected.
- **Variation to review:** the control is not local by design, so its variance is cost without a legal driver. This is the consolidation worklist.
- **Uniform:** one option everywhere.

Two warnings fire on the shape of the result rather than the number alone. Above the band, the view names the local-by-design controls currently running uniform, since retention periods and notification timelines rarely survive a single group setting. Anywhere in the range, unflagged variance is listed for review.

The table matters because the gauge alone cannot distinguish two very different control sets that average to the same score: one varying exactly where the law requires, another forcing uniformity on notification while letting access drift. Commonality is a modal share, so it should be read alongside the variant count: nine of ten territories aligned and a five-five split both show two variants but very different shapes.

### 5. Change impact

A before and after diff against the live selection and control set, for three kinds of change.

- **Add a territory.** Any unselected territory, including the two prospective markets. Output: score and harmonisation deltas, the new territory's risk indicators, new obligations with absorbed, partial or open status, which existing controls hold each absorbed obligation, existing obligations extending their reach, and new gaps. An adopt button commits the change to the live selection.
- **Framework version change.** ISO/IEC 27001 2013 to 2022, and PCI DSS 3.2.1 to 4.0.1. Both are marked retrospective, since those transitions completed in 2025; they are included to demonstrate the mechanics. Version changes are modelled as uplifts to existing obligation weights rather than as freshly authored obligations, which keeps the crosswalk honest and makes absorption measurable.
- **Upcoming regulation**, all marked indicative: EU AI Act high-risk phase, Platform Work Directive transposition, UK Cyber Security and Resilience Bill.

The view states explicitly which existing controls absorb a change unchanged. That is the harmonisation dividend made visible: run a mature uniform control set, apply a version uplift, and the surplus evidence already in the system absorbs it with no score movement. Run a weaker set and the same change opens a gap.

### 6. Control design

The selected control set restated for the people who will implement it: policy-as-code guardrails in the spirit of infrastructure-as-code guardrails. Each selected control renders as a card with the guardrail intent in plain terms, enforcement points on an illustrative reference stack (AWS, Cloudflare, GitHub with CI, Kubernetes, Terraform with OPA policy checks, an identity provider, a SIEM, and a payment service provider), and the evidence artefact the enforcement emits.

The two control axes map directly onto engineering reality. Implementation level sets the enforcement posture: documented, detective, preventive, or automated with evidence emission. Assurance depth sets how the evidence is captured, from self-declared attestation through to pipeline-exported audit artefacts. Harmonisation state maps onto module strategy: a uniform control is one group-wide module, a control with local variants is a parameterised module with per-territory variable maps, with the overriding territories listed. Three controls carry short illustrative configuration sketches (a retention schedule rendered into storage lifecycle rules, a residency pin as a service control policy, and a pipeline policy check over a Terraform plan), each marked as needing engineering review before use.

The reference stack is representative for demonstration and is stated as such in the interface; it is not a claim about any organisation's environment.

## Running it

Designed for GitHub Pages or any static web server. No build step, no bundler, no package installation.

1. Put `index.html` and `control-harmonisation-simulator.jsx` in the same folder of the repository.
2. Enable GitHub Pages for the repository, or serve the folder locally with `python3 -m http.server` and open the address it prints.
3. The page fetches the source, transforms the JSX in the browser with Babel standalone, and renders it. React, ReactDOM and d3 resolve through an import map to a CDN, so the first visit needs a network connection.

Opening `index.html` directly from disk will not work: browsers block the fetch of the source file from `file://` addresses. The loader detects this and shows an explanatory message rather than failing silently.

To use the component inside an existing React project instead, import the default export from `control-harmonisation-simulator.jsx`. It takes no required props.

## Data and disclaimers

All data in this tool is authored and illustrative. Scores are a model, not an audit. Scenarios are not statements about any organisation's internal programme. Items marked verify must be checked against primary sources before being relied on.

Regulatory content is representative rather than exhaustive, and accuracy was preferred over coverage. References use plain instrument names; registration numbers, licence numbers and article numbers are not asserted where they could not be confirmed. Evidence weights are authored judgement rather than a clause-level crosswalk: the model asserts that an option helps evidence an obligation, not which specific article it satisfies.

No licence file is included. Add one before inviting reuse.
