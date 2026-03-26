/**
 * @file seed/seed-demo-data
 * Idempotent seed for 100 demo users with realistic US tax situations.
 *
 * Creates exactly 100 users (usernames demo_user_001 … demo_user_100) each
 * with 1–2 tax_object entities and 1–2 tax_return entities per object.
 *
 * Income distribution:
 *   ~60 W-2 only
 *   ~20 freelance / 1099-NEC
 *   ~12 investment (1099-B / DIV / INT)
 *    ~8 multi-state or rental
 *
 * Return status spread:
 *   ~30% draft  (~30 returns)
 *   ~25% in_review  (~25 returns)
 *   ~35% filed  (~35 returns)
 *   ~10% amended  (~10 returns)
 *
 * Filing status mix:
 *   ~40% single
 *   ~35% married_filing_jointly
 *   ~15% head_of_household
 *   ~10% other
 *
 * ~20 users have seeded validation errors (missing required fields).
 *
 * Set DEMO_SEED=false to skip (e.g. in production).
 */

import type { sql as SqlPool } from 'db';

export interface SeedDemoDataOptions {
  sql: typeof SqlPool;
}

// ---------------------------------------------------------------------------
// Deterministic fixed data
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'James',
  'Mary',
  'Robert',
  'Patricia',
  'John',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Barbara',
  'David',
  'Elizabeth',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Christopher',
  'Lisa',
  'Daniel',
  'Nancy',
  'Matthew',
  'Betty',
  'Anthony',
  'Margaret',
  'Mark',
  'Sandra',
  'Donald',
  'Ashley',
  'Steven',
  'Dorothy',
  'Paul',
  'Kimberly',
  'Andrew',
  'Emily',
  'Kenneth',
  'Donna',
  'Joshua',
  'Michelle',
  'Kevin',
  'Carol',
  'Brian',
  'Amanda',
  'George',
  'Melissa',
  'Timothy',
  'Deborah',
  'Ronald',
  'Stephanie',
  'Edward',
  'Rebecca',
  'Jason',
  'Sharon',
  'Jeffrey',
  'Laura',
  'Ryan',
  'Cynthia',
  'Jacob',
  'Kathleen',
  'Gary',
  'Amy',
  'Nicholas',
  'Angela',
  'Eric',
  'Shirley',
  'Jonathan',
  'Anna',
  'Stephen',
  'Brenda',
  'Larry',
  'Pamela',
  'Justin',
  'Emma',
  'Scott',
  'Nicole',
  'Brandon',
  'Helen',
  'Benjamin',
  'Samantha',
  'Samuel',
  'Katherine',
  'Raymond',
  'Christine',
  'Gregory',
  'Debra',
  'Frank',
  'Rachel',
  'Alexander',
  'Carolyn',
  'Patrick',
  'Janet',
  'Jack',
  'Maria',
  'Dennis',
  'Heather',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
  'Chen',
  'Patel',
  'Kim',
  'Park',
  'Singh',
  'Gupta',
  'Zhang',
  'Liu',
  'Wang',
  'Sharma',
  'Jackson',
  'Murphy',
  "O'Brien",
  'Sullivan',
  'Walsh',
  'Cohen',
  'Goldberg',
  'Friedman',
  'Rosenberg',
  'Fischer',
  'Muller',
  'Weber',
  'Meyer',
  'Wagner',
  'Becker',
  'Hoffman',
  'Schulz',
  'Kumar',
  'Ahmed',
  'Hassan',
  'Ibrahim',
  'Ali',
  'Okafor',
  'Nwosu',
  'Diallo',
  'Traore',
  'Mbeki',
  'Osei',
  'Fernandez',
  'Castillo',
  'Morales',
  'Ortiz',
  'Cruz',
  'Reyes',
  'Gutierrez',
  'Chavez',
  'Vargas',
  'Romero',
];

const EMPLOYERS = [
  'Acme Corp',
  'TechWave Solutions',
  'BlueStar Financial',
  'Oakwood Medical Center',
  'National Grid Services',
  'Summit Logistics LLC',
  'Horizon Manufacturing',
  'Pacific Coast Airlines',
  'Green Valley Schools',
  'Riverside County Government',
  'FirstBank NA',
  'Pinnacle Insurance Group',
  'DeltaSoft Inc',
  'Apex Engineering',
  'Clearwater Staffing',
  'Metro Transit Authority',
  'Lighthouse Consulting',
  'RedRock Energy',
  'Springdale Hospital',
  'Allied Defense Contractors',
  'Northeast Telecom',
  'Sunset Retail Group',
  'Cascade Software',
  'Ironwood Mining Co',
  'BrightPath Education',
  'Central Valley Foods',
  'Keystone Building Services',
  'Maple Street Bakery Inc',
  'StormBridge Capital',
  'CrossCountry Freight',
];

const FREELANCE_CLIENTS = [
  'Freelance Design Studio',
  'Independent Consulting LLC',
  'Digital Marketing Pro',
  'Tech Contractor Services',
  'Creative Solutions Agency',
  'Remote Dev Services',
  'Consulting Partners Group',
  'Content Creation Inc',
  'SEO Expert Services',
  'Web Development Hub',
];

const INVESTMENT_PAYERS = [
  'Fidelity Investments',
  'Vanguard Group',
  'Charles Schwab',
  'TD Ameritrade',
  'E*TRADE Financial',
  'Merrill Lynch',
  'Morgan Stanley',
  'Raymond James',
  'Wells Fargo Advisors',
  'Edward Jones',
];

const RENTAL_ADDRESSES = [
  '123 Oak Street Unit B',
  '456 Maple Ave Apt 2',
  '789 Pine Rd',
  '1010 Elm Court',
  '222 Birch Lane',
  '333 Cedar Blvd Unit 5',
  '444 Walnut Way',
  '555 Spruce Ave',
];

const STATES: readonly string[] = [
  'CA',
  'TX',
  'FL',
  'NY',
  'PA',
  'IL',
  'OH',
  'GA',
  'NC',
  'MI',
  'NJ',
  'VA',
  'WA',
  'AZ',
  'MA',
  'TN',
  'IN',
  'MO',
  'MD',
  'WI',
  'CO',
  'MN',
  'SC',
  'AL',
  'LA',
  'KY',
  'OR',
  'OK',
  'CT',
  'UT',
];

// Fixed registration dates spread across ~18 months
const REGISTRATION_DATES = [
  '2024-01-15T10:23:00Z',
  '2024-01-22T14:05:00Z',
  '2024-02-03T09:17:00Z',
  '2024-02-14T16:45:00Z',
  '2024-02-28T11:30:00Z',
  '2024-03-07T08:55:00Z',
  '2024-03-19T13:20:00Z',
  '2024-04-01T10:00:00Z',
  '2024-04-11T15:33:00Z',
  '2024-04-22T09:48:00Z',
  '2024-05-06T14:12:00Z',
  '2024-05-15T11:05:00Z',
  '2024-05-27T16:38:00Z',
  '2024-06-03T10:22:00Z',
  '2024-06-17T13:55:00Z',
  '2024-06-30T09:10:00Z',
  '2024-07-08T14:40:00Z',
  '2024-07-22T11:15:00Z',
  '2024-08-05T16:02:00Z',
  '2024-08-19T09:35:00Z',
  '2024-09-02T14:18:00Z',
  '2024-09-16T11:47:00Z',
  '2024-09-30T10:05:00Z',
  '2024-10-14T15:28:00Z',
  '2024-10-28T09:52:00Z',
  '2024-11-04T14:15:00Z',
  '2024-11-18T11:40:00Z',
  '2024-12-02T16:22:00Z',
  '2024-12-16T10:55:00Z',
  '2024-12-30T14:08:00Z',
  '2025-01-06T09:20:00Z',
  '2025-01-13T15:45:00Z',
  '2025-01-20T11:10:00Z',
  '2025-01-27T16:33:00Z',
  '2025-02-03T09:55:00Z',
  '2025-02-10T14:28:00Z',
  '2025-02-17T11:02:00Z',
  '2025-02-24T15:47:00Z',
  '2025-03-03T10:18:00Z',
  '2025-03-10T14:40:00Z',
  '2025-03-17T09:05:00Z',
  '2025-03-24T15:32:00Z',
  '2025-03-31T11:48:00Z',
  '2025-04-07T16:15:00Z',
  '2025-04-14T10:38:00Z',
  '2025-04-21T14:02:00Z',
  '2025-04-28T09:25:00Z',
  '2025-05-05T15:50:00Z',
  '2025-05-12T11:13:00Z',
  '2025-05-19T16:40:00Z',
];

// Return statuses distributed per spec: ~30% draft, ~25% in_review, ~35% filed, ~10% amended
const RETURN_STATUSES: Array<'draft' | 'in_review' | 'filed' | 'amended'> = [
  'draft',
  'draft',
  'draft',
  'draft',
  'draft',
  'draft',
  'in_review',
  'in_review',
  'in_review',
  'in_review',
  'in_review',
  'filed',
  'filed',
  'filed',
  'filed',
  'filed',
  'filed',
  'filed',
  'amended',
];

// Filing statuses distributed per spec: ~40% single, ~35% mfj, ~15% hoh, ~10% other
const FILING_STATUSES = [
  'single',
  'single',
  'single',
  'single',
  'married_filing_jointly',
  'married_filing_jointly',
  'married_filing_jointly',
  'head_of_household',
  'married_filing_separately',
];

// Income type categories (100 total, matching the spec distribution)
type IncomeCategory = 'w2' | 'freelance' | 'investment' | 'multi_state' | 'rental';
const INCOME_CATEGORIES: IncomeCategory[] = [
  // ~60 W-2 only (indices 0–59)
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  'w2',
  // ~20 freelance / 1099-NEC (indices 60–79)
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  'freelance',
  // ~12 investment (indices 80–91)
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  'investment',
  // ~8 multi-state or rental (indices 92–99)
  'multi_state',
  'multi_state',
  'multi_state',
  'multi_state',
  'rental',
  'rental',
  'rental',
  'rental',
];

// Wages for W-2 filers spread $28k–$340k
const W2_WAGES = [
  28500, 32000, 35400, 38900, 42000, 45600, 48200, 51800, 55000, 58700, 62300, 65100, 68400, 71200,
  74500, 77800, 81000, 84300, 87600, 91000, 94200, 97500, 101000, 104800, 108200, 112500, 116000,
  119800, 123400, 127000, 131200, 135600, 139000, 143500, 148000, 152400, 157000, 161500, 166200,
  171000, 175800, 180500, 185200, 190000, 195500, 201000, 207000, 213500, 220000, 226500, 233000,
  240000, 247500, 255000, 263000, 271500, 280000, 295000, 312000, 340000,
];

// Freelance NEC amounts
const FREELANCE_AMOUNTS = [
  18000, 22500, 28000, 34000, 41000, 48000, 55000, 63000, 71000, 80000, 88000, 96000, 105000,
  115000, 126000, 138000, 150000, 165000, 182000, 200000,
];

// Investment amounts
const INVESTMENT_AMOUNTS = [
  1200, 2400, 3800, 5500, 7200, 9000, 11500, 14000, 17500, 22000, 28000, 35000,
];

// Rental income amounts
const RENTAL_AMOUNTS = [14400, 18000, 21600, 24000];

// ---------------------------------------------------------------------------
// Helper: build a TaxSituation object
// ---------------------------------------------------------------------------

interface BuildSituationOptions {
  userId: string;
  taxObjectId: string;
  taxYear: number;
  filingStatus: string;
  category: IncomeCategory;
  index: number;
  hasValidationError: boolean;
}

function buildSituation(opts: BuildSituationOptions): Record<string, unknown> {
  const { taxObjectId, taxYear, filingStatus, category, index, hasValidationError } = opts;
  const lastName = LAST_NAMES[index % LAST_NAMES.length];
  const state = STATES[index % STATES.length] as string;
  const now = new Date().toISOString();

  // Build income streams based on category
  const incomeStreams: Record<string, unknown>[] = [];

  if (category === 'w2') {
    const wages = W2_WAGES[index % W2_WAGES.length];
    const employer = EMPLOYERS[index % EMPLOYERS.length];
    const federalWithheld = Math.round(wages * 0.14);
    const ssWages = Math.min(wages, 160200);
    const ssWithheld = Math.round(ssWages * 0.062);
    const medicareWithheld = Math.round(wages * 0.0145);

    // W-2 income stream — skip w2Data for validation-error users
    const stream: Record<string, unknown> = {
      type: 'w2',
      source: employer,
      amount: wages,
      employerEIN: `${String(10 + (index % 89)).padStart(2, '0')}-${String(1000000 + index * 7).slice(0, 7)}`,
      documentation: [],
    };
    if (!hasValidationError) {
      stream.w2Data = {
        wages,
        federalTaxWithheld: federalWithheld,
        socialSecurityWages: ssWages,
        socialSecurityTaxWithheld: ssWithheld,
        medicareWages: wages,
        medicareTaxWithheld: medicareWithheld,
        stateName: state,
        stateWages: wages,
        stateTaxWithheld: Math.round(wages * 0.05),
      };
    }
    incomeStreams.push(stream);
  } else if (category === 'freelance') {
    const necIdx = (index - 60) % FREELANCE_AMOUNTS.length;
    const amount = FREELANCE_AMOUNTS[necIdx];
    const client = FREELANCE_CLIENTS[necIdx % FREELANCE_CLIENTS.length];
    incomeStreams.push({
      type: '1099_nec',
      source: client,
      amount,
      documentation: [],
      form1099Data: {
        payerName: client,
        payerTIN: `88-${String(2000000 + index * 13).slice(0, 7)}`,
        nonEmployeeCompensation: amount,
      },
    });
    // ~half of freelancers also have a W-2 side job
    if (index % 2 === 0) {
      const sideWages = W2_WAGES[(index * 3) % 20]; // lower wages
      const employer = EMPLOYERS[(index + 5) % EMPLOYERS.length];
      incomeStreams.push({
        type: 'w2',
        source: employer,
        amount: sideWages,
        documentation: [],
        w2Data: {
          wages: sideWages,
          federalTaxWithheld: Math.round(sideWages * 0.12),
          socialSecurityWages: sideWages,
          socialSecurityTaxWithheld: Math.round(sideWages * 0.062),
          medicareWages: sideWages,
          medicareTaxWithheld: Math.round(sideWages * 0.0145),
          stateName: state,
          stateWages: sideWages,
          stateTaxWithheld: Math.round(sideWages * 0.05),
        },
      });
    }
  } else if (category === 'investment') {
    const invIdx = (index - 80) % INVESTMENT_AMOUNTS.length;
    const amount = INVESTMENT_AMOUNTS[invIdx];
    const payer = INVESTMENT_PAYERS[invIdx % INVESTMENT_PAYERS.length];
    // Alternate between 1099-B, 1099-DIV, 1099-INT
    const invType = ['1099_b', '1099_div', '1099_int'][invIdx % 3];
    const form1099Data: Record<string, unknown> = { payerName: payer };
    if (invType === '1099_b') {
      form1099Data.proceeds = amount;
      form1099Data.costBasis = Math.round(amount * 0.7);
    } else if (invType === '1099_div') {
      form1099Data.ordinaryDividends = amount;
      form1099Data.qualifiedDividends = Math.round(amount * 0.8);
    } else {
      form1099Data.interestIncome = amount;
    }
    incomeStreams.push({
      type: invType,
      source: payer,
      amount,
      documentation: [],
      form1099Data,
    });
  } else if (category === 'multi_state') {
    const wages = W2_WAGES[(index * 2) % W2_WAGES.length];
    const employer = EMPLOYERS[(index + 10) % EMPLOYERS.length];
    incomeStreams.push({
      type: 'w2',
      source: employer,
      amount: wages,
      documentation: [],
      w2Data: {
        wages,
        federalTaxWithheld: Math.round(wages * 0.15),
        socialSecurityWages: Math.min(wages, 160200),
        socialSecurityTaxWithheld: Math.round(Math.min(wages, 160200) * 0.062),
        medicareWages: wages,
        medicareTaxWithheld: Math.round(wages * 0.0145),
        stateName: state,
        stateWages: wages,
        stateTaxWithheld: Math.round(wages * 0.055),
      },
    });
  } else {
    // rental
    const rentalIdx = (index - 96) % RENTAL_AMOUNTS.length;
    const rentalAmount = RENTAL_AMOUNTS[rentalIdx];
    const address = RENTAL_ADDRESSES[rentalIdx % RENTAL_ADDRESSES.length];
    incomeStreams.push({
      type: 'rental',
      source: address,
      amount: rentalAmount,
      documentation: [],
    });
  }

  // Standard deduction for most, mortgage interest for some
  const deductions: Record<string, unknown>[] = [
    {
      type: 'standard',
      amount: filingStatus === 'married_filing_jointly' ? 29200 : 14600,
      documentation: [],
    },
  ];
  if (index % 5 === 0) {
    deductions.push({
      type: 'charitable',
      amount: Math.round(((incomeStreams[0]?.amount as number) ?? 50000) * 0.03),
      documentation: [],
    });
  }

  // Credits for some users
  const credits: Record<string, unknown>[] = [];
  if (filingStatus === 'head_of_household' || filingStatus === 'married_filing_jointly') {
    credits.push({ type: 'child_tax', amount: 2000, documentation: [] });
  }

  // Dependents for married/hoh filers
  const dependents: Record<string, unknown>[] = [];
  if (filingStatus === 'married_filing_jointly' && index % 3 === 0) {
    dependents.push({
      firstName: 'Alex',
      lastName: lastName,
      relationship: 'child',
      dateOfBirth: '2015-06-15',
      ssn_last4: String(1000 + (index % 9000)),
      qualifiesForChildTaxCredit: true,
      qualifiesForEIC: false,
    });
  } else if (filingStatus === 'head_of_household') {
    dependents.push({
      firstName: 'Jordan',
      lastName: lastName,
      relationship: 'child',
      dateOfBirth: '2012-03-20',
      qualifiesForChildTaxCredit: true,
      qualifiesForEIC: true,
    });
  }

  // Multi-state filers have additional residency
  const additionalStates: string[] = [];
  if (category === 'multi_state') {
    const secondState = STATES[(index + 15) % STATES.length] as string;
    if (secondState !== state) additionalStates.push(secondState);
  }

  const totalIncome = incomeStreams.reduce((sum, s) => sum + (s.amount as number), 0);

  return {
    id: `${taxObjectId}-sit-${taxYear}`,
    version: '0.1.0',
    filingYear: taxYear,
    filingStatus,
    dependents,
    incomeStreams,
    deductions,
    credits,
    lifeEvents: [],
    priorYearContext: {
      estimatedAGI: Math.round(totalIncome * 0.95),
      filingMethod: index % 4 === 0 ? 'tax_professional' : 'self_prepared',
      provider: index % 4 === 0 ? 'Local CPA' : null,
    },
    stateResidency: {
      primary: state,
      additional: additionalStates,
    },
    documentationCompleteness: hasValidationError ? 0.4 : 0.85,
    confidenceScores: {
      overall: hasValidationError ? 0.5 : 0.9,
      perField: {
        incomeStreams: hasValidationError ? 0.5 : 0.95,
        deductions: 0.9,
      },
    },
    rawArtifacts: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      objectType: filingStatus === 'married_filing_jointly' ? 'joint_household' : 'individual',
      schemaVersion: '0.1.0',
    },
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function seedDemoData({ sql }: SeedDemoDataOptions): Promise<void> {
  if (process.env.DEMO_SEED === 'false') {
    console.log('[seed] DEMO_SEED=false — skipping demo data seeding.');
    return;
  }

  // Check how many demo_user_* accounts already exist
  const existing = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM entities
    WHERE type = 'user'
      AND properties->>'username' LIKE 'demo_user_%'
  `;

  const existingCount = Number(existing[0]?.count ?? 0);
  if (existingCount >= 100) {
    console.log(`[seed] ${existingCount} demo users already exist — skipping demo data seeding.`);
    return;
  }

  console.log('[seed] Seeding 100 demo users with tax situations…');

  for (let i = 0; i < 100; i++) {
    const userIndex = i + 1;
    const username = `demo_user_${String(userIndex).padStart(3, '0')}`;

    // Skip if this particular user already exists (partial re-run recovery)
    const userExists = await sql<{ id: string }[]>`
      SELECT id FROM entities
      WHERE type = 'user'
        AND properties->>'username' = ${username}
      LIMIT 1
    `;
    if (userExists.length > 0) {
      continue;
    }

    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const registrationDate = REGISTRATION_DATES[i % REGISTRATION_DATES.length];
    const filingStatus = FILING_STATUSES[i % FILING_STATUSES.length];
    const category = INCOME_CATEGORIES[i];
    const hasValidationError = i < 20; // first 20 users have errors
    const returnStatus = RETURN_STATUSES[i % RETURN_STATUSES.length];

    // Create user entity
    const userId = crypto.randomUUID();
    const passwordHash = await Bun.password.hash('demo_user_password123');
    const userProperties = {
      username,
      password_hash: passwordHash,
      role: 'tax_filer',
      display_name: `${firstName} ${lastName}`,
    };

    await sql`
      INSERT INTO entities (id, type, properties, tenant_id, created_at, updated_at)
      VALUES (
        ${userId},
        'user',
        ${sql.json(userProperties as never)},
        null,
        ${registrationDate}::timestamptz,
        ${registrationDate}::timestamptz
      )
    `;

    // Determine tax years — most users have one year, ~30% have two years
    const hasTwoYears = i % 3 === 0;
    const taxYears = hasTwoYears ? [2023, 2024] : [2024];

    for (const taxYear of taxYears) {
      // Create tax_object
      const taxObjectId = crypto.randomUUID();
      const objectType =
        filingStatus === 'married_filing_jointly' ? 'joint_household' : 'individual';
      const taxObjectProperties = {
        object_type: objectType,
        filing_year: taxYear,
        display_name: `${firstName} ${lastName} ${taxYear}`,
        created_by_user_id: userId,
        status: 'active',
      };

      await sql`
        INSERT INTO entities (id, type, properties, created_at, updated_at)
        VALUES (
          ${taxObjectId},
          'tax_object',
          ${sql.json(taxObjectProperties as never)},
          ${registrationDate}::timestamptz,
          ${registrationDate}::timestamptz
        )
      `;

      // owns relation: user -> tax_object
      const ownsRelId = crypto.randomUUID();
      await sql`
        INSERT INTO relations (id, source_id, target_id, type)
        VALUES (${ownsRelId}, ${userId}, ${taxObjectId}, 'owns')
      `;

      // Create tax_return
      const taxReturnId = crypto.randomUUID();
      const situationData = buildSituation({
        userId,
        taxObjectId,
        taxYear,
        filingStatus,
        category,
        index: i,
        hasValidationError,
      });

      const taxReturnProperties = {
        tax_object_id: taxObjectId,
        tax_year: taxYear,
        jurisdiction: 'federal',
        return_type: '1040',
        filing_status: filingStatus,
        status: returnStatus,
        situation_data: situationData,
      };

      await sql`
        INSERT INTO entities (id, type, properties, created_at, updated_at)
        VALUES (
          ${taxReturnId},
          'tax_return',
          ${sql.json(taxReturnProperties as never)},
          ${registrationDate}::timestamptz,
          ${registrationDate}::timestamptz
        )
      `;

      // belongs_to relation: tax_return -> tax_object
      const belongsRelId = crypto.randomUUID();
      await sql`
        INSERT INTO relations (id, source_id, target_id, type)
        VALUES (${belongsRelId}, ${taxReturnId}, ${taxObjectId}, 'belongs_to')
      `;
    }
  }

  console.log('[seed] Demo data seeding complete — 100 users created.');
}
