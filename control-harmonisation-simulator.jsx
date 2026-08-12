import React, { useState, useMemo, useCallback } from "react";
import * as d3 from "d3";

/* ------------------------------------------------------------------
   Control Harmonisation Simulator
   A drafting-plate style tool exploring one question: how far should a
   group harmonise its control set across jurisdictions before local
   obligations legitimately force variation?
   Five views: territory selection (tile and projection maps), exposure
   mapping, control selection with a two-axis compliance score,
   harmonisation against an efficient band, and change impact diffs
   including prospective-market entry.
   All data is authored and illustrative. Items marked verify must be
   checked against primary sources before being relied on.
------------------------------------------------------------------ */

/* ----------------------------- palette ---------------------------- */

const C = {
  sheet: "#E9E5DC",
  sheetDeep: "#DED9CE",
  ink: "#1B2430",
  inkSoft: "#5A6472",
  law: "#B3323F",
  frame: "#2F5C8A",
  contract: "#B07A22",
  exposure: "#2E6F5E",
  paper: "#F6F4EF",
  verify: "#9A6A12",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SERIF = "Georgia, 'Times New Roman', serif";

const TYPE_META = {
  regulation: { label: "Regulation", colour: C.law },
  contract: { label: "Contractual mandate", colour: C.contract },
  framework: { label: "Framework", colour: C.frame },
};

/* ------------------------- risk indicators ------------------------ */

const RISKS = {
  sox: "SOX ITGC reach from the US-listed parent",
  mtl: "State money-transmitter licensing exposure, unverified",
  patchwork: "State privacy-law patchwork",
  stateEnf: "Active state privacy enforcement practice",
  biometric: "Biometric privacy statute (BIPA)",
  healthData: "Broad consumer health data statute, verify applicability",
  newPrivacy: "Recently strengthened privacy law",
  adequacy: "EU adequacy dependency",
  riderLit: "Rider-status litigation history",
  nis2lag: "NIS2 transposition lag, verify national status",
  leadAuth: "Probable GDPR lead supervisory authority seat",
  garante: "Garante rider enforcement precedent, EUR 2.5m fine (2021)",
  doraAnchor: "DORA scope via the Finnish payment institution",
  localisation: "Data localisation requirements, verify",
  pdplReg: "PDPL executive regulations, verify status",
  prospective: "Prospective market: no current group entity",
  privReform: "Privacy law reform in progress, verify status",
};

/* -------------------------- jurisdictions -------------------------
   col and row place each tile on the stylised map grid.
   tier: 1 anchor jurisdiction, 2 major market, 3 standard market.
------------------------------------------------------------------- */

const JURISDICTIONS = [
  /* Americas */
  { id: "ca_fed", code: "CAN", name: "Canada (federal)", tier: 2, risks: [], col: 1, row: 0 },
  { id: "ca_qc", code: "QC", name: "Quebec", tier: 3, risks: ["newPrivacy"], col: 2, row: 0 },
  { id: "us_wa", code: "WA", name: "Washington", tier: 3, risks: ["healthData", "patchwork"], col: 0, row: 1 },
  { id: "us_fed", code: "US", name: "United States (federal)", tier: 1, risks: ["sox", "mtl", "patchwork"], col: 1, row: 1 },
  { id: "us_il", code: "IL", name: "Illinois", tier: 3, risks: ["biometric", "patchwork"], col: 2, row: 1 },
  { id: "us_ny", code: "NY", name: "New York", tier: 2, risks: ["patchwork"], col: 3, row: 1 },
  { id: "us_ct", code: "CT", name: "Connecticut", tier: 3, risks: ["patchwork"], col: 4, row: 1 },
  { id: "us_ca", code: "CA", name: "California", tier: 2, risks: ["stateEnf", "patchwork"], col: 0, row: 2 },
  { id: "us_co", code: "CO", name: "Colorado", tier: 3, risks: ["patchwork"], col: 1, row: 2 },
  { id: "us_va", code: "VA", name: "Virginia", tier: 3, risks: ["patchwork"], col: 3, row: 2 },
  { id: "us_tx", code: "TX", name: "Texas", tier: 3, risks: ["stateEnf", "patchwork"], col: 1, row: 3 },
  { id: "mx", code: "MX", name: "Mexico", tier: 3, risks: [], col: 1, row: 4 },
  { id: "ar", code: "AR", name: "Argentina", tier: 3, prospective: true, risks: ["prospective", "privReform"], col: 1, row: 5 },

  /* Europe and EEA */
  { id: "is", code: "IS", name: "Iceland", tier: 3, risks: [], col: 6, row: 0 },
  { id: "no", code: "NO", name: "Norway", tier: 3, risks: [], col: 8, row: 0 },
  { id: "se", code: "SE", name: "Sweden", tier: 3, risks: [], col: 9, row: 0 },
  { id: "fi", code: "FI", name: "Finland", tier: 1, risks: ["doraAnchor", "leadAuth"], col: 10, row: 0 },
  { id: "ie", code: "IE", name: "Ireland", tier: 2, risks: ["nis2lag", "leadAuth"], col: 6, row: 1 },
  { id: "gb", code: "UK", name: "United Kingdom", tier: 1, risks: ["adequacy", "riderLit"], col: 7, row: 1 },
  { id: "dk", code: "DK", name: "Denmark", tier: 3, risks: [], col: 8, row: 1 },
  { id: "ee", code: "EE", name: "Estonia", tier: 3, risks: [], col: 10, row: 1 },
  { id: "fr", code: "FR", name: "France", tier: 2, risks: ["nis2lag", "riderLit"], col: 6, row: 2 },
  { id: "be", code: "BE", name: "Belgium", tier: 3, risks: ["riderLit"], col: 7, row: 2 },
  { id: "de", code: "DE", name: "Germany", tier: 2, risks: [], col: 8, row: 2 },
  { id: "pl", code: "PL", name: "Poland", tier: 3, risks: [], col: 9, row: 2 },
  { id: "lv", code: "LV", name: "Latvia", tier: 3, risks: [], col: 10, row: 2 },
  { id: "lu", code: "LU", name: "Luxembourg", tier: 3, risks: [], col: 7, row: 3 },
  { id: "cz", code: "CZ", name: "Czechia", tier: 3, risks: [], col: 8, row: 3 },
  { id: "sk", code: "SK", name: "Slovakia", tier: 3, risks: [], col: 9, row: 3 },
  { id: "lt", code: "LT", name: "Lithuania", tier: 3, risks: [], col: 10, row: 3 },
  { id: "it", code: "IT", name: "Italy", tier: 2, risks: ["garante", "riderLit"], col: 7, row: 4 },
  { id: "at", code: "AT", name: "Austria", tier: 3, risks: [], col: 8, row: 4 },
  { id: "hu", code: "HU", name: "Hungary", tier: 3, risks: [], col: 9, row: 4 },
  { id: "ro", code: "RO", name: "Romania", tier: 3, risks: [], col: 10, row: 4 },
  { id: "si", code: "SI", name: "Slovenia", tier: 3, risks: [], col: 7, row: 5 },
  { id: "hr", code: "HR", name: "Croatia", tier: 3, risks: [], col: 8, row: 5 },
  { id: "rs", code: "RS", name: "Serbia", tier: 3, risks: [], col: 9, row: 5 },
  { id: "bg", code: "BG", name: "Bulgaria", tier: 3, risks: [], col: 10, row: 5 },
  { id: "mt", code: "MT", name: "Malta", tier: 3, risks: [], col: 7, row: 6 },
  { id: "al", code: "AL", name: "Albania", tier: 3, risks: [], col: 8, row: 6 },
  { id: "xk", code: "XK", name: "Kosovo", tier: 3, risks: [], col: 9, row: 6 },
  { id: "mk", code: "MK", name: "North Macedonia", tier: 3, risks: [], col: 10, row: 6 },
  { id: "gr", code: "GR", name: "Greece", tier: 3, risks: [], col: 10, row: 7 },
  { id: "cy", code: "CY", name: "Cyprus", tier: 3, risks: [], col: 12, row: 6 },

  /* Middle East, Caucasus, Central Asia */
  { id: "kz", code: "KZ", name: "Kazakhstan", tier: 3, risks: ["localisation"], col: 14, row: 2 },
  { id: "uz", code: "UZ", name: "Uzbekistan", tier: 3, risks: ["localisation"], col: 15, row: 3 },
  { id: "ge", code: "GE", name: "Georgia", tier: 3, risks: [], col: 13, row: 4 },
  { id: "az", code: "AZ", name: "Azerbaijan", tier: 3, risks: [], col: 14, row: 4 },
  { id: "isr", code: "ISR", name: "Israel", tier: 2, risks: ["newPrivacy"], col: 12, row: 7 },
  { id: "kw", code: "KW", name: "Kuwait", tier: 3, risks: [], col: 13, row: 6 },
  { id: "qa", code: "QA", name: "Qatar", tier: 3, risks: [], col: 13, row: 7 },
  { id: "ae", code: "AE", name: "United Arab Emirates", tier: 2, risks: ["pdplReg"], col: 14, row: 7 },
  { id: "za", code: "ZA", name: "South Africa", tier: 3, prospective: true, risks: ["prospective"], col: 13, row: 8 },

  /* Asia Pacific */
  { id: "jp", code: "JP", name: "Japan", tier: 2, risks: [], col: 17, row: 1 },
  { id: "in", code: "IN", name: "India", tier: 3, risks: ["privReform"], col: 16, row: 4 },
  { id: "sg", code: "SG", name: "Singapore", tier: 2, risks: [], col: 16, row: 6 },
  { id: "au", code: "AU", name: "Australia", tier: 2, risks: ["privReform"], col: 17, row: 8 },
  { id: "nz", code: "NZ", name: "New Zealand", tier: 3, risks: [], col: 18, row: 8 },
];

const J_BY_ID = Object.fromEntries(JURISDICTIONS.map((j) => [j.id, j]));

/* ------------------------------ blocs ----------------------------- */

const EU_IDS = [
  "at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr",
  "hu", "ie", "it", "lv", "lt", "lu", "mt", "pl", "ro", "sk", "si", "se",
];
const EEA_IDS = [...EU_IDS, "no", "is"];
const NA_IDS = [
  "us_fed", "us_ca", "us_ny", "us_tx", "us_il", "us_va", "us_co", "us_ct",
  "us_wa", "ca_fed", "ca_qc", "mx",
];
const GCC_IDS = ["ae", "kw", "qa"];
const APAC_IDS = ["sg", "jp", "in", "au", "nz"];
const ALL_IDS = JURISDICTIONS.map((j) => j.id);
const FOOTPRINT_IDS = JURISDICTIONS.filter((j) => !j.prospective).map((j) => j.id);

const BLOCS = [
  { id: "EU", label: "EU", members: EU_IDS },
  { id: "EEA", label: "EEA", members: EEA_IDS },
  { id: "UK", label: "UK", members: ["gb"] },
  { id: "NA", label: "North America", members: NA_IDS },
  { id: "GCC", label: "GCC", members: GCC_IDS },
  { id: "APAC", label: "APAC", members: APAC_IDS },
  { id: "ALL", label: "Full DoorDash footprint", members: FOOTPRINT_IDS },
];

/* --------------------------- activities ---------------------------
   The fixed activity profile of the group. Obligations reference the
   activities that trigger them so the exposure view can explain why
   an instrument applies.
------------------------------------------------------------------- */

const ACTIVITIES = {
  marketplace: "three-sided marketplace operations",
  payments: "card payment acceptance",
  paymentInstitution: "the licensed Finnish payment institution",
  advertising: "merchant advertising services",
  logistics: "last-mile logistics",
  ai: "AI and algorithmic management of riders",
  ageRestricted: "age-restricted delivery",
  usListed: "the US-listed parent",
  devCentre: "development and shared-service centres",
};

/* --------------------------- categories --------------------------- */

const CATEGORIES = [
  { id: "privacy", label: "Privacy and data protection" },
  { id: "cyber", label: "Cybersecurity and resilience" },
  { id: "payments", label: "Payments" },
  { id: "ai", label: "AI and platform work" },
  { id: "corporate", label: "Corporate and financial" },
  { id: "frameworks", label: "Voluntary frameworks" },
];

/* --------------------------- obligations --------------------------
   juris entries may be jurisdiction ids, "EU", "EEA" or "GLOBAL".
   weight expresses relative gravity for the later scoring stage.
------------------------------------------------------------------- */

const OBLIGATIONS = [
  /* Privacy and data protection */
  { id: "eugdpr", name: "EU GDPR", instrument: "Regulation (EU) 2016/679", type: "regulation",
    category: "privacy", juris: ["EEA"], activities: ["marketplace", "ai", "advertising"], weight: 5,
    note: "Consumer, rider and merchant personal data processed in or targeted at the EEA. One-stop-shop routing for Wolt processing probably leads to Finland, and any Ireland-seated processing to the Irish DPC." },
  { id: "ukgdpr", name: "UK GDPR and DPA 2018", instrument: "UK GDPR, DPA 2018", type: "regulation",
    category: "privacy", juris: ["gb"], activities: ["marketplace", "ai", "advertising"], weight: 5,
    note: "The ICO is the supervisory authority. Rider algorithmic management sits under the automated decision-making provisions, which the UK and EU regimes now treat differently." },
  { id: "duaa", name: "Data (Use and Access) Act 2025", instrument: "DUAA 2025", type: "regulation",
    category: "privacy", juris: ["gb"], activities: ["marketplace", "ai"], weight: 2, verify: true,
    note: "Staged commencement: confirm which provisions are in force. Its automated decision-making liberalisation is directly relevant to rider algorithms, and divergence pressures the EU adequacy finding." },
  { id: "ccpa", name: "CCPA as amended by CPRA", instrument: "Cal. Civ. Code", type: "regulation",
    category: "privacy", juris: ["us_ca"], activities: ["marketplace", "advertising"], weight: 4,
    note: "California consumer and worker personal information, with active CPPA and Attorney General enforcement practice." },
  { id: "statePriv", name: "State comprehensive privacy laws", instrument: "VCDPA, CPA, CTDPA, TDPSA", type: "regulation",
    category: "privacy", juris: ["us_va", "us_co", "us_ct", "us_tx"], activities: ["marketplace", "advertising"], weight: 3,
    note: "A representative set of the state comprehensive laws: Virginia, Colorado, Connecticut and Texas. Thresholds are almost certainly met at marketplace scale; universal opt-out signals apply in several." },
  { id: "bipa", name: "Illinois Biometric Information Privacy Act", instrument: "740 ILCS 14", type: "regulation",
    category: "privacy", juris: ["us_il"], activities: ["logistics"], weight: 3, verify: true,
    note: "Applies only if biometric identifiers are collected in Illinois, for example Dasher identity verification. Private right of action with per-violation damages makes this activity-conditional question worth settling." },
  { id: "mhmda", name: "Washington My Health My Data Act", instrument: "Wash. MHMDA", type: "regulation",
    category: "privacy", juris: ["us_wa"], activities: ["marketplace"], weight: 2, verify: true,
    note: "The consumer health data definition is broad. Whether pharmacy or dietary ordering data falls within it needs analysis before relying on exclusion." },
  { id: "shield", name: "New York SHIELD Act", instrument: "NY Gen. Bus. Law 899-bb", type: "regulation",
    category: "privacy", juris: ["us_ny"], activities: ["marketplace"], weight: 2,
    note: "A reasonable-safeguards data security programme requirement for New York residents' private information, plus breach notification." },
  { id: "pipeda", name: "PIPEDA", instrument: "PIPEDA", type: "regulation",
    category: "privacy", juris: ["ca_fed"], activities: ["marketplace", "advertising"], weight: 3,
    note: "Federal private-sector privacy law for the Canadian marketplace operator, pending any reform successor." },
  { id: "law25", name: "Quebec Law 25", instrument: "Law 25 (Quebec)", type: "regulation",
    category: "privacy", juris: ["ca_qc"], activities: ["marketplace", "ai"], weight: 3,
    note: "Fully phased in: privacy officer designation, impact assessments, and transparency for automated decisions, which reaches rider-facing algorithms in Quebec." },
  { id: "pdpaSg", name: "Singapore PDPA", instrument: "PDPA 2012", type: "regulation",
    category: "privacy", juris: ["sg"], activities: ["marketplace"], weight: 3,
    note: "Consent, purpose limitation and the Do Not Call regime for the Singapore operating company, outside the GDPR family." },
  { id: "pdplAe", name: "UAE Personal Data Protection Law", instrument: "Federal Decree-Law 45/2021", type: "regulation",
    category: "privacy", juris: ["ae"], activities: ["marketplace"], weight: 3, verify: true,
    note: "Federal PDPL applies: the operating entity sits in DMCC, which is not DIFC or ADGM, so the free-zone regimes do not displace it. The executive regulations remain the item to confirm, since enforcement detail is unsettled until they land." },
  { id: "pplIsr", name: "Israel Protection of Privacy Law", instrument: "PPL, Amendment 13", type: "regulation",
    category: "privacy", juris: ["isr"], activities: ["marketplace"], weight: 3,
    note: "Amendment 13 took effect on 14 August 2025, materially strengthening enforcement powers, database duties and officer requirements for the Wolt Israel operation." },
  { id: "appi", name: "Japan APPI", instrument: "APPI", type: "regulation",
    category: "privacy", juris: ["jp"], activities: ["marketplace"], weight: 3,
    note: "Applies to the Japan marketplace operation, with cross-border transfer conditions for data moving to the US parent." },
  { id: "auPriv", name: "Australia Privacy Act 1988", instrument: "Privacy Act 1988 (Cth)", type: "regulation",
    category: "privacy", juris: ["au"], activities: ["marketplace"], weight: 3,
    note: "Applies to the Australian marketplace operator. The first reform tranche passed in December 2024, adding a statutory tort for serious invasions of privacy and automated decision transparency duties with a lead-in period; a second tranche is under development and worth tracking." },
  { id: "nzPriv", name: "New Zealand Privacy Act 2020", instrument: "Privacy Act 2020 (NZ)", type: "regulation",
    category: "privacy", juris: ["nz"], activities: ["marketplace"], weight: 2,
    note: "Information privacy principles and mandatory breach notification for the New Zealand operation." },
  { id: "mxPriv", name: "Mexico LFPDPPP", instrument: "LFPDPPP 2025", type: "regulation",
    category: "privacy", juris: ["mx"], activities: ["marketplace"], weight: 2,
    note: "The 2025 Federal Law on the Protection of Personal Data Held by Private Parties replaced the 2010 statute, with supervision moving to the anticorruption and good governance secretariat after the INAI wind-down." },
  { id: "arPdpa", name: "Argentina Personal Data Protection Act", instrument: "Law 25,326 and AAIP practice", type: "regulation",
    category: "privacy", juris: ["ar"], activities: ["marketplace"], weight: 2, verify: true,
    note: "An EU-adequacy-recognised regime with habeas data roots, reaffirmed in the Commission's 2024 adequacy review. A modernising reform bill remains pending and would add breach notification duties. Prospective market: confirm the position as part of any entry assessment." },
  { id: "zaPopia", name: "South Africa POPIA", instrument: "Protection of Personal Information Act 2013", type: "regulation",
    category: "privacy", juris: ["za"], activities: ["marketplace"], weight: 3, verify: true,
    note: "In force since July 2021 with an active Information Regulator: mandatory breach notification, information officer registration, direct marketing rules and cross-border transfer conditions. Prospective market: confirm scope as part of any entry assessment." },
  { id: "qaPdppl", name: "Qatar Personal Data Privacy Protection Law", instrument: "Law No. 13 of 2016 (PDPPL)", type: "regulation",
    category: "privacy", juris: ["qa"], activities: ["marketplace"], weight: 2,
    note: "A consent-based regime with controller duties, breach notification and permits for special-nature data, applying to the Deliveroo Qatar operation." },
  { id: "kwDppr", name: "Kuwait Data Privacy Protection Regulation", instrument: "CITRA DPPR", type: "regulation",
    category: "privacy", juris: ["kw"], activities: ["marketplace"], weight: 2, verify: true,
    note: "Issued by CITRA and framed around telecommunications and ICT service providers. Whether a delivery platform sits inside the regulated perimeter needs confirming against the regulation text, so the verify label stays." },
  { id: "localDp", name: "Local data protection regimes", instrument: "National DP laws", type: "regulation",
    category: "privacy", juris: ["rs", "ge", "az", "uz", "al", "mk", "xk"], activities: ["marketplace"], weight: 2, verify: true,
    note: "Balkans, Caucasus and Central Asia markets carry national data protection laws, several GDPR-modelled (Serbia notably). Grouped as one representative obligation: confirm each before reliance." },
  { id: "kzDp", name: "Kazakhstan personal data law", instrument: "Law on Personal Data (KZ)", type: "regulation",
    category: "privacy", juris: ["kz"], activities: ["marketplace"], weight: 2, verify: true,
    note: "Includes an in-country storage requirement for personal data of Kazakhstan citizens, one of the clearest local-by-design constraints on a harmonised data architecture." },
  { id: "dpdp", name: "India Digital Personal Data Protection Act", instrument: "DPDP Act 2023", type: "regulation",
    category: "privacy", juris: ["in"], activities: ["devCentre"], weight: 3, verify: true,
    note: "India hosts a development centre rather than a consumer marketplace, so the exposure is employee and group data processed by the entity seated there. The DPDP Rules commence in phases: which duties are live at a given date must be verified." },

  /* Cybersecurity and resilience */
  { id: "nis2", name: "NIS2 national transpositions", instrument: "Directive (EU) 2022/2555", type: "regulation",
    category: "cyber", juris: ["EU"], activities: ["marketplace"], weight: 4, verify: true,
    note: "Applicability is assumed in this model: an online food marketplace sits within the Annex II online marketplace category of digital provider. What still needs per-state verification is transposition, since the operative law is national and France and Ireland lagged. Scoped EU-only: EEA incorporation for Norway and Iceland is unresolved." },
  { id: "ukNis", name: "UK NIS Regulations 2018", instrument: "SI 2018/506", type: "regulation",
    category: "cyber", juris: ["gb"], activities: ["marketplace"], weight: 2, verify: true,
    note: "Confirm whether the platform meets the relevant digital service provider definitions and thresholds, and track the announced UK cyber security reform pipeline." },
  { id: "dora", name: "DORA", instrument: "Regulation (EU) 2022/2554", type: "regulation",
    category: "cyber", juris: ["fi"], activities: ["paymentInstitution"], weight: 5, verify: true,
    note: "Anchored on the FIN-FSA authorised Finnish payment institution: ICT risk management, incident reporting, register of information, and proportionate resilience testing. The licence type (payment institution or e-money institution) is a confirm item that inherits into this scope." },

  /* Payments */
  { id: "psd2", name: "PSD2 and strong customer authentication", instrument: "Directive (EU) 2015/2366", type: "regulation",
    category: "payments", juris: ["EEA"], activities: ["payments", "paymentInstitution"], weight: 4,
    note: "Passported across the EEA from the Finnish authorisation. SCA applies to customer payments; watch the PSD3 and PSR successor package moving through the EU legislative process." },
  { id: "finfsa", name: "FIN-FSA authorisation conditions", instrument: "Finnish Payment Institutions Act", type: "regulation",
    category: "payments", juris: ["fi"], activities: ["paymentInstitution"], weight: 3, verify: true,
    note: "Safeguarding of customer funds, governance and reporting conditions attached to the Finnish licence. Exact entity name and licence type must be confirmed on the FIN-FSA register." },
  { id: "ukPsr", name: "UK Payment Services Regulations", instrument: "PSRs 2017, FCA SCA rules", type: "regulation",
    category: "payments", juris: ["gb"], activities: ["payments"], weight: 2, verify: true,
    note: "Whether any group entity holds or needs its own FCA permission, or relies on partner arrangements and exemptions, is unverified and materially changes the UK payments obligation set." },
  { id: "pci", name: "PCI DSS v4.0.1", instrument: "PCI DSS v4.0.1", type: "contract",
    category: "payments", juris: ["GLOBAL"], activities: ["payments"], weight: 5,
    note: "Contractual, not legal: applies wherever card payments are accepted, through acquiring agreements. Scope discipline (tokenisation, hosted fields) determines how heavy this is in practice." },
  { id: "usMtl", name: "US state money-transmitter licensing", instrument: "State MTL statutes", type: "regulation",
    category: "payments", juris: ["us_fed"], activities: ["payments"], weight: 2, verify: true,
    note: "A category-level obligation: whether the group needs or holds state licences is unverified. Gift cards and stored value are the usual nexus, and analysis is state by state." },

  /* AI and platform work */
  { id: "aiact", name: "EU AI Act", instrument: "Regulation (EU) 2024/1689", type: "regulation",
    category: "ai", juris: ["EU"], activities: ["ai"], weight: 5,
    note: "Phased application runs to 2027. The open classification question: whether rider allocation systems fall in the Annex III employment high-risk category given self-employed rider status. That analysis decides most of the compliance load." },
  { id: "pwd", name: "EU Platform Work Directive", instrument: "Directive (EU) 2024/2831", type: "regulation",
    category: "ai", juris: ["EU"], activities: ["ai", "logistics"], weight: 4, verify: true,
    note: "Transposition deadline December 2026: national status varies and must be tracked per member state. Algorithmic management transparency and human oversight duties apply regardless of employment status." },

  /* Corporate and financial */
  { id: "sox", name: "SOX IT general controls", instrument: "Sarbanes-Oxley Act s404", type: "regulation",
    category: "corporate", juris: ["us_fed"], activities: ["usListed"], weight: 5,
    note: "The US-listed parent pulls financially material systems group-wide into ITGC scope, including newly consolidated Deliveroo and Wolt entities. The evidentiary standard is stricter than certification audits." },
  { id: "ftc5", name: "FTC Act section 5", instrument: "15 U.S.C. 45", type: "regulation",
    category: "corporate", juris: ["us_fed"], activities: ["marketplace", "advertising"], weight: 3,
    note: "The general unfair and deceptive practices backstop, including the FTC's data security and dark patterns enforcement practice." },
  { id: "ageVerif", name: "Age-restricted delivery rules", instrument: "Licensing and verification duties", type: "regulation",
    category: "corporate", juris: ["GLOBAL"], activities: ["ageRestricted"], weight: 3, verify: true,
    note: "Alcohol, pharmacy and other age-restricted lines carry market-specific licensing and point-of-handover verification duties, and the identity data generated at the doorstep is itself a privacy exposure. Category-level: confirm the regime in each operating market." },

  /* Voluntary frameworks */
  { id: "iso27001", name: "ISO/IEC 27001:2022", instrument: "ISO/IEC 27001:2022", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 4,
    note: "The harmonisation spine: one ISMS scope, Statement of Applicability and risk method reconciled across three heritage programmes, onto which most other obligations map." },
  { id: "iso27002", name: "ISO/IEC 27002:2022", instrument: "ISO/IEC 27002:2022", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 1,
    note: "Implementation guidance for the Annex A controls, not certifiable on its own: the shared recipe book for consistent control descriptions." },
  { id: "iso27701", name: "ISO/IEC 27701", instrument: "ISO/IEC 27701", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 3,
    note: "Privacy information management extending the ISMS: a single privacy operating model evidencing many privacy regimes at once." },
  { id: "isoCloud", name: "ISO/IEC 27017 and 27018", instrument: "ISO/IEC 27017, 27018", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 2,
    note: "Cloud security and cloud PII controls supporting due diligence for a cloud-native estate, including transfers to the US parent." },
  { id: "iso42001", name: "ISO/IEC 42001", instrument: "ISO/IEC 42001:2023", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["ai"], weight: 3,
    note: "The AI management system standard: the natural evidence vehicle for EU AI Act readiness and algorithmic management governance." },
  { id: "iso22301", name: "ISO 22301", instrument: "ISO 22301", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace", "logistics"], weight: 2,
    note: "Business continuity management: demonstrable resilience for a platform whose downtime stops revenue on all three sides at once." },
  { id: "soc2", name: "SOC 2", instrument: "AICPA Trust Services Criteria", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 3,
    note: "Procurement-driven attestation, more relevant with a US-headquartered group: an opinion over a period, not a certificate." },
  { id: "nistcsf", name: "NIST CSF 2.0", instrument: "NIST CSF 2.0", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 2,
    note: "The Govern function gives executive risk reporting a shared scaffold across the group's regulators and boards." },
  { id: "cis", name: "CIS Controls v8.1", instrument: "CIS Controls v8.1", type: "framework",
    category: "frameworks", juris: ["GLOBAL"], activities: ["marketplace"], weight: 2,
    note: "The hardening baseline producing the configuration evidence other frameworks and PCI assessments ask for." },
];

const O_BY_ID = Object.fromEntries(OBLIGATIONS.map((o) => [o.id, o]));

/* Tunable in data: the efficient harmonisation band. */
const OPTIMAL_BAND = { min: 70, max: 90 };

/* ------------------------- control domains ------------------------
   Fourteen domains, three controls each, four implementation options
   per control in increasing strength. evidences: which obligations an
   option helps evidence and how strongly. local: true marks controls
   whose content legitimately varies by jurisdiction (local by design)
   and which accept per-territory variants. about: the one-line
   explanation surfaced from the domain heading.
------------------------------------------------------------------- */

const CONTROL_DOMAINS = [
  { id: "access", name: "Access control", about: "Who can reach which systems and data, and the proof that access stays right.", controls: [
    { id: "access_life", name: "Identity lifecycle", options: [
      { label: "Manual account handling", evidences: [{ o: "iso27001", w: 1 }] },
      { label: "Central identity provider", evidences: [{ o: "iso27001", w: 1 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 1 }, { o: "sox", w: 1 }, { o: "pci", w: 1 }] },
      { label: "Automated joiner-mover-leaver", evidences: [{ o: "iso27001", w: 2 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 1 }, { o: "sox", w: 1 }, { o: "pci", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Federated with conditional access", evidences: [{ o: "iso27001", w: 2 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 2 }, { o: "sox", w: 2 }, { o: "pci", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "nis2", w: 1 }] },
    ] },
    { id: "access_priv", name: "Privileged access", options: [
      { label: "Shared administrator accounts", evidences: [] },
      { label: "Named administrator accounts", evidences: [{ o: "iso27001", w: 1 }, { o: "sox", w: 1 }, { o: "cis", w: 1 }] },
      { label: "Vaulted credentials with logging", evidences: [{ o: "iso27001", w: 1 }, { o: "sox", w: 1 }, { o: "pci", w: 1 }, { o: "dora", w: 1 }, { o: "cis", w: 1 }, { o: "nis2", w: 1 }, { o: "shield", w: 1 }] },
      { label: "Just-in-time elevation, no standing privilege", evidences: [{ o: "iso27001", w: 2 }, { o: "sox", w: 2 }, { o: "pci", w: 2 }, { o: "dora", w: 2 }, { o: "cis", w: 2 }, { o: "nis2", w: 1 }, { o: "shield", w: 1 }] },
    ] },
    { id: "access_recert", name: "Access review and recertification", options: [
      { label: "No periodic review", evidences: [{ o: "sox", w: 1 }] },
      { label: "Annual manager review", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "sox", w: 1 }] },
      { label: "Quarterly risk-based recertification", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 2 }, { o: "sox", w: 2 }, { o: "pci", w: 1 }, { o: "ftc5", w: 1 }, { o: "iso27002", w: 1 }] },
      { label: "Continuous entitlement analytics", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 2 }, { o: "sox", w: 3 }, { o: "pci", w: 1 }, { o: "ftc5", w: 1 }, { o: "iso27002", w: 1 }] },
    ] },
  ] },
  { id: "logging", name: "Logging and monitoring", about: "Recording what systems do, and noticing quickly when something is wrong.", controls: [
    { id: "log_collect", name: "Log collection and retention", options: [
      { label: "Local logs only", evidences: [{ o: "iso27001", w: 1 }] },
      { label: "Central aggregation", evidences: [{ o: "iso27001", w: 1 }, { o: "cis", w: 1 }, { o: "pci", w: 1 }] },
      { label: "Standardised retention and coverage", evidences: [{ o: "iso27001", w: 2 }, { o: "cis", w: 1 }, { o: "pci", w: 1 }, { o: "sox", w: 1 }, { o: "dora", w: 1 }] },
      { label: "Immutable storage with integrity checks", evidences: [{ o: "iso27001", w: 2 }, { o: "cis", w: 2 }, { o: "pci", w: 2 }, { o: "sox", w: 2 }, { o: "aiact", w: 1 }, { o: "dora", w: 1 }] },
    ] },
    { id: "log_detect", name: "Threat detection and alerting", options: [
      { label: "No alerting", evidences: [] },
      { label: "Basic rule alerts", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "nistcsf", w: 1 }] },
      { label: "Correlated detection use cases", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 2 }, { o: "nis2", w: 1 }, { o: "dora", w: 1 }, { o: "nistcsf", w: 1 }, { o: "ukNis", w: 1 }, { o: "ftc5", w: 1 }] },
      { label: "Behavioural analytics with tuning", evidences: [{ o: "iso27001", w: 2 }, { o: "soc2", w: 2 }, { o: "nis2", w: 2 }, { o: "dora", w: 1 }, { o: "nistcsf", w: 2 }, { o: "ukNis", w: 1 }, { o: "ftc5", w: 1 }] },
    ] },
    { id: "log_ops", name: "Monitoring operations", options: [
      { label: "Best-effort review", evidences: [] },
      { label: "Business-hours triage", evidences: [] },
      { label: "Documented response runbooks", evidences: [{ o: "iso27001", w: 1 }, { o: "pci", w: 1 }, { o: "psd2", w: 1 }, { o: "soc2", w: 1 }] },
      { label: "Continuous operations with case management", evidences: [{ o: "iso27001", w: 1 }, { o: "pci", w: 1 }, { o: "psd2", w: 1 }, { o: "dora", w: 1 }, { o: "soc2", w: 1 }] },
    ] },
  ] },
  { id: "change", name: "Change management", about: "Altering systems deliberately, with approval, separation and evidence.", controls: [
    { id: "chg_flow", name: "Change approval workflow", options: [
      { label: "Ad hoc changes", evidences: [{ o: "iso27001", w: 1 }] },
      { label: "Ticketed approvals", evidences: [{ o: "iso27001", w: 1 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 1 }, { o: "sox", w: 1 }] },
      { label: "Risk-tiered approval with review board", evidences: [{ o: "iso27001", w: 2 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 1 }, { o: "sox", w: 2 }] },
      { label: "Fully audited workflow with service levels", evidences: [{ o: "iso27001", w: 2 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 2 }, { o: "sox", w: 2 }] },
    ] },
    { id: "chg_env", name: "Environment segregation and release", options: [
      { label: "Single environment", evidences: [] },
      { label: "Separate production", evidences: [{ o: "iso27001", w: 1 }, { o: "sox", w: 1 }, { o: "pci", w: 1 }] },
      { label: "Segregation of duties enforced", evidences: [{ o: "iso27001", w: 1 }, { o: "sox", w: 1 }, { o: "pci", w: 1 }, { o: "dora", w: 1 }, { o: "soc2", w: 1 }] },
      { label: "Controlled release with rollback", evidences: [{ o: "iso27001", w: 2 }, { o: "sox", w: 2 }, { o: "pci", w: 2 }, { o: "dora", w: 1 }, { o: "soc2", w: 1 }] },
    ] },
    { id: "chg_pipe", name: "Pipeline and configuration controls", options: [
      { label: "Manual deployments", evidences: [] },
      { label: "Scripted deployments", evidences: [{ o: "cis", w: 1 }] },
      { label: "Pipeline-enforced checks", evidences: [{ o: "iso27001", w: 1 }, { o: "sox", w: 1 }, { o: "dora", w: 1 }, { o: "cis", w: 1 }] },
      { label: "Evidence captured automatically in pipeline", evidences: [{ o: "iso27001", w: 1 }, { o: "sox", w: 2 }, { o: "pci", w: 1 }, { o: "dora", w: 1 }, { o: "cis", w: 2 }, { o: "aiact", w: 1 }] },
    ] },
  ] },
  { id: "supplier", name: "Supplier and third-party risk", about: "The third parties the platform depends on, and what their failure would mean.", controls: [
    { id: "sup_dd", name: "Due diligence and onboarding", options: [
      { label: "Contract clauses only", evidences: [{ o: "iso27001", w: 1 }, { o: "eugdpr", w: 1 }] },
      { label: "Questionnaire at onboarding", evidences: [{ o: "iso27001", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "soc2", w: 1 }, { o: "nis2", w: 1 }, { o: "isoCloud", w: 1 }] },
      { label: "Tiered assessment by criticality", evidences: [{ o: "iso27001", w: 2 }, { o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "soc2", w: 1 }, { o: "nis2", w: 1 }, { o: "isoCloud", w: 1 }] },
      { label: "Assurance evidence required before use", evidences: [{ o: "iso27001", w: 2 }, { o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "soc2", w: 2 }, { o: "nis2", w: 2 }, { o: "isoCloud", w: 2 }] },
    ] },
    { id: "sup_mon", name: "Ongoing monitoring and concentration", options: [
      { label: "Nothing after onboarding", evidences: [] },
      { label: "Annual reassessment", evidences: [{ o: "iso27001", w: 1 }] },
      { label: "Continuous monitoring for critical tier", evidences: [{ o: "iso27001", w: 1 }, { o: "nis2", w: 1 }, { o: "dora", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "soc2", w: 1 }] },
      { label: "Concentration and fourth-party analysis", evidences: [{ o: "iso27001", w: 2 }, { o: "nis2", w: 1 }, { o: "dora", w: 2 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "soc2", w: 1 }] },
    ] },
    { id: "sup_exit", name: "Register, contracts and exit", options: [
      { label: "No register", evidences: [] },
      { label: "Contract repository", evidences: [{ o: "dora", w: 1 }] },
      { label: "Maintained register of arrangements", evidences: [{ o: "dora", w: 2 }, { o: "nis2", w: 1 }, { o: "iso27001", w: 1 }, { o: "isoCloud", w: 1 }] },
      { label: "Regulator-grade register with exit tested", evidences: [{ o: "dora", w: 3 }, { o: "nis2", w: 1 }, { o: "iso27001", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "isoCloud", w: 1 }] },
    ] },
  ] },
  { id: "incident", name: "Incident management and reporting", about: "Detecting, handling and reporting incidents to the right authority in the right window.", controls: [
    { id: "inc_ready", name: "Response readiness", options: [
      { label: "Improvised response", evidences: [{ o: "iso27001", w: 1 }] },
      { label: "Documented plan and roles", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "iso22301", w: 1 }, { o: "nistcsf", w: 1 }] },
      { label: "Playbooks with annual exercises", evidences: [{ o: "iso27001", w: 2 }, { o: "soc2", w: 1 }, { o: "iso22301", w: 1 }, { o: "nistcsf", w: 1 }, { o: "nis2", w: 1 }] },
      { label: "Cross-functional exercises, lessons tracked", evidences: [{ o: "iso27001", w: 2 }, { o: "soc2", w: 2 }, { o: "iso22301", w: 2 }, { o: "nistcsf", w: 2 }, { o: "nis2", w: 1 }] },
    ] },
    { id: "inc_notify", name: "Regulatory notification", local: true, options: [
      { label: "No notification mapping", evidences: [] },
      { label: "Core regimes mapped", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Full notification matrix per regime", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "nis2", w: 1 }, { o: "dora", w: 1 }, { o: "law25", w: 1 }, { o: "statePriv", w: 1 }, { o: "pdpaSg", w: 1 }, { o: "appi", w: 1 }, { o: "shield", w: 1 }, { o: "nzPriv", w: 1 }, { o: "ukNis", w: 1 }, { o: "dpdp", w: 1 }, { o: "pipeda", w: 1 }, { o: "pdplAe", w: 1 }, { o: "auPriv", w: 1 }, { o: "qaPdppl", w: 1 }, { o: "kwDppr", w: 1 }, { o: "zaPopia", w: 1 }] },
      { label: "Rehearsed, with regulator communication packs", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "nis2", w: 2 }, { o: "dora", w: 2 }, { o: "law25", w: 1 }, { o: "statePriv", w: 1 }, { o: "pdpaSg", w: 1 }, { o: "appi", w: 1 }, { o: "shield", w: 1 }, { o: "nzPriv", w: 1 }, { o: "ukNis", w: 1 }, { o: "dpdp", w: 1 }, { o: "pipeda", w: 1 }, { o: "pdplAe", w: 1 }, { o: "auPriv", w: 1 }, { o: "qaPdppl", w: 1 }, { o: "kwDppr", w: 1 }, { o: "pplIsr", w: 1 }, { o: "mxPriv", w: 1 }, { o: "zaPopia", w: 1 }] },
    ] },
    { id: "inc_crisis", name: "Crisis management", options: [
      { label: "No crisis structure", evidences: [] },
      { label: "Escalation path defined", evidences: [{ o: "iso22301", w: 1 }] },
      { label: "Crisis team exercised", evidences: [{ o: "iso22301", w: 1 }, { o: "dora", w: 1 }, { o: "iso27001", w: 1 }] },
      { label: "Severe scenarios with board involvement", evidences: [{ o: "iso22301", w: 2 }, { o: "dora", w: 1 }, { o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "nis2", w: 1 }] },
    ] },
  ] },
  { id: "privacyOps", name: "Data protection operations", about: "The machinery behind privacy promises: records, rights, lawful bases and notices.", controls: [
    { id: "dp_records", name: "Records and impact assessments", options: [
      { label: "No records", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Record of processing maintained", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "law25", w: 1 }, { o: "iso27701", w: 1 }] },
      { label: "Impact assessments for high risk", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "law25", w: 1 }, { o: "iso27701", w: 1 }, { o: "pipeda", w: 1 }, { o: "pdplAe", w: 1 }] },
      { label: "Integrated privacy-by-design reviews", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "law25", w: 1 }, { o: "iso27701", w: 2 }, { o: "pipeda", w: 1 }, { o: "dpdp", w: 1 }, { o: "pdplAe", w: 1 }] },
    ] },
    { id: "dp_rights", name: "Subject rights operations", options: [
      { label: "Manual on request", evidences: [] },
      { label: "Tracked inbox with deadlines", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "ccpa", w: 1 }, { o: "statePriv", w: 1 }] },
      { label: "Tooling for volume with identity checks", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "ccpa", w: 2 }, { o: "statePriv", w: 1 }, { o: "law25", w: 1 }, { o: "pdpaSg", w: 1 }, { o: "appi", w: 1 }, { o: "mxPriv", w: 1 }, { o: "nzPriv", w: 1 }, { o: "pplIsr", w: 1 }, { o: "auPriv", w: 1 }, { o: "pipeda", w: 1 }, { o: "dpdp", w: 1 }, { o: "arPdpa", w: 1 }, { o: "zaPopia", w: 1 }] },
      { label: "Automated fulfilment with quality control", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "ccpa", w: 2 }, { o: "statePriv", w: 2 }, { o: "law25", w: 1 }, { o: "pdpaSg", w: 2 }, { o: "appi", w: 2 }, { o: "mxPriv", w: 1 }, { o: "nzPriv", w: 1 }, { o: "pplIsr", w: 1 }, { o: "auPriv", w: 1 }, { o: "pipeda", w: 1 }, { o: "dpdp", w: 1 }, { o: "arPdpa", w: 1 }, { o: "zaPopia", w: 1 }] },
    ] },
    { id: "dp_lawful", name: "Lawful basis, consent and notices", local: true, options: [
      { label: "Generic notice", evidences: [] },
      { label: "Purposes documented", evidences: [{ o: "bipa", w: 1 }] },
      { label: "Basis mapped per purpose and market", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "ccpa", w: 1 }, { o: "law25", w: 1 }, { o: "duaa", w: 1 }, { o: "bipa", w: 1 }, { o: "mhmda", w: 1 }, { o: "ftc5", w: 1 }, { o: "localDp", w: 1 }, { o: "ageVerif", w: 1 }, { o: "auPriv", w: 1 }, { o: "arPdpa", w: 1 }, { o: "zaPopia", w: 1 }] },
      { label: "Consent and preference management at scale", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "ccpa", w: 2 }, { o: "law25", w: 1 }, { o: "duaa", w: 1 }, { o: "bipa", w: 2 }, { o: "mhmda", w: 1 }, { o: "ftc5", w: 1 }, { o: "appi", w: 1 }, { o: "pdplAe", w: 1 }, { o: "localDp", w: 1 }, { o: "ageVerif", w: 1 }, { o: "auPriv", w: 1 }, { o: "pplIsr", w: 1 }, { o: "arPdpa", w: 1 }, { o: "zaPopia", w: 1 }] },
    ] },
  ] },
  { id: "retention", name: "Retention and records", about: "Keeping data exactly as long as required, then provably not.", controls: [
    { id: "ret_sched", name: "Retention schedules", local: true, options: [
      { label: "Indefinite by default", evidences: [] },
      { label: "Group default periods", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "iso27001", w: 1 }] },
      { label: "Jurisdictional schedules maintained", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "ccpa", w: 1 }, { o: "law25", w: 1 }, { o: "appi", w: 1 }, { o: "qaPdppl", w: 1 }, { o: "kwDppr", w: 1 }, { o: "pdplAe", w: 1 }, { o: "kzDp", w: 1 }, { o: "sox", w: 1 }, { o: "iso27001", w: 1 }, { o: "bipa", w: 1 }, { o: "mhmda", w: 1 }, { o: "localDp", w: 1 }, { o: "ageVerif", w: 1 }, { o: "arPdpa", w: 1 }, { o: "zaPopia", w: 1 }] },
      { label: "Schedules tied to the data inventory", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "ccpa", w: 1 }, { o: "law25", w: 1 }, { o: "appi", w: 1 }, { o: "qaPdppl", w: 1 }, { o: "kwDppr", w: 1 }, { o: "pdplAe", w: 1 }, { o: "kzDp", w: 1 }, { o: "sox", w: 1 }, { o: "iso27001", w: 1 }, { o: "bipa", w: 1 }, { o: "mhmda", w: 1 }, { o: "localDp", w: 1 }, { o: "ageVerif", w: 1 }, { o: "arPdpa", w: 1 }, { o: "zaPopia", w: 1 }] },
    ] },
    { id: "ret_delete", name: "Deletion and legal hold", options: [
      { label: "No deletion", evidences: [] },
      { label: "Manual deletion on request", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Automated deletion jobs", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "ccpa", w: 1 }, { o: "law25", w: 1 }, { o: "iso27001", w: 1 }] },
      { label: "Defensible destruction with legal hold", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "ccpa", w: 2 }, { o: "statePriv", w: 1 }, { o: "law25", w: 1 }, { o: "bipa", w: 1 }, { o: "qaPdppl", w: 1 }, { o: "kwDppr", w: 1 }, { o: "iso27001", w: 1 }] },
    ] },
    { id: "ret_archive", name: "Backup and archive alignment", options: [
      { label: "Backups ignore retention", evidences: [] },
      { label: "Backup periods documented", evidences: [{ o: "iso27001", w: 1 }] },
      { label: "Backup expiry aligned to schedules", evidences: [{ o: "iso27001", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Point-in-time deletion across archives", evidences: [{ o: "iso27001", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "sox", w: 1 }, { o: "pci", w: 1 }, { o: "dora", w: 1 }] },
    ] },
  ] },
  { id: "aiOversight", name: "AI oversight", about: "Knowing what the models decide about people, and governing those decisions.", controls: [
    { id: "ai_inv", name: "Model inventory and risk screening", options: [
      { label: "Untracked models", evidences: [] },
      { label: "Inventory maintained", evidences: [{ o: "aiact", w: 1 }, { o: "iso42001", w: 1 }] },
      { label: "Risk screening at intake", evidences: [{ o: "aiact", w: 1 }, { o: "iso42001", w: 1 }, { o: "eugdpr", w: 1 }] },
      { label: "Lifecycle gates with re-screening", evidences: [{ o: "aiact", w: 2 }, { o: "iso42001", w: 2 }, { o: "eugdpr", w: 1 }, { o: "pwd", w: 1 }] },
    ] },
    { id: "ai_human", name: "Rider-affecting decision oversight", local: true, options: [
      { label: "No human review", evidences: [] },
      { label: "Escalation route exists", evidences: [{ o: "aiact", w: 1 }, { o: "pwd", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Human review with authority to overturn", evidences: [{ o: "aiact", w: 1 }, { o: "pwd", w: 2 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "duaa", w: 1 }, { o: "iso42001", w: 1 }] },
      { label: "Documented oversight per market, with metrics", evidences: [{ o: "aiact", w: 2 }, { o: "pwd", w: 2 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 2 }, { o: "duaa", w: 1 }, { o: "law25", w: 1 }, { o: "iso42001", w: 1 }] },
    ] },
    { id: "ai_ms", name: "AI management system", options: [
      { label: "No management system", evidences: [] },
      { label: "Policy and roles defined", evidences: [{ o: "iso42001", w: 1 }] },
      { label: "Management system operating", evidences: [{ o: "iso42001", w: 2 }, { o: "aiact", w: 1 }, { o: "pwd", w: 1 }] },
      { label: "Certified, with conformity readiness", evidences: [{ o: "iso42001", w: 3 }, { o: "aiact", w: 1 }, { o: "pwd", w: 1 }, { o: "eugdpr", w: 1 }] },
    ] },
  ] },
  { id: "paySec", name: "Payments security", about: "Protecting cardholder data and meeting payments-regulatory conditions.", controls: [
    { id: "pay_scope", name: "Cardholder data scope", options: [
      { label: "Unknown scope", evidences: [{ o: "pci", w: 1 }] },
      { label: "Scope documented", evidences: [{ o: "pci", w: 1 }] },
      { label: "Tokenisation and hosted fields", evidences: [{ o: "pci", w: 2 }, { o: "psd2", w: 1 }, { o: "iso27001", w: 1 }] },
      { label: "Minimised environment, segmentation tested", evidences: [{ o: "pci", w: 3 }, { o: "psd2", w: 1 }, { o: "iso27001", w: 1 }] },
    ] },
    { id: "pay_sca", name: "Authentication and fraud", local: true, options: [
      { label: "Provider defaults only", evidences: [] },
      { label: "Strong customer authentication via provider", evidences: [{ o: "psd2", w: 1 }, { o: "ukPsr", w: 1 }] },
      { label: "Exemption strategy managed", evidences: [{ o: "psd2", w: 2 }, { o: "pci", w: 1 }, { o: "ukPsr", w: 1 }] },
      { label: "Fraud monitoring with regulatory reporting", evidences: [{ o: "psd2", w: 3 }, { o: "pci", w: 1 }, { o: "ukPsr", w: 2 }] },
    ] },
    { id: "pay_inst", name: "Safeguarding and institution conditions", options: [
      { label: "Posture unassessed", evidences: [] },
      { label: "Safeguarding accounts documented", evidences: [{ o: "finfsa", w: 1 }, { o: "usMtl", w: 1 }] },
      { label: "Reconciliation and reporting operating", evidences: [{ o: "finfsa", w: 2 }, { o: "dora", w: 1 }, { o: "psd2", w: 1 }, { o: "usMtl", w: 1 }] },
      { label: "Full authorisation conditions evidenced", evidences: [{ o: "finfsa", w: 3 }, { o: "dora", w: 2 }, { o: "psd2", w: 1 }, { o: "usMtl", w: 2 }, { o: "pci", w: 1 }] },
    ] },
  ] },
  { id: "resilience", name: "Resilience and continuity", about: "Keeping the platform up, and recovering deliberately when it is not.", controls: [
    { id: "res_plan", name: "Continuity planning", options: [
      { label: "No plans", evidences: [] },
      { label: "Plans exist", evidences: [{ o: "iso22301", w: 1 }, { o: "iso27001", w: 1 }] },
      { label: "Impact-analysis driven objectives", evidences: [{ o: "iso22301", w: 2 }, { o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "nis2", w: 1 }, { o: "dora", w: 1 }] },
      { label: "Dependencies mapped, including third parties", evidences: [{ o: "iso22301", w: 2 }, { o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "nis2", w: 1 }, { o: "dora", w: 1 }] },
    ] },
    { id: "res_test", name: "Testing and exercising", options: [
      { label: "Never tested", evidences: [] },
      { label: "Annual tabletop", evidences: [{ o: "iso22301", w: 1 }] },
      { label: "Component failover tested", evidences: [{ o: "iso22301", w: 1 }, { o: "iso27001", w: 1 }, { o: "dora", w: 1 }, { o: "soc2", w: 1 }, { o: "ukNis", w: 1 }] },
      { label: "Full-scenario exercises", evidences: [{ o: "iso22301", w: 2 }, { o: "iso27001", w: 1 }, { o: "dora", w: 1 }, { o: "soc2", w: 1 }, { o: "nis2", w: 1 }, { o: "ukNis", w: 1 }] },
    ] },
    { id: "res_tlpt", name: "Severe scenario and threat-led testing", options: [
      { label: "None", evidences: [] },
      { label: "Scenario library", evidences: [] },
      { label: "Severe-but-plausible exercised", evidences: [{ o: "dora", w: 1 }] },
      { label: "Threat-led penetration testing", evidences: [{ o: "dora", w: 2 }, { o: "iso22301", w: 1 }, { o: "nis2", w: 1 }, { o: "finfsa", w: 1 }] },
    ] },
  ] },
  { id: "finItgc", name: "Financial reporting ITGC", about: "Controls over the systems that feed the financial statements.", controls: [
    { id: "fin_scope", name: "Scoping and mapping", options: [
      { label: "Unscoped", evidences: [{ o: "sox", w: 1 }] },
      { label: "Material systems listed", evidences: [{ o: "sox", w: 1 }] },
      { label: "Controls mapped to assertions", evidences: [{ o: "sox", w: 2 }, { o: "iso27001", w: 1 }] },
      { label: "Scope refreshed on change", evidences: [{ o: "sox", w: 2 }, { o: "iso27001", w: 1 }] },
    ] },
    { id: "fin_op", name: "ITGC operation", options: [
      { label: "Informal", evidences: [] },
      { label: "Baseline access and change controls", evidences: [{ o: "sox", w: 1 }] },
      { label: "Operating with evidence retained", evidences: [{ o: "sox", w: 2 }, { o: "soc2", w: 1 }] },
      { label: "Exceptions managed with remediation", evidences: [{ o: "sox", w: 2 }, { o: "soc2", w: 1 }, { o: "iso27001", w: 1 }] },
    ] },
    { id: "fin_test", name: "Independent testing", options: [
      { label: "None", evidences: [] },
      { label: "Self-assessment", evidences: [{ o: "sox", w: 1 }] },
      { label: "Internal audit testing", evidences: [{ o: "sox", w: 1 }, { o: "soc2", w: 1 }] },
      { label: "Continuous controls monitoring", evidences: [{ o: "sox", w: 2 }, { o: "soc2", w: 2 }, { o: "dora", w: 1 }] },
    ] },
  ] },
  { id: "transfers", name: "Transfers and data localisation", about: "Where data may go, where it must stay, and the paperwork that moves it lawfully.", controls: [
    { id: "tr_mech", name: "Transfer mechanisms", options: [
      { label: "None documented", evidences: [] },
      { label: "Clauses in key contracts", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Standard clauses and UK addendum programme", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "law25", w: 1 }, { o: "pdpaSg", w: 1 }, { o: "appi", w: 1 }, { o: "dpdp", w: 1 }, { o: "zaPopia", w: 1 }] },
      { label: "Mechanism register with renewals tracked", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "law25", w: 1 }, { o: "pdpaSg", w: 1 }, { o: "appi", w: 1 }, { o: "pipeda", w: 1 }, { o: "dpdp", w: 1 }, { o: "pdplAe", w: 1 }, { o: "isoCloud", w: 1 }, { o: "zaPopia", w: 1 }, { o: "arPdpa", w: 1 }] },
    ] },
    { id: "tr_local", name: "Localisation architecture", local: true, options: [
      { label: "Unassessed", evidences: [] },
      { label: "Requirements catalogued", evidences: [{ o: "kzDp", w: 1 }] },
      { label: "In-country storage where mandated", evidences: [{ o: "kzDp", w: 1 }, { o: "localDp", w: 1 }, { o: "pdplAe", w: 1 }] },
      { label: "Residency controls with attestation", evidences: [{ o: "kzDp", w: 2 }, { o: "localDp", w: 1 }, { o: "dpdp", w: 1 }, { o: "pdplAe", w: 1 }, { o: "appi", w: 1 }] },
    ] },
    { id: "tr_tia", name: "Transfer risk assessments", options: [
      { label: "None", evidences: [] },
      { label: "High-risk routes assessed", evidences: [] },
      { label: "Assessments for all third-country routes", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "isoCloud", w: 1 }] },
      { label: "Adequacy watch with reassessment triggers", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "isoCloud", w: 1 }, { o: "pplIsr", w: 1 }] },
    ] },
  ] },
  { id: "training", name: "Awareness and training", about: "People knowing their part: baseline awareness, role depth and measured effect.", controls: [
    { id: "trn_base", name: "Baseline awareness", options: [
      { label: "None", evidences: [] },
      { label: "Annual training", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "pci", w: 1 }] },
      { label: "Onboarding plus annual, with tracking", evidences: [{ o: "iso27001", w: 1 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 1 }, { o: "pci", w: 1 }, { o: "nis2", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
      { label: "Adaptive content, completion enforced", evidences: [{ o: "iso27001", w: 2 }, { o: "iso27002", w: 1 }, { o: "soc2", w: 1 }, { o: "pci", w: 1 }, { o: "nis2", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }] },
    ] },
    { id: "trn_role", name: "Role-based training", options: [
      { label: "None", evidences: [] },
      { label: "Key roles identified", evidences: [{ o: "aiact", w: 1 }, { o: "ageVerif", w: 1 }] },
      { label: "Payments, privacy and AI roles trained", evidences: [{ o: "pci", w: 1 }, { o: "dora", w: 1 }, { o: "aiact", w: 1 }, { o: "sox", w: 1 }, { o: "ageVerif", w: 1 }] },
      { label: "Competence assessed and refreshed", evidences: [{ o: "pci", w: 1 }, { o: "dora", w: 1 }, { o: "aiact", w: 1 }, { o: "eugdpr", w: 1 }, { o: "sox", w: 1 }, { o: "ageVerif", w: 1 }, { o: "iso42001", w: 1 }] },
    ] },
    { id: "trn_measure", name: "Effectiveness measurement", options: [
      { label: "None", evidences: [] },
      { label: "Completion tracked", evidences: [] },
      { label: "Behavioural testing", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "nistcsf", w: 1 }, { o: "cis", w: 1 }] },
      { label: "Outcomes feed risk reporting", evidences: [{ o: "iso27001", w: 1 }, { o: "soc2", w: 1 }, { o: "nistcsf", w: 1 }, { o: "cis", w: 1 }] },
    ] },
  ] },
  { id: "inventory", name: "Asset and data inventory", about: "Knowing what exists and what data it holds: the precondition for every other domain.", controls: [
    { id: "inv_asset", name: "Asset inventory", options: [
      { label: "None", evidences: [{ o: "iso27001", w: 1 }, { o: "cis", w: 1 }] },
      { label: "Spreadsheet inventory", evidences: [{ o: "iso27001", w: 1 }, { o: "cis", w: 1 }] },
      { label: "Automated discovery", evidences: [{ o: "iso27001", w: 2 }, { o: "cis", w: 2 }, { o: "nis2", w: 1 }, { o: "dora", w: 1 }, { o: "pci", w: 1 }, { o: "sox", w: 1 }] },
      { label: "Configuration database with ownership", evidences: [{ o: "iso27001", w: 2 }, { o: "cis", w: 2 }, { o: "nis2", w: 1 }, { o: "dora", w: 2 }, { o: "pci", w: 1 }, { o: "sox", w: 1 }] },
    ] },
    { id: "inv_data", name: "Data inventory and classification", options: [
      { label: "None", evidences: [] },
      { label: "Key stores mapped", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "iso27701", w: 1 }] },
      { label: "Classification applied", evidences: [{ o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "iso27701", w: 1 }, { o: "ccpa", w: 1 }, { o: "dpdp", w: 1 }, { o: "isoCloud", w: 1 }] },
      { label: "Lineage and flows mapped", evidences: [{ o: "eugdpr", w: 2 }, { o: "ukgdpr", w: 2 }, { o: "iso27701", w: 1 }, { o: "ccpa", w: 1 }, { o: "mhmda", w: 1 }, { o: "bipa", w: 1 }, { o: "kzDp", w: 1 }, { o: "dpdp", w: 1 }, { o: "isoCloud", w: 1 }] },
    ] },
    { id: "inv_link", name: "Inventory-driven control linkage", options: [
      { label: "None", evidences: [] },
      { label: "Retention linked", evidences: [] },
      { label: "Retention and residency driven from inventory", evidences: [{ o: "iso27001", w: 1 }, { o: "nistcsf", w: 1 }] },
      { label: "Controls scoped automatically from inventory", evidences: [{ o: "iso27001", w: 1 }, { o: "eugdpr", w: 1 }, { o: "ukgdpr", w: 1 }, { o: "sox", w: 1 }, { o: "nistcsf", w: 1 }] },
    ] },
  ] },
];

const ALL_CONTROLS = CONTROL_DOMAINS.flatMap((d) =>
  d.controls.map((c) => ({ ...c, domainId: d.id, domainName: d.name })));

/* --------------------------- change scenarios -----------------------
   Version changes and incoming regulation are modelled as uplifts to
   existing obligation families (weight increases), not as freshly
   authored obligations: the crosswalk stays honest and absorption by
   the existing control set stays measurable. Territory addition is a
   picker over the unselected territories, not a fixed scenario.
------------------------------------------------------------------- */

const CHANGE_SCENARIOS = [
  {
    id: "iso2022", kind: "version", name: "ISO/IEC 27001: 2013 to 2022",
    retro: true,
    summary: "The 2022 revision consolidated Annex A and added controls such as threat intelligence, cloud service security and data leakage prevention. Certified organisations completed transition by October 2025. Retrospective, shown to demonstrate version-change mechanics.",
    mods: [{ o: "iso27001", delta: 1 }],
  },
  {
    id: "pci401", kind: "version", name: "PCI DSS: 3.2.1 to 4.0.1",
    retro: true,
    summary: "The future-dated requirements became mandatory in March 2025: targeted risk analyses, expanded multi-factor authentication and payment-page script management. Retrospective, shown to demonstrate version-change mechanics.",
    mods: [{ o: "pci", delta: 1 }],
  },
  {
    id: "aiactHr", kind: "upcoming", name: "EU AI Act: high-risk phase applies",
    indicative: true, verify: true,
    summary: "Annex III high-risk obligations, including employment and worker-management systems, are scheduled to apply from August 2026, with timing subject to the proposed digital omnibus. Indicative: confirm dates and scope against primary sources.",
    mods: [{ o: "aiact", delta: 1 }],
  },
  {
    id: "pwdTrans", kind: "upcoming", name: "Platform Work Directive: transposition",
    indicative: true,
    summary: "Member states transpose by December 2026, firming algorithmic management duties into national law, with detail varying by state. Indicative of the direction, not any single national text.",
    mods: [{ o: "pwd", delta: 1 }],
  },
  {
    id: "ukCsrb", kind: "upcoming", name: "UK Cyber Security and Resilience Bill",
    indicative: true, verify: true,
    summary: "Expected to widen NIS-style duties to more sectors and strengthen regulator powers and incident reporting. Progress and final scope to confirm against primary sources.",
    mods: [{ o: "ukNis", delta: 1 }],
  },
];

/* ---------------------------- resolution --------------------------- */

function expandScope(juris) {
  const out = new Set();
  juris.forEach((token) => {
    if (token === "GLOBAL") ALL_IDS.forEach((id) => out.add(id));
    else if (token === "EU") EU_IDS.forEach((id) => out.add(id));
    else if (token === "EEA") EEA_IDS.forEach((id) => out.add(id));
    else out.add(token);
  });
  return out;
}

function resolveObligations(selectedIds) {
  const selected = new Set(selectedIds);
  const results = [];
  OBLIGATIONS.forEach((o) => {
    const scope = expandScope(o.juris);
    const matched = [...selected].filter((id) => scope.has(id));
    if (matched.length > 0) {
      matched.sort((a, b) => J_BY_ID[a].name.localeCompare(J_BY_ID[b].name));
      results.push({ obligation: o, matched });
    }
  });
  return results;
}

/* ------------------------------ layout ----------------------------- */

const CELL = 53;
const TILE_W = 46;
const TILE_H = 44;
const PAD_X = 8;
const PAD_TOP = 30;
const MAP_W = PAD_X + 18 * CELL + TILE_W + PAD_X;
const MAP_H = PAD_TOP + 8 * CELL + TILE_H + 10;

const REGION_CAPTIONS = [
  { text: "Americas", col: 0 },
  { text: "Europe and EEA", col: 6 },
  { text: "Middle East, Africa and Central Asia", col: 12 },
  { text: "Asia Pacific", col: 16 },
];

/* --------------------------- small pieces --------------------------- */

function Pill({ text, colour }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase",
      color: colour, border: `1px solid ${colour}`, borderRadius: 2,
      padding: "1px 6px", whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

function VerifyPill() {
  return <Pill text="verify" colour={C.verify} />;
}

/* ------------------------------ tile map/* ---------------------------- projection ----------------------------
   The projection view draws world borders (Natural Earth geometry,
   simplified and quantised for embedding, decoded in-file) including
   United States state and Canadian provincial boundaries. Selected
   territories fill. Approximate coordinates per territory anchor
   labels, markers for very small territories, and focus indicators.
   No external fetches: the artefact stays self-contained.
------------------------------------------------------------------- */

const GEO = {
  ca_fed: [-75.7, 45.4], ca_qc: [-71.2, 46.8], us_wa: [-120.5, 47.4],
  us_fed: [-77.0, 38.9], us_il: [-89.2, 40.0], us_ny: [-75.5, 43.0],
  us_ct: [-72.7, 41.6], us_ca: [-119.7, 36.8], us_co: [-105.5, 39.0],
  us_va: [-78.7, 37.5], us_tx: [-99.0, 31.0], mx: [-102.5, 23.6],
  is: [-19.0, 64.9], no: [8.5, 60.5], se: [15.0, 62.0], fi: [26.0, 64.0],
  ie: [-8.0, 53.4], gb: [-1.5, 52.5], dk: [9.5, 56.0], ee: [25.0, 58.6],
  fr: [2.2, 46.6], be: [4.5, 50.5], de: [10.4, 51.1], pl: [19.1, 51.9],
  lv: [24.6, 56.9], lu: [6.1, 49.8], cz: [15.5, 49.8], sk: [19.7, 48.7],
  lt: [23.9, 55.2], it: [12.6, 42.5], at: [14.6, 47.5], hu: [19.5, 47.2],
  ro: [24.9, 45.9], si: [14.8, 46.1], hr: [15.2, 45.1], rs: [21.0, 44.0],
  bg: [25.5, 42.7], mt: [14.4, 35.9], al: [20.1, 41.1], xk: [20.9, 42.6],
  mk: [21.7, 41.6], gr: [22.9, 39.0], cy: [33.4, 35.1], kz: [66.9, 48.0],
  uz: [64.6, 41.4], ge: [43.4, 42.3], az: [47.6, 40.4], isr: [34.9, 31.4],
  kw: [47.5, 29.3], qa: [51.2, 25.3], ae: [54.3, 24.3], jp: [138.2, 36.2],
  sg: [103.8, 1.4], in: [78.9, 20.6], au: [133.8, -25.3], nz: [174.9, -40.9],
  ar: [-64.5, -34.5], za: [24.7, -29.0],
};

const MAP_COUNTRY = { ca_fed: "Canada", us_fed: "United States of America", mx: "Mexico", is: "Iceland", no: "Norway", se: "Sweden", fi: "Finland", ie: "Ireland", gb: "United Kingdom", dk: "Denmark", ee: "Estonia", fr: "France", be: "Belgium", de: "Germany", pl: "Poland", lv: "Latvia", lu: "Luxembourg", cz: "Czechia", sk: "Slovakia", lt: "Lithuania", it: "Italy", at: "Austria", hu: "Hungary", ro: "Romania", si: "Slovenia", hr: "Croatia", rs: "Serbia", bg: "Bulgaria", mt: "Malta", al: "Albania", xk: "Kosovo", mk: "Macedonia", gr: "Greece", cy: "Cyprus", kz: "Kazakhstan", uz: "Uzbekistan", ge: "Georgia", az: "Azerbaijan", isr: "Israel", kw: "Kuwait", qa: "Qatar", ae: "United Arab Emirates", jp: "Japan", sg: "Singapore", in: "India", au: "Australia", nz: "New Zealand", ar: "Argentina", za: "South Africa" };

const MAP_ADMIN1 = { us_wa: "Washington", us_il: "Illinois", us_ny: "New York", us_ct: "Connecticut", us_ca: "California", us_co: "Colorado", us_va: "Virginia", us_tx: "Texas", ca_qc: "Quebec" };

const WORLD_TOPO = {"type":"Topology","objects":{"countries":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","arcs":[[[0]],[[1]]],"id":"242","properties":{"name":"Fiji"}},{"type":"Polygon","arcs":[[2,3,4,5,6,7,8,9,10]],"id":"834","properties":{"name":"Tanzania"}},{"type":"Polygon","arcs":[[11,12,13,14]],"id":"732","properties":{"name":"W. Sahara"}},{"type":"MultiPolygon","arcs":[[[15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60,61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]]],"id":"124","properties":{"name":"Canada"}},{"type":"MultiPolygon","arcs":[[[-54,-53,-52,-51,-50,-49,-48,-47,-46,-45,-44,-43,-42,-41,-40,-39,-38,-37,-36,-35,-34,-33,-32,-31,-30,-29,-28,-27,-26,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140]],[[141,142,143,144]],[[145,146,147,148]],[[-24,-23,-22,-21,-20,-19,-18,-17,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197]]],"id":"840","properties":{"name":"United States of America"}},{"type":"Polygon","arcs":[[198,199,200,201,202,203]],"id":"398","properties":{"name":"Kazakhstan"}},{"type":"Polygon","arcs":[[-201,204,205,206,207]],"id":"860","properties":{"name":"Uzbekistan"}},{"type":"MultiPolygon","arcs":[[[208,209]],[[210]],[[211]],[[212]]],"id":"598","properties":{"name":"Papua New Guinea"}},{"type":"MultiPolygon","arcs":[[[-210,213]],[[214,215]],[[216]],[[217,218]],[[219]],[[220]],[[221]],[[222]],[[223]],[[224]],[[225]],[[226]],[[227]]],"id":"360","properties":{"name":"Indonesia"}},{"type":"MultiPolygon","arcs":[[[228,229]],[[230,231,232,233,234,235]]],"id":"032","properties":{"name":"Argentina"}},{"type":"MultiPolygon","arcs":[[[-230,236]],[[237,-233,238,239]]],"id":"152","properties":{"name":"Chile"}},{"type":"Polygon","arcs":[[-8,240,241,242,243,244,245,246,247,248,249]],"id":"180","properties":{"name":"Dem. Rep. Congo"}},{"type":"Polygon","arcs":[[250,251,252,253]],"id":"706","properties":{"name":"Somalia"}},{"type":"Polygon","arcs":[[-3,254,255,256,-251,257]],"id":"404","properties":{"name":"Kenya"}},{"type":"Polygon","arcs":[[258,259,260,261,262,263,264,265]],"id":"729","properties":{"name":"Sudan"}},{"type":"Polygon","arcs":[[-260,266,267,268,269]],"id":"148","properties":{"name":"Chad"}},{"type":"Polygon","arcs":[[270,271]],"id":"332","properties":{"name":"Haiti"}},{"type":"Polygon","arcs":[[-271,272]],"id":"214","properties":{"name":"Dominican Rep."}},{"type":"MultiPolygon","arcs":[[[273]],[[274]],[[275]],[[276]],[[277]],[[278,279,280]],[[281]],[[282]],[[283,284,285,286,-204,287,288,289,290,291,292,293,294,295,296,297,298]],[[299]],[[300,301]]],"id":"643","properties":{"name":"Russia"}},{"type":"MultiPolygon","arcs":[[[302]],[[303]]],"id":"044","properties":{"name":"Bahamas"}},{"type":"Polygon","arcs":[[304]],"id":"238","properties":{"name":"Falkland Is."}},{"type":"MultiPolygon","arcs":[[[305]],[[-298,306,307,308]],[[309]],[[310]]],"id":"578","properties":{"name":"Norway"}},{"type":"Polygon","arcs":[[311]],"id":"304","properties":{"name":"Greenland"}},{"type":"Polygon","arcs":[[312]],"id":"260","properties":{"name":"Fr. S. Antarctic Lands"}},{"type":"Polygon","arcs":[[313,-215]],"id":"626","properties":{"name":"Timor-Leste"}},{"type":"Polygon","arcs":[[314,315,316,317,318,319,320],[321]],"id":"710","properties":{"name":"South Africa"}},{"type":"Polygon","arcs":[[-322]],"id":"426","properties":{"name":"Lesotho"}},{"type":"Polygon","arcs":[[-129,-128,-127,-126,-125,-124,-123,-122,-121,-120,-119,-118,-117,-116,322,323,324,325]],"id":"484","properties":{"name":"Mexico"}},{"type":"Polygon","arcs":[[326,327,-231]],"id":"858","properties":{"name":"Uruguay"}},{"type":"Polygon","arcs":[[-327,-236,328,329,330,331,332,333,334,335,336]],"id":"076","properties":{"name":"Brazil"}},{"type":"Polygon","arcs":[[-330,337,-234,-238,338]],"id":"068","properties":{"name":"Bolivia"}},{"type":"Polygon","arcs":[[-331,-339,-240,339,340,341]],"id":"604","properties":{"name":"Peru"}},{"type":"Polygon","arcs":[[-332,-342,342,343,344,345,346]],"id":"170","properties":{"name":"Colombia"}},{"type":"Polygon","arcs":[[-345,347,348,349]],"id":"591","properties":{"name":"Panama"}},{"type":"Polygon","arcs":[[-349,350,351,352]],"id":"188","properties":{"name":"Costa Rica"}},{"type":"Polygon","arcs":[[-352,353,354,355]],"id":"558","properties":{"name":"Nicaragua"}},{"type":"Polygon","arcs":[[-355,356,357,358,359]],"id":"340","properties":{"name":"Honduras"}},{"type":"Polygon","arcs":[[-358,360,361]],"id":"222","properties":{"name":"El Salvador"}},{"type":"Polygon","arcs":[[-325,362,363,-359,-362,364]],"id":"320","properties":{"name":"Guatemala"}},{"type":"Polygon","arcs":[[-324,365,-363]],"id":"084","properties":{"name":"Belize"}},{"type":"Polygon","arcs":[[-333,-347,366,367]],"id":"862","properties":{"name":"Venezuela"}},{"type":"Polygon","arcs":[[-334,-368,368,369]],"id":"328","properties":{"name":"Guyana"}},{"type":"Polygon","arcs":[[-335,-370,370,371]],"id":"740","properties":{"name":"Suriname"}},{"type":"MultiPolygon","arcs":[[[-336,-372,372]],[[373,374,375,376,377,378,379,380]],[[381]]],"id":"250","properties":{"name":"France"}},{"type":"Polygon","arcs":[[-341,382,-343]],"id":"218","properties":{"name":"Ecuador"}},{"type":"Polygon","arcs":[[383]],"id":"630","properties":{"name":"Puerto Rico"}},{"type":"Polygon","arcs":[[384]],"id":"388","properties":{"name":"Jamaica"}},{"type":"Polygon","arcs":[[385]],"id":"192","properties":{"name":"Cuba"}},{"type":"Polygon","arcs":[[-317,386,387,388]],"id":"716","properties":{"name":"Zimbabwe"}},{"type":"Polygon","arcs":[[-316,389,390,-387]],"id":"072","properties":{"name":"Botswana"}},{"type":"Polygon","arcs":[[-315,391,392,393,-390]],"id":"516","properties":{"name":"Namibia"}},{"type":"Polygon","arcs":[[394,395,396,397,398,399,400]],"id":"686","properties":{"name":"Senegal"}},{"type":"Polygon","arcs":[[-397,401,402,403,404,405,406]],"id":"466","properties":{"name":"Mali"}},{"type":"Polygon","arcs":[[-13,407,-402,-396,408]],"id":"478","properties":{"name":"Mauritania"}},{"type":"Polygon","arcs":[[409,410,411,412,413]],"id":"204","properties":{"name":"Benin"}},{"type":"Polygon","arcs":[[-269,414,415,-413,416,-404,417,418]],"id":"562","properties":{"name":"Niger"}},{"type":"Polygon","arcs":[[-414,-416,419,420]],"id":"566","properties":{"name":"Nigeria"}},{"type":"Polygon","arcs":[[-268,421,422,423,424,425,-420,-415]],"id":"120","properties":{"name":"Cameroon"}},{"type":"Polygon","arcs":[[-411,426,427,428]],"id":"768","properties":{"name":"Togo"}},{"type":"Polygon","arcs":[[-428,429,430,431]],"id":"288","properties":{"name":"Ghana"}},{"type":"Polygon","arcs":[[-406,432,-431,433,434,435]],"id":"384","properties":{"name":"Côte d'Ivoire"}},{"type":"Polygon","arcs":[[-398,-407,-436,436,437,438,439]],"id":"324","properties":{"name":"Guinea"}},{"type":"Polygon","arcs":[[-399,-440,440]],"id":"624","properties":{"name":"Guinea-Bissau"}},{"type":"Polygon","arcs":[[-435,441,442,-437]],"id":"430","properties":{"name":"Liberia"}},{"type":"Polygon","arcs":[[-438,-443,443]],"id":"694","properties":{"name":"Sierra Leone"}},{"type":"Polygon","arcs":[[-405,-417,-412,-429,-432,-433]],"id":"854","properties":{"name":"Burkina Faso"}},{"type":"Polygon","arcs":[[-246,444,-422,-267,-259,445]],"id":"140","properties":{"name":"Central African Rep."}},{"type":"Polygon","arcs":[[-245,446,447,448,-423,-445]],"id":"178","properties":{"name":"Congo"}},{"type":"Polygon","arcs":[[-424,-449,449,450]],"id":"266","properties":{"name":"Gabon"}},{"type":"Polygon","arcs":[[-425,-451,451]],"id":"226","properties":{"name":"Eq. Guinea"}},{"type":"Polygon","arcs":[[-7,452,453,-388,-391,-394,454,-241]],"id":"894","properties":{"name":"Zambia"}},{"type":"Polygon","arcs":[[-6,455,-453]],"id":"454","properties":{"name":"Malawi"}},{"type":"Polygon","arcs":[[-5,456,-320,457,-318,-389,-454,-456]],"id":"508","properties":{"name":"Mozambique"}},{"type":"Polygon","arcs":[[-319,-458]],"id":"748","properties":{"name":"eSwatini"}},{"type":"MultiPolygon","arcs":[[[-244,458,-447]],[[-242,-455,-393,459]]],"id":"024","properties":{"name":"Angola"}},{"type":"Polygon","arcs":[[-9,-250,460]],"id":"108","properties":{"name":"Burundi"}},{"type":"Polygon","arcs":[[461,462,463,464,465,466,467]],"id":"376","properties":{"name":"Israel"}},{"type":"Polygon","arcs":[[-467,468,469]],"id":"422","properties":{"name":"Lebanon"}},{"type":"Polygon","arcs":[[470]],"id":"450","properties":{"name":"Madagascar"}},{"type":"Polygon","arcs":[[-463,471]],"id":"275","properties":{"name":"Palestine"}},{"type":"Polygon","arcs":[[-401,472]],"id":"270","properties":{"name":"Gambia"}},{"type":"Polygon","arcs":[[473,474,475]],"id":"788","properties":{"name":"Tunisia"}},{"type":"Polygon","arcs":[[-12,476,477,-474,478,-418,-403,-408]],"id":"012","properties":{"name":"Algeria"}},{"type":"Polygon","arcs":[[-462,479,480,481,482,-464,-472]],"id":"400","properties":{"name":"Jordan"}},{"type":"Polygon","arcs":[[483,484,485]],"id":"784","properties":{"name":"United Arab Emirates"}},{"type":"Polygon","arcs":[[486,487]],"id":"634","properties":{"name":"Qatar"}},{"type":"Polygon","arcs":[[488,489,490]],"id":"414","properties":{"name":"Kuwait"}},{"type":"Polygon","arcs":[[-481,491,492,493,494,-491,495]],"id":"368","properties":{"name":"Iraq"}},{"type":"Polygon","arcs":[[-485,496,497,498]],"id":"512","properties":{"name":"Oman"}},{"type":"Polygon","arcs":[[499]],"id":"548","properties":{"name":"Vanuatu"}},{"type":"Polygon","arcs":[[500,501,502,503]],"id":"116","properties":{"name":"Cambodia"}},{"type":"Polygon","arcs":[[-501,504,505,506,507,508]],"id":"764","properties":{"name":"Thailand"}},{"type":"Polygon","arcs":[[-502,-509,509,510,511]],"id":"418","properties":{"name":"Laos"}},{"type":"Polygon","arcs":[[-508,512,513,514,515,-510]],"id":"104","properties":{"name":"Myanmar"}},{"type":"Polygon","arcs":[[-503,-512,516,517]],"id":"704","properties":{"name":"Vietnam"}},{"type":"Polygon","arcs":[[-284,518,519,520,521]],"id":"408","properties":{"name":"North Korea"}},{"type":"Polygon","arcs":[[-520,522]],"id":"410","properties":{"name":"South Korea"}},{"type":"Polygon","arcs":[[-286,523]],"id":"496","properties":{"name":"Mongolia"}},{"type":"Polygon","arcs":[[-515,524,525,526,527,528,529,530,531]],"id":"356","properties":{"name":"India"}},{"type":"Polygon","arcs":[[-514,532,-525]],"id":"050","properties":{"name":"Bangladesh"}},{"type":"Polygon","arcs":[[-531,533]],"id":"064","properties":{"name":"Bhutan"}},{"type":"Polygon","arcs":[[-529,534]],"id":"524","properties":{"name":"Nepal"}},{"type":"Polygon","arcs":[[-527,535,536,537,538]],"id":"586","properties":{"name":"Pakistan"}},{"type":"Polygon","arcs":[[-207,539,540,-538,541,542]],"id":"004","properties":{"name":"Afghanistan"}},{"type":"Polygon","arcs":[[-206,543,544,-540]],"id":"762","properties":{"name":"Tajikistan"}},{"type":"Polygon","arcs":[[-200,545,-544,-205]],"id":"417","properties":{"name":"Kyrgyzstan"}},{"type":"Polygon","arcs":[[-202,-208,-543,546,547]],"id":"795","properties":{"name":"Turkmenistan"}},{"type":"Polygon","arcs":[[-494,548,549,550,551,552,-547,-542,-537,553]],"id":"364","properties":{"name":"Iran"}},{"type":"Polygon","arcs":[[-468,-470,554,555,-492,-480]],"id":"760","properties":{"name":"Syria"}},{"type":"Polygon","arcs":[[-551,556,557,558,559]],"id":"051","properties":{"name":"Armenia"}},{"type":"Polygon","arcs":[[-308,560,561]],"id":"752","properties":{"name":"Sweden"}},{"type":"Polygon","arcs":[[-293,562,563,564,565]],"id":"112","properties":{"name":"Belarus"}},{"type":"Polygon","arcs":[[-292,566,-301,567,568,569,570,571,572,573,-563]],"id":"804","properties":{"name":"Ukraine"}},{"type":"Polygon","arcs":[[-564,-574,574,575,576,577,-279,578]],"id":"616","properties":{"name":"Poland"}},{"type":"Polygon","arcs":[[579,580,581,582,583,584,585]],"id":"040","properties":{"name":"Austria"}},{"type":"Polygon","arcs":[[-572,586,587,588,589,-580,590]],"id":"348","properties":{"name":"Hungary"}},{"type":"Polygon","arcs":[[-570,591]],"id":"498","properties":{"name":"Moldova"}},{"type":"Polygon","arcs":[[-569,592,593,594,-587,-571,-592]],"id":"642","properties":{"name":"Romania"}},{"type":"Polygon","arcs":[[-565,-579,-281,595,596]],"id":"440","properties":{"name":"Lithuania"}},{"type":"Polygon","arcs":[[-294,-566,-597,597,598]],"id":"428","properties":{"name":"Latvia"}},{"type":"Polygon","arcs":[[-295,-599,599]],"id":"233","properties":{"name":"Estonia"}},{"type":"Polygon","arcs":[[-577,600,-584,601,-374,602,603,604,605,606,607]],"id":"276","properties":{"name":"Germany"}},{"type":"Polygon","arcs":[[-594,608,609,610,611,612]],"id":"100","properties":{"name":"Bulgaria"}},{"type":"MultiPolygon","arcs":[[[613]],[[-611,614,615,616,617]]],"id":"300","properties":{"name":"Greece"}},{"type":"MultiPolygon","arcs":[[[-493,-556,618,619,-558,-549]],[[-610,620,-615]]],"id":"792","properties":{"name":"Turkey"}},{"type":"Polygon","arcs":[[-617,621,622,623,624]],"id":"008","properties":{"name":"Albania"}},{"type":"Polygon","arcs":[[-589,625,626,627,628,629]],"id":"191","properties":{"name":"Croatia"}},{"type":"Polygon","arcs":[[-583,630,-375,-602]],"id":"756","properties":{"name":"Switzerland"}},{"type":"Polygon","arcs":[[-603,-381,631]],"id":"442","properties":{"name":"Luxembourg"}},{"type":"Polygon","arcs":[[-604,-632,-380,632,633]],"id":"056","properties":{"name":"Belgium"}},{"type":"Polygon","arcs":[[-605,-634,634]],"id":"528","properties":{"name":"Netherlands"}},{"type":"Polygon","arcs":[[635,636]],"id":"620","properties":{"name":"Portugal"}},{"type":"Polygon","arcs":[[-636,637,-378,638]],"id":"724","properties":{"name":"Spain"}},{"type":"Polygon","arcs":[[639,640]],"id":"372","properties":{"name":"Ireland"}},{"type":"Polygon","arcs":[[641]],"id":"540","properties":{"name":"New Caledonia"}},{"type":"Polygon","arcs":[[642]],"id":"090","properties":{"name":"Solomon Is."}},{"type":"MultiPolygon","arcs":[[[643]],[[644]]],"id":"554","properties":{"name":"New Zealand"}},{"type":"MultiPolygon","arcs":[[[645]],[[646]]],"id":"036","properties":{"name":"Australia"}},{"type":"Polygon","arcs":[[647]],"id":"144","properties":{"name":"Sri Lanka"}},{"type":"MultiPolygon","arcs":[[[648]],[[-199,-287,-524,-285,-522,649,-517,-511,-516,-532,-534,-530,-535,-528,-539,-541,-545,-546]]],"id":"156","properties":{"name":"China"}},{"type":"Polygon","arcs":[[650]],"id":"158","properties":{"name":"Taiwan"}},{"type":"MultiPolygon","arcs":[[[-582,651,652,-376,-631]],[[653]],[[654]]],"id":"380","properties":{"name":"Italy"}},{"type":"MultiPolygon","arcs":[[[-607,655]],[[656]]],"id":"208","properties":{"name":"Denmark"}},{"type":"MultiPolygon","arcs":[[[-641,657]],[[658]]],"id":"826","properties":{"name":"United Kingdom"}},{"type":"Polygon","arcs":[[659]],"id":"352","properties":{"name":"Iceland"}},{"type":"MultiPolygon","arcs":[[[-289,660,-552,-560,661]],[[-550,-557]]],"id":"031","properties":{"name":"Azerbaijan"}},{"type":"Polygon","arcs":[[-290,-662,-559,-620,662]],"id":"268","properties":{"name":"Georgia"}},{"type":"MultiPolygon","arcs":[[[663]],[[664]],[[665]],[[666]],[[667]],[[668]],[[669]]],"id":"608","properties":{"name":"Philippines"}},{"type":"MultiPolygon","arcs":[[[-506,670]],[[-219,671,672,673]]],"id":"458","properties":{"name":"Malaysia"}},{"type":"Polygon","arcs":[[-673,674]],"id":"096","properties":{"name":"Brunei"}},{"type":"Polygon","arcs":[[-581,-590,-630,675,-652]],"id":"705","properties":{"name":"Slovenia"}},{"type":"Polygon","arcs":[[-297,676,-561,-307]],"id":"246","properties":{"name":"Finland"}},{"type":"Polygon","arcs":[[-573,-591,-586,677,-575]],"id":"703","properties":{"name":"Slovakia"}},{"type":"Polygon","arcs":[[-576,-678,-585,-601]],"id":"203","properties":{"name":"Czechia"}},{"type":"Polygon","arcs":[[-264,678,679,680]],"id":"232","properties":{"name":"Eritrea"}},{"type":"MultiPolygon","arcs":[[[681]],[[682]],[[683]]],"id":"392","properties":{"name":"Japan"}},{"type":"Polygon","arcs":[[-329,-235,-338]],"id":"600","properties":{"name":"Paraguay"}},{"type":"Polygon","arcs":[[-498,684,685]],"id":"887","properties":{"name":"Yemen"}},{"type":"Polygon","arcs":[[-482,-496,-490,686,-488,687,-486,-499,-686,688]],"id":"682","properties":{"name":"Saudi Arabia"}},{"type":"MultiPolygon","arcs":[[[689]],[[690]],[[691]],[[692]],[[693]],[[694]],[[695]]],"id":"010","properties":{"name":"Antarctica"}},{"type":"Polygon","arcs":[[696,697]],"properties":{"name":"N. Cyprus"}},{"type":"Polygon","arcs":[[-698,698]],"id":"196","properties":{"name":"Cyprus"}},{"type":"Polygon","arcs":[[-477,-15,699]],"id":"504","properties":{"name":"Morocco"}},{"type":"Polygon","arcs":[[-262,700,701,-465,702]],"id":"818","properties":{"name":"Egypt"}},{"type":"Polygon","arcs":[[-261,-270,-419,-479,-476,703,-701]],"id":"434","properties":{"name":"Libya"}},{"type":"Polygon","arcs":[[-252,-257,704,-265,-681,705,706]],"id":"231","properties":{"name":"Ethiopia"}},{"type":"Polygon","arcs":[[-680,707,708,-706]],"id":"262","properties":{"name":"Djibouti"}},{"type":"Polygon","arcs":[[-253,-707,-709,709]],"properties":{"name":"Somaliland"}},{"type":"Polygon","arcs":[[-11,710,-248,711,-255]],"id":"800","properties":{"name":"Uganda"}},{"type":"Polygon","arcs":[[-10,-461,-249,-711]],"id":"646","properties":{"name":"Rwanda"}},{"type":"Polygon","arcs":[[-627,712,713]],"id":"070","properties":{"name":"Bosnia and Herz."}},{"type":"Polygon","arcs":[[-612,-618,-625,714,715]],"id":"807","properties":{"name":"Macedonia"}},{"type":"Polygon","arcs":[[-588,-595,-613,-716,716,717,-713,-626]],"id":"688","properties":{"name":"Serbia"}},{"type":"Polygon","arcs":[[-623,718,-628,-714,-718,719]],"id":"499","properties":{"name":"Montenegro"}},{"type":"Polygon","arcs":[[-624,-720,-717,-715]],"properties":{"name":"Kosovo"}},{"type":"Polygon","arcs":[[720]],"id":"780","properties":{"name":"Trinidad and Tobago"}},{"type":"Polygon","arcs":[[-247,-446,-266,-705,-256,-712]],"id":"728","properties":{"name":"S. Sudan"}},{"type":"Polygon","arcs":[[721]],"id":"702","properties":{"name":"Singapore"}},{"type":"Polygon","arcs":[[722]],"id":"470","properties":{"name":"Malta"}}]},"admin1":{"type":"GeometryCollection","geometries":[{"type":"Polygon","arcs":[[723,724,725,726,-50,727,728,729,-47,730,731]],"properties":{"name":"Minnesota"}},{"type":"Polygon","arcs":[[732,733,734,735,736,737]],"properties":{"name":"Montana"}},{"type":"Polygon","arcs":[[-727,738,-735,739]],"properties":{"name":"North Dakota"}},{"type":"MultiPolygon","arcs":[[[740,741,742,743]],[[744]],[[745]],[[746]],[[747]]],"properties":{"name":"Hawaii"}},{"type":"Polygon","arcs":[[-738,748,749,750,751,752,753]],"properties":{"name":"Idaho"}},{"type":"Polygon","arcs":[[-753,754,755,756,757,-54,758]],"properties":{"name":"Washington"}},{"type":"Polygon","arcs":[[759,760,761,762,763,764,765]],"properties":{"name":"Arizona"}},{"type":"Polygon","arcs":[[-764,766,129,767,768,132,769,134,770,136,771,772]],"properties":{"name":"California"}},{"type":"Polygon","arcs":[[773,774,775,776,777,778]],"properties":{"name":"Colorado"}},{"type":"Polygon","arcs":[[-751,779,-765,-773,780]],"properties":{"name":"Nevada"}},{"type":"Polygon","arcs":[[-760,-776,781,782,125,783]],"properties":{"name":"New Mexico"}},{"type":"Polygon","arcs":[[-752,-781,-772,137,784,-755]],"properties":{"name":"Oregon"}},{"type":"Polygon","arcs":[[-750,785,-777,-766,-780]],"properties":{"name":"Utah"}},{"type":"Polygon","arcs":[[-737,786,787,-778,-786,-749]],"properties":{"name":"Wyoming"}},{"type":"Polygon","arcs":[[788,789,790,791,792,793]],"properties":{"name":"Arkansas"}},{"type":"Polygon","arcs":[[-725,794,795,796,797,798]],"properties":{"name":"Iowa"}},{"type":"Polygon","arcs":[[-774,799,800,801]],"properties":{"name":"Kansas"}},{"type":"Polygon","arcs":[[-794,802,-801,803,-797,804,805,806]],"properties":{"name":"Missouri"}},{"type":"Polygon","arcs":[[-779,-788,807,-798,-804,-800]],"properties":{"name":"Nebraska"}},{"type":"Polygon","arcs":[[-775,-802,-803,-793,808,-782]],"properties":{"name":"Oklahoma"}},{"type":"Polygon","arcs":[[-726,-799,-808,-787,-736,-739]],"properties":{"name":"South Dakota"}},{"type":"Polygon","arcs":[[-791,809,810,811,812,109,813,814]],"properties":{"name":"Louisiana"}},{"type":"Polygon","arcs":[[-783,-809,-792,-815,815,111,816,817,114,115,818,819,118,820,120,821,822,823,824]],"properties":{"name":"Texas"}},{"type":"Polygon","arcs":[[825,826,827,828]],"properties":{"name":"Connecticut"}},{"type":"Polygon","arcs":[[-826,829,830,831,832,833,834]],"properties":{"name":"Massachusetts"}},{"type":"Polygon","arcs":[[-832,835,836,837,838]],"properties":{"name":"New Hampshire"}},{"type":"Polygon","arcs":[[-827,-835,839]],"properties":{"name":"Rhode Island"}},{"type":"Polygon","arcs":[[-831,840,841,-836]],"properties":{"name":"Vermont"}},{"type":"Polygon","arcs":[[842,843,844,845,846]],"properties":{"name":"Alabama"}},{"type":"Polygon","arcs":[[-845,847,848,97,849,850,851,852,102,853,104]],"properties":{"name":"Florida"}},{"type":"Polygon","arcs":[[-844,854,855,856,857,95,-848]],"properties":{"name":"Georgia"}},{"type":"Polygon","arcs":[[-790,858,-847,859,860,-810]],"properties":{"name":"Mississippi"}},{"type":"Polygon","arcs":[[-857,861,862,863]],"properties":{"name":"South Carolina"}},{"type":"Polygon","arcs":[[-796,864,865,866,867,-805]],"properties":{"name":"Illinois"}},{"type":"Polygon","arcs":[[-867,868,869,870]],"properties":{"name":"Indiana"}},{"type":"Polygon","arcs":[[-806,-868,-871,871,872,873,874,875]],"properties":{"name":"Kentucky"}},{"type":"Polygon","arcs":[[-856,876,877,-878,878,879,92,-862]],"properties":{"name":"North Carolina"}},{"type":"Polygon","arcs":[[-870,880,881,882,883,884,885,-872]],"properties":{"name":"Ohio"}},{"type":"Polygon","arcs":[[-789,-807,-876,-875,874,886,-878,-877,-855,-843,-859]],"properties":{"name":"Tennessee"}},{"type":"MultiPolygon","arcs":[[[-874,887,888,889,890,891,90,892,-879,877,-887,-875]],[[893,894]]],"properties":{"name":"Virginia"}},{"type":"Polygon","arcs":[[-724,895,-865,-795]],"properties":{"name":"Wisconsin"}},{"type":"Polygon","arcs":[[-873,-886,896,897,-888]],"properties":{"name":"West Virginia"}},{"type":"Polygon","arcs":[[898,899,900,901,902]],"properties":{"name":"Delaware"}},{"type":"Polygon","arcs":[[-890,903]],"properties":{"name":"District of Columbia"}},{"type":"Polygon","arcs":[[-895,904,-891,-904,-889,-898,905,-899,906,907]],"properties":{"name":"Maryland"}},{"type":"Polygon","arcs":[[-901,908,909,910,911]],"properties":{"name":"New Jersey"}},{"type":"Polygon","arcs":[[-829,912,913,914,-910,915,916,917,918,-33,919,920,921,922,-841,-830]],"properties":{"name":"New York"}},{"type":"Polygon","arcs":[[-885,923,924,-916,-909,-900,-906,-897]],"properties":{"name":"Pennsylvania"}},{"type":"Polygon","arcs":[[-838,925,926,-28,927,928,-26,78,929,930]],"properties":{"name":"Maine"}},{"type":"Polygon","arcs":[[-732,931,932,933,934,935,936,937,938,-881,-869,-866,-896]],"properties":{"name":"Michigan"}},{"type":"MultiPolygon","arcs":[[[939,940,941,942]],[[943]],[[944]],[[-24,945,946,947,-20,948,949,-17,950,150,951,152,952,154,953,954,955,158,956,160,957,958,959,164,960,166,961,962,963,170,964,172,965,966,175,967,177,968,969,180,970,971,183,972,185,973,187,974,975,190,976,192,977,194,978,196,979]]],"properties":{"name":"Alaska"}},{"type":"MultiPolygon","arcs":[[[980]],[[981,982,983,984,985,986,987,988]]],"properties":{"name":"Quebec"}},{"type":"MultiPolygon","arcs":[[[989,-989]],[[990,991]]],"properties":{"name":"Newfoundland and Labrador"}},{"type":"MultiPolygon","arcs":[[[992]],[[993]],[[994,995,996,997,998,999]]],"properties":{"name":"British Columbia"}},{"type":"MultiPolygon","arcs":[[[1000,1001]],[[1002,1003]],[[1004,1005,1006]],[[1007]],[[1008]],[[1009]],[[1010]],[[1011]],[[1012]],[[1013]],[[1014]],[[1015]],[[1016]],[[1017]],[[1018]],[[1019]],[[1020]],[[1021]],[[1022]],[[1023]],[[1024]]],"properties":{"name":"Nunavut"}},{"type":"MultiPolygon","arcs":[[[1025]],[[1026,-1001]],[[-1004,1027]],[[1028,1029,-996,1030,1031,1032,-1006]],[[1033]],[[1034]],[[1035]]],"properties":{"name":"Northwest Territories"}},{"type":"Polygon","arcs":[[-983,1036,1037,1038,-929,1039]],"properties":{"name":"New Brunswick"}},{"type":"MultiPolygon","arcs":[[[1040]],[[1041,-1038]]],"properties":{"name":"Nova Scotia"}},{"type":"Polygon","arcs":[[1042,1043,1044,-1029]],"properties":{"name":"Saskatchewan"}},{"type":"Polygon","arcs":[[-997,-1030,-1045,1045]],"properties":{"name":"Alberta"}},{"type":"Polygon","arcs":[[1046]],"properties":{"name":"Prince Edward Island"}},{"type":"Polygon","arcs":[[-995,1047,1048,-1031]],"properties":{"name":"Yukon Territory"}},{"type":"Polygon","arcs":[[-1005,1049,1050,-728,1051,-1043]],"properties":{"name":"Manitoba"}},{"type":"MultiPolygon","arcs":[[[-987,1052,1053,-1051,1054]],[[1055]]],"properties":{"name":"Ontario"}}]}},"arcs":[[[7957,3220],[14,-5],[-4,-25],[-26,-1],[-2,21],[8,16],[10,-6]],[[0,3288],[2,-20],[-2,-3],[7985,-11],[-14,-10],[-3,17],[31,27],[-7999,0]],[[4753,4003],[84,-101],[2,-28],[32,-47]],[[4871,3827],[-11,-58],[2,-27],[14,-17],[-6,-41],[0,-37],[17,-76],[8,-11]],[[4895,3560],[-17,-27],[-25,-18],[-13,0],[-8,-14],[-21,-7],[-27,13],[-17,-4]],[[4767,3503],[-6,65],[-12,35],[-22,9]],[[4727,3612],[-44,42]],[[4683,3654],[-12,59],[-13,27],[-5,27],[2,25],[-4,43]],[[4651,3835],[10,3],[22,51],[-6,45]],[[4677,3934],[7,34],[-9,27]],[[4675,3995],[8,5],[70,3]],[[3807,5356],[0,-12]],[[3807,5344],[-1,-72],[-72,3],[0,-121],[-21,-5],[-5,-24],[4,-68],[-87,0],[-5,-16]],[[3620,5041],[1,20]],[[3621,5061],[51,4],[11,38],[8,66],[31,50],[10,60],[7,4],[7,36],[19,6],[18,-7],[21,13],[3,25]],[[1270,6365],[-46,47],[-16,20],[-40,20],[-12,42],[3,29],[-29,20],[-4,38],[-26,34],[-1,25]],[[1099,6640],[12,22],[0,30],[-38,30]],[[1073,6722],[-37,88]],[[1036,6810],[-35,41]],[[1001,6851],[-12,24]],[[989,6875],[-44,-41]],[[945,6834],[-35,51]],[[910,6885],[-43,15]],[[867,6900],[0,269],[0,176]],[[867,7345],[41,-12],[35,-22],[23,-5],[20,20],[27,15],[33,-6],[70,33],[15,-20],[37,28],[37,-42],[33,-4],[62,19],[34,-20],[52,-17],[31,-8],[22,3],[30,-24],[-31,-24],[40,-10],[60,6],[19,8],[23,-29],[24,24],[-22,21],[14,16],[45,7],[40,-37],[25,3],[39,-21],[67,6],[-2,30],[19,8],[67,-24],[10,47],[-50,49],[2,52],[26,34],[29,-7],[23,-21],[30,-54],[-20,-23],[71,-21],[27,-30],[-7,-35],[22,-32],[23,34],[16,41],[1,52],[65,-11],[30,-23],[1,-24],[-17,-25],[16,-25],[-3,-23],[-43,-33],[-61,-17],[-21,-40],[-7,-21],[-26,-32],[-31,-3],[-18,-20],[-1,-31],[-26,-5],[-27,-39],[-24,-53],[-9,-37],[-1,-55],[32,-8],[21,-80],[31,9],[41,-20],[38,-41],[52,-33],[60,-7],[-3,-41],[7,-47],[16,-53],[33,-45],[17,15],[12,49],[-12,74],[-15,25],[35,22],[25,34],[13,33],[-2,31],[-15,40],[-27,36],[26,49],[-10,43],[-7,74],[15,11],[61,-17],[19,12],[48,-43],[7,-19],[39,-3],[0,-40],[7,-60],[20,-7],[16,-28],[33,26],[36,74],[17,-42],[53,-117],[-9,-30],[50,-53],[35,-13],[15,-15],[8,-40],[27,-24],[1,-53],[-32,-34],[-36,-17],[-28,-39],[-38,-8],[-47,10],[-57,-3],[-18,-34],[-29,-21],[-32,-62],[76,66],[33,4],[20,-23],[-21,-32],[14,-86],[29,-24],[37,7],[22,53],[1,-34],[15,-17],[-28,-31],[-49,-28],[-22,-20],[-25,-34],[-17,4],[-1,40],[39,39],[-60,-7]],[[2508,6183],[-15,26],[0,65]],[[2493,6274],[-10,14],[-22,4]],[[2461,6292],[-17,-36]],[[2444,6256],[-15,-58]],[[2429,6198],[-18,-22],[-75,0]],[[2336,6176],[-36,-46]],[[2300,6130],[-7,-19]],[[2293,6111],[-43,0]],[[2250,6111],[-10,-7]],[[2240,6104],[6,-29]],[[2246,6075],[-30,-23]],[[2216,6052],[-22,-8]],[[2194,6044],[-26,-25]],[[2168,6019],[-15,19]],[[2153,6038],[21,71]],[[2174,6109],[-9,84]],[[2165,6193],[-23,22]],[[2142,6215],[-26,39]],[[2116,6254],[-2,12]],[[2114,6266],[-78,66]],[[2036,6332],[-27,-14]],[[2009,6318],[-28,13],[-18,-6],[-21,14]],[[1942,6339],[-38,11]],[[1904,6350],[-19,15]],[[1885,6365],[-46,0]],[[1839,6365],[-76,0],[-75,0],[-67,0],[-67,0]],[[1554,6365],[-65,0],[-68,0]],[[1421,6365],[-88,0]],[[1333,6365],[-63,0]],[[2133,7001],[17,22],[30,-9],[-26,-26],[-21,13]],[[2227,7491],[-25,25],[12,20],[51,-5],[40,-39],[-78,-1]],[[1919,7594],[-12,-19],[-59,16],[44,34],[27,-31]],[[1850,7773],[20,-34],[-51,2],[31,32]],[[2041,7566],[-95,21],[-10,50],[-23,20],[-71,21],[8,19],[70,-18],[44,0],[14,-33],[40,-22],[62,-6],[36,10],[81,1],[29,-38],[-47,-23],[-29,6],[-109,-8]],[[1527,7744],[24,-22],[-41,-13],[-33,15],[50,20]],[[2752,6420],[7,-27],[20,-13],[10,12],[22,-15],[19,-81],[-10,-42]],[[2820,6254],[-24,8],[4,38],[-29,-11],[-21,12],[-67,-2],[0,44],[19,28],[23,76],[14,26],[25,2],[-12,-55]],[[2136,7127],[24,-16],[25,-15],[35,-34],[-20,-15],[-35,11],[-12,21],[-54,-49],[-18,46],[3,37],[7,44],[45,-30]],[[2249,7470],[21,18],[80,-46],[44,-10],[23,-30],[54,-19],[40,-63],[-40,-22],[52,-31],[35,-10],[32,-44],[35,-3],[-7,-33],[-39,-55],[-27,20],[-35,46],[-29,-6],[-3,-27],[24,-28],[30,-22],[9,-12],[15,-47],[-8,-34],[-28,13],[-56,38],[55,-70],[3,-16],[-60,19],[-48,27],[-27,23],[8,13],[-65,34],[-64,-8],[-19,17],[15,35],[87,6],[0,41],[29,46],[-14,37],[-34,23],[-46,16],[15,12],[-24,29],[-49,5],[-40,-6],[-81,11],[-83,21],[-18,16],[23,22],[-32,0],[-7,48],[17,42],[23,20],[57,12],[-16,-30],[94,28],[39,-49],[-4,-31],[44,14]],[[1900,7554],[88,-13],[-33,-42],[-26,-10],[-24,-35],[-25,2],[-14,41],[12,44],[22,13]],[[1270,7648],[83,66],[65,6],[-3,-37],[-80,-38],[-65,3]],[[1051,6604],[21,3],[-7,-53],[-22,20],[8,30]],[[1655,7798],[104,-24],[-10,-36],[-92,42],[-2,18]],[[1255,6342],[-11,-6],[-36,21],[-31,47],[-23,8],[-7,37],[58,-22],[19,-39],[22,-20],[9,-26]],[[1299,7569],[88,-13],[46,-33],[-83,-46],[-27,-33],[0,-20],[-59,-23],[-11,21],[-52,25],[45,85],[-22,29],[75,8]],[[1604,7635],[43,6],[-10,-46],[-75,-7],[-56,-21],[-122,38],[51,60],[63,-16],[39,-28],[39,-4],[-32,45],[44,12],[16,-39]],[[1633,7504],[24,-19],[14,-46],[7,-34],[38,-23],[40,-22],[-3,-21],[-36,-4],[14,-18],[-7,-18],[-41,8],[-38,13],[-26,-3],[-41,-16],[-96,-12],[-12,22],[-31,13],[-19,-5],[-28,37],[49,14],[18,17],[-79,-3],[-12,17],[17,19],[-39,12],[35,54],[59,29],[61,-17],[31,-24],[25,24],[76,6]],[[1768,7486],[-25,31],[27,23],[72,-18],[-21,-22],[33,-21],[-4,-42],[-36,-19],[-21,4],[-16,19],[-55,36],[46,9]],[[1811,7676],[17,-22],[-10,-59],[-60,2],[-14,60],[67,19]],[[1866,7860],[29,28],[153,-42],[45,-46],[-72,-50],[-85,3],[-24,36],[-47,28],[1,43]],[[1964,7921],[103,18],[170,40],[144,5],[204,-16],[39,-25],[-206,-121],[-112,-37],[18,-24],[-55,-29],[-39,-43],[39,-10],[-59,-29],[-59,13],[-65,-7],[-75,8],[-3,23],[41,11],[-11,34],[25,40],[46,28],[-56,56],[-39,16],[-50,49]],[[2328,7237],[-39,-16],[4,50],[38,-7],[-3,-27]],[[1861,7334],[13,-18],[-14,-16],[-48,9],[-30,21],[35,35],[44,-31]],[[2508,6183],[4,-16],[-24,-23]],[[2488,6144],[-46,-30]],[[2442,6114],[-16,-39]],[[2426,6075],[4,-66]],[[2430,6009],[-27,-7]],[[2403,6002],[-2,-18]],[[2401,5984],[-31,-14],[-14,-1]],[[2356,5969],[-5,-43]],[[2351,5926],[-20,-44]],[[2331,5882],[1,-18]],[[2332,5864],[-15,-22]],[[2317,5842],[-13,-1]],[[2304,5841],[1,-45],[6,-3]],[[2311,5793],[6,-64]],[[2317,5729],[-14,-35],[-23,-14],[-15,-28],[-11,-3]],[[2254,5649],[-14,-33]],[[2240,5616],[-25,-30],[-23,-51]],[[2192,5535],[-3,-34]],[[2189,5501],[11,-73]],[[2200,5428],[10,-33],[0,-21],[11,-55]],[[2221,5319],[-2,-50]],[[2219,5269],[-5,-29],[-18,0]],[[2196,5240],[-12,32]],[[2184,5272],[-26,95],[5,31]],[[2163,5398],[-6,26],[-17,40],[-9,7],[-23,-21]],[[2108,5450],[-28,36]],[[2080,5486],[-25,-6]],[[2055,5480],[-37,2]],[[2018,5482],[-5,-20]],[[2013,5462],[0,-35]],[[2013,5427],[-33,0]],[[1980,5427],[-16,25],[-20,-6],[-16,11]],[[1928,5457],[-32,-15]],[[1896,5442],[-21,-35],[-22,-20]],[[1853,5387],[-17,-44]],[[1836,5343],[1,-55]],[[1837,5288],[4,-16]],[[1841,5272],[-9,-2]],[[1832,5270],[-33,25]],[[1799,5295],[-11,56]],[[1788,5351],[-13,26]],[[1775,5377],[-19,61]],[[1756,5438],[-15,18]],[[1741,5456],[-19,0],[-14,-38]],[[1708,5418],[-29,29]],[[1679,5447],[-13,50]],[[1666,5497],[-33,53]],[[1633,5550],[-39,0],[0,-20]],[[1594,5530],[-61,0]],[[1533,5530],[-85,56]],[[1448,5586],[2,10],[-53,-9]],[[1397,5587],[-4,24]],[[1393,5611],[-27,46]],[[1366,5657],[-20,15]],[[1346,5672],[-21,5]],[[1325,5677],[-8,34]],[[1317,5711],[-22,47],[-18,66]],[[1277,5824],[-27,66]],[[1250,5890],[-3,39],[-12,26],[5,39],[0,40]],[[1240,6034],[-8,37],[9,44]],[[1241,6115],[5,86],[-4,63],[-13,63]],[[1229,6327],[35,-7]],[[1264,6320],[14,6],[-8,39]],[[547,4998],[12,-30]],[[559,4968],[-24,-19]],[[535,4949],[-3,31]],[[532,4980],[15,18]],[[595,6789],[24,-17]],[[619,6772],[-41,-41]],[[578,6731],[-15,34]],[[563,6765],[32,24]],[[1099,6640],[-32,33]],[[1067,6673],[-6,41],[-29,38],[-12,45]],[[1020,6797],[-56,4]],[[964,6801],[-26,14],[-46,49]],[[892,6864],[-60,25]],[[832,6889],[-31,-4],[-44,22],[-26,20],[-25,-10],[5,-33]],[[711,6884],[-38,-12]],[[673,6872],[-45,-26]],[[628,6846],[-19,42]],[[609,6888],[-32,-33],[17,-23],[-21,-34]],[[573,6798],[-47,-34]],[[526,6764],[-5,-21],[-35,-25],[-7,-22],[-26,-20],[-15,3]],[[438,6679],[-62,-45]],[[376,6634],[-41,-5]],[[335,6629],[46,36]],[[381,6665],[23,26],[28,6],[11,19]],[[443,6716],[52,55]],[[495,6771],[4,35]],[[499,6806],[-34,5]],[[465,6811],[-28,31],[-36,-19]],[[401,6823],[2,45]],[[403,6868],[-15,17],[-28,-9]],[[360,6876],[-34,33]],[[326,6909],[-1,27],[-17,20]],[[308,6956],[35,78]],[[343,7034],[33,-4]],[[376,7030],[18,23]],[[394,7053],[33,11]],[[427,7064],[-4,21]],[[423,7085],[-33,16]],[[390,7101],[-56,-5]],[[334,7096],[-32,11],[-10,19],[-28,28]],[[264,7154],[81,42]],[[345,7196],[15,-23]],[[360,7173],[47,2],[-18,29],[-27,18]],[[362,7222],[-37,44]],[[325,7266],[-31,15]],[[294,7281],[13,24],[39,2]],[[346,7307],[28,22]],[[374,7329],[28,45]],[[402,7374],[22,6],[42,20]],[[466,7400],[20,-3]],[[486,7397],[34,25],[60,-22]],[[580,7400],[37,-2],[-1,-11]],[[616,7387],[57,-4]],[[673,7383],[47,-15]],[[720,7368],[59,-10]],[[779,7358],[30,8]],[[809,7366],[58,-21]],[[5941,6375],[-17,-31],[-19,-4],[-1,-48],[-12,-21],[-44,15],[-16,-84],[-12,-11],[-44,-19],[20,-82],[-15,-12],[2,-27]],[[5783,6051],[-25,24],[-70,6],[-8,-5],[-32,20],[-12,-10],[-4,-28],[-36,16],[-15,-6],[-5,-21]],[[5576,6047],[-42,-42],[-10,-34],[-14,22],[-28,2],[-5,39],[-11,0],[2,47],[-26,35],[-65,-11],[-21,43],[-57,56],[-57,-28],[1,-174]],[[5243,6002],[-11,-3],[-16,37],[-15,14],[-25,-10],[-10,-16]],[[5166,6024],[0,48],[-26,16],[-10,42],[9,23],[1,35],[19,7],[19,-7],[4,47],[-4,29],[-22,-3],[-19,12],[-46,-31]],[[5091,6242],[-24,64],[-16,-1],[-19,32],[13,35],[-7,10],[18,52],[23,-27],[3,34],[45,52],[35,1],[75,-52],[24,20],[35,1],[29,-25],[6,14],[31,-2],[6,23],[-36,32],[38,48],[-16,33],[11,16],[83,16],[11,12],[55,18],[20,19],[40,-10],[7,-49],[23,12],[29,-17],[-2,-25],[21,2],[48,30],[28,-36],[50,-121],[12,25],[30,-27],[32,12],[23,-36],[25,-29],[29,6],[12,-29]],[[5576,6047],[-12,-35],[17,-18],[15,12],[27,-25],[-29,-34],[-17,4]],[[5577,5951],[-12,12],[5,22],[-30,-11],[-18,-56],[-18,2],[-6,-21],[16,-11],[5,-35],[-12,-48]],[[5507,5805],[-29,10]],[[5478,5815],[0,29],[-29,20],[-24,23],[-40,55],[-10,49],[-8,9],[-24,-3],[-8,10],[-3,38],[-30,25],[-19,-28],[-18,-16],[3,-24],[-25,0]],[[7132,3925],[39,-32],[41,-27],[28,-48],[3,-28],[37,-29],[6,-26],[-21,-5],[5,-31],[20,-31],[14,-50],[23,-37],[23,-20],[-17,-17],[-5,13],[-42,12],[-30,56],[-11,42],[-29,20],[-33,-29],[3,-35],[-17,-16],[-13,8],[-23,2]],[[7133,3617],[0,154],[-1,154]],[[7391,3875],[9,-15],[2,-25],[-7,-12],[-9,46],[5,6]],[[7361,3772],[-23,-23],[-12,1],[-31,26],[2,15],[20,-7],[33,6],[19,33],[-2,28],[17,-7],[0,-26],[-7,-29],[-16,-17]],[[7438,3796],[28,-57],[-9,-18],[-20,48],[1,27]],[[7133,3617],[-20,39],[-22,9],[-6,-13],[-28,-2],[10,39],[14,13],[-6,51],[-11,40],[-43,40],[-18,4],[-34,44],[-6,-23],[-9,-4],[-5,38],[-17,23],[38,28],[-32,1],[-9,28],[-20,8],[-9,24],[30,11],[11,16],[36,-20],[3,-17],[6,-77],[23,-28],[19,50],[25,29],[20,0],[36,-34],[23,-9]],[[6776,3628],[3,-24]],[[6779,3604],[-15,-35],[-19,-11],[0,22],[9,29],[22,19]],[[6982,3722],[-3,36],[14,-4],[-11,-32]],[[6619,4244],[-13,-43],[16,-45],[-3,-21],[25,-44],[-27,-6],[-7,-32],[1,-43],[-22,-32],[0,-47],[-12,-56],[-25,-21],[-9,29],[-16,3],[-11,15],[-26,-17],[-9,23],[-32,2],[-4,64],[-11,13],[-11,40],[-3,42],[3,44],[13,31]],[[6436,4143],[4,-32],[15,-26],[14,9],[15,-3],[13,24],[10,4],[21,-13],[18,10],[12,66],[8,16],[8,54],[25,0],[20,-8]],[[6874,3916],[24,-14],[-10,-17],[-47,3],[6,26],[27,2]],[[6819,3869],[-16,9],[-4,20],[22,2],[-2,-31]],[[6842,4151],[2,-26],[13,-4],[1,-61],[-12,5],[-9,-29],[-7,60],[5,38],[7,17]],[[6731,4090],[25,2],[22,34],[4,-11],[-18,-47],[-16,-9],[-22,10],[-37,-3],[-19,-7],[-3,-35],[20,-42],[12,21],[30,1],[-10,-28],[-20,-18],[21,-60],[-4,-17],[20,-54],[0,-31],[-12,-14],[-8,16],[10,39],[-22,-18],[-2,31],[-16,28],[1,46],[-14,-14],[2,-123],[-14,-7],[-9,14],[6,43],[-3,46],[-10,0],[-7,33],[10,31],[3,37],[16,91],[19,35],[17,-14],[28,-6]],[[6672,3563],[-29,33],[21,10],[19,-29],[-11,-14]],[[6696,3645],[14,3],[20,17],[-3,-26],[-33,-13],[-30,6],[0,17],[18,10],[14,-14]],[[6627,3653],[14,4],[5,-20],[-41,-16],[-4,27],[26,5]],[[6410,3745],[3,-17],[43,-5],[5,20],[41,-23],[8,-31],[33,-9],[27,-28],[-25,-18],[-24,19],[-44,3],[-20,8],[-26,18],[-26,-1],[-40,19],[-4,21],[-20,3],[15,45],[27,-2],[27,-22]],[[6319,3997],[3,-33],[8,-26],[16,-5],[11,-30],[-5,-58],[-1,-74],[-25,0],[-19,39],[-28,39],[-26,67],[-28,101],[-20,40],[-15,77],[-20,30],[-11,41],[-17,26],[-23,52],[-2,24],[49,-11],[19,-46],[30,-52],[21,-51],[22,0],[19,-33],[13,-39],[17,-22],[-9,-38],[21,-18]],[[2475,1559],[19,-57],[29,-29],[31,-11],[-10,-24],[-21,-2],[-11,16]],[[2512,1452],[-37,2],[0,105]],[[2719,2619],[-11,-86],[0,-47],[-7,-41]],[[2701,2445],[-1,-25],[28,-40],[-3,-33],[14,-21],[-1,-23],[-22,-60],[-33,-26],[-44,-10],[-25,5],[5,-28],[-4,-35],[4,-24],[-14,-17],[-22,-6],[-22,17],[-8,-13],[3,-47],[33,-24],[-20,-14],[-18,-30],[-8,-72],[-21,-1],[-18,-24],[-6,-35],[22,-35],[21,-9],[-8,-43],[-26,-27],[-14,-55],[-21,-19],[-9,-22],[13,-74]],[[2476,1575],[-21,8],[-53,6],[-10,27],[1,36],[-23,14],[-2,50],[17,21],[7,30],[-2,24],[12,40],[8,63],[-3,28],[10,8],[-13,28],[8,20],[-10,18],[-6,54],[9,10],[-3,57],[11,91],[13,17],[-7,46],[0,44],[17,31],[-1,39],[13,46],[0,44],[-5,8],[-11,82],[14,49],[-2,45],[8,43],[14,45],[16,29],[-3,113],[24,23],[8,49],[-3,12]],[[2508,2973],[19,43],[29,-12],[13,-34],[9,38],[25,-2],[4,-10]],[[2607,2996],[41,-77],[18,-7],[27,-35],[23,-19],[3,-21],[-22,-71],[47,-21],[18,8],[20,36],[4,42]],[[2786,2831],[11,9],[11,-27],[-1,-38],[-33,-45],[-25,-46],[-30,-65]],[[2512,1452],[-27,-34],[-24,6],[-39,21],[-51,52],[19,11],[30,-17],[18,54],[21,20],[16,-6]],[[2453,3217],[11,-32],[3,-34],[12,-20],[-7,-46],[12,-53],[8,-65],[16,6]],[[2476,1575],[-20,0],[-31,-28],[-3,-44],[-35,14],[-25,33],[-28,27],[-7,30],[7,28],[-12,31],[-3,81],[10,45],[23,37],[-33,13],[21,42],[7,79],[25,-17],[12,98],[-15,13],[-7,-59],[-14,6],[14,155],[11,33],[-7,46],[-2,53],[10,2],[13,76],[16,76],[9,70],[-5,71],[7,39],[-3,58],[13,58],[4,92],[7,98],[7,106],[-1,77],[-5,67]],[[2436,3181],[11,12],[6,24]],[[4683,3654],[-9,5],[-36,-14],[-6,-30],[5,-21],[-7,-103],[21,-27],[8,-43],[-17,1],[-17,46],[-17,6],[-5,25],[-14,-15],[-17,7],[-8,21],[-24,4],[-9,16]],[[4531,3532],[-10,2],[-29,-10],[1,56],[-7,18],[1,57],[-5,48],[-27,0],[-24,7],[-9,-40],[-12,7],[-22,-10],[-14,40],[-12,63],[-65,1],[-24,-11]],[[4273,3760],[-3,14]],[[4270,3774],[7,26],[11,22]],[[4288,3822],[14,13],[12,0],[10,-22],[31,68],[-1,39],[10,46],[25,47],[7,49],[1,69],[11,54],[1,29]],[[4409,4214],[2,33],[9,24],[12,15],[33,-33],[32,-14],[7,28],[13,-1],[25,24],[9,-10],[18,17],[31,-6],[8,5]],[[4608,4296],[13,-39],[10,-6],[29,15],[5,-20],[20,-32]],[[4685,4214],[-2,-55],[-6,-36],[-14,-47],[-1,-38],[-5,-18],[0,-35]],[[4657,3985],[-7,-13],[-6,-58]],[[4644,3914],[6,-22],[1,-57]],[[4924,3969],[-14,39],[0,172],[20,54]],[[4930,4234],[6,14],[14,1],[20,34],[29,2],[62,142]],[[5061,4427],[26,68],[0,93]],[[5087,4588],[29,12],[19,17],[-1,-66],[-11,-68],[-25,-113],[-19,-69],[-19,-53],[-26,-65],[-22,-38],[-33,-47],[-21,-36],[-24,-57],[-10,-36]],[[4753,4003],[0,50],[17,51],[8,34],[-12,78],[-11,33]],[[4755,4249],[29,60]],[[4784,4309],[11,-8],[0,-27],[8,-15],[15,0],[29,-41],[31,-8],[7,20],[20,20],[9,-16],[16,0]],[[4924,3969],[-30,-42],[-3,-34],[-11,-50],[-9,-16]],[[4545,4437],[-17,21],[-7,14],[2,53],[-13,30],[-2,20]],[[4508,4575],[-8,25],[-1,28],[-10,33],[3,39],[9,55],[10,35],[19,-4],[-1,188]],[[4529,4974],[0,20],[26,0],[0,95]],[[4555,5089],[89,0],[86,0],[89,0]],[[4819,5089],[7,-47],[-5,-8],[3,-49],[8,-57],[21,-29]],[[4853,4899],[-11,-27],[-17,-7],[-7,-15],[-2,-31],[-9,-70],[2,-19]],[[4809,4730],[-4,-40],[-9,-47],[-13,-23],[-12,-56],[-10,-13],[-7,-50],[0,-42]],[[4754,4459],[0,37],[-3,1],[0,23],[-2,16],[-12,19],[-2,34],[2,35],[-10,3],[-9,-26],[1,-29],[-23,-60],[-11,-5],[-19,28],[-23,-42],[-22,0],[-3,9],[-30,-2],[-15,41],[-16,-7],[-12,-64],[-8,-9],[-7,-5],[15,-19]],[[4508,4575],[-15,-8],[-11,-19],[-16,-52],[-21,-22],[-21,3],[-4,-21],[-21,-35],[-28,-18],[-32,-4]],[[4339,4399],[3,13],[-10,52],[-9,8],[-13,28],[4,22],[29,-2],[-12,43],[-1,63],[-8,30]],[[4322,4656],[2,23],[-14,1],[0,30],[-10,18],[10,62],[28,44],[2,62],[8,96],[5,20],[-18,44],[-5,73]],[[4330,5129],[22,26],[89,-90],[88,-91]],[[2406,4980],[0,-78]],[[2406,4902],[-15,8],[-24,0],[-10,-9],[-10,30],[37,-11],[-2,50],[-9,20],[33,-10]],[[2406,4980],[20,8],[23,-27],[12,0],[20,-33],[-8,-19],[-10,10],[-18,1],[-12,-12],[-11,5],[-9,-33],[-7,22]],[[6083,7880],[48,10],[95,-69],[-6,-43],[-48,-6],[-99,32],[-48,43],[58,33]],[[6284,7797],[57,-27],[-7,-19],[-125,-18],[41,62],[34,2]],[[7084,7649],[59,-3],[80,-25],[-17,-35],[-82,2],[-37,-12],[-44,31],[12,33],[29,9]],[[7293,7611],[56,-12],[-26,-19],[-36,4],[6,27]],[[7107,7518],[49,23],[1,-31],[-50,8]],[[4505,6617],[-41,0],[-28,5]],[[4436,6622],[5,21],[31,15]],[[4472,6658],[33,-16],[0,-25]],[[5188,7536],[54,41],[-6,22],[123,55],[74,9],[81,23],[0,-33],[-146,-46],[-69,-45],[-68,-92],[4,-39],[43,-39],[-13,-4],[-73,6],[-6,21],[-40,13],[-3,26],[23,10],[-1,26],[44,40],[-21,6]],[[7175,6588],[8,-46],[-1,-46],[9,-48],[23,-84],[-33,16],[-14,-69],[22,-48],[-36,-1],[2,46],[-2,51],[5,35],[1,64],[-13,46],[2,65],[27,19]],[[6905,6045],[-3,8]],[[6902,6053],[11,25],[4,56],[-6,41],[19,16],[27,-8],[15,46],[7,52],[21,60],[-37,-14],[-19,-19],[-34,0],[-9,44],[-26,34],[-39,15],[-8,47],[-30,97],[-20,17],[-33,14],[-57,-10],[-18,-23],[12,-11],[0,-27],[-12,-15],[-20,-50],[0,-21],[-31,-30],[-27,18]],[[6592,6407],[-26,-4],[-25,21],[-33,-33],[-50,-20],[-48,8],[-35,47],[-23,6],[-49,-15],[-31,20],[-5,35],[-46,18],[-25,19],[-23,-49],[9,-27],[-21,-33],[-55,13],[-15,22],[-23,1],[-19,15],[-34,-23],[-42,-40],[-24,-9]],[[5949,6379],[-8,-4]],[[5091,6242],[-11,-28],[-21,-7],[-22,-49],[20,-45],[-2,-32],[24,-56]],[[5079,6025],[-17,-31],[-10,3],[-21,31]],[[5031,6028],[-21,30],[-38,11],[-30,23],[-55,10]],[[4887,6102],[-28,40],[-25,18],[-20,28],[17,7],[18,40],[-12,19],[12,22]],[[4849,6276],[12,34],[21,3],[-1,42],[9,39],[-46,15],[-14,22],[-17,-8],[-28,17],[-7,30],[-18,2],[4,24],[-15,27],[-43,-11]],[[4706,6512],[-7,50],[18,-1],[3,23],[-15,8],[-22,48],[3,35],[-60,29]],[[4626,6704],[-9,51],[-11,11]],[[4606,6766],[9,15],[-6,44],[12,36]],[[4621,6861],[26,26],[-24,22]],[[4623,6909],[68,88],[9,24],[-33,32],[9,31],[-20,35],[15,41],[-26,54],[21,35],[-34,32],[3,33]],[[4635,7314],[18,4],[38,19]],[[4691,7337],[22,17],[37,-29],[61,-11],[84,-53],[17,-23],[1,-31],[-24,-25],[-37,-13],[-99,36],[20,-41],[1,-21],[2,-49],[46,-26],[-11,43],[15,18],[53,-30],[19,12],[-15,34],[52,47],[41,-20],[13,33],[-19,28],[11,28],[-16,30],[62,-15],[13,-27],[-28,-6],[0,-26],[17,-16],[35,10],[5,30],[124,63],[-5,-31],[27,-5],[16,17],[42,1],[33,19],[25,-28],[26,31],[-24,28],[12,15],[65,-14],[31,-15],[81,-54],[15,25],[-23,25],[-1,10],[-26,5],[7,22],[-12,37],[-1,15],[41,43],[15,43],[17,9],[58,-12],[5,-27],[-21,-38],[14,-15],[7,-33],[-5,-65],[24,-29],[-9,-32],[-44,-67],[26,-7],[33,29],[25,46],[-13,27],[11,32],[-25,3],[-5,27],[18,47],[-29,39],[57,40],[88,1],[22,12],[-3,51],[39,9],[102,4],[-18,25],[25,31],[69,25],[59,6],[134,32],[40,-1],[28,41],[52,19],[85,-46],[65,0],[67,-41],[-5,-25],[-100,-54],[102,-28],[35,8],[72,-8],[5,-22],[93,-7],[1,36],[83,-8],[36,-25],[10,-30],[-13,-20],[28,-37],[35,-19],[21,49],[36,-21],[38,13],[43,-15],[52,7],[-16,44],[30,20],[200,-31],[19,-28],[58,-36],[90,9],[44,-8],[19,-19],[-3,-35],[28,-13],[69,11],[42,-10],[42,6],[38,-42],[28,15],[-18,30],[10,21],[71,-13],[46,3],[64,-23],[-7968,-21],[121,-90],[60,-7],[43,-44],[-22,-21],[-36,-4],[-1,-47],[-29,-8],[-47,30],[-5,21],[-48,1],[-36,-19],[7999,0],[-29,-21],[-9,-22],[24,-52],[-3,-32],[-42,11],[-62,-36],[-19,-5],[-67,-63],[-8,-21],[-32,33],[-58,-38],[-10,18],[-21,-20],[-30,6],[-7,-31],[-27,-46],[1,-19],[26,-10],[-3,-69],[-21,-2],[-10,-39],[10,-21],[-39,-24],[-8,-54],[-33,-11],[-7,-49],[-32,-44],[-8,33],[-9,69],[-13,105],[11,66],[19,28],[1,22],[34,10],[78,109],[40,37],[18,67],[-27,-4],[-13,-39],[-57,-52],[-18,58],[-57,-16],[-56,-79],[19,-29],[-84,-17],[1,34],[-34,7],[-28,-23],[-68,8],[-73,-14],[-72,-92],[-85,-112],[35,-6],[11,-29],[21,-11],[15,24],[24,-3],[32,-52],[1,-41],[-17,-47],[-2,-56],[-10,-76],[-34,-68],[-7,-33],[-75,-138],[-29,-27],[-14,-1],[-14,23],[-30,-35],[-4,-15]],[[0,7430],[54,-12],[-25,-17],[-29,-3],[7975,-3],[-4,15],[-7971,20]],[[4742,6222],[6,12],[29,-23]],[[4777,6211],[30,-29],[-25,-9],[-30,-27],[-12,10],[5,22],[-24,14],[21,30]],[[2245,5315],[25,2],[0,-12],[-24,-7],[-1,17]],[[2262,5240],[7,-2],[8,-39],[-20,11],[5,30]],[[2640,1596],[26,29],[19,-12],[14,19],[17,-21],[-6,-17],[-30,-14],[-10,16],[-19,-21],[-11,21]],[[4336,7816],[41,18],[101,-52],[-56,-19],[-42,-83],[-27,-2],[-48,29],[-56,71],[-17,37],[60,17],[44,-16]],[[4635,7314],[9,33],[-28,19],[-35,-16],[-11,-35],[-21,-21],[-91,22]],[[4458,7316],[-17,-33],[-42,8],[-27,-27],[-37,-86],[-34,-66],[0,-35],[-22,1],[-14,-45],[1,-62],[14,-24],[-7,-56],[-28,-60]],[[4245,6831],[-15,29],[-44,-54],[-30,-11],[-31,24],[-8,51],[-7,109],[21,30],[59,40],[43,49],[41,65],[54,92],[37,35],[61,60],[49,20],[36,-2],[34,39],[40,-2],[40,9],[70,-34],[-29,-13],[25,-30]],[[4609,7834],[-33,-26],[-65,-5],[-65,8],[-61,35],[124,16],[100,-28]],[[4549,7730],[-50,-20],[-39,11],[2,28],[46,9],[41,-28]],[[2960,7955],[75,29],[106,15],[256,-1],[139,-38],[-41,-18],[-114,-10],[160,-29],[108,19],[79,-30],[-122,-55],[-44,-65],[0,-52],[27,-31],[-71,-17],[41,-25],[5,-40],[-24,-5],[29,-41],[-31,-39],[-62,-7],[28,-32],[-25,-26],[29,-29],[8,-38],[-39,-9],[-37,13],[-26,-25],[89,-5],[-60,-41],[-60,-37],[-113,-35],[-30,-50],[-48,-33],[-77,-24],[-19,-30],[0,-33],[-12,-31],[-36,-38],[9,-37],[-21,-85],[-32,-3],[-32,39],[-45,0],[-21,26],[-15,46],[-39,59],[-11,31],[-3,42],[-31,44],[8,35],[-15,16],[22,56],[34,17],[9,20],[4,37],[-57,-31],[-28,16],[-1,32],[9,25],[20,1],[46,-13],[-39,30],[-19,16],[-41,6],[25,44],[-86,138],[-60,28],[-161,-2],[-64,45],[58,15],[-100,34],[3,18],[165,46],[9,17],[-60,17],[96,52],[23,26],[121,20],[69,0],[163,20]],[[5531,1749],[36,-21],[-6,-30],[-34,-3],[4,54]],[[6776,3628],[3,11],[34,12],[8,-13],[-42,-34]],[[4363,2697],[10,23],[13,-33],[24,-12],[12,3],[20,24],[0,175]],[[4442,2877],[6,-7],[13,-45],[3,-45],[16,4],[21,36],[6,22],[10,11],[20,-19],[19,-2],[14,11],[6,37],[12,4],[14,49],[20,36],[31,35]],[[4653,3004],[20,-9],[20,1]],[[4693,2996],[16,-100],[-2,-70]],[[4707,2826],[-18,5],[-8,-47],[14,-26],[13,5],[4,21]],[[4712,2784],[17,0]],[[4729,2784],[-8,-74],[-6,-21],[-19,-31],[-29,-82],[-40,-78],[-17,-21],[-38,-34],[-13,7],[-11,-9],[-24,9],[-23,-3],[-42,-26],[-24,-19],[-17,17],[-13,28],[0,27],[-7,32],[7,9],[-1,36],[-14,44],[-27,102]],[[4643,2679],[-9,15],[-23,-29],[-12,-30],[17,-36],[25,27],[10,39],[-8,14]],[[1841,5272],[-12,-76],[-4,-86],[11,-49],[4,-37],[15,-35],[14,-50],[23,-13],[9,-20],[67,35],[15,19],[11,81],[38,24],[33,2],[5,-33],[-12,-28],[-1,-37],[-9,-57],[-10,11]],[[2038,4923],[-19,-33]],[[2019,4890],[-41,1],[-1,-27],[13,-40],[-1,-16],[-28,0],[-11,-39],[0,-33]],[[1950,4736],[-25,51],[-29,27],[-13,-3],[-29,-23],[-32,22],[-21,22],[-17,6],[-25,22],[-24,35],[-35,18],[-9,22],[-24,27],[-17,53],[10,30],[-16,80],[-20,47],[-22,37],[-11,30],[-23,30],[3,30],[-24,34],[-6,33],[-12,3],[-23,48],[-21,87],[0,18],[-16,19],[-20,11],[-3,-19],[6,-59],[38,-82],[4,-30],[25,-53],[8,-44],[13,-43],[1,-25],[11,-1],[16,-43],[-13,-26],[-6,29],[-15,27],[-27,35],[-3,60],[-26,36],[-22,18],[-2,28],[9,39],[-17,34],[-13,13],[-27,98],[-9,43]],[[2719,2619],[15,5],[22,-36],[8,1],[40,-56],[13,-32],[-10,-23],[7,-27]],[[2814,2451],[-10,-29],[-25,-27],[-17,10],[-12,-5],[-20,20],[-15,-1],[-14,26]],[[2786,2831],[7,55],[0,26],[-8,9],[-16,-6],[-5,62],[-19,27],[-9,-9],[-24,9],[2,64],[-7,26]],[[2707,3094],[7,10],[-2,27],[10,58],[-5,29],[-12,13],[-3,19],[3,27],[-42,2],[-9,55],[6,22],[-5,41],[-13,14],[-14,-1],[-24,23],[-9,18],[-25,8],[-24,42],[2,86],[-29,-8],[-32,-37],[-4,-15],[-28,3]],[[2455,3530],[-23,-2],[1,71],[-18,-27],[-19,1],[-31,77],[-9,42],[5,29],[14,14],[-2,25],[7,39],[25,32],[21,16],[21,-2]],[[2447,3845],[10,130],[-3,47],[-10,17],[0,35],[4,55],[43,-1],[8,17],[15,-38]],[[2514,4107],[12,-25],[17,4],[4,14],[26,19],[-4,109],[11,10],[18,-12],[6,12],[41,25],[5,31]],[[2650,4294],[12,2],[2,-31],[13,-30],[-7,-16],[-3,-40],[7,-46],[14,-22],[30,17],[8,12],[17,-2]],[[2743,4138],[12,-4],[1,33],[19,1],[13,-10]],[[2788,4158],[10,-10],[25,1],[9,18],[7,35],[13,43]],[[2852,4245],[7,2],[18,-109],[12,-8],[1,-32],[-17,-39],[7,-15],[39,-7],[1,-47],[17,31],[28,-17],[37,-29],[11,-28],[-4,-26],[26,15],[43,-26],[33,2],[33,-39],[28,-53],[18,-13],[19,-2],[8,-15],[11,-89],[-9,-78],[-11,-31],[-32,-66],[-14,-53],[-28,-77],[2,-89],[-7,-72],[-2,-32],[-7,-18],[-4,-64],[-23,-61],[-3,-49],[-18,-21],[-5,-28],[-25,0],[-35,-18],[-15,-21],[-25,-14],[-26,-38],[-19,-46],[-3,-36],[3,-26],[-9,-71],[-15,-26],[-25,-83],[-35,-60],[-10,-45],[-14,-27]],[[2707,3094],[0,15],[-21,24],[-21,1],[-38,-14],[-11,-42],[-1,-25],[-8,-57]],[[2453,3217],[14,51],[-9,40],[1,33],[8,24],[2,73],[5,16],[-19,76]],[[2436,3181],[-22,27],[-2,19],[-44,48],[-40,51],[-17,30],[-10,39],[4,13],[-19,62],[-22,87],[-21,95],[-9,21],[-7,35],[-17,31],[-16,19],[7,21],[-10,45],[7,33],[17,30]],[[2215,3887],[3,-19],[-6,-29],[18,-1],[10,-24],[12,19],[4,32],[14,41],[27,19],[24,49],[7,31],[-3,36]],[[2325,4041],[6,5],[32,-57],[13,-50],[16,-6],[13,13],[21,-5],[17,-22],[-8,-49],[12,-25]],[[2325,4041],[-21,27],[-6,-8],[-19,7],[-9,19],[-23,28]],[[2247,4114],[10,59],[11,3],[18,54],[-8,12],[4,27],[-5,43],[4,13],[-3,40],[-9,25]],[[2269,4390],[3,23],[11,10],[-2,35]],[[2281,4458],[11,-1],[17,33],[9,5],[4,55],[13,22],[16,11],[17,-4],[26,35],[11,22],[14,-15],[-4,-16]],[[2415,4605],[-15,-8],[-5,-23],[-15,-32],[-9,-61],[11,-3],[10,-51],[-2,-28],[11,-20],[28,4],[13,-6],[16,-40],[37,8],[8,-9],[-9,-41],[-1,-34],[11,-56],[-11,-23],[14,-27],[7,-48]],[[2269,4390],[-7,13],[-9,58],[-11,13],[-31,-43],[11,-26],[-20,-15],[-18,42],[-15,8],[-13,-3]],[[2156,4437],[3,19],[-2,40],[8,5]],[[2165,4501],[8,-27],[17,-10],[11,3],[23,22],[7,14],[34,-18],[16,-27]],[[2156,4437],[-16,21],[1,18],[-22,27],[-11,-3],[-15,28],[2,45]],[[2095,4573],[23,-1],[17,-17],[6,11]],[[2141,4566],[5,-26],[19,-39]],[[2095,4573],[-18,33],[-18,56]],[[2059,4662],[13,13],[0,24],[21,3],[14,25],[6,21],[10,-8],[21,18],[8,-1]],[[2152,4757],[-9,-88],[2,-34],[-9,-49],[5,-20]],[[2059,4662],[-10,19]],[[2049,4681],[1,19],[-18,9],[-18,21]],[[2014,4730],[5,31],[20,31]],[[2039,4792],[14,7],[26,-4],[10,10],[22,0],[14,-8],[27,-40]],[[2049,4681],[-16,-10],[-35,27]],[[1998,4698],[16,32]],[[2019,4890],[-2,-91],[7,0]],[[2024,4799],[15,-7]],[[1998,4698],[-26,9],[-22,29]],[[2038,4923],[4,-7],[-6,-86],[-12,-31]],[[2415,4605],[-14,-17],[7,-21],[0,-25],[-10,-27],[8,-38],[10,3],[5,34],[-7,17],[-1,36],[28,19],[-3,22],[7,15],[8,-33],[16,-1],[14,-26],[1,-16],[44,5],[13,-21],[17,-6],[12,26],[36,-10],[7,-22],[18,-4],[17,-23],[3,-38],[21,-10]],[[2672,4444],[-18,-28],[6,-35],[-19,-16],[-6,-35],[15,-36]],[[2672,4444],[14,-18],[23,-56],[21,-39]],[[2730,4331],[-4,-43],[-13,-12],[-3,-36],[10,-34],[23,-68]],[[2730,4331],[26,-10],[21,12],[24,-13]],[[2801,4320],[-12,-40],[2,-33],[9,-28],[-12,-61]],[[2801,4320],[23,-16],[24,-40],[4,-19]],[[4137,6387],[10,-12],[32,-9],[-11,-32],[-3,-34]],[[4165,6300],[-31,-42],[18,-35]],[[4152,6223],[5,-31],[-8,-15],[16,-63]],[[4165,6114],[-20,-26],[-44,12],[-33,-15],[-2,-28]],[[4066,6057],[-26,-6],[-25,21],[-8,-10],[-41,21],[-9,19]],[[3957,6102],[12,28],[4,94],[-23,50],[-16,24],[-34,18],[-3,34],[29,11],[38,-13],[-7,54],[21,-20],[51,37],[7,38],[19,10]],[[4055,6467],[40,-59],[11,4],[20,-22]],[[4126,6390],[11,-3]],[[4194,6064],[14,18],[4,-41],[-7,-36],[-11,10],[-5,31],[5,18]],[[2215,3887],[12,36],[-13,-2],[-14,21],[5,13],[-4,43],[8,7],[13,60],[-2,20],[27,29]],[[2527,4924],[9,-26],[-29,-1],[2,27],[18,0]],[[2276,4923],[27,-16],[-19,-22],[-12,8],[4,30]],[[2172,5145],[36,-4],[21,-16],[9,-18],[21,6],[40,-62],[21,-9],[31,-35],[-2,-11],[-30,-8],[-15,4],[-32,-5],[15,26],[-24,16],[-13,41],[-12,-2],[-28,22],[-28,8],[0,21],[-22,2],[-16,-25],[-23,-17],[7,36],[21,20],[23,10]],[[4653,3004],[-14,21],[-17,7],[-6,47],[-10,5],[-25,52],[-20,74]],[[4561,3210],[39,-10],[13,31],[19,38],[8,4],[3,17],[12,18],[17,7]],[[4672,3315],[2,-18],[18,1],[10,-10],[5,-11],[11,-4],[11,-15],[0,-60],[-5,-68],[4,-14],[-12,-66],[-23,-54]],[[4442,2877],[0,138],[21,2],[1,168],[17,2],[34,16],[8,-19],[15,18],[19,11]],[[4557,3213],[4,-3]],[[4363,2697],[-17,36],[-8,34],[-11,80],[-7,73],[-4,83],[-20,58],[-16,87],[-18,46],[-2,36]],[[4260,3230],[24,17],[15,-1],[16,-18],[90,2],[16,-23],[54,-7],[40,20]],[[4515,3220],[19,10],[14,-2],[9,-15]],[[3628,4691],[-9,37],[-1,26],[16,57]],[[3634,4811],[7,15],[11,-4],[24,11],[25,-26],[28,-68]],[[3729,4739],[5,-56],[9,-13],[1,-33]],[[3744,4637],[-22,-6],[-27,12]],[[3695,4643],[-41,2],[-25,-11]],[[3629,4634],[-4,36]],[[3625,4670],[21,-1],[6,23],[-24,-1]],[[3729,4739],[8,9],[3,28],[23,-12],[24,16],[89,1],[2,39],[-11,204],[-11,204],[34,1]],[[3890,5229],[75,-103],[75,-103],[5,-22],[24,-22],[1,-30],[24,5]],[[4094,4954],[0,-109],[-12,-31],[-2,-30],[-19,-7],[-31,-4],[-8,-17],[-14,-2]],[[4008,4754],[-20,9],[-33,-26],[-4,-15],[-30,-43],[-17,-5],[-3,-33],[-18,-39],[-5,-36],[1,-27]],[[3879,4539],[-14,-13],[-3,20],[-15,-18],[-26,3]],[[3821,4531],[-12,44],[4,12],[-16,43],[-23,-22],[-30,29]],[[3807,5344],[83,-115]],[[3634,4811],[-2,26],[6,23],[3,45],[-5,70],[2,23],[-18,43]],[[4059,4344],[-18,-5]],[[4041,4339],[-6,32],[1,109],[-5,33],[-14,30],[2,25]],[[4019,4568],[13,26],[15,19]],[[4047,4613],[16,14],[17,-27]],[[4080,4600],[4,-44],[-2,-32],[-18,-44],[-4,-29],[-1,-107]],[[4322,4656],[-7,-17]],[[4315,4639],[-5,-2],[-15,52],[-22,-24],[-17,14],[-32,-3],[-13,-20],[-11,-1],[-27,24],[-22,-11],[-8,18],[-23,18],[-23,-6],[-6,-10],[-10,-46],[-1,-42]],[[4047,4613],[1,32],[-26,11],[0,23],[-13,31],[-1,44]],[[4094,4954],[32,21],[64,93],[76,90]],[[4266,5158],[35,-20],[13,-26],[16,17]],[[4315,4639],[8,-19],[-3,-25],[-19,-36],[-18,-99],[-12,-19],[-11,-63],[-15,-16],[-12,20],[-9,-1],[-13,-28],[-6,0],[-17,-79]],[[4188,4274],[-40,-25],[-17,1],[-12,29],[-8,35],[-15,31],[-37,-1]],[[4339,4399],[-11,-48],[-6,-8],[-1,-71],[11,-25],[10,-41],[10,-15],[3,-36]],[[4355,4155],[-1,-25],[-36,24],[-28,1]],[[4290,4155],[-40,0]],[[4250,4155],[-36,1]],[[4214,4156],[3,38],[-9,31],[-10,8],[-10,41]],[[4041,4339],[-18,-10]],[[4023,4329],[-11,46],[-2,24],[5,42],[-5,18],[-2,71],[-8,39]],[[4000,4569],[19,-1]],[[4023,4329],[-35,-28],[-12,-16],[-20,-14],[-20,13]],[[3936,4284],[1,19],[-10,41],[6,53],[10,40],[-6,67]],[[3937,4504],[-3,63],[66,2]],[[3879,4539],[24,-36],[18,13],[16,-12]],[[3936,4284],[-26,9],[-40,-9],[-38,-31],[-4,2]],[[3828,4255],[3,63],[-23,36],[5,21],[-1,37]],[[3812,4412],[5,36],[8,6],[-10,57],[6,20]],[[3812,4412],[-11,-18],[-10,10],[1,19],[-9,29],[-11,-6]],[[3772,4446],[-20,77],[-17,0],[-12,-10],[-18,-44]],[[3705,4469],[-18,47],[-11,15],[-13,39]],[[3663,4570],[10,23],[21,14],[1,36]],[[3663,4570],[-21,23],[-13,41]],[[3828,4255],[-29,22],[-20,36],[-19,26],[-15,30]],[[3745,4369],[7,29],[20,48]],[[3745,4369],[-22,23],[-11,25],[-7,52]],[[4409,4214],[-29,10],[-13,-25],[-12,-44]],[[4545,4437],[13,-19],[0,-15],[24,-45],[6,-29],[16,-18],[4,-15]],[[4288,3822],[-8,16],[-16,-28]],[[4264,3810],[-18,50]],[[4246,3860],[17,26],[-8,31],[22,18],[33,-4],[10,54],[-2,37],[-11,28],[10,55],[-6,9],[-16,-4],[-7,25],[2,20]],[[4246,3860],[-23,48],[-15,39],[-13,49],[15,100]],[[4210,4096],[40,2],[0,57]],[[4210,4096],[-4,7],[8,53]],[[4727,3612],[11,-21],[6,-41],[-9,-51],[5,-39],[-7,-16],[-7,-44],[12,-12]],[[4738,3388],[-68,-39],[2,-34]],[[4515,3220],[-14,29],[-15,39],[1,150],[46,0],[2,34],[-4,60]],[[4767,3503],[-6,-36],[6,-61],[16,-15],[9,-34],[2,-61],[-9,-9],[-7,-33],[-15,29],[-1,33],[3,41],[-15,8],[-12,23]],[[4895,3560],[4,-21],[-1,-47],[3,-41],[1,-74],[4,-24],[-7,-33],[-9,-33],[-14,-29],[-45,-41],[-25,-51],[-9,-9],[-25,-44],[-1,-34],[19,-75],[-3,-96],[-9,-17],[-45,-42],[-10,-17],[8,-23],[-2,-25]],[[4712,2784],[-5,42]],[[4270,3774],[-6,36]],[[4260,3230],[-2,30],[3,41],[9,64],[13,62],[19,52],[2,62],[-7,17],[-11,57],[8,28],[-12,78],[-9,39]],[[4644,3914],[14,-4],[7,27],[12,-3]],[[4793,5595],[-4,-15]],[[4789,5580],[-8,7],[-5,-56],[10,6]],[[4786,5537],[1,-18],[-12,-76]],[[4775,5443],[-14,82]],[[4761,5525],[11,40],[8,48]],[[4780,5613],[15,9]],[[4795,5622],[-2,-27]],[[4780,5613],[19,74]],[[4799,5687],[14,-21],[-12,-18],[-6,-26]],[[5100,3459],[12,-52],[3,-57],[6,-22],[-6,-36],[-12,13],[4,-35],[-2,-20],[-6,-11],[-1,-40],[-20,-120],[-14,-90],[-8,-65],[-10,-55],[-38,-31],[-30,29],[-6,25],[-2,41],[-7,38],[-2,34],[4,34],[21,60],[2,30],[-10,52],[-2,44],[8,26],[3,30],[11,2],[13,10],[8,8],[10,1],[30,56],[26,71],[0,29],[15,1]],[[4789,5580],[-3,-43]],[[3625,4670],[3,21]],[[4210,5481],[-9,85],[-32,59],[-2,36],[13,26],[6,39],[-4,45],[5,24]],[[4187,5795],[24,19],[15,-5],[0,-24],[9,-15],[8,-34],[-3,-41],[-15,-23],[4,-26],[12,-1],[14,-30]],[[4255,5615],[-1,-36],[-33,-47],[0,-40],[-11,-11]],[[3807,5356],[0,56],[36,35],[40,20],[9,23],[25,19],[1,35],[13,4],[10,18],[29,8],[-10,107],[-9,30]],[[3951,5711],[22,26],[24,8],[14,20],[21,14],[74,12],[12,-7],[21,19],[23,0],[25,-8]],[[4210,5481],[9,-63],[-4,-39],[0,-77],[-8,-20],[13,-34],[8,-47],[11,9],[17,-22],[10,-30]],[[4793,5595],[25,-19],[43,51]],[[4861,5627],[9,-58]],[[4870,5569],[-4,-7],[-44,-24],[22,-47],[-11,-24],[-17,-7],[-15,-31],[-25,7]],[[4776,5436],[-1,7]],[[5146,5195],[4,-11],[18,7],[32,-2],[45,91],[5,-16],[3,-37]],[[5253,5227],[-12,0],[-2,-31],[-13,-74]],[[5226,5122],[-4,-10],[-67,24],[-9,59]],[[5128,5219],[-1,34],[6,25],[13,-10],[-5,-55]],[[5141,5213],[-13,6]],[[5065,5466],[10,-68]],[[5075,5398],[-15,-1],[-6,23],[-20,4]],[[5034,5424],[17,46],[14,-4]],[[4861,5627],[50,49],[8,57],[-2,35],[12,11],[11,30]],[[4940,5809],[10,7],[44,-10]],[[4994,5806],[15,-57],[14,-14],[2,-27],[-11,-17],[-5,-37],[15,-44],[27,-26],[12,-36],[-4,-35],[20,-50]],[[5079,5463],[-14,3]],[[5034,5424],[-41,4],[-63,95],[-33,33],[-27,13]],[[5253,5227],[10,-32],[12,-18],[29,-14],[24,-60],[-11,-41],[-10,-15],[-8,-33],[-10,3],[-8,-36],[3,-31],[-27,-23],[-7,-33],[-14,0],[-8,-31],[-11,-13],[-12,4],[-25,-18]],[[5180,4836],[-25,111]],[[5155,4947],[67,47],[14,95],[-10,33]],[[7706,3307],[-4,50],[11,-15],[3,-38],[-10,3]],[[6279,4625],[-5,57],[14,39],[29,9],[20,-7]],[[6337,4723],[19,-18],[10,32],[20,-17]],[[6386,4720],[5,-32],[-3,-56],[-37,-37],[9,-28],[-23,-4],[-19,-19]],[[6318,4544],[-19,7],[-9,25],[-11,49]],[[6279,4625],[-20,21],[-19,-1],[3,37],[-19,0],[-2,-52],[-19,-111],[1,-34],[15,-1],[9,-43],[4,-41],[12,-28],[14,-5],[11,-25]],[[6269,4342],[-7,-19],[-15,-6],[-2,25],[-18,20],[-4,-8]],[[6223,4354],[-12,41],[-23,50],[-8,-2],[9,75]],[[6189,4518],[23,93],[-8,43],[-3,48],[-14,38],[2,32],[8,41],[-23,66],[-11,41],[9,9],[11,51],[15,2],[26,32]],[[6224,5014],[10,-15],[1,-28],[15,-2],[-6,-50],[1,-43],[23,29],[20,-7],[5,16],[16,-3],[17,-39],[2,-46],[18,-42],[-1,-40],[-8,-21]],[[6224,5014],[5,17],[19,31]],[[6248,5062],[14,-13],[-4,55],[12,6]],[[6270,5110],[13,-37],[10,-43],[27,0],[9,-41],[-21,-30],[27,-28],[32,-98],[17,-32],[6,-34],[-4,-47]],[[6189,4518],[-2,35],[7,36],[-8,28],[2,52],[-9,24],[-7,57],[-4,60],[-10,39],[-39,-58],[-27,16],[8,58],[-5,45],[-17,54],[-26,62]],[[6052,5026],[6,31],[1,33]],[[6059,5090],[11,12],[3,85],[17,-11],[10,39],[2,23],[12,40],[-1,27],[29,32],[16,-8],[-2,29],[6,27]],[[6162,5385],[13,3],[7,-28],[10,-11],[0,-75],[-21,-40],[-3,-56],[24,8],[5,-43],[14,-10],[-6,-39],[26,-26],[17,-6]],[[6270,5110],[12,12],[39,5],[19,26],[11,-18],[20,-9],[-4,-27],[11,-19],[22,-13]],[[6400,5067],[-29,-40],[-19,-45],[-5,-33],[38,-111],[20,-29],[14,-38],[10,-88],[-3,-83],[-19,-31],[-25,-31],[-18,-39],[-28,-44],[-8,30],[6,32],[-16,27]],[[6905,6045],[-8,3],[-16,-33],[0,-34],[-23,-32],[-25,-21],[-1,-20],[19,-34]],[[6851,5874],[-3,-11],[-25,-6],[-9,-21],[-11,-3]],[[6803,5833],[-13,0],[-19,17],[15,61],[-25,25]],[[6761,5936],[18,31],[24,25],[15,34],[11,-15],[19,-2],[-3,25],[34,20],[9,27],[14,-28]],[[6851,5874],[20,-56],[5,-30],[0,-55],[-8,-26],[-20,-9],[-18,-19],[-20,-5],[-3,26],[5,36],[-10,49],[16,8],[-15,40]],[[6592,6407],[-27,-83],[41,-20],[17,17],[18,-15],[20,-33],[-20,-12],[-32,-6],[-16,-13],[-16,-31],[-34,-19],[-22,-25],[-36,14],[-11,-31],[10,-33],[-31,-42],[-26,-16],[-33,-2],[-36,-16],[-26,-26],[-10,15],[-27,0],[-33,29],[-22,7],[-29,-7],[-46,11],[-25,-1],[-13,28],[-10,43],[-14,6],[-26,29],[-57,15],[-8,20],[9,55],[-16,39],[-31,17],[-19,25],[-6,33]],[[6059,5090],[-12,75],[-10,-30],[-12,25],[7,27],[10,2],[10,40],[-13,8],[-42,6],[-1,33],[-11,2],[-18,21],[-8,-32],[16,-25],[-18,-35],[13,-13],[-3,-28],[7,-36],[4,-39]],[[5978,5091],[-3,-17],[-43,-9],[1,-36],[-12,-28],[-32,-32],[-24,-55],[-39,-61],[0,-22],[-31,-28],[-11,-3],[-6,-36],[5,-101],[-9,-45],[0,-80],[-12,-2],[-10,-36],[7,-16],[-20,-13],[-8,-33],[-9,-13],[-21,44],[-18,114],[-20,68],[-9,88],[-21,65],[-15,152],[0,58],[-5,44],[-32,-28],[-16,5],[-29,58],[11,17],[-7,18],[-26,41]],[[5514,5169],[15,31],[49,0],[-4,41],[-13,24],[-2,36],[-15,21],[25,50],[25,-4],[24,50],[14,48],[21,47],[0,34],[19,27],[-18,24],[-16,73],[11,20],[34,-11],[25,7],[21,40]],[[5729,5727],[24,-56],[-2,-38],[8,-25],[0,-24],[-16,7],[6,-52],[22,-30],[31,-33]],[[5802,5476],[-14,-22],[-9,-44],[71,-68],[31,-6],[13,-24],[44,-16],[18,1],[1,69]],[[5957,5366],[14,10],[2,-37]],[[5973,5339],[21,-27],[14,7],[36,-2],[2,29],[-9,15]],[[6037,5361],[18,6],[20,36],[26,30],[18,-12],[16,20],[11,-29],[-8,-20],[24,-7]],[[6052,5026],[-6,24],[-6,47],[-9,28],[-21,2],[2,-20],[-7,-26],[-27,10]],[[5973,5339],[15,35],[12,12],[27,-12],[10,-13]],[[5802,5476],[9,11],[18,-15],[22,-31],[13,-6],[7,-23],[17,-9],[18,-21],[26,-11],[25,-5]],[[5514,5169],[-16,12],[-7,33],[-17,36],[-41,-8],[-36,-1],[-31,-7]],[[5366,5234],[8,55],[32,24],[-2,22],[-10,8],[-1,42],[-21,20],[-20,54]],[[5352,5459],[37,-24],[40,11],[16,-4],[29,20],[0,40],[13,27],[19,13],[25,1],[9,14],[-2,28],[10,29],[14,12],[-9,31],[21,-2],[6,36],[11,20],[-8,43],[13,21],[49,15],[25,14]],[[5670,5804],[16,-22],[6,-36],[37,-19]],[[5507,5805],[6,-6],[31,28],[13,-1],[16,42],[16,-27],[-2,-40],[9,-16],[31,36],[39,-3]],[[5666,5818],[4,-14]],[[5352,5459],[20,43],[-2,30],[-16,8],[-9,68],[-1,33],[16,93]],[[5360,5734],[22,-18],[17,6],[5,22],[30,21],[4,38],[19,9],[3,17],[18,-14]],[[5577,5951],[-8,-14],[-24,8],[-2,-28],[24,4],[27,-15],[43,7]],[[5637,5913],[5,-44],[21,-6],[3,-45]],[[5783,6051],[-3,-11],[-35,-26],[-8,-18],[-29,-6],[-8,-30],[-24,6],[-36,-31],[-3,-22]],[[5360,5734],[-2,40],[-17,2],[-25,41],[-18,6],[-25,24],[-15,4],[-25,-8],[-16,-27],[-19,-9]],[[5198,5807],[-5,34],[4,49],[-18,16],[6,33],[-15,2],[5,40],[21,-11],[20,15],[-16,28],[-7,27],[-27,-16]],[[4994,5806],[-12,38],[5,14],[-7,55],[15,13]],[[4995,5926],[15,-40],[15,-6]],[[5025,5880],[8,2]],[[5033,5882],[26,34],[15,-10],[-8,-23],[20,-23]],[[5086,5860],[7,-35],[21,-9],[15,-24],[32,-8],[34,12],[3,11]],[[5366,5234],[-91,31],[-10,58],[-10,9],[-17,-9],[-23,-23],[-27,16],[-22,36],[-22,14],[-15,45],[-16,63],[-12,-8],[-14,16],[-8,-19]],[[4799,5687],[-2,36],[6,19]],[[4803,5742],[20,38],[25,13],[30,-9],[25,18],[37,7]],[[5025,5880],[-9,28],[-21,18]],[[4995,5926],[-25,26],[-2,39]],[[4968,5991],[31,8]],[[4999,5999],[13,-21],[7,-28],[-6,-15],[19,-21],[1,-32]],[[4458,7316],[65,-55],[0,-73],[8,-18]],[[4531,7170],[-39,-14],[-21,-33],[3,-29],[-35,-38],[-43,-41],[-16,-66],[16,-33],[21,-27],[-20,-53],[-24,-11],[-8,-79],[-13,-45],[-27,5],[-12,-38],[-26,-2],[-7,45],[-19,54],[-16,66]],[[4706,6512],[-19,-3],[-17,-29],[-20,-3],[-65,22],[-40,3],[-23,-15]],[[4522,6487],[-7,43],[13,10],[-7,58]],[[4521,6598],[22,-1],[24,18],[5,27],[18,15],[-2,21]],[[4588,6678],[38,26]],[[4849,6276],[-33,-20],[-21,-2],[-19,-18],[1,-25]],[[4742,6222],[-59,29],[-26,-61]],[[4657,6190],[-30,9]],[[4627,6199],[15,37],[19,4],[-14,71],[-36,29],[-20,-12]],[[4591,6328],[-39,-22],[-10,11],[-28,6],[-10,-11]],[[4504,6312],[-14,26]],[[4490,6338],[11,31]],[[4501,6369],[-1,19],[33,58],[-11,41]],[[4501,6369],[-21,19],[-27,-2],[-13,-10],[-22,13]],[[4418,6389],[-10,23],[-18,18],[-46,20],[-11,15]],[[4333,6465],[-7,46],[-14,43],[1,36]],[[4313,6590],[15,14],[63,38],[45,-20]],[[4505,6617],[16,-19]],[[4377,6324],[-18,-60]],[[4359,6264],[-34,-20],[-19,3]],[[4306,6247],[-32,13],[-4,16],[-38,-10]],[[4232,6266],[-22,10],[3,20]],[[4213,6296],[40,0],[36,5],[-3,31],[16,27]],[[4302,6359],[16,-15],[20,23],[38,-21]],[[4376,6346],[1,-22]],[[4504,6312],[-13,-9],[-24,-65],[-18,-9]],[[4449,6229],[-31,-10]],[[4418,6219],[-27,2],[-23,26]],[[4368,6247],[-9,17]],[[4377,6324],[19,-17],[21,15],[32,12],[13,14],[28,-10]],[[4627,6199],[-2,63],[-27,62],[-7,4]],[[4657,6190],[-17,-18],[-6,-57]],[[4634,6115],[-29,22],[-37,-23],[-59,7],[-6,19]],[[4503,6140],[-24,25],[-30,64]],[[4472,6658],[-5,40]],[[4467,6698],[26,14],[59,2],[36,-36]],[[4467,6698],[1,35],[11,30],[21,16],[18,-35],[17,1],[5,36]],[[4540,6781],[19,8],[28,-23],[19,0]],[[4540,6781],[-20,39],[-2,27],[56,20],[47,-6]],[[4333,6465],[-37,-18],[-25,-22],[7,-34],[24,-32]],[[4213,6296],[-24,14],[-24,-10]],[[4137,6387],[-3,32]],[[4134,6419],[2,32]],[[4136,6451],[-3,49],[13,0],[11,61],[-4,16]],[[4153,6577],[42,26],[-6,44]],[[4189,6647],[31,1]],[[4220,6648],[0,-18],[45,-19],[13,13],[35,-34]],[[4634,6115],[-11,-20],[-9,-33],[8,-27]],[[4622,6035],[-20,6],[-22,-15]],[[4580,6026],[0,-23],[-21,-5],[-15,17],[-18,-13],[-17,1]],[[4509,6003],[-1,31],[-11,15]],[[4497,6049],[13,43],[-11,20],[4,28]],[[4584,5717],[-3,-14],[-32,4],[7,16],[28,-6]],[[4580,6026],[11,-12],[-13,-35]],[[4578,5979],[-25,5],[-27,-12],[16,-26],[-24,-8],[-11,-14],[3,-33],[23,-35],[1,-27],[-28,-17],[8,-41],[-15,-1],[-18,20],[-12,70],[-20,49],[-2,13]],[[4447,5922],[20,58]],[[4467,5980],[42,23]],[[4803,5742],[-14,35],[-18,11],[-15,-27],[-34,-5],[-18,25],[-24,2],[-5,-20],[-16,-6],[-21,26],[-24,-1],[-13,47],[-17,26],[11,37],[-14,22],[25,46],[34,1],[9,36],[43,-6],[26,31],[26,13],[37,1],[39,-33],[32,-18],[25,7],[20,-4],[26,24]],[[4923,6012],[23,3],[22,-24]],[[4622,6035],[2,-19],[16,-26],[-27,-3],[-28,-40],[-7,32]],[[4447,5922],[-16,30],[-1,77]],[[4430,6029],[-2,15],[17,18]],[[4445,6062],[12,-35]],[[4457,6027],[0,-36],[10,-11]],[[4418,6219],[12,-32],[-8,-17]],[[4422,6170],[-10,10],[-58,7],[-5,-19],[16,-37],[27,-48],[20,-18]],[[4412,6065],[-3,-8]],[[4409,6057],[-33,34],[-21,15],[-18,34],[-6,40],[-27,20]],[[4304,6200],[36,-2],[10,37],[18,12]],[[4232,6266],[-12,-28],[-16,6],[-32,-29],[-20,8]],[[4126,6390],[8,29]],[[4055,6467],[18,9]],[[4073,6476],[37,6],[26,-31]],[[4073,6476],[12,13],[19,70],[30,20],[19,-2]],[[3799,6029],[17,19],[5,-24],[30,5],[7,-24],[-11,-13],[-5,-98],[-6,-31],[7,-14],[-11,-31],[2,-16]],[[3834,5802],[-9,-12],[-23,2],[1,66],[-15,22],[2,31],[8,17],[7,48],[-6,53]],[[3799,6029],[1,33],[-9,21],[31,34],[27,-9],[30,1],[24,-8],[54,1]],[[4066,6057],[1,-28],[-21,-31],[-28,-10],[-16,-42],[-9,-39],[9,-27],[-13,-21],[-5,-31],[-16,-9],[-16,-37],[-50,1],[-22,-35],[-11,4],[-14,43],[-21,7]],[[3862,6595],[3,-33],[-16,-43],[-40,-27],[-31,7],[18,49],[-12,48],[47,59]],[[3831,6655],[0,-50],[31,-10]],[[7683,3051],[30,-51],[-9,-11],[-28,34],[-29,58],[7,16],[29,-46]],[[7547,3669],[6,-25],[-30,38],[-5,20],[29,-33]],[[7930,2154],[-20,-58],[-17,-19],[-13,19],[13,39],[-7,26],[-24,19],[0,17],[16,17],[3,67],[-19,59],[-17,42],[11,11],[17,-12],[6,-42],[16,-50],[32,-32],[15,-4],[13,18],[11,-5],[-12,-70],[-17,1],[-7,-43]],[[7769,1989],[33,49],[21,74],[16,21],[10,-39],[16,19],[6,-40],[-43,-99],[-19,-18],[-18,-79],[-29,-34],[-20,1],[-15,15],[-24,4],[-4,17],[12,35],[28,47],[30,27]],[[7281,2118],[13,-3],[2,-56],[-33,-74],[-18,4],[-14,40],[-3,32],[-13,41],[1,21],[36,-20],[29,15]],[[6802,2525],[-23,-24],[-19,-11],[-13,-44],[-33,-6],[-19,9],[-32,-7],[-41,-52],[-31,2],[-36,39],[1,27],[11,7],[6,60],[-3,28],[-12,48],[-2,54],[-10,45],[-10,19],[-2,37],[-14,81],[17,-8],[-18,66],[10,63],[18,58],[18,16],[28,37],[16,-2],[40,38],[12,-1],[24,13],[12,21],[6,26],[13,24],[1,44],[16,40],[11,-9],[7,23],[9,-10],[3,36],[29,63],[31,20],[16,-22],[13,-28],[28,-5],[-5,26],[27,89],[13,17],[12,-6],[18,9],[0,25],[10,10],[12,-19],[39,-22],[26,19],[10,-24],[-33,-112],[1,-13],[18,-26],[17,-15],[11,-17],[17,-28],[17,-12],[4,-14],[21,-16],[15,16],[4,25],[5,21],[2,26],[7,38],[-4,64],[4,60],[9,52],[9,31],[8,-53],[14,-50],[1,-44],[8,-37],[15,18],[18,-38],[-3,-21],[5,-41],[3,-23],[6,-6],[6,-41],[-2,-24],[7,-32],[24,-25],[31,-43],[-3,-11],[13,-30],[8,-51],[9,10],[15,-13],[3,-50],[27,-47],[17,-39],[6,-38],[-1,-56],[11,-40],[-2,-42],[-9,-64],[-4,-61],[-10,-43],[-17,-23],[-15,-60],[-7,-41],[-14,-59],[-2,-48],[-12,-16],[-25,-2],[-21,-19],[-23,-39],[-41,45],[-20,-34],[-31,20],[-35,17],[-14,30],[-9,59],[-11,20],[-22,5],[-17,43],[12,50],[-1,35],[-18,-40],[-14,-16],[-9,-38],[-17,20],[0,25],[-21,63],[-29,29],[-15,1],[-21,23],[-40,-5],[-54,-32],[-22,3]],[[5817,4404],[-4,-49],[-9,-14],[-19,-11],[-11,38],[-4,68],[10,77],[16,-26],[10,-34],[11,-49]],[[6432,4909],[-18,14],[-1,41],[11,21],[24,14],[13,-1],[5,-18],[-15,-49],[-19,-22]],[[6761,5936],[-31,-13],[-17,-23],[-17,28],[18,32],[-12,24],[-19,-16],[-25,-33],[-14,-31],[-22,-2],[-11,-22],[12,-32],[18,-8],[1,-21],[17,-14],[25,34],[20,-18],[14,-2],[4,-24],[-32,-14],[-10,-25],[-22,-24],[-11,-33],[24,-26],[9,-47],[13,-43],[15,-36],[0,-35],[-14,-13],[5,-25],[13,-15],[-9,-76],[-12,-4],[-34,-114],[-21,-56],[-31,-44],[-30,-39],[-26,-6],[-13,-21],[-8,15],[-12,-23],[-31,-24],[-24,-7],[-8,-50],[-12,-3],[-6,35],[6,18],[-30,15],[-11,-8]],[[6705,5202],[-13,-76],[-10,-39],[-11,40],[-3,35],[13,47],[18,35],[10,-14],[-4,-28]],[[4306,6247],[3,-43]],[[4309,6204],[-17,7],[-19,-17],[-1,-37],[7,-24],[21,-24],[11,-39],[42,-57],[36,-32],[5,-28],[-20,8],[-9,-31],[16,-17],[-24,-69],[0,47],[-15,51],[-40,54],[-16,3],[-18,21],[-35,58],[-7,47],[-29,21],[-32,-32]],[[4328,5852],[16,4],[-8,-37],[-1,-39],[-59,47],[3,24],[26,-4],[23,5]],[[4193,5982],[11,15],[13,-34],[-3,-62],[-27,0],[-1,57],[7,24]],[[4189,6647],[-9,27],[-1,48],[10,27],[20,3],[18,-14],[3,-33],[-16,-34],[6,-23]],[[4274,6702],[7,-24],[-13,-38],[-23,26],[-3,20],[32,16]],[[3831,6655],[19,2],[24,-29],[-12,-33]],[[3931,6574],[3,27],[-15,30],[-27,8],[-17,25],[-1,45],[-11,24],[8,49],[17,39],[45,0],[-24,-51],[47,6],[-6,-39],[-20,-42],[23,-3],[22,-61],[15,-7],[20,-73],[27,-9],[-3,-30],[-11,-14],[9,-24],[-20,-25],[-30,0],[-38,-13],[-10,9],[-15,-22],[-20,6],[-16,-18],[-12,9],[33,50],[-22,37],[24,14],[-12,26],[4,31],[33,-4]],[[3677,7191],[-5,-31],[25,-32],[-29,-36],[-83,-41],[-91,22],[22,21],[-49,23],[40,9],[-1,14],[-47,11],[15,31],[34,7],[34,-32],[34,25],[28,-13],[36,25],[37,-3]],[[5079,6025],[23,-58],[-9,-72],[-7,-35]],[[4999,5999],[37,-3],[-5,32]],[[4923,6012],[3,21],[-5,32],[-34,37]],[[6684,4649],[-11,36],[19,-2],[8,-17],[-6,-41],[-10,24]],[[6723,4520],[8,43],[25,16],[-2,-45],[-22,-59],[-13,33],[4,12]],[[6808,4446],[3,-58],[-7,-43],[-9,48],[-10,-24],[7,-35],[-6,-22],[-26,28],[-7,34],[7,22],[-14,23],[-7,-20],[-10,2],[-17,-27],[-3,14],[8,40],[26,31],[8,-21],[17,13],[4,21],[15,1],[-1,37],[18,-23],[4,-41]],[[6633,4489],[-3,17],[13,33],[12,47],[4,-39],[-15,-26],[-11,-32]],[[6718,4910],[-4,-20],[8,-33],[-6,-40],[-13,-15],[-4,-39],[5,-37],[22,0],[28,-26],[-3,-26],[-12,-10],[-14,8],[-14,28],[-20,-7],[-11,11],[1,19],[-14,33],[-3,21],[8,29],[3,74],[7,43],[13,0],[23,-13]],[[6711,4588],[24,8],[0,-20],[-25,-34],[1,46]],[[6788,4623],[6,-52],[-17,12],[6,-45],[-10,-11],[-1,34],[-11,31],[13,14],[-13,36],[21,-1],[6,-18]],[[6269,4342],[18,-33],[10,-31],[-1,-54],[3,-44],[8,-13],[9,-42],[-1,-16],[-15,-3],[-48,73],[-2,24],[-13,31],[-3,40],[-8,25],[2,35],[-5,20]],[[6436,4143],[16,-16],[18,9],[4,40],[36,19],[27,67]],[[6537,4262],[25,-10],[3,54]],[[6565,4306],[17,33],[11,37],[9,0],[11,-24],[2,-21],[33,-27],[-2,-19],[-15,-2],[4,-23],[-16,-16]],[[6537,4262],[28,44]],[[4304,6200],[5,4]],[[4623,6909],[-40,-4],[-75,-27],[-13,26],[-22,15],[5,47],[-11,43],[31,57],[51,51],[15,10],[-2,20],[-31,23]],[[4376,6346],[42,43]],[[4853,4899],[13,-54],[6,-44],[12,-23],[30,-45],[32,-70],[11,-14]],[[4957,4649],[-16,-8]],[[4941,4641],[-33,75],[-19,19],[-21,10],[-13,-11],[-13,22],[-7,-36],[-26,10]],[[7152,5901],[-20,-48],[0,-48],[-8,-38],[3,-24],[-11,-33],[-29,-22],[-39,-3],[-31,-54],[-15,18],[-1,35],[-39,-10],[-26,-23],[-26,0],[22,-35],[-14,-81],[-15,-19],[-11,18],[6,43],[-14,13],[-9,33],[21,14],[12,30],[22,24],[16,33],[44,14],[24,-10],[23,84],[15,-22],[46,65],[13,58],[-3,53],[9,30],[24,9],[12,-66],[-1,-38]],[[7213,6127],[15,20],[5,-53],[-33,-13],[-19,-47],[-35,32],[-12,-51],[-25,-1],[-3,47],[11,36],[24,3],[13,102],[26,-49],[33,-26]],[[6941,5631],[12,28],[13,-6],[9,20],[16,-10],[3,-16],[-13,-29],[-9,15],[-11,-11],[-6,-27],[-14,13],[0,23]],[[5180,4836],[-17,-13],[-4,-37],[-22,-20],[-36,-22],[-20,-34],[-16,1],[-13,-20],[-39,-14],[-14,-28],[-33,-3],[-6,27],[-12,119],[2,29]],[[4950,4821],[10,15],[3,44],[16,-9],[25,2],[26,-10],[14,-13],[10,8],[16,49],[21,22],[64,18]],[[5075,5398],[9,-40],[30,-48],[-1,-35],[15,-56]],[[5141,5213],[5,-18]],[[4950,4821],[-11,54],[-12,17],[-12,39],[-6,39],[-15,32],[-10,8],[-15,45],[-1,61],[-13,52],[-23,29],[-12,62],[-40,116],[-11,0],[7,61]],[[2918,358],[45,10],[61,-31],[13,-73],[-159,-47],[-53,3],[-25,35],[47,13],[71,90]],[[2527,253],[97,-6],[39,-29],[-96,4],[-40,31]],[[2357,678],[41,4],[7,79],[13,23],[32,-10],[29,-81],[-8,-58],[-51,-15],[-69,6],[-18,34],[24,18]],[[1726,649],[14,8],[85,-17],[20,-17],[-85,-3],[-34,29]],[[1275,565],[60,0],[-7,-20],[-53,20]],[[362,332],[55,10],[39,-32],[-37,-27],[-57,49]],[[0,42],[125,9],[98,31],[65,-33],[63,-12],[50,-15],[86,-11],[64,13],[148,-24],[121,27],[5,22],[-160,13],[-78,29],[16,78],[-54,29],[103,4],[76,31],[10,36],[-61,27],[-129,14],[-60,49],[24,34],[71,11],[54,-16],[83,39],[33,5],[-2,52],[42,-8],[59,22],[62,5],[81,32],[66,0],[29,-9],[60,8],[63,-10],[127,2],[49,22],[28,-11],[51,25],[36,-47],[23,14],[83,-36],[59,11],[94,-17],[12,21],[-25,32],[-42,22],[-12,52],[75,-6],[88,-41],[87,21],[22,-11],[67,19],[53,-4],[19,-18],[82,-18],[79,20],[38,-26],[75,27],[87,19],[35,25],[2,40],[-27,72],[1,37],[22,56],[-7,39],[38,52],[33,29],[35,45],[69,33],[29,27],[22,-22],[-32,-25],[-35,3],[-43,-37],[-1,-36],[10,-16],[-36,-15],[-39,-51],[-4,-17],[20,-34],[35,-26],[38,-88],[18,-99],[-28,-60],[-30,-6],[-23,-33],[-121,-45],[-18,-20],[-148,-3],[80,-57],[-25,-15],[-70,-7],[-2,-38],[59,-51],[87,-20],[72,-30],[110,-20],[139,-53],[161,53],[55,1],[99,-17],[46,34],[271,48],[-25,51],[-132,-9],[-3,53],[79,32],[74,47],[75,18],[95,18],[82,37],[41,29],[-17,30],[22,34],[48,21],[67,68],[64,-20],[12,36],[56,-25],[57,14],[59,-7],[139,50],[53,12],[29,-39],[25,9],[33,31],[129,4],[49,-8],[25,-30],[24,8],[76,3],[126,51],[25,42],[23,-8],[28,-27],[23,3],[32,-28],[31,31],[43,24],[48,16],[53,32],[21,-6],[34,30],[39,10],[5,16],[37,23],[42,11],[41,-8],[20,-33],[33,-29],[26,-5],[33,-26],[22,-3],[37,29],[21,-10],[86,-15],[18,-49],[-3,-34],[-39,-29],[25,-36],[-22,-38],[43,-19],[26,8],[45,65],[18,40],[84,20],[32,53],[82,53],[22,-5],[82,21],[70,-17],[22,6],[76,-3],[17,-10],[64,13],[23,-7],[69,80],[32,-20],[43,-45],[42,-1],[48,12],[33,27],[42,12],[44,-39],[25,2],[41,-24],[51,-1],[32,30],[20,3],[44,-11],[40,8],[40,-10],[44,16],[48,2],[66,17],[16,-36],[19,-8],[74,7],[50,1],[54,-6],[26,-46],[49,-24],[81,-23],[40,15],[56,-39],[52,-10],[11,-19],[67,-35],[76,-1],[52,-10],[62,-34],[-43,-93],[-71,-34],[-41,-51],[-17,-76],[28,-53],[50,-27],[-116,-19],[-44,-84],[60,-53],[142,-61],[12,-23],[146,-15],[89,-27],[-7999,0]],[[4727,5710],[21,11],[6,-15]],[[4754,5706],[-27,4]],[[4754,5706],[-22,-23],[-5,27]],[[3621,5061],[1,22],[16,38],[6,49],[20,38],[7,52],[8,30],[14,17],[15,48],[11,19],[21,5],[28,45],[19,40],[-6,59],[12,65],[14,32],[39,41],[22,78],[16,0],[13,-20],[22,3],[32,-11]],[[4555,5089],[0,174],[0,168],[-7,38],[6,29],[-3,20],[8,23]],[[4559,5541],[29,1],[54,-34],[26,29],[20,3],[45,-25],[17,-2],[11,12]],[[4775,5443],[-11,-54],[-11,-33],[-13,2],[17,-74],[16,-52],[20,-52],[-4,-39],[30,-52]],[[4255,5615],[26,-16],[28,-4],[29,-21],[11,-42],[51,-29],[24,-24],[21,34],[-5,37],[7,23],[16,22],[15,6],[30,-9],[8,-22],[37,-13],[6,-16]],[[4784,4309],[-13,51],[-11,11],[-15,42],[-13,3],[7,27],[15,16]],[[4941,4641],[-16,-43],[2,-27],[23,-6]],[[4950,4565],[-5,-17],[25,-65],[73,-57],[18,1]],[[4957,4649],[5,-15],[-4,-44]],[[4958,4590],[-8,-25]],[[4958,4590],[22,-48],[56,18],[38,26],[13,2]],[[4675,3995],[-18,-10]],[[4685,4214],[9,13],[14,-11],[18,12],[15,-1],[14,22]],[[4422,6170],[13,-39],[-8,-25]],[[4427,6106],[-12,-15],[-3,-26]],[[4457,6027],[22,19]],[[4479,6046],[18,3]],[[4479,6046],[4,21],[-21,27],[-12,-21]],[[4450,6073],[-23,33]],[[4430,6029],[-21,28]],[[4450,6073],[-5,-11]],[[2629,4557],[17,5],[0,-36],[-19,-5],[2,36]],[[6310,4111],[-4,-3],[-3,3],[3,6],[4,-6]],[[4323,5744],[-3,-2],[-2,2],[3,5],[2,-5]],[[2001,6284],[-4,1],[-4,0],[-4,0],[-4,0],[-4,-4],[-5,-5],[-4,-4],[-5,-5],[-3,-2],[-2,-2],[-3,-3],[-3,-2],[-1,-1],[-6,-3],[0,-26],[-6,-5],[-5,-5],[-3,-8],[5,-9],[-2,-12],[0,-13],[0,-10],[6,-10],[3,0],[7,-7],[2,-3],[2,-5],[6,-8],[7,-7],[1,-4],[0,-11],[0,-6]],[[1972,6105],[-29,1],[-32,0],[-30,-1],[-25,0]],[[1856,6105],[1,44],[-3,46],[-4,3],[-2,8],[1,6],[5,5],[0,7]],[[1854,6224],[0,9],[-1,7],[-2,8],[-1,9],[0,11],[-1,3],[-1,14],[0,6],[0,6],[-1,9],[-3,10],[-3,8],[0,9],[0,9],[0,6],[1,6],[-3,7],[0,4]],[[1885,6365],[0,18]],[[1885,6383],[8,1],[4,-26],[7,-8]],[[1904,6350],[15,-3],[23,-8]],[[2009,6318],[2,1]],[[2011,6319],[-1,-3],[-2,-7],[-2,-8],[-3,-8],[-2,-9]],[[1421,6365],[66,0],[67,0]],[[1554,6365],[66,1],[67,0]],[[1687,6366],[0,-87],[1,-58]],[[1688,6221],[-1,-43]],[[1687,6178],[-37,1],[-40,-1],[-35,1],[-43,-1],[0,-24],[-1,-1]],[[1531,6153],[-2,2],[-2,7],[-3,1],[-3,-9],[-5,-2],[-13,3],[0,-4],[-7,1],[-5,-6],[-3,12],[-3,7],[-5,1],[-1,4],[-1,12],[-4,6],[-3,15],[-3,6],[-2,2],[-3,-7],[-4,-6],[-4,5],[0,12],[2,3],[-1,12],[2,13],[2,10],[-7,1],[-5,7],[-6,14],[-4,8],[-5,4],[-4,8],[0,8],[-6,13],[-2,49]],[[1854,6224],[-42,-2],[-36,0],[-45,0],[-43,-1]],[[1687,6366],[77,-1],[75,0]],[[535,4949],[0,14],[-3,17]],[[532,4980],[1,5],[4,8],[-2,9],[1,5],[2,-1],[9,-8]],[[547,4998],[3,-4],[4,-7],[6,-16],[-1,-3]],[[559,4968],[-8,-10],[-8,-7],[-3,-8],[-5,6]],[[533,5030],[-1,-6],[-8,-3],[-4,10],[-2,4],[-1,3],[3,4],[8,-5],[5,-7]],[[516,5050],[0,-6],[-12,2],[1,6],[11,-2]],[[486,5056],[-3,11],[-1,2],[6,6],[2,-3],[7,-16],[-2,-2],[-1,0],[-8,2]],[[449,5092],[1,3],[3,5],[5,-1],[1,-11],[-3,-5],[-7,9]],[[1531,6153],[1,-1],[0,-118]],[[1532,6034],[-66,0]],[[1466,6034],[-67,0]],[[1399,6034],[1,85],[1,14],[-1,6],[-4,3],[0,8],[3,10],[4,10],[4,15],[3,12],[2,6],[-1,7],[-4,4],[-5,9]],[[1402,6223],[0,9],[-2,7],[-1,66],[0,60]],[[1399,6365],[22,0]],[[1402,6223],[-46,0],[-8,-5],[-6,2],[-4,-4],[-8,-5],[-10,1],[-5,-4],[-5,-2],[-4,3],[-8,2],[-5,-2],[-8,-5],[-6,0],[-5,2],[-1,7],[-1,7],[-4,10],[-7,2],[-5,5],[-7,0],[-5,0]],[[1244,6237],[-1,27],[-8,41],[-6,22]],[[1229,6327],[3,9],[32,-16]],[[1264,6320],[12,-45],[5,13],[-3,39],[-8,38]],[[1333,6365],[66,0]],[[1577,5798],[0,-268]],[[1577,5530],[-44,0]],[[1533,5530],[-51,33],[-34,23]],[[1448,5586],[2,9]],[[1450,5595],[3,0],[3,10],[-4,6],[-1,7],[-1,9],[4,11],[2,21],[7,10],[-4,9],[-3,9],[-2,8],[-1,7],[-1,4]],[[1452,5706],[2,9],[-2,9],[0,9],[0,11],[-2,6],[2,6],[4,0],[5,-3],[3,-2],[1,7],[1,2],[0,38]],[[1466,5798],[36,0],[42,0],[33,0]],[[1450,5595],[-28,-5],[-25,-3]],[[1393,5611],[-14,27],[-11,6],[-2,13]],[[1366,5657],[-12,3],[-8,12]],[[1325,5677],[-6,8],[-2,26]],[[1277,5824],[0,11],[-9,16],[-18,39]],[[1240,6034],[93,0]],[[1333,6034],[0,-142],[42,-64],[40,-62],[37,-60]],[[1732,5940],[0,-73],[0,-70]],[[1732,5797],[-21,1]],[[1711,5798],[-27,0],[-38,0],[-35,0],[-34,0]],[[1577,5798],[-1,189]],[[1576,5987],[23,0],[22,0],[44,0],[23,0]],[[1688,5987],[44,0],[0,-46],[0,-1]],[[1466,6034],[0,-236]],[[1333,6034],[66,0]],[[1711,5798],[0,-24]],[[1711,5774],[0,-124],[0,-89],[-21,0],[-40,0],[-20,0],[0,-4],[3,-7]],[[1594,5530],[-17,0]],[[1241,6115],[6,86],[-3,36]],[[1532,6034],[0,-46],[44,-1]],[[1687,6178],[1,-96]],[[1688,6082],[0,-95]],[[2007,5752],[0,-4],[-2,-7],[-4,-5],[-1,-7],[-4,-7],[1,-13],[-3,-5]],[[1994,5704],[0,-3],[-4,-4],[0,-7],[-3,-13],[-3,-2],[-4,-7],[-2,-9],[-5,-17],[0,-11],[2,-13],[-1,-9]],[[1974,5609],[-19,2],[-24,-2],[-21,0]],[[1910,5609],[1,27],[-5,0],[-5,0],[-1,3]],[[1900,5639],[1,41],[0,46],[-4,50]],[[1897,5776],[27,-1],[24,0],[24,0],[25,-3],[2,-5],[-2,-6],[-3,-5],[-1,-4],[14,0]],[[1972,6105],[1,-2],[3,-8],[-2,-3],[0,-10],[1,-5],[1,-7],[7,-5],[3,-7]],[[1986,6058],[1,-3],[2,-3],[1,-5],[4,-4],[2,-4],[-1,-13],[-4,-10],[-2,-4],[-5,-2],[-7,-3],[-2,-8],[3,-4],[0,-7],[-2,-8],[-2,-7],[-6,-7],[0,-9]],[[1968,5957],[-3,4],[-4,8],[-25,-1],[-25,-1],[-20,0],[-20,0]],[[1871,5967],[-2,9],[1,8],[0,8],[-3,14],[-1,6],[-2,1],[0,11],[-1,8],[-4,9],[0,4],[-2,8],[-1,4]],[[1856,6057],[0,5],[-3,5],[2,8],[1,7],[0,5],[-3,7],[0,11],[3,0]],[[1732,5940],[39,0],[29,0],[51,0],[30,0]],[[1881,5940],[6,-7],[3,1],[0,-7],[-3,-9],[2,-5],[3,-9],[5,-5],[0,-51],[0,-50]],[[1897,5798],[-19,0],[-40,0],[-40,0],[-23,0],[-22,0],[-21,-1]],[[1897,5776],[0,22]],[[1881,5940],[-2,10],[-4,6],[-4,7],[0,4]],[[1968,5957],[-2,-12],[2,-14],[4,-9],[4,-9],[5,-6],[2,-2],[2,-9],[0,-8],[3,-2],[4,3],[4,-7],[-1,-9],[-2,-7],[-1,-8],[3,-8],[4,-6],[3,0],[5,-11],[3,-1],[1,-12],[-1,-7],[3,-11],[3,1],[4,-7]],[[2020,5796],[-1,-5],[0,-8],[-3,-4],[-5,-5]],[[2011,5774],[-1,-4],[-1,-7],[-2,-11]],[[1688,6082],[43,0],[33,0],[45,0],[6,-6],[8,-4],[2,2],[5,0],[8,0],[6,-6],[6,-4],[1,-4],[2,-2],[3,-1]],[[1900,5639],[-9,9],[-7,5],[-5,-3],[-7,0],[-5,0],[-4,-4],[-4,-2],[-3,3],[-7,-3],[-4,8],[-3,-7],[-6,3],[-6,8],[-7,-5],[-3,11],[-10,-1],[-7,3],[-7,3],[-4,10],[-6,-3],[-3,4],[-5,5],[0,45],[0,46],[-23,0],[-22,0],[-22,0]],[[1974,5609],[2,-3],[-2,-6],[3,-10],[-1,-6],[3,-8],[-3,-5],[-1,-9],[-5,-7],[-2,-10],[-2,-12],[-2,-5],[1,-12],[19,-1],[21,0],[-1,-8],[-1,-8],[1,-6],[3,-5],[1,-8],[1,-5],[0,-1]],[[2009,5474],[4,-12]],[[2013,5462],[-1,-19],[5,-10],[-4,-6]],[[2013,5427],[-8,7],[-9,-9],[-16,2]],[[1928,5457],[-14,-4]],[[1914,5453],[-1,5],[2,7],[3,7],[0,9],[-1,3],[2,11],[1,6],[2,17],[-2,6],[-2,11],[-2,11],[-1,7],[-4,6],[-1,50]],[[1914,5453],[-18,-11]],[[1853,5387],[-12,-23],[-5,-21]],[[1836,5343],[0,-33],[1,-22]],[[1832,5270],[-15,11],[-18,14]],[[1799,5295],[-6,22],[-5,34]],[[1775,5377],[-8,28],[-11,33]],[[1741,5456],[-19,-1],[-14,-37]],[[1708,5418],[-18,14],[-11,15]],[[1679,5447],[-6,26],[-7,24]],[[1666,5497],[-14,21],[-11,15],[-8,17]],[[2366,6037],[17,-1],[21,-1]],[[2404,6035],[0,-26],[-1,-7]],[[2403,6002],[-10,-2],[-13,-3],[-17,-12]],[[2363,5985],[0,1],[-1,6],[5,5],[-2,4],[1,36]],[[2366,6037],[5,32]],[[2371,6069],[19,0]],[[2390,6069],[26,-1],[3,5],[4,3],[3,-1]],[[2426,6075],[0,-25],[7,-25],[9,-1],[-2,17],[7,-10],[-2,-14],[-15,-8]],[[2430,6009],[-11,1]],[[2419,6010],[0,8],[-4,5],[-2,12],[-9,0]],[[2390,6069],[-2,5],[2,6],[0,12],[1,3],[0,11],[3,10],[2,4],[2,11],[1,8],[1,4],[4,3],[5,5],[1,6],[-2,7],[3,13]],[[2411,6177],[2,11],[7,3]],[[2420,6191],[3,-87],[-1,-5],[4,-7],[1,-7],[3,1]],[[2430,6086],[-4,-11]],[[2419,6010],[-16,-8]],[[2371,6069],[1,39],[-3,1],[0,2],[1,6],[-2,13],[2,10],[-1,7],[-1,14],[1,6],[1,9]],[[2370,6176],[41,1]],[[2040,5703],[28,0],[29,0]],[[2097,5703],[6,-59],[5,-47],[3,-15],[2,-8],[-4,-9],[-1,-15],[1,-9],[0,-8],[-1,-8],[2,-6],[1,-5]],[[2111,5514],[-46,-1],[-12,-2],[-1,-4],[5,-11],[-1,-10],[-1,-6]],[[2055,5480],[-20,5]],[[2035,5485],[-1,72],[4,76],[4,61],[-2,9]],[[2111,5514],[3,-13],[22,-2],[36,-7],[2,-9],[3,5],[0,16],[3,2],[4,-4],[5,-1]],[[2189,5501],[4,-32],[7,-41]],[[2221,5319],[-1,-32],[-1,-18]],[[2219,5269],[-6,-29],[-6,-6],[-11,6]],[[2196,5240],[-4,21],[-8,11]],[[2184,5272],[-12,40],[-10,36],[-3,19],[4,31]],[[2108,5450],[-4,2],[-10,22],[-14,12]],[[2097,5703],[17,-1],[12,1]],[[2126,5703],[28,-1]],[[2154,5702],[-3,-4],[-3,-9],[6,-7],[3,-3],[5,-15],[2,-9],[8,-11],[1,-6],[6,-7],[2,-12],[7,-9],[2,-11],[1,-5],[0,-4],[4,-5],[2,-9],[0,-9],[2,-2],[4,-2]],[[2203,5563],[-11,-28]],[[1994,5704],[22,0],[24,-1]],[[2035,5485],[-17,-3]],[[2018,5482],[-9,-8]],[[2154,5702],[2,2],[12,8],[20,-1],[11,-2],[0,-4],[2,3],[4,-8],[0,-5],[24,-1],[25,-45]],[[2254,5649],[-11,-17],[-3,-16]],[[2240,5616],[-25,-31],[-12,-22]],[[1986,6058],[22,0],[23,0],[17,0],[8,0],[10,0]],[[2066,6058],[-1,-9],[-1,-9],[-1,-8],[-2,-9]],[[2061,6023],[-3,0],[-3,0],[0,-3],[0,-54],[0,-55],[-3,-13],[2,-4],[1,-8],[0,-6],[-2,-3],[-2,-8],[-4,-10],[-3,-13],[-1,-9]],[[2043,5837],[0,-4],[-2,-7],[2,-4],[-4,-3],[-5,-4],[1,-11],[-3,-4],[-6,5],[-6,2],[-1,-4],[1,-7]],[[2061,6023],[7,0],[2,0],[24,0],[21,0],[0,-4]],[[2115,6019],[0,-43],[0,-46],[0,-33]],[[2115,5897],[-2,-2],[2,-9],[-1,-4],[-3,0],[-4,-4],[-5,2],[-1,-10],[-3,-3],[-3,-8],[-3,-2],[-5,-14],[-4,4],[-2,6],[-3,-9],[-3,-6],[-5,6],[-5,-4],[-2,-5],[-6,7],[-5,-5],[-6,4],[0,-6],[-3,2]],[[2115,5897],[7,-1],[4,-4],[6,-11],[5,-3],[3,-4],[6,1],[4,-2],[4,2],[5,1],[1,-7],[4,-4]],[[2164,5865],[1,-5],[0,-10],[2,-7],[1,-7],[4,-6],[2,-6],[4,-1]],[[2178,5823],[-2,-3],[-7,-11],[-7,-5],[0,-4],[-3,-5],[-5,-6],[-1,0],[-2,-4],[-3,-3]],[[2148,5782],[-1,0],[-7,-3]],[[2140,5779],[-15,-2],[-19,2],[-7,0],[-12,1],[-13,1],[-12,0],[-14,-2],[-1,3],[-4,-1],[0,-7],[-32,0]],[[2126,5703],[0,10],[5,3],[2,5],[3,5],[4,2],[6,2],[5,4],[2,4],[4,4],[0,3],[6,7],[1,-4],[9,9],[3,-1],[4,8],[4,2],[0,6],[1,6]],[[2185,5778],[-9,0]],[[2185,5778],[37,-2],[44,0],[24,0],[21,1],[3,0]],[[2314,5777],[3,-48]],[[2115,6019],[12,0],[10,0],[8,1],[7,13]],[[2152,6033],[1,-1],[2,-6],[3,-3],[4,-4],[6,0]],[[2168,6019],[5,5],[5,5],[5,5],[5,5],[6,5]],[[2194,6044],[5,2],[8,2],[3,2]],[[2210,6050],[0,-80]],[[2210,5970],[-3,-2],[1,-6],[-1,-11],[-2,-13],[-2,-10],[-1,-5],[-6,-10],[-2,-3],[-3,-1],[-3,1],[-5,-8],[-1,-9],[0,-4],[-2,-2],[-1,5],[-3,1],[-3,-10],[0,-10],[-3,-7],[-6,-1]],[[2140,5779],[33,-2],[3,1]],[[2178,5823],[1,-8],[2,-3],[1,-1],[3,-4],[5,4],[2,2],[3,-4],[7,4],[1,0],[0,3],[0,2],[3,-2],[3,3],[3,0],[3,3],[1,3],[0,2],[-1,5],[3,8],[5,7],[1,7],[2,4],[2,4],[2,10],[3,-3],[3,-4],[3,2],[1,4],[2,6],[2,4],[1,3],[2,-2],[3,6],[2,4],[2,2],[1,2],[2,3],[1,10],[1,3],[10,-12],[1,-1],[3,9]],[[2273,5908],[0,-1],[3,-1],[3,-3],[-2,-4],[0,-2],[5,-2],[4,-6]],[[2286,5889],[2,-4],[0,-3]],[[2288,5882],[-1,-3],[-1,-1],[-2,-4],[-3,-10],[3,-3],[4,2],[1,-5],[0,-2]],[[2289,5856],[15,-15]],[[2311,5793],[3,-16]],[[2325,5846],[-13,-38],[-2,2],[7,32]],[[2317,5842],[2,3],[6,1]],[[2001,6284],[-2,-4],[-1,-4],[-1,-4],[-1,-4],[-2,-4],[-1,-5],[-1,-4],[-1,-3],[0,-1],[1,1],[4,-2],[2,-9],[19,-8],[13,-9],[6,0],[4,0],[2,-8],[5,-3],[2,-7],[-1,-3],[-1,-8],[4,-1],[-1,-7],[3,-6],[3,-2],[1,6],[4,5],[3,8],[4,0],[3,0],[7,-7],[5,-4],[-3,-5],[-3,-4],[-4,-9],[-3,-12],[-2,-11],[-2,-13],[-1,-9],[-2,-11],[0,-4],[0,-12],[1,-14],[1,-12],[1,-13]],[[2210,5970],[0,-43],[24,0]],[[2234,5927],[-1,-24],[4,4],[4,5],[4,2],[3,5],[7,-2],[2,4],[4,3],[7,-4],[3,-6],[2,-6]],[[2332,5866],[-15,0],[-1,61]],[[2316,5927],[1,3],[2,2],[5,-2]],[[2324,5930],[-3,-5],[0,-9]],[[2321,5916],[5,-25],[5,-9]],[[2331,5882],[1,-16]],[[2286,5889],[2,3],[3,-5],[-3,-5]],[[2317,5842],[-11,18],[-3,40],[-4,-21],[5,-30],[-15,7]],[[2234,5927],[20,-1],[7,1],[16,0],[19,0],[20,0]],[[2332,5866],[0,-2]],[[2332,5864],[-7,-18]],[[2324,5930],[5,4],[1,3],[5,7],[3,5],[-7,12],[0,5],[-2,1],[0,8],[2,6],[-1,6],[4,4],[3,11],[3,2]],[[2340,6004],[17,-19],[-1,-10]],[[2356,5975],[-6,-13],[6,-2],[-5,-34]],[[2351,5926],[-16,-36],[-2,12],[-4,2],[-8,12]],[[2363,5985],[-1,-1],[32,9],[7,-9]],[[2401,5984],[-31,-15],[-14,0]],[[2356,5969],[0,6]],[[2340,6004],[-3,3],[-4,3],[-2,7],[1,6],[-3,4],[-5,7],[-30,0],[-32,0],[-35,0],[0,24],[0,2]],[[2227,6060],[19,15]],[[2246,6075],[0,5],[-2,14],[-4,10]],[[2240,6104],[4,2],[4,3],[2,2]],[[2293,6111],[2,8],[3,6],[2,5]],[[2300,6130],[2,3],[24,34]],[[2326,6167],[10,9]],[[2336,6176],[34,0]],[[2210,6050],[6,2]],[[2216,6052],[11,8]],[[2420,6191],[9,7]],[[2429,6198],[8,21],[7,37]],[[2461,6292],[7,-13],[15,8]],[[2483,6287],[10,-13]],[[2488,6144],[-23,-16],[-23,-14]],[[2442,6114],[-12,-28]],[[2011,6319],[5,0],[2,1],[18,12]],[[2036,6332],[19,-16],[7,-5],[6,-6],[6,-4],[4,-3],[1,-2],[4,-4],[5,-3],[4,-4],[4,-4],[5,-4],[4,-3],[4,-4],[5,-4]],[[2114,6266],[1,-6],[1,-6]],[[2116,6254],[5,-5],[-1,-5],[6,-1],[4,5],[0,-2],[1,-5],[0,-5],[4,-7],[3,0],[2,0],[2,0],[3,-6],[-3,-8]],[[2142,6215],[4,-4],[5,-5],[6,-5],[4,-4],[4,-4]],[[2165,6193],[1,-7],[1,-6],[1,-8],[0,-8],[1,-8],[1,-9],[1,-9],[1,-8],[1,-10],[1,-11]],[[2174,6109],[-1,-5],[-5,-22],[0,-1],[-10,-26],[-5,-17]],[[2153,6038],[-1,0],[0,-5]],[[595,6789],[15,-3],[9,-14]],[[619,6772],[-19,-23],[-22,-18]],[[578,6731],[-12,12],[-3,22]],[[563,6765],[20,17],[12,7]],[[301,6904],[17,-5],[2,-18],[-13,-7],[-15,9],[-13,13],[22,8]],[[184,7064],[13,-9],[14,5],[18,-12],[22,-7],[-2,-5],[-16,-10],[-17,11],[-9,8],[-19,-3],[-6,5],[2,17]],[[867,6900],[21,-1],[22,-14]],[[910,6885],[16,-20],[19,-31]],[[945,6834],[22,26],[22,15]],[[1001,6851],[15,-19],[20,-22]],[[1036,6810],[14,-34],[23,-54]],[[1099,6640],[-12,17],[-20,16]],[[1020,6797],[-21,3],[-35,1]],[[892,6864],[-22,9],[-38,16]],[[711,6884],[-13,-3],[-25,-9]],[[673,6872],[-20,-16],[-25,-10]],[[628,6846],[-3,27],[10,47],[24,14],[-6,12],[-29,-26],[-15,-32]],[[573,6798],[-24,-20],[-23,-14]],[[438,6679],[-21,-13],[-22,-16],[-19,-16]],[[376,6634],[-38,-13],[-3,8]],[[335,6629],[24,22],[22,14]],[[443,6716],[31,28],[5,10],[16,17]],[[499,6806],[11,28],[-25,-14],[-8,8],[-12,-17]],[[465,6811],[-14,24],[-6,-17],[-9,24],[-22,-19],[-13,0]],[[401,6823],[-2,28],[4,17]],[[360,6876],[-19,22],[-15,11]],[[308,6956],[9,28],[18,26],[8,24]],[[343,7034],[18,4],[15,-8]],[[394,7053],[16,-4],[17,15]],[[423,7085],[-12,9],[16,18],[-14,-1],[-23,-10]],[[390,7101],[-7,-10],[-17,10],[-32,-5]],[[264,7154],[31,19],[50,23]],[[345,7196],[18,0],[-3,-23]],[[362,7222],[-16,24],[-21,20]],[[294,7281],[13,25],[39,1]],[[374,7329],[5,23],[23,22]],[[402,7374],[22,5],[42,21]],[[486,7397],[34,26],[34,-10],[16,-22],[10,9]],[[616,7387],[34,-8],[23,4]],[[720,7368],[42,-4],[17,-6]],[[809,7366],[34,-15],[24,-6]],[[2589,6405],[36,-23],[-8,-14],[-30,16],[2,21]],[[2731,6479],[-30,-4],[-31,-47],[-42,-11],[-28,10],[-14,-3],[-36,4],[-27,-3],[-16,-22],[-5,-22],[-16,-3],[-21,-24],[-26,-60],[31,41],[49,36],[38,4],[15,-14],[-2,-23],[-21,-19],[-26,5],[-9,-6]],[[2514,6318],[-34,-4],[0,-17],[-15,-12]],[[2465,6285],[-21,-29]],[[2444,6256],[-9,-42],[-24,-37]],[[2411,6177],[-72,-1]],[[2339,6176],[9,10],[-12,20],[-22,-12],[-18,10],[-23,28],[-22,7],[-17,37],[-1,78],[-1,104]],[[2232,6458],[0,1],[0,23],[12,0],[11,42],[-10,32],[-1,46],[-14,33],[29,16],[25,26],[15,33],[0,39],[-14,43],[-31,35],[28,60],[-10,18],[1,37],[-10,51],[17,13],[39,-12],[27,-2],[16,11],[24,-18],[28,-45],[23,-3],[13,-19],[4,-39],[-4,-17],[9,-30],[43,-28],[17,10],[22,27],[2,32],[23,27]],[[2566,6900],[-7,-37],[18,-48],[-9,-20],[15,-17],[-5,-45],[6,-43],[12,-27],[-11,-32],[-15,6],[-30,-2],[-20,26],[-27,-56],[20,-34],[5,-30],[14,-28],[21,2],[17,-15],[13,7],[148,0],[0,-28]],[[2566,6900],[43,-101],[15,-25],[0,-40],[11,-40],[23,-9],[5,-22],[27,-9],[0,-12],[24,-5],[10,-11],[6,-37],[15,2],[14,-20],[-5,-28],[8,-31],[-31,-33]],[[2752,6420],[2,-23],[19,-19],[15,12],[24,-13],[-11,-32],[11,-36],[18,-15],[-10,-40]],[[2820,6254],[-22,7],[4,26],[-14,1],[-28,11],[-41,0],[-9,5],[-24,-7],[-6,17],[18,24],[2,27],[12,32],[13,44],[15,35],[18,14],[10,-3],[-10,-34],[-6,-33]],[[1047,6583],[-3,26],[29,-9],[-6,-34],[-10,-5],[-10,22]],[[1175,6406],[-19,23],[-2,25],[19,-12],[39,-15],[15,-40],[22,-16],[10,-29],[-13,-7],[-26,18],[-31,33],[-3,22],[-11,-2]],[[912,6885],[115,0],[195,1],[26,-1]],[[1248,6885],[86,0]],[[1334,6885],[-1,-283],[2,-19],[14,-19],[12,-4],[25,-47],[23,-22],[21,-38],[19,-23],[2,-39],[14,-26]],[[1465,6365],[-44,0]],[[1421,6365],[-62,0],[-87,0],[-12,18],[-13,5],[-19,23],[-7,24],[-20,0],[-5,19],[-19,-3],[-17,17],[-1,49],[-9,12],[-7,31],[-17,12],[-17,27],[-7,33],[10,30],[-10,40],[-32,32],[-35,79],[-34,38]],[[1001,6851],[-12,25],[-19,-9],[-3,-15],[-25,-3],[-30,36]],[[1555,7587],[0,33]],[[1555,7620],[0,16],[0,1],[0,16],[0,12],[48,-20],[49,-5],[-8,-43],[-26,-6],[-37,7],[-26,-11]],[[1555,7474],[0,2],[0,2],[0,4],[0,5],[0,1],[0,11],[50,-40],[-7,58],[27,-2],[31,-22],[10,-35],[15,-25],[-7,-22],[69,-48],[-20,-29],[16,-15],[-26,-17],[-49,4],[-42,21],[-7,-14],[-27,-5],[-25,-14],[-75,-6],[-15,32],[-63,10],[-7,11]],[[1403,7341],[-5,17],[93,0],[64,0],[0,116]],[[1893,6885],[-107,0],[-53,0]],[[1733,6885],[0,200],[-164,29],[-28,32],[-41,0],[-181,118],[-1,73]],[[1318,7337],[62,-27],[37,-7],[14,7],[34,-23],[-33,-27],[56,-12],[45,5],[18,9],[25,-12],[24,0],[19,27],[-27,15],[57,13],[11,-25],[18,-15],[21,1],[27,-16],[36,7],[39,-8],[8,21],[29,16],[18,-15],[39,-5],[21,27],[-13,19],[2,20],[-38,16],[-13,23],[-1,25],[15,38],[30,19],[36,-31],[6,-27],[27,-53],[39,-31],[13,13],[26,-24],[4,-18],[-13,-17],[20,-31],[21,3],[14,29],[3,27],[23,20],[-17,13],[-1,21],[24,5],[40,-9],[29,-23],[2,-26],[-22,-17],[3,-18],[19,-20],[-20,-36],[-39,-13],[-11,-11],[-33,-2],[-27,-37],[3,-16],[-20,-33],[-19,-18],[-22,3],[-10,-18],[-17,-4],[7,-24],[-48,-42],[-35,-62],[-10,-41]],[[2638,7198],[-30,-38],[-13,-8],[-3,-27],[-32,8],[-47,63],[-21,-7],[15,-55],[30,-18],[2,-18],[27,-40],[-5,-34],[-32,0],[-32,8],[38,-42],[-11,-16],[-22,13],[-26,5],[-23,19],[-40,19],[-44,57],[-50,9],[-27,-11],[-30,20],[5,19],[29,17],[24,-10],[24,7],[18,20],[-17,16],[49,54],[-21,49],[-35,23],[-18,22],[-47,28],[-83,13],[-19,-14],[-88,14],[-54,17],[-17,21],[-15,48],[26,65],[53,26],[30,-1],[-32,-45],[21,-6],[15,29],[49,18],[28,-1],[8,-21],[42,-41],[38,16],[53,-11],[4,-18],[30,-17],[48,-13],[-14,-34],[37,7],[49,-18],[23,-28],[-16,-8],[30,-27],[-43,-17],[2,-12],[30,-6],[29,-24],[28,-7],[29,-40],[29,0],[15,-17]],[[2499,7971],[92,-7],[49,-28],[-71,-23],[-8,-17],[-94,-36],[-48,-39],[-82,-29],[2,-22],[-19,-28],[-53,-15],[-29,-27],[27,-10],[-2,-23],[-56,-17],[-7,15],[-72,-2],[-21,-8],[-90,7],[-7,20],[46,13],[-14,33],[32,46],[53,8],[-17,31],[-32,7],[9,36],[-52,9],[-43,21],[51,45],[112,8],[33,23],[122,14],[189,-5]],[[1850,7688],[22,5],[59,-22],[37,4],[47,-19],[-15,-14],[40,-22],[40,-5],[55,18],[35,1],[45,-9],[22,-35],[-21,-15],[-162,-6],[-53,4],[-47,12],[-10,20],[11,18],[-17,29],[-41,3],[-31,13],[-16,20]],[[2080,7102],[8,53],[87,-48],[18,-29],[24,-12],[-19,-17],[-33,14],[-26,1],[-19,-22],[-23,-3],[0,20],[-17,43]],[[1903,7884],[49,6],[33,-26],[66,-13],[16,-24],[46,-30],[-34,-10],[-53,-43],[-83,7],[-56,46],[-38,38],[54,49]],[[1753,7516],[21,28],[23,-8],[42,5],[-1,-43],[22,-25],[-4,-24],[-44,-29],[-49,42],[-25,5],[-22,23],[54,0],[-17,26]],[[1875,7514],[8,34],[39,8],[73,-14],[-36,-48],[-58,-40],[-26,32],[0,28]],[[1790,7641],[-20,31],[59,-7],[7,-38],[-14,-32],[-52,1],[-34,41],[0,26],[54,-22]],[[1787,7313],[36,40],[42,-31],[10,-19],[-15,-17],[-70,20],[-3,7]],[[1688,7766],[1,35],[99,-36],[-27,-25],[-73,26]],[[2205,7536],[58,-4],[21,-8],[26,-29],[-88,-1],[-18,19],[1,23]],[[2333,7269],[-2,-27],[-18,-14],[-25,1],[-7,20],[11,22],[25,8],[16,-10]],[[1867,7588],[5,31],[31,4],[19,-16],[-5,-29],[-50,10]],[[2173,7026],[6,-12],[-24,-24],[-21,10],[10,19],[29,7]],[[1823,7775],[69,-22],[-32,-23],[-33,8],[-4,37]],[[1661,7497],[-27,22],[44,6],[-17,-28]],[[2232,6971],[-16,0],[7,27],[15,-10],[-6,-17]],[[1929,7723],[-9,-13],[-51,1],[9,17],[51,-5]],[[1556,7733],[-6,-20],[-40,-8],[-26,27],[72,9],[0,-8]],[[1555,7587],[-37,-16],[-40,-4],[-20,14],[-73,26],[26,43],[45,16],[99,-46]],[[1403,7341],[-15,45],[-20,20],[8,25],[-22,4],[12,41],[26,20],[62,22],[14,-12],[87,-32]],[[1733,6885],[-114,0],[-64,0]],[[1555,6885],[-221,0]],[[1248,6885],[-17,34],[-51,3],[-4,28],[-20,15],[-27,38],[-21,39],[7,8],[-26,40],[-31,21],[-7,18],[12,21],[-37,34],[-5,32],[-47,1],[-6,33],[0,56]],[[968,7306],[9,-1],[7,-5],[2,6],[9,2]],[[995,7308],[5,-3],[3,3],[92,56],[43,-17],[17,25],[19,-1],[28,-41],[20,16],[41,-12],[4,16],[51,-13]],[[1339,7549],[36,12],[30,-11],[32,-27],[-85,-40],[-29,-33],[-2,-20],[-57,-21],[-19,28],[-40,14],[18,29],[2,24],[18,22],[-12,36],[68,11],[40,-24]],[[1419,7690],[5,-15],[-38,-20],[-21,3],[-29,-23],[-58,12],[74,58],[61,11],[6,-26]],[[995,7308],[-13,-2],[-1,5],[1,15],[45,8],[-13,-17],[-13,-11],[-6,2]],[[2514,6318],[24,-5],[3,-11],[18,7],[-2,-45],[9,-29],[11,-12]],[[2577,6223],[-6,-7]],[[2571,6216],[-32,-28],[-20,-8],[-14,5],[-12,23],[0,66]],[[2483,6287],[-18,-2]],[[2653,6233],[18,-2],[-10,-22],[-23,-7],[-6,23],[19,41],[9,-3],[-7,-30]],[[2577,6223],[34,-16],[23,1],[4,-20],[-28,-21],[-34,-8],[-21,-44],[-16,-10],[-9,12],[0,28],[9,17],[30,31],[2,23]],[[1733,6885],[0,-88],[0,-109],[7,-116],[3,-115],[4,-92]],[[1747,6365],[-60,0],[-46,0],[-86,0]],[[1555,6365],[0,237],[0,111],[0,172]],[[1555,6365],[-90,0]],[[2578,6242],[31,2],[-4,-23],[-27,21]],[[912,6885],[-3,17],[-20,-8],[-22,6]],[[867,6900],[0,75],[0,187],[0,122],[-1,57],[42,-6],[12,-13],[48,-16]],[[1893,6885],[0,-46],[9,-14],[28,1],[0,-11],[21,-70],[26,11],[41,-19]],[[2018,6737],[-3,-11],[-34,-45],[-62,-92],[-34,-43],[0,-163]],[[1885,6365],[-62,0],[-76,0]],[[2339,6176],[-13,-9]],[[2326,6167],[-15,-20],[-22,-15],[-47,-11],[-15,-24],[7,-21],[-17,-4],[-7,-11],[-18,4],[-25,-29],[-3,22],[4,22],[15,18],[0,35],[11,25],[26,-7],[6,22],[-21,47],[-19,9],[-30,3],[-24,7],[-16,31],[3,18],[-9,12],[4,16],[-22,1],[-13,38],[-19,-1],[-15,9],[-26,-22],[-5,-18],[-42,-1],[-38,26],[-12,-5],[-24,9],[-6,29],[-7,2]],[[2018,6737],[27,-20],[13,-23],[32,-12],[30,-22],[15,4],[31,-7],[7,-15],[-5,-23],[7,-27],[-4,-39],[16,-24],[5,-17],[17,-18],[4,-18],[19,-18]],[[2158,6222],[21,0],[-3,-19],[-18,19]]],"transform":{"scale":[0.0450056257032129,0.02114735491113987],"translate":[-180,-85.60903777459771]}};

function decodeTopoObject(topology, objectName) {
  const scale = topology.transform.scale;
  const translate = topology.transform.translate;
  const absArcs = topology.arcs.map((arc) => {
    let ax = 0;
    let ay = 0;
    return arc.map(([dx, dy]) => {
      ax += dx;
      ay += dy;
      return [ax * scale[0] + translate[0], ay * scale[1] + translate[1]];
    });
  });
  const ring = (arcIdxs) => {
    const pts = [];
    arcIdxs.forEach((i) => {
      let seg = i < 0 ? absArcs[~i].slice().reverse() : absArcs[i];
      if (pts.length > 0) seg = seg.slice(1);
      seg.forEach((p) => pts.push(p));
    });
    return pts;
  };
  const toGeometry = (g) => {
    if (g.type === "Polygon") return { type: "Polygon", coordinates: g.arcs.map(ring) };
    if (g.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: g.arcs.map((poly) => poly.map(ring)) };
    return null;
  };
  return topology.objects[objectName].geometries
    .map((g) => ({ type: "Feature", properties: g.properties || {}, geometry: toGeometry(g) }))
    .filter((f) => f.geometry);
}

const PROJ_W = 1030;
const PROJ_H = 540;
const TINY_AREA = 45;
const BACKDROP_LAND = "#E1DDD2";

function buildProjectionScene() {
  const projection = d3.geoNaturalEarth1().fitExtent(
    [[6, 6], [PROJ_W - 6, PROJ_H - 6]], { type: "Sphere" });
  const path = d3.geoPath(projection);
  const countries = decodeTopoObject(WORLD_TOPO, "countries");
  const admin1 = decodeTopoObject(WORLD_TOPO, "admin1");
  const byName = (features) => {
    const m = {};
    features.forEach((f) => { m[f.properties.name] = f; });
    return m;
  };
  const countryByName = byName(countries);
  const admin1ByName = byName(admin1);
  const modelledCountries = new Set(Object.values(MAP_COUNTRY));
  const modelledAdmin1 = new Set(Object.values(MAP_ADMIN1));
  const backdropCountries = countries
    .filter((f) => !modelledCountries.has(f.properties.name))
    .map((f) => path(f));
  const backdropAdmin1 = admin1
    .filter((f) => !modelledAdmin1.has(f.properties.name))
    .map((f) => path(f));
  const regions = JURISDICTIONS.map((j) => {
    const feat = MAP_COUNTRY[j.id]
      ? countryByName[MAP_COUNTRY[j.id]]
      : admin1ByName[MAP_ADMIN1[j.id]];
    if (!feat) return null;
    return {
      id: j.id,
      d: path(feat),
      tiny: path.area(feat) < TINY_AREA,
      layer: MAP_COUNTRY[j.id] ? "country" : "admin1",
      point: projection(GEO[j.id]),
    };
  }).filter(Boolean);
  return {
    spherePath: path({ type: "Sphere" }),
    graticulePath: path(d3.geoGraticule10()),
    backdropCountries,
    backdropAdmin1,
    regions,
  };
}

function ProjectionMap({ selection, onToggle, reduceMotion }) {
  const [focusId, setFocusId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const scene = useMemo(buildProjectionScene, []);
  const transition = reduceMotion ? "none" : "fill 140ms ease, stroke 140ms ease";
  const countryRegions = scene.regions.filter((r) => r.layer === "country");
  const admin1Regions = scene.regions.filter((r) => r.layer === "admin1");

  const renderRegion = (r) => {
    const j = J_BY_ID[r.id];
    const isSel = selection.has(r.id);
    const isFocus = focusId === r.id;
    const isHover = hoverId === r.id;
    const emphasised = isHover || isFocus;
    return (
      <g
        key={r.id}
        role="button"
        tabIndex={0}
        aria-pressed={isSel}
        aria-label={j.name + (isSel ? ", selected" : "")}
        onClick={() => onToggle(r.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(r.id); }
        }}
        onFocus={() => setFocusId(r.id)}
        onBlur={() => setFocusId((f) => (f === r.id ? null : f))}
        onMouseEnter={() => setHoverId(r.id)}
        onMouseLeave={() => setHoverId((h) => (h === r.id ? null : h))}
        style={{ cursor: "pointer", outline: "none" }}
      >
        <title>{j.name}</title>
        <path
          d={r.d}
          fill={isSel ? C.ink : C.paper}
          stroke={emphasised ? C.ink : C.inkSoft}
          strokeWidth={emphasised ? 1.3 : 0.7}
          style={{ transition }}
        />
        {r.tiny && (
          <circle cx={r.point[0]} cy={r.point[1]} r={4.5}
            fill={isSel ? C.ink : C.paper}
            stroke={emphasised ? C.ink : C.inkSoft}
            strokeWidth={1.1}
            style={{ transition }}
          />
        )}
        {j.tier === 1 && (
          <circle cx={r.point[0]} cy={r.point[1]} r={7} fill="none" stroke={C.law} strokeWidth={1.1} />
        )}
        {isFocus && (
          <circle cx={r.point[0]} cy={r.point[1]} r={10} fill="none"
            stroke={C.ink} strokeWidth={1.3} strokeDasharray="3 2" />
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox={"0 0 " + PROJ_W + " " + PROJ_H}
      role="group"
      aria-label="Territory selection map: world projection with geographic borders"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <path d={scene.spherePath} fill={C.paper} stroke={C.inkSoft} strokeWidth={1} />
      <path d={scene.graticulePath} fill="none" stroke={C.sheetDeep} strokeWidth={0.6} />
      <g aria-hidden="true">
        {scene.backdropCountries.map((d, i) => (
          <path key={i} d={d} fill={BACKDROP_LAND} stroke={C.paper} strokeWidth={0.5} />
        ))}
      </g>
      {countryRegions.map(renderRegion)}
      <g aria-hidden="true" style={{ pointerEvents: "none" }}>
        {scene.backdropAdmin1.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={C.inkSoft} strokeWidth={0.45} strokeOpacity={0.65} />
        ))}
      </g>
      {admin1Regions.map(renderRegion)}
      <g style={{ pointerEvents: "none" }}>
        {scene.regions.map((r) => {
          const show = hoverId === r.id || focusId === r.id || (selection.has(r.id) && r.tiny);
          if (!show) return null;
          return (
            <text key={r.id} x={r.point[0] + 9} y={r.point[1] + 4}
              style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 600, fill: C.ink,
                paintOrder: "stroke", stroke: C.paper, strokeWidth: 3,
              }}>
              {J_BY_ID[r.id].code}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

/* ------------------------------ tile map ---------------------------- */

function TileMap({ selection, onToggle, reduceMotion }) {
  const [focusId, setFocusId] = useState(null);
  const transition = reduceMotion ? "none" : "fill 140ms ease, stroke 140ms ease";

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      role="group"
      aria-label="Territory selection map: stylised tiles arranged by region"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {REGION_CAPTIONS.map((r) => (
        <text key={r.text} x={PAD_X + r.col * CELL} y={16}
          style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fill: C.inkSoft }}>
          {r.text}
        </text>
      ))}
      {JURISDICTIONS.map((j) => {
        const x = PAD_X + j.col * CELL;
        const y = PAD_TOP + j.row * CELL;
        const isSel = selection.has(j.id);
        const isFocus = focusId === j.id;
        return (
          <g
            key={j.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSel}
            aria-label={`${j.name}${isSel ? ", selected" : ""}`}
            onClick={() => onToggle(j.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(j.id); }
            }}
            onFocus={() => setFocusId(j.id)}
            onBlur={() => setFocusId((f) => (f === j.id ? null : f))}
            style={{ cursor: "pointer", outline: "none" }}
          >
            <title>{j.name}</title>
            {isFocus && (
              <rect x={x - 3} y={y - 3} width={TILE_W + 6} height={TILE_H + 6} rx={4}
                fill="none" stroke={C.ink} strokeWidth={1.5} strokeDasharray="3 2" />
            )}
            <rect x={x} y={y} width={TILE_W} height={TILE_H} rx={3}
              fill={isSel ? C.ink : C.paper}
              stroke={isSel ? C.ink : C.inkSoft}
              strokeWidth={j.tier === 1 ? 1.8 : 1}
              strokeDasharray={j.prospective ? "4 3" : undefined}
              style={{ transition }}
            />
            <text x={x + TILE_W / 2} y={y + TILE_H / 2 + 4} textAnchor="middle"
              style={{
                fontFamily: MONO, fontSize: 12, fontWeight: 600,
                fill: isSel ? C.paper : C.ink, pointerEvents: "none", transition,
              }}>
              {j.code}
            </text>
            {j.tier === 1 && (
              <circle cx={x + TILE_W - 7} cy={y + 7} r={2.5}
                fill={isSel ? C.paper : C.law} style={{ transition }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------- summary strip ------------------------- */

function SummaryStrip({ selection, onToggle }) {
  const selected = JURISDICTIONS.filter((j) => selection.has(j.id));
  if (selected.length === 0) {
    return (
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft, margin: "14px 0 0" }}>
        No territories selected. Choose tiles on the map or use a bloc shortcut. Selection is additive.
      </p>
    );
  }
  const riskLedger = {};
  selected.forEach((j) => {
    j.risks.forEach((r) => {
      if (!riskLedger[r]) riskLedger[r] = [];
      riskLedger[r].push(j.code);
    });
  });
  const riskKeys = Object.keys(riskLedger);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {selected.map((j) => (
          <button
            key={j.id}
            onClick={() => onToggle(j.id)}
            aria-label={`Remove ${j.name} from selection`}
            title={`${j.name}. Click to remove.`}
            style={{
              fontFamily: MONO, fontSize: 11, color: C.ink,
              background: C.sheetDeep, border: `1px solid ${C.inkSoft}`,
              borderRadius: 2, padding: "3px 8px", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >
            <span style={{ fontWeight: 700 }}>{j.code}</span>
            <span style={{ color: C.inkSoft }}>{j.name}</span>
            {j.risks.length > 0 && (
              <span aria-hidden="true" style={{
                width: 6, height: 6, borderRadius: 3, background: C.law, display: "inline-block",
              }} />
            )}
          </button>
        ))}
      </div>
      {riskKeys.length > 0 && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.sheetDeep}`, paddingTop: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginBottom: 6 }}>
            Risk indicators across the selection
          </div>
          {riskKeys.map((k) => (
            <div key={k} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: C.law, flexShrink: 0, position: "relative", top: -1 }} />
              <span style={{ fontFamily: SERIF, fontSize: 13, color: C.ink }}>
                {RISKS[k]}
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}> ({riskLedger[k].join(", ")})</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- territory view ------------------------- */

function TerritoryView({ selection, setSelection, reduceMotion }) {
  const [mapMode, setMapMode] = useState("tiles");
  const toggle = useCallback((id) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [setSelection]);

  const toggleBloc = useCallback((members) => {
    setSelection((prev) => {
      const next = new Set(prev);
      const allIn = members.every((id) => next.has(id));
      if (allIn) members.forEach((id) => next.delete(id));
      else members.forEach((id) => next.add(id));
      return next;
    });
  }, [setSelection]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginRight: 4 }}>
          Bloc shortcuts
        </span>
        {BLOCS.map((b) => {
          const allIn = b.members.every((id) => selection.has(id));
          return (
            <button
              key={b.id}
              onClick={() => toggleBloc(b.members)}
              aria-pressed={allIn}
              style={{
                fontFamily: MONO, fontSize: 11, borderRadius: 2, padding: "4px 10px",
                cursor: "pointer",
                background: allIn ? C.ink : C.paper,
                color: allIn ? C.paper : C.ink,
                border: `1px solid ${allIn ? C.ink : C.inkSoft}`,
              }}
            >
              {b.label}
            </button>
          );
        })}
        <button
          onClick={() => setSelection(new Set())}
          disabled={selection.size === 0}
          style={{
            fontFamily: MONO, fontSize: 11, borderRadius: 2, padding: "4px 10px",
            cursor: selection.size === 0 ? "default" : "pointer",
            background: "transparent", color: selection.size === 0 ? C.sheetDeep : C.law,
            border: `1px solid ${selection.size === 0 ? C.sheetDeep : C.law}`,
          }}
        >
          Clear selection
        </button>
      </div>
      <p style={{ fontFamily: SERIF, fontSize: 13, color: C.inkSoft, margin: "0 0 10px", maxWidth: 760 }}>
        The tile map arranges stylised tiles by region; the projection map draws world borders,
        including United States state and Canadian provincial boundaries, and fills a territory when
        selected. Only group territories are interactive, and very small territories carry a marker so
        they stay clickable. Click or press Enter to toggle a territory; shortcuts toggle a whole bloc.
        Anchor jurisdictions carry a red mark.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          { id: "tiles", label: "Tile map" },
          { id: "projection", label: "Projection map" },
        ].map((m) => {
          const active = mapMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMapMode(m.id)}
              aria-pressed={active}
              style={{
                fontFamily: MONO, fontSize: 11, borderRadius: 2, padding: "4px 10px",
                cursor: "pointer",
                background: active ? C.ink : C.paper,
                color: active ? C.paper : C.ink,
                border: `1px solid ${active ? C.ink : C.inkSoft}`,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 4, padding: 10 }}>
        {mapMode === "tiles"
          ? <TileMap selection={selection} onToggle={toggle} reduceMotion={reduceMotion} />
          : <ProjectionMap selection={selection} onToggle={toggle} reduceMotion={reduceMotion} />}
      </div>
      <SummaryStrip selection={selection} onToggle={toggle} />
    </div>
  );
}

/* ---------------------------- exposure view ------------------------- */

function whyLine(entry) {
  const { obligation, matched } = entry;
  const codes = matched.map((id) => J_BY_ID[id].code);
  const shown = codes.slice(0, 8).join(", ");
  const extra = codes.length > 8 ? ` and ${codes.length - 8} more` : "";
  const acts = obligation.activities.map((a) => ACTIVITIES[a]).join("; ");
  return { via: shown + extra, acts };
}

function ExposureView({ selection }) {
  const resolved = useMemo(() => resolveObligations([...selection]), [selection]);

  if (selection.size === 0) {
    return (
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft }}>
        Select at least one territory on the Territory view to derive the applicable obligation set.
      </p>
    );
  }

  const verifyCount = resolved.filter((r) => r.obligation.verify).length;

  return (
    <div>
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.ink, margin: "0 0 4px" }}>
        {resolved.length} obligations apply to the current selection of {selection.size}{" "}
        {selection.size === 1 ? "territory" : "territories"}, given the group's activity profile.
      </p>
      <p style={{ fontFamily: SERIF, fontSize: 13, color: C.inkSoft, margin: "0 0 18px" }}>
        {verifyCount} carry a verify label and must be checked against primary sources before reliance.
        Voluntary frameworks are listed because they are the instruments through which the mandatory set is evidenced.
      </p>
      {CATEGORIES.map((cat) => {
        const rows = resolved.filter((r) => r.obligation.category === cat.id);
        if (rows.length === 0) return null;
        return (
          <section key={cat.id} style={{ marginBottom: 22 }}>
            <h3 style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase",
              color: C.inkSoft, borderBottom: `1px solid ${C.sheetDeep}`,
              paddingBottom: 5, margin: "0 0 10px",
            }}>
              {cat.label} <span style={{ color: C.ink }}>({rows.length})</span>
            </h3>
            {rows.map((entry) => {
              const o = entry.obligation;
              const meta = TYPE_META[o.type];
              const { via, acts } = whyLine(entry);
              return (
                <article key={o.id} style={{
                  background: C.paper, border: `1px solid ${C.sheetDeep}`,
                  borderLeft: `3px solid ${meta.colour}`, borderRadius: 3,
                  padding: "10px 12px", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: C.ink }}>{o.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}>{o.instrument}</span>
                    <Pill text={meta.label} colour={meta.colour} />
                    {o.verify && <VerifyPill />}
                  </div>
                  <p style={{ fontFamily: SERIF, fontSize: 13, color: C.ink, margin: "6px 0 4px", lineHeight: 1.45 }}>
                    {o.note}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft, margin: 0 }}>
                    applies via: {via} · triggered by: {acts}
                  </p>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/* ----------------------------- scoring -----------------------------
   Two axes per control: implementation level 1 to 4, and assurance
   depth 1 to 4. Assurance discounts evidence: designed but weakly
   evidenced controls count for less. Scoring is territory-aware: an
   obligation counts evidence at the level operated in the weakest
   territory it applies to, which is the auditor's view and the link
   to the harmonisation measure. The cap applies to the score only;
   surplus evidence is retained as the harmonisation dividend.
------------------------------------------------------------------- */

const AF = { 1: 0.4, 2: 0.7, 3: 0.8, 4: 1 };
const ASSURANCE_LABELS = ["Self-declared", "Self-assessed", "Internally tested", "Independently assured"];

const fmt = (x) => (Math.round(x * 10) / 10).toString();

function optionWeight(control, level, oblId) {
  if (!level) return 0;
  const e = control.options[level - 1].evidences.find((x) => x.o === oblId);
  return e ? e.w : 0;
}

function computeCompliance(selection, base, assurance, overrides, mods) {
  const modMap = {};
  (mods || []).forEach((m) => { modMap[m.o] = (modMap[m.o] || 0) + m.delta; });
  const resolved = resolveObligations([...selection]);
  let earned = 0;
  let required = 0;
  let surplus = 0;
  const rows = resolved.map(({ obligation, matched }) => {
    let raw = 0;
    ALL_CONTROLS.forEach((c) => {
      const b = base[c.id];
      if (!b) return;
      const ov = overrides[c.id] || {};
      let minW = Infinity;
      matched.forEach((t) => {
        const w = optionWeight(c, ov[t] || b, obligation.id);
        if (w < minW) minW = w;
      });
      if (minW === Infinity) minW = 0;
      raw += minW * AF[assurance[c.id] || 2];
    });
    const req = obligation.weight + (modMap[obligation.id] || 0);
    const pts = Math.min(raw, req);
    earned += pts;
    required += req;
    surplus += Math.max(0, raw - req);
    return { obligation, matched, req, pts, raw };
  });
  return {
    rows,
    score: required > 0 ? Math.round((earned / required) * 100) : 0,
    surplus: Math.round(surplus),
    satisfied: rows.filter((r) => r.pts >= r.req - 1e-9).length,
    partial: rows.filter((r) => r.pts > 1e-9 && r.pts < r.req - 1e-9).length,
    open: rows.filter((r) => r.pts <= 1e-9).length,
  };
}

function upgradePaths(oblId, base) {
  const paths = [];
  ALL_CONTROLS.forEach((c) => {
    const cur = base[c.id] || 0;
    const curW = cur ? optionWeight(c, cur, oblId) : 0;
    let gain = 0;
    for (let l = cur + 1; l <= 4; l++) {
      const w = optionWeight(c, l, oblId);
      if (w - curW > gain) gain = w - curW;
    }
    if (gain > 0) paths.push({ name: `${c.domainName}: ${c.name}`, gain });
  });
  return paths.sort((a, b) => b.gain - a.gain).slice(0, 3);
}

/* --------------------------- controls view -------------------------- */

function ControlsView({
  selection, controlSelections, setControlSelections,
  assuranceSelections, setAssuranceSelections,
  territoryOverrides, setTerritoryOverrides,
}) {
  const [openInfo, setOpenInfo] = useState(null);
  const [openVariants, setOpenVariants] = useState(null);
  const result = useMemo(
    () => computeCompliance(selection, controlSelections, assuranceSelections, territoryOverrides),
    [selection, controlSelections, assuranceSelections, territoryOverrides]
  );
  const anyControls = Object.keys(controlSelections).length > 0;
  const selectedTerritories = useMemo(
    () => JURISDICTIONS.filter((j) => selection.has(j.id)),
    [selection]
  );

  const chooseLevel = (controlId, level) => {
    setControlSelections((prev) => {
      const next = { ...prev };
      if (next[controlId] === level) {
        delete next[controlId];
        setAssuranceSelections((a) => { const n = { ...a }; delete n[controlId]; return n; });
        setTerritoryOverrides((o) => { const n = { ...o }; delete n[controlId]; return n; });
        if (openVariants === controlId) setOpenVariants(null);
      } else {
        next[controlId] = level;
        setAssuranceSelections((a) => (a[controlId] ? a : { ...a, [controlId]: 2 }));
      }
      return next;
    });
  };
  const setAssurance = (controlId, level) =>
    setAssuranceSelections((a) => ({ ...a, [controlId]: level }));
  const setOverride = (controlId, jurisId, level) =>
    setTerritoryOverrides((prev) => {
      const forControl = { ...(prev[controlId] || {}) };
      if (level === null) delete forControl[jurisId]; else forControl[jurisId] = level;
      const next = { ...prev };
      if (Object.keys(forControl).length === 0) delete next[controlId];
      else next[controlId] = forControl;
      return next;
    });
  const applyEverywhere = (level) => {
    setControlSelections(Object.fromEntries(ALL_CONTROLS.map((c) => [c.id, level])));
    setAssuranceSelections(Object.fromEntries(ALL_CONTROLS.map((c) => [c.id, level])));
    setTerritoryOverrides({});
    setOpenVariants(null);
  };
  const clearAll = () => {
    setControlSelections({});
    setAssuranceSelections({});
    setTerritoryOverrides({});
    setOpenVariants(null);
  };

  if (selection.size === 0) {
    return (
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft }}>
        Select at least one territory on the Territory view. The compliance score measures the chosen
        control set against the obligations that selection derives.
      </p>
    );
  }

  const gaps = result.rows
    .filter((r) => r.pts < r.req - 1e-9)
    .sort((a, b) => {
      const aOpen = a.pts <= 1e-9 ? 0 : 1;
      const bOpen = b.pts <= 1e-9 ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return b.obligation.weight - a.obligation.weight;
    });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 560px", minWidth: 320 }}>
        <p style={{ fontFamily: SERIF, fontSize: 13, color: C.inkSoft, margin: "0 0 10px", maxWidth: 780, lineHeight: 1.45 }}>
          Each control sets two axes: the implementation option, 1 to 4, and the assurance depth
          behind it. Assurance discounts evidence: A1 self-declared counts 40 per cent of an
          option's weight, A2 self-assessed 70, A3 internally tested 80, A4 independently assured
          counts in full. Controls marked local by design accept per-territory variants.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft }}>
            Apply one option and matching assurance everywhere
          </span>
          {[1, 2, 3, 4].map((level) => (
            <button
              key={level}
              onClick={() => applyEverywhere(level)}
              aria-label={`Apply option ${level} and assurance ${level} across every control`}
              style={{
                fontFamily: MONO, fontSize: 11, borderRadius: 2, padding: "4px 10px",
                cursor: "pointer", background: C.paper, color: C.ink,
                border: `1px solid ${C.inkSoft}`,
              }}
            >
              {level}
            </button>
          ))}
          <button
            onClick={clearAll}
            disabled={!anyControls}
            style={{
              fontFamily: MONO, fontSize: 11, borderRadius: 2, padding: "4px 10px",
              cursor: anyControls ? "pointer" : "default",
              background: "transparent",
              color: anyControls ? C.law : C.sheetDeep,
              border: `1px solid ${anyControls ? C.law : C.sheetDeep}`,
            }}
          >
            Clear controls
          </button>
        </div>
        {CONTROL_DOMAINS.map((domain) => (
          <section key={domain.id} style={{
            background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3,
            padding: "10px 12px", marginBottom: 10,
          }}>
            <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, color: C.ink }}>{domain.name}</span>
              <button
                onClick={() => setOpenInfo(openInfo === domain.id ? null : domain.id)}
                aria-expanded={openInfo === domain.id}
                aria-label={`About ${domain.name}`}
                style={{
                  fontFamily: SERIF, fontSize: 13, lineHeight: 1, color: C.frame,
                  background: "transparent", border: "none", cursor: "pointer", padding: 2,
                }}
              >
                ⓘ
              </button>
              {openInfo === domain.id && (
                <div role="note" style={{
                  position: "absolute", top: "100%", left: 0, zIndex: 5, marginTop: 4,
                  background: C.paper, border: `1px solid ${C.ink}`, borderRadius: 3,
                  padding: "7px 10px", maxWidth: 380, boxShadow: "1px 2px 0 rgba(27,36,48,0.18)",
                  fontFamily: SERIF, fontSize: 12.5, color: C.ink, lineHeight: 1.4,
                }}>
                  {domain.about}
                </div>
              )}
            </div>
            {domain.controls.map((control, ci) => {
              const level = controlSelections[control.id];
              const assurance = assuranceSelections[control.id] || 2;
              const overrides = territoryOverrides[control.id] || {};
              const overrideCount = Object.keys(overrides).length;
              const chosenOpt = level ? control.options[level - 1] : null;
              const evNames = chosenOpt
                ? chosenOpt.evidences.map((e) => O_BY_ID[e.o].name)
                : [];
              return (
                <div key={control.id} style={{
                  borderTop: ci === 0 ? `1px solid ${C.sheetDeep}` : `1px dashed ${C.sheetDeep}`,
                  marginTop: 8, paddingTop: 8,
                }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                    <span style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{control.name}</span>
                    {control.local && <Pill text="local by design" colour={C.exposure} />}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "6px 0 0" }}>
                    {control.options.map((option, idx) => {
                      const active = level === idx + 1;
                      return (
                        <button
                          key={idx}
                          onClick={() => chooseLevel(control.id, idx + 1)}
                          aria-pressed={active}
                          title={option.label}
                          style={{
                            fontFamily: MONO, fontSize: 10.5, textAlign: "left", borderRadius: 2,
                            padding: "4px 8px", cursor: "pointer", lineHeight: 1.3,
                            background: active ? C.ink : C.sheet,
                            color: active ? C.paper : C.ink,
                            border: `1px solid ${active ? C.ink : C.inkSoft}`,
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{idx + 1}</span> {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {chosenOpt && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: C.inkSoft }}>
                          assurance
                        </span>
                        {[1, 2, 3, 4].map((a) => (
                          <button
                            key={a}
                            onClick={() => setAssurance(control.id, a)}
                            aria-pressed={assurance === a}
                            title={ASSURANCE_LABELS[a - 1]}
                            style={{
                              fontFamily: MONO, fontSize: 10, borderRadius: 2, padding: "2px 7px",
                              cursor: "pointer",
                              background: assurance === a ? C.frame : C.paper,
                              color: assurance === a ? C.paper : C.ink,
                              border: `1px solid ${assurance === a ? C.frame : C.inkSoft}`,
                            }}
                          >
                            A{a}
                          </button>
                        ))}
                        <span style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft }}>
                          {ASSURANCE_LABELS[assurance - 1]}
                        </span>
                        {control.local && (
                          <button
                            onClick={() => setOpenVariants(openVariants === control.id ? null : control.id)}
                            aria-expanded={openVariants === control.id}
                            style={{
                              fontFamily: MONO, fontSize: 10, borderRadius: 2, padding: "2px 7px",
                              cursor: "pointer", marginLeft: "auto",
                              background: overrideCount > 0 ? C.exposure : C.paper,
                              color: overrideCount > 0 ? C.paper : C.exposure,
                              border: `1px solid ${C.exposure}`,
                            }}
                          >
                            Local variants ({overrideCount})
                          </button>
                        )}
                      </div>
                      {openVariants === control.id && control.local && (
                        <div style={{
                          marginTop: 6, border: `1px solid ${C.sheetDeep}`, borderRadius: 3,
                          padding: "6px 8px", maxHeight: 190, overflowY: "auto", background: C.sheet,
                        }}>
                          <p style={{ fontFamily: SERIF, fontSize: 11.5, color: C.inkSoft, margin: "0 0 5px" }}>
                            Territories follow the group option unless set otherwise here.
                          </p>
                          {selectedTerritories.map((j) => {
                            const ov = overrides[j.id];
                            return (
                              <div key={j.id} style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 3 }}>
                                <span style={{ fontFamily: MONO, fontSize: 10, width: 34, color: C.ink, fontWeight: 700 }}>{j.code}</span>
                                <button
                                  onClick={() => setOverride(control.id, j.id, null)}
                                  aria-pressed={!ov}
                                  aria-label={`${j.name}: follow group option`}
                                  style={{
                                    fontFamily: MONO, fontSize: 9.5, borderRadius: 2, padding: "1px 6px", cursor: "pointer",
                                    background: !ov ? C.ink : C.paper, color: !ov ? C.paper : C.ink,
                                    border: `1px solid ${C.inkSoft}`,
                                  }}
                                >
                                  group
                                </button>
                                {[1, 2, 3, 4].map((l) => (
                                  <button
                                    key={l}
                                    onClick={() => setOverride(control.id, j.id, l)}
                                    aria-pressed={ov === l}
                                    aria-label={`${j.name}: option ${l}`}
                                    style={{
                                      fontFamily: MONO, fontSize: 9.5, borderRadius: 2, padding: "1px 6px", cursor: "pointer",
                                      background: ov === l ? C.exposure : C.paper, color: ov === l ? C.paper : C.ink,
                                      border: `1px solid ${C.inkSoft}`,
                                    }}
                                  >
                                    {l}
                                  </button>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft, margin: "5px 0 0", lineHeight: 1.5 }}>
                        Evidences {evNames.length} obligations: {evNames.join("; ")}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <aside style={{ flex: "1 1 320px", minWidth: 300, position: "sticky", top: 12, alignSelf: "flex-start" }}>
        <div style={{
          background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3,
          padding: "12px 14px", marginBottom: 12,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft }}>
            Compliance score
          </div>
          <span style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, color: C.ink }}>{result.score}%</span>
          <div style={{ height: 6, background: C.sheetDeep, borderRadius: 3, overflow: "hidden", margin: "6px 0 8px" }}>
            <div style={{ width: `${result.score}%`, height: "100%", background: C.ink }} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: 11, color: C.ink, margin: "0 0 6px" }}>
            {result.satisfied} evidenced · {result.partial} partial · {result.open} open
          </p>
          <p style={{ fontFamily: SERIF, fontSize: 12, color: C.inkSoft, margin: 0, lineHeight: 1.45 }}>
            Weighted coverage of the {result.rows.length} obligations the territory selection derives,
            discounted by assurance depth and measured in each obligation's weakest territory.
          </p>
          {result.surplus > 0 && (
            <p style={{ fontFamily: SERIF, fontSize: 12, color: C.exposure, margin: "6px 0 0", lineHeight: 1.4 }}>
              Surplus evidence retained: {result.surplus} points beyond requirement. The same controls
              answering more than was asked: the harmonisation dividend.
            </p>
          )}
          {!anyControls && (
            <p style={{ fontFamily: SERIF, fontSize: 12, color: C.law, margin: "6px 0 0" }}>
              No control options are selected yet.
            </p>
          )}
        </div>
        <div style={{
          background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3,
          padding: "12px 14px", maxHeight: "62vh", overflowY: "auto",
        }}>
          <h3 style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase",
            color: C.inkSoft, margin: "0 0 4px",
          }}>
            Outstanding gaps ({gaps.length})
          </h3>
          {gaps.length === 0 ? (
            <p style={{ fontFamily: SERIF, fontSize: 13, color: C.ink, margin: "6px 0 0", lineHeight: 1.45 }}>
              No outstanding gaps against the current selection. Model coverage is not an audit:
              items marked verify still need primary-source confirmation.
            </p>
          ) : gaps.map((g) => {
            const codes = g.matched.map((id) => J_BY_ID[id].code);
            const via = codes.slice(0, 6).join(", ") + (codes.length > 6 ? ` +${codes.length - 6}` : "");
            const ups = upgradePaths(g.obligation.id, controlSelections);
            return (
              <div key={g.obligation.id} style={{ borderTop: `1px solid ${C.sheetDeep}`, padding: "7px 0" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
                  <span style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 700, color: C.ink }}>
                    {g.obligation.name}
                  </span>
                  {g.obligation.verify && <VerifyPill />}
                  <span style={{ fontFamily: MONO, fontSize: 10, color: g.pts <= 1e-9 ? C.law : C.contract }}>
                    {g.pts <= 1e-9 ? "open" : "partial"} {fmt(g.pts)}/{g.req}
                  </span>
                </div>
                <p style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft, margin: "2px 0" }}>
                  jurisdictions: {via}
                </p>
                <p style={{ fontFamily: SERIF, fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.4 }}>
                  {g.pts <= 1e-9
                    ? "No selected control evidences this obligation yet."
                    : `Evidence ${fmt(g.pts)} of ${g.req} accumulated.`}
                  {ups.length > 0 ? ` Strengthen: ${ups.map((u) => u.name).join("; ")}.` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------- harmonisation view ----------------------- */

function computeHarmonisation(selection, base, overrides) {
  const territories = [...selection];
  const rows = [];
  ALL_CONTROLS.forEach((c) => {
    const b = base[c.id];
    if (!b) return;
    const counts = {};
    territories.forEach((t) => {
      const lvl = (overrides[c.id] || {})[t] || b;
      counts[lvl] = (counts[lvl] || 0) + 1;
    });
    const modal = Math.max(...Object.values(counts));
    rows.push({
      control: c,
      commonality: territories.length > 0 ? modal / territories.length : 1,
      variants: Object.keys(counts).length,
    });
  });
  const score = rows.length > 0
    ? Math.round((rows.reduce((s, r) => s + r.commonality, 0) / rows.length) * 100)
    : 0;
  return { rows, score };
}

function BandGauge({ score }) {
  const W = 620;
  const H = 84;
  const x0 = 20;
  const scale = (W - 40) / 100;
  const x = (v) => x0 + v * scale;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Harmonisation score ${score} per cent; the efficient band runs from ${OPTIMAL_BAND.min} to ${OPTIMAL_BAND.max}`}
      style={{ width: "100%", maxWidth: 640, height: "auto", display: "block" }}>
      <rect x={x(OPTIMAL_BAND.min)} y={30} width={x(OPTIMAL_BAND.max) - x(OPTIMAL_BAND.min)} height={18}
        fill={C.exposure} opacity={0.18} />
      <line x1={x0} y1={48} x2={x(100)} y2={48} stroke={C.inkSoft} strokeWidth={1} />
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={48} x2={x(t)} y2={53} stroke={C.inkSoft} strokeWidth={1} />
          <text x={x(t)} y={64} textAnchor="middle" style={{ fontFamily: MONO, fontSize: 9, fill: C.inkSoft }}>{t}</text>
        </g>
      ))}
      <line x1={x(OPTIMAL_BAND.min)} y1={28} x2={x(OPTIMAL_BAND.min)} y2={50} stroke={C.exposure} strokeWidth={1.2} />
      <line x1={x(OPTIMAL_BAND.max)} y1={28} x2={x(OPTIMAL_BAND.max)} y2={50} stroke={C.exposure} strokeWidth={1.2} />
      <text x={(x(OPTIMAL_BAND.min) + x(OPTIMAL_BAND.max)) / 2} y={24} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 9.5, fill: C.exposure, letterSpacing: 0.8 }}>
        EFFICIENT BAND {OPTIMAL_BAND.min} TO {OPTIMAL_BAND.max}
      </text>
      <text x={x0} y={80} style={{ fontFamily: MONO, fontSize: 9, fill: C.inkSoft }}>fragmented</text>
      <text x={x(100)} y={80} textAnchor="end" style={{ fontFamily: MONO, fontSize: 9, fill: C.inkSoft }}>over-standardised</text>
      <polygon points={`${x(score) - 5},8 ${x(score) + 5},8 ${x(score)},18`} fill={C.law} />
      <line x1={x(score)} y1={18} x2={x(score)} y2={50} stroke={C.law} strokeWidth={1.6} />
      <text x={x(score)} y={6} textAnchor="middle" style={{ fontFamily: SERIF, fontSize: 12, fontWeight: 700, fill: C.law }}>
        {score}%
      </text>
    </svg>
  );
}

function HarmonisationView({ selection, controlSelections, territoryOverrides }) {
  const h = useMemo(
    () => computeHarmonisation(selection, controlSelections, territoryOverrides),
    [selection, controlSelections, territoryOverrides]
  );
  if (selection.size === 0) {
    return (
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft }}>
        Select territories, then set controls. Harmonisation measures how common the control set
        is across the selected territories.
      </p>
    );
  }
  if (h.rows.length === 0) {
    return (
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft }}>
        No controls are set yet. Choose implementation options on the Controls view; harmonisation
        measures their commonality across the {selection.size} selected territories.
      </p>
    );
  }
  const uniformLocal = h.rows.filter((r) => r.control.local && r.variants === 1);
  const nonLocalVaried = h.rows.filter((r) => !r.control.local && r.variants > 1);
  const inBand = h.score >= OPTIMAL_BAND.min && h.score <= OPTIMAL_BAND.max;
  const status = inBand
    ? "Within the efficient band: shared where sharing works, local where law demands it."
    : h.score > OPTIMAL_BAND.max
      ? "Above the band: the control set is more uniform than the obligations are."
      : "Below the band: variation exceeds what local law forces, and effort is duplicating.";
  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.ink, margin: "0 0 4px", lineHeight: 1.5 }}>
        Harmonisation is the share of selected territories operating each control at its most common
        option, averaged across the {h.rows.length} controls in use.
      </p>
      <p style={{ fontFamily: SERIF, fontSize: 13, color: C.inkSoft, margin: "0 0 14px", lineHeight: 1.5 }}>
        Both ends fail: below the band, effort duplicates across markets; at full uniformity,
        obligations that are local by design get flattened.
      </p>
      <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3, padding: "14px 16px 8px", marginBottom: 12 }}>
        <BandGauge score={h.score} />
        <p style={{
          fontFamily: SERIF, fontSize: 13, margin: "8px 0 6px", lineHeight: 1.45,
          color: inBand ? C.exposure : C.contract,
        }}>
          {status}
        </p>
        {h.score > OPTIMAL_BAND.max && uniformLocal.length > 0 && (
          <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.ink, margin: "0 0 6px", lineHeight: 1.45 }}>
            {uniformLocal.length} local-by-design {uniformLocal.length === 1 ? "control is" : "controls are"} currently
            uniform: {uniformLocal.map((r) => r.control.name).join("; ")}. Retention periods and
            notification timelines rarely survive a single group setting; set local variants on the
            Controls view where the law forces them.
          </p>
        )}
        {nonLocalVaried.length > 0 && (
          <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.contract, margin: "0 0 6px", lineHeight: 1.45 }}>
            Variation to review: {nonLocalVaried.map((r) => r.control.name).join("; ")}. These controls
            are not marked local by design, so their variance is cost without a legal driver.
          </p>
        )}
      </div>
      <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3, padding: "10px 14px" }}>
        <h3 style={{
          fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase",
          color: C.inkSoft, margin: "0 0 6px",
        }}>
          Commonality by control
        </h3>
        {h.rows.map((r) => (
          <div key={r.control.id} style={{
            display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline",
            borderTop: `1px solid ${C.sheetDeep}`, padding: "5px 0",
          }}>
            <span style={{ fontFamily: SERIF, fontSize: 13, color: C.ink, minWidth: 240 }}>
              {r.control.domainName}: <span style={{ fontWeight: 700 }}>{r.control.name}</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink }}>{Math.round(r.commonality * 100)}%</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft }}>
              {r.variants} {r.variants === 1 ? "variant" : "variants"}
            </span>
            {r.control.local
              ? <Pill text="local by design" colour={C.exposure} />
              : r.variants > 1
                ? <Pill text="variation to review" colour={C.contract} />
                : <Pill text="uniform" colour={C.inkSoft} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- change impact -------------------------- */

function contributingControls(oblId, matched, base, assurance, overrides) {
  const out = [];
  ALL_CONTROLS.forEach((c) => {
    const b = base[c.id];
    if (!b) return;
    const ov = overrides[c.id] || {};
    let minW = Infinity;
    matched.forEach((t) => {
      const w = optionWeight(c, ov[t] || b, oblId);
      if (w < minW) minW = w;
    });
    if (minW !== Infinity && minW > 0) {
      out.push({ name: `${c.domainName}: ${c.name}`, w: minW * AF[assurance[c.id] || 2] });
    }
  });
  return out.sort((a, b) => b.w - a.w);
}

function DeltaCell({ before, after, suffix }) {
  const d = after - before;
  const colour = d > 0 ? C.exposure : d < 0 ? C.law : C.inkSoft;
  const sign = d > 0 ? "+" : "";
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, color: colour }}>
      {sign}{fmt(d)}{suffix || ""}
    </span>
  );
}

function StatusPill({ pts, req }) {
  if (pts >= req - 1e-9) return <Pill text="absorbed unchanged" colour={C.exposure} />;
  if (pts > 1e-9) return <Pill text="partial" colour={C.contract} />;
  return <Pill text="open" colour={C.law} />;
}

function ChangeView({
  selection, setSelection, controlSelections, assuranceSelections,
  territoryOverrides, changeScenario, setChangeScenario,
}) {
  const anyControls = Object.keys(controlSelections).length > 0;
  const unselected = useMemo(
    () => JURISDICTIONS.filter((j) => !selection.has(j.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [selection]
  );
  if (selection.size === 0) {
    return (
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft }}>
        Select territories and set controls first. Change impact diffs a chosen change against the
        live selection and control set.
      </p>
    );
  }

  const before = computeCompliance(selection, controlSelections, assuranceSelections, territoryOverrides);
  const beforeH = computeHarmonisation(selection, controlSelections, territoryOverrides);

  let scenario = null;
  let after = before;
  let afterH = beforeH;
  let afterSelection = selection;
  if (changeScenario && changeScenario.kind === "territory" && !selection.has(changeScenario.territoryId)) {
    const j = J_BY_ID[changeScenario.territoryId];
    afterSelection = new Set([...selection, j.id]);
    after = computeCompliance(afterSelection, controlSelections, assuranceSelections, territoryOverrides);
    afterH = computeHarmonisation(afterSelection, controlSelections, territoryOverrides);
    scenario = { kind: "territory", territory: j };
  } else if (changeScenario && changeScenario.kind === "scenario") {
    const s = CHANGE_SCENARIOS.find((x) => x.id === changeScenario.scenarioId);
    if (s) {
      after = computeCompliance(selection, controlSelections, assuranceSelections, territoryOverrides, s.mods);
      scenario = { kind: s.kind, def: s };
    }
  }

  const beforeIds = new Set(before.rows.map((r) => r.obligation.id));
  const beforeById = {};
  before.rows.forEach((r) => { beforeById[r.obligation.id] = r; });
  const newRows = scenario && scenario.kind === "territory"
    ? after.rows.filter((r) => !beforeIds.has(r.obligation.id))
    : [];
  const extended = scenario && scenario.kind === "territory"
    ? after.rows.filter((r) => beforeIds.has(r.obligation.id)
        && r.matched.length > beforeById[r.obligation.id].matched.length)
    : [];
  const uplifted = scenario && scenario.kind !== "territory"
    ? after.rows.filter((r) => r.req > (beforeById[r.obligation.id] ? beforeById[r.obligation.id].req : r.req))
    : [];
  const focus = scenario ? (scenario.kind === "territory" ? newRows : uplifted) : [];
  const absorbed = focus.filter((r) => r.pts >= r.req - 1e-9);
  const newGaps = after.rows.filter((r) => {
    if (r.pts >= r.req - 1e-9) return false;
    const prev = beforeById[r.obligation.id];
    return !prev || prev.pts >= prev.req - 1e-9;
  });

  const pickerButton = (active) => ({
    fontFamily: MONO, fontSize: 11, borderRadius: 2, padding: "4px 9px",
    cursor: "pointer", textAlign: "left", lineHeight: 1.35,
    background: active ? C.ink : C.paper,
    color: active ? C.paper : C.ink,
    border: `1px solid ${active ? C.ink : C.inkSoft}`,
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontFamily: SERIF, fontSize: 14, color: C.ink, margin: "0 0 4px", lineHeight: 1.5 }}>
        A before and after comparison against the live selection and control set. Choose one change;
        the diff shows what lands, what the existing controls absorb unchanged, and what opens.
      </p>
      {!anyControls && (
        <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.law, margin: "0 0 10px" }}>
          No controls are set, so both sides of the diff score zero. Set controls first for a
          meaningful comparison.
        </p>
      )}
      <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3, padding: "12px 14px", margin: "10px 0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          <div style={{ minWidth: 230 }}>
            <h3 style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: C.inkSoft, margin: "0 0 5px" }}>
              Add a territory
            </h3>
            <label htmlFor="territory-picker" style={{ fontFamily: SERIF, fontSize: 12, color: C.inkSoft, display: "block", marginBottom: 4 }}>
              Diff the selection with one more market.
            </label>
            {unselected.length === 0 ? (
              <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.inkSoft, margin: 0 }}>
                Every modelled territory is already selected.
              </p>
            ) : (
              <select
                id="territory-picker"
                value={changeScenario && changeScenario.kind === "territory" ? changeScenario.territoryId : ""}
                onChange={(e) => setChangeScenario(e.target.value ? { kind: "territory", territoryId: e.target.value } : null)}
                style={{
                  fontFamily: MONO, fontSize: 11.5, padding: "4px 6px", borderRadius: 2,
                  border: `1px solid ${C.inkSoft}`, background: C.sheet, color: C.ink, maxWidth: 240,
                }}
              >
                <option value="">Choose a territory</option>
                {unselected.map((j) => (
                  <option key={j.id} value={j.id}>{j.code} · {j.name}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ minWidth: 230 }}>
            <h3 style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: C.inkSoft, margin: "0 0 5px" }}>
              Framework version change
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {CHANGE_SCENARIOS.filter((s) => s.kind === "version").map((s) => {
                const active = changeScenario && changeScenario.kind === "scenario" && changeScenario.scenarioId === s.id;
                return (
                  <button key={s.id} aria-pressed={!!active} style={pickerButton(active)}
                    onClick={() => setChangeScenario(active ? null : { kind: "scenario", scenarioId: s.id })}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ minWidth: 250 }}>
            <h3 style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: C.inkSoft, margin: "0 0 5px" }}>
              Upcoming regulation
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {CHANGE_SCENARIOS.filter((s) => s.kind === "upcoming").map((s) => {
                const active = changeScenario && changeScenario.kind === "scenario" && changeScenario.scenarioId === s.id;
                return (
                  <button key={s.id} aria-pressed={!!active} style={pickerButton(active)}
                    onClick={() => setChangeScenario(active ? null : { kind: "scenario", scenarioId: s.id })}>
                    {s.name} <span style={{ color: active ? C.paper : C.contract }}>· indicative</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!scenario ? (
        <p style={{ fontFamily: SERIF, fontSize: 13, color: C.inkSoft, margin: "12px 0 0" }}>
          No change selected. The diff renders here once a territory or scenario is chosen.
        </p>
      ) : (
        <div>
          <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, color: C.ink }}>
                {scenario.kind === "territory" ? `Add ${scenario.territory.name}` : scenario.def.name}
              </span>
              {scenario.kind === "territory" && <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkSoft }}>{scenario.territory.code}</span>}
              {scenario.def && scenario.def.indicative && <Pill text="indicative" colour={C.contract} />}
              {scenario.def && scenario.def.retro && <Pill text="retrospective" colour={C.inkSoft} />}
              {scenario.def && scenario.def.verify && <VerifyPill />}
              <button onClick={() => setChangeScenario(null)} style={{
                fontFamily: MONO, fontSize: 10.5, marginLeft: "auto", cursor: "pointer",
                background: "transparent", color: C.law, border: `1px solid ${C.law}`, borderRadius: 2, padding: "2px 8px",
              }}>
                Clear
              </button>
            </div>
            {scenario.def && (
              <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.inkSoft, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 780 }}>
                {scenario.def.summary}
              </p>
            )}
            {scenario.kind === "territory" && scenario.territory.risks.length > 0 && (
              <p style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkSoft, margin: "6px 0 0", lineHeight: 1.6 }}>
                risk indicators: {scenario.territory.risks.map((r) => RISKS[r]).join(" · ")}
              </p>
            )}
            <table style={{ borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr>
                  {["", "Before", "After", "Delta"].map((h) => (
                    <th key={h} style={{
                      fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
                      color: C.inkSoft, textAlign: "left", padding: "3px 18px 3px 0", fontWeight: 400,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Compliance score", before.score, after.score, "%"],
                  ["Harmonisation", beforeH.score, afterH.score, "%"],
                  ["Obligations derived", before.rows.length, after.rows.length, ""],
                  ["Open or partial", before.rows.length - before.satisfied, after.rows.length - after.satisfied, ""],
                ].map(([label, b, a, suffix]) => (
                  <tr key={label}>
                    <td style={{ fontFamily: SERIF, fontSize: 12.5, color: C.ink, padding: "3px 18px 3px 0" }}>{label}</td>
                    <td style={{ fontFamily: MONO, fontSize: 11.5, color: C.ink, padding: "3px 18px 3px 0" }}>{b}{suffix}</td>
                    <td style={{ fontFamily: MONO, fontSize: 11.5, color: C.ink, padding: "3px 18px 3px 0" }}>{a}{suffix}</td>
                    <td style={{ padding: "3px 0" }}><DeltaCell before={b} after={a} suffix={suffix} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scenario.kind !== "territory" && (
              <p style={{ fontFamily: SERIF, fontSize: 11.5, color: C.inkSoft, margin: "8px 0 0" }}>
                The control set is untouched, so harmonisation is unchanged: the change lands on the
                obligation side.
              </p>
            )}
            {scenario.kind === "territory" && (
              <button
                onClick={() => { setSelection(afterSelection); setChangeScenario(null); }}
                style={{
                  fontFamily: MONO, fontSize: 11, marginTop: 10, cursor: "pointer", borderRadius: 2,
                  background: C.frame, color: C.paper, border: `1px solid ${C.frame}`, padding: "5px 12px",
                }}
              >
                Adopt {scenario.territory.code} into the selection
              </button>
            )}
          </div>

          <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3, padding: "12px 14px", marginBottom: 10 }}>
            <h3 style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.inkSoft, margin: "0 0 4px" }}>
              {scenario.kind === "territory" ? `New obligations (${focus.length})` : `Uplifted obligations (${focus.length})`}
            </h3>
            {focus.length === 0 ? (
              <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.inkSoft, margin: "4px 0 0" }}>
                {scenario.kind === "territory"
                  ? "No new obligations: everything this territory triggers is already derived by the current selection. The whole change is absorbed."
                  : "The uplifted obligation is not derived by the current territory selection, so this change has no effect here."}
              </p>
            ) : (
              <div>
                <p style={{ fontFamily: SERIF, fontSize: 12.5, color: absorbed.length === focus.length ? C.exposure : C.ink, margin: "2px 0 8px", lineHeight: 1.45 }}>
                  {absorbed.length} of {focus.length} {absorbed.length === 1 ? "is" : "are"} absorbed by the existing
                  control set with no change: the harmonisation dividend.
                </p>
                {focus.map((r) => {
                  const contrib = contributingControls(r.obligation.id, r.matched, controlSelections, assuranceSelections, territoryOverrides);
                  const prev = beforeById[r.obligation.id];
                  return (
                    <div key={r.obligation.id} style={{ borderTop: `1px solid ${C.sheetDeep}`, padding: "6px 0" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
                        <span style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{r.obligation.name}</span>
                        {r.obligation.verify && <VerifyPill />}
                        <StatusPill pts={r.pts} req={r.req} />
                        <span style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft }}>
                          {prev ? `requirement ${prev.req} to ${r.req}` : `requirement ${r.req}`} · evidence {fmt(r.pts)}
                        </span>
                      </div>
                      {contrib.length > 0 && (
                        <p style={{ fontFamily: MONO, fontSize: 10, color: C.inkSoft, margin: "3px 0 0", lineHeight: 1.5 }}>
                          held by: {contrib.slice(0, 4).map((c) => c.name).join("; ")}{contrib.length > 4 ? ` +${contrib.length - 4}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {scenario.kind === "territory" && extended.length > 0 && (
              <p style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.6 }}>
                {extended.length} existing obligations extend their reach to {scenario.territory.code}:{" "}
                {extended.slice(0, 6).map((r) => r.obligation.name).join("; ")}{extended.length > 6 ? ` +${extended.length - 6}` : ""}.
              </p>
            )}
          </div>

          <div style={{ background: C.paper, border: `1px solid ${C.sheetDeep}`, borderRadius: 3, padding: "12px 14px" }}>
            <h3 style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.inkSoft, margin: "0 0 4px" }}>
              New gaps ({newGaps.length})
            </h3>
            {newGaps.length === 0 ? (
              <p style={{ fontFamily: SERIF, fontSize: 12.5, color: C.exposure, margin: "4px 0 0" }}>
                The change opens no gap that was not already open.
              </p>
            ) : newGaps.map((r) => {
              const ups = upgradePaths(r.obligation.id, controlSelections);
              return (
                <div key={r.obligation.id} style={{ borderTop: `1px solid ${C.sheetDeep}`, padding: "6px 0" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
                    <span style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{r.obligation.name}</span>
                    {r.obligation.verify && <VerifyPill />}
                    <span style={{ fontFamily: MONO, fontSize: 10, color: r.pts <= 1e-9 ? C.law : C.contract }}>
                      {r.pts <= 1e-9 ? "open" : "partial"} {fmt(r.pts)}/{r.req}
                    </span>
                  </div>
                  <p style={{ fontFamily: SERIF, fontSize: 12, color: C.ink, margin: "2px 0 0", lineHeight: 1.4 }}>
                    {ups.length > 0 ? `Strengthen: ${ups.map((u) => u.name).join("; ")}.` : "No mapped control strengthens this further; it needs a control the model does not yet carry."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- footer ----------------------------- */

function Footer() {
  return (
    <footer style={{
      marginTop: 34, borderTop: `1px solid ${C.sheetDeep}`, paddingTop: 12,
      fontFamily: SERIF, fontSize: 12, color: C.inkSoft, lineHeight: 1.55, maxWidth: 860,
    }}>
      Data in this tool is authored and illustrative. Scores are a model, not an audit. Scenarios are
      not statements about any organisation's internal programme. Items marked verify must be checked
      against primary sources before being relied on.
    </footer>
  );
}

/* -------------------------------- shell ----------------------------- */

const TABS = [
  { id: "territory", label: "Territory" },
  { id: "exposure", label: "Exposure" },
  { id: "controls", label: "Controls" },
  { id: "harmonisation", label: "Harmonisation" },
  { id: "change", label: "Change impact" },
];

export default function ControlHarmonisationSimulator() {
  const [tab, setTab] = useState("territory");
  const [selection, setSelection] = useState(() => new Set());

  /* controlSelections: controlId to implementation level (1 to 4).
     assuranceSelections: controlId to assurance depth (1 to 4).
     territoryOverrides: controlId to (jurisdictionId to level) for
       local-by-design variation, feeding the harmonisation measure.
     changeScenario: the active before-and-after comparison, if any. */
  const [controlSelections, setControlSelections] = useState({});
  const [assuranceSelections, setAssuranceSelections] = useState({});
  const [territoryOverrides, setTerritoryOverrides] = useState({});
  const [changeScenario, setChangeScenario] = useState(null);

  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const obligationCount = OBLIGATIONS.length;
  const domainCount = CONTROL_DOMAINS.length;
  const controlCount = ALL_CONTROLS.length;

  return (
    <div style={{ background: C.sheet, minHeight: "100vh", padding: "26px 22px 30px", color: C.ink }}>
      <header style={{ maxWidth: 1060, margin: "0 auto 18px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, margin: "0 0 2px" }}>
          Control Harmonisation Simulator
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 11.5, color: C.inkSoft, margin: "0 0 8px", letterSpacing: 0.6 }}>
          Developed by Presh Williams
        </p>
        <p style={{ fontFamily: SERIF, fontSize: 14, color: C.inkSoft, margin: 0, maxWidth: 780, lineHeight: 1.5 }}>
          One harmonised control should evidence as many obligations as possible. But some obligations
          are legitimately local: retention periods, rider employment rules, breach notification
          timelines. This tool explores where the efficient band lies for the DoorDash group footprint.
        </p>
        <p style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft, margin: "8px 0 0", letterSpacing: 0.4 }}>
          {JURISDICTIONS.length} territories · {obligationCount} obligations · {domainCount} domains · {controlCount} controls, four options each
        </p>
      </header>

      <nav aria-label="Views" style={{ maxWidth: 1060, margin: "0 auto 20px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              style={{
                fontFamily: MONO, fontSize: 12, padding: "6px 14px", borderRadius: 2,
                cursor: "pointer",
                background: active ? C.ink : "transparent",
                color: active ? C.paper : C.ink,
                border: `1px solid ${active ? C.ink : C.inkSoft}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: 1060, margin: "0 auto" }}>
        {tab === "territory" && (
          <TerritoryView selection={selection} setSelection={setSelection} reduceMotion={reduceMotion} />
        )}
        {tab === "exposure" && <ExposureView selection={selection} />}
        {tab === "controls" && (
          <ControlsView
            selection={selection}
            controlSelections={controlSelections}
            setControlSelections={setControlSelections}
            assuranceSelections={assuranceSelections}
            setAssuranceSelections={setAssuranceSelections}
            territoryOverrides={territoryOverrides}
            setTerritoryOverrides={setTerritoryOverrides}
          />
        )}
        {tab === "harmonisation" && (
          <HarmonisationView
            selection={selection}
            controlSelections={controlSelections}
            territoryOverrides={territoryOverrides}
          />
        )}
        {tab === "change" && (
          <ChangeView
            selection={selection}
            setSelection={setSelection}
            controlSelections={controlSelections}
            assuranceSelections={assuranceSelections}
            territoryOverrides={territoryOverrides}
            changeScenario={changeScenario}
            setChangeScenario={setChangeScenario}
          />
        )}
      </main>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <Footer />
      </div>
    </div>
  );
}
