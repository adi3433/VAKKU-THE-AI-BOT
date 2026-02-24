/**
 * Retriever — Hybrid Vector + BM25 Search
 * ─────────────────────────────────────────
 * Stage 1-2 of RAG pipeline:
 *   1) Embed query with qwen3-embedding-8b
 *   2) Vector search (cosine similarity) + BM25 keyword scoring
 *   3) Merge and return top-15 candidates for reranking
 */

import type { RetrievedPassage, RetrievalResult } from '@/types';
import { embedQuery, embedDocuments, cosineSimilarity } from './embeddings';
import { getConfig } from '@/lib/fireworks';
import { getAllBooths, type BoothRecord } from '@/lib/booth-data';

// ── V5 Knowledge Base — Core + Dataset-grounded passages ──
const CORE_KNOWLEDGE_BASE: RetrievedPassage[] = [
  // ── Original 8 core passages ──────────────────────────────
  {
    id: 'kb-001',
    content:
      'To register as a voter in Kerala, you must be an Indian citizen, at least 18 years old on the qualifying date (January 1), and a resident of the constituency. Fill Form 6 at voters.eci.gov.in or visit your nearest Electoral Registration Officer (ERO).',
    metadata: {
      source: 'Election Commission of India — Voter Registration Guide',
      url: 'https://voters.eci.gov.in/',
      lastUpdated: '2026-01-10',
      section: 'Registration',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-002',
    content:
      'Documents required for voter registration: (1) Proof of age — birth certificate, school leaving certificate, passport, or PAN card. (2) Proof of address — Aadhaar card, utility bill, bank passbook, or rent agreement. (3) One recent passport-size photograph.',
    metadata: {
      source: 'CEO Kerala — Required Documents',
      url: 'https://ceokerala.gov.in/registration-documents',
      lastUpdated: '2026-01-05',
      section: 'Documents',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-003',
    content:
      'Kottayam district has 6 assembly constituencies: Vaikom, Kottayam, Puthuppally, Changanassery, Kanjirappally, and Pala. The district is part of the Kottayam (Lok Sabha) parliamentary constituency.',
    metadata: {
      source: 'CEO Kerala — Kottayam District Profile',
      url: 'https://ceokerala.gov.in/kottayam',
      lastUpdated: '2026-01-15',
      section: 'District Info',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-004',
    content:
      'To find your polling booth, use the Electoral Search portal at electoralsearch.eci.gov.in. Enter your EPIC number or search by name, father\'s name, and age. You can also SMS your EPIC number to 1950.',
    metadata: {
      source: 'ECI — Booth Locator',
      url: 'https://electoralsearch.eci.gov.in/',
      lastUpdated: '2026-01-12',
      section: 'Booth Locator',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-005',
    content:
      'Acceptable photo ID documents at polling booths include: (1) EPIC/Voter ID card, (2) Aadhaar, (3) Passport, (4) Driving License, (5) PAN card, (6) Smart Card issued by RGI under NPR, (7) MNREGA Job Card, (8) Health Insurance Smart Card (RSBY), (9) Bank/Post Office passbook with photo, (10) Service ID of PSU/Government employees, (11) Pension document with photo, (12) MP/MLA/MLC official identity card.',
    metadata: {
      source: 'ECI — Approved ID Documents',
      url: 'https://eci.gov.in/voter-id-documents',
      lastUpdated: '2025-12-20',
      section: 'Voter ID',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-006',
    content:
      'SVEEP (Systematic Voters\' Education and Electoral Participation) is the flagship program of the Election Commission of India to enhance voter awareness, literacy, and participation. Activities include campus ambassadors, voter awareness forums, and cultural events.',
    metadata: {
      source: 'ECI — About SVEEP',
      url: 'https://ecisveep.nic.in/',
      lastUpdated: '2026-01-01',
      section: 'About',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-007',
    content:
      'To report election violations, you can: (1) Use the cVIGIL mobile app, (2) Call the Election Commission helpline at 1950, (3) File a complaint at the nearest returning officer\'s office. Reports are tracked and acted upon within 100 minutes under the cVIGIL protocol.',
    metadata: {
      source: 'ECI — cVIGIL & Violation Reporting',
      url: 'https://cvigil.eci.gov.in/',
      lastUpdated: '2026-01-08',
      section: 'Violations',
    },
    score: 0,
    method: 'vector',
  },
  {
    id: 'kb-008',
    content:
      'Kerala elections use Electronic Voting Machines (EVMs) with Voter Verifiable Paper Audit Trail (VVPAT). After pressing the button on the EVM, the VVPAT displays the candidate\'s name and symbol for 7 seconds, then drops the slip into a sealed box for verification if needed.',
    metadata: {
      source: 'ECI — EVM & VVPAT Guide',
      url: 'https://eci.gov.in/evm-vvpat',
      lastUpdated: '2025-11-15',
      section: 'EVM',
    },
    score: 0,
    method: 'vector',
  },

  // ── V5: Voting Rules passages (from voting_rules.json) ────
  {
    id: 'kb-v5-vr-001',
    content:
      'Polling hours in Kerala are from 7:00 AM to 6:00 PM. The first 30 minutes (6:30 AM – 7:00 AM) are reserved for mock polls in the presence of polling agents. Voters who are in the queue at 6:00 PM will be allowed to vote.',
    metadata: { source: 'ECI — Voting Rules', url: 'https://eci.gov.in/poll-timing', lastUpdated: '2026-01-15', section: 'Poll Timing' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vr-002',
    content:
      '12 accepted photo ID documents at the polling booth: (1) EPIC, (2) Aadhaar, (3) Passport, (4) Driving License, (5) PAN Card, (6) NPR Smart Card, (7) MNREGA Job Card, (8) RSBY Health Insurance Card, (9) Bank/Post Office passbook with photo, (10) PSU/Government Service ID, (11) Pension document with photo, (12) MP/MLA/MLC identity card.',
    metadata: { source: 'ECI — Accepted ID', url: 'https://eci.gov.in/voter-id-documents', lastUpdated: '2026-01-15', section: 'ID Documents' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vr-003',
    content:
      'Step-by-step voting process: (1) Stand in queue at your assigned booth. (2) Show accepted photo ID to the polling officer. (3) Get your left index finger inked with indelible ink. (4) Receive a ballot slip. (5) Enter the voting compartment. (6) Press the button on the EVM next to your chosen candidate. (7) Check the VVPAT slip (visible for 7 seconds). (8) Exit the booth. (9) Your vote is secret — nobody can see your choice.',
    metadata: { source: 'ECI — Voting Process', url: 'https://eci.gov.in/voting-process', lastUpdated: '2026-01-15', section: 'Voting Process' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vr-004',
    content:
      'Prohibited items at polling stations: mobile phones, cameras, arms, loud speakers, party flags/banners within 200m. Strict silence period of 48 hours before polling day — no campaigning allowed.',
    metadata: { source: 'ECI — Prohibited Items', url: 'https://eci.gov.in/voting-rules', lastUpdated: '2026-01-15', section: 'Prohibited Items' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vr-005',
    content:
      'PwD voter facilities: wheelchair ramps at all polling stations, Braille-enabled dummy ballots for visually impaired voters, companion-assisted voting with Presiding Officer permission, priority entry for elderly/disabled voters, home voting option for those with 40%+ disability.',
    metadata: { source: 'ECI — PwD Facilities', url: 'https://eci.gov.in/pwd-facilities', lastUpdated: '2026-01-15', section: 'PwD Facilities' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vr-006',
    content:
      'Tender vote: If someone has already voted using your identity, you can cast a "tender vote" on a paper ballot after informing the Presiding Officer. Your complaint will be recorded in Form 17A.',
    metadata: { source: 'ECI — Tender Vote', url: 'https://eci.gov.in/tender-vote', lastUpdated: '2026-01-15', section: 'Tender Vote' },
    score: 0, method: 'vector',
  },

  // ── V5: Voter Services / ECI Forms passages ───────────────
  {
    id: 'kb-v5-vs-001',
    content:
      'Form 6 is for new voter registration. Eligibility: Indian citizen, 18+ years old on January 1 qualifying date, ordinary resident of the constituency. Required documents: proof of age (birth certificate, school leaving cert, passport, PAN, or Aadhaar), proof of address, and passport-size photograph. Apply at voters.eci.gov.in or visit your ERO.',
    metadata: { source: 'ECI — Form 6', url: 'https://voters.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Forms' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vs-002',
    content:
      'Form 6A is for overseas/NRI voter registration. Eligibility: Indian citizen living abroad with valid passport. Required documents: valid Indian passport, proof of overseas address, original address in India. NRI voters must vote in person at their enrolled constituency polling station.',
    metadata: { source: 'ECI — Form 6A', url: 'https://voters.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Forms' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vs-003',
    content:
      'Form 7 is for objection to inclusion / request for deletion from electoral roll. Used to report deceased voters, shifted voters, or duplicate entries. Required: EPIC number of entry to be objected, supporting evidence, applicant\'s own voter ID.',
    metadata: { source: 'ECI — Form 7', url: 'https://voters.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Forms' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vs-004',
    content:
      'Form 8 is used for corrections and updates to voter ID: name correction, address change (within constituency), photo update, PwD marking, replacement of lost/damaged EPIC card, and change of constituency (shifting residence). Seven sub-variants exist (Form 8-1 through 8-7).',
    metadata: { source: 'ECI — Form 8', url: 'https://voters.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Forms' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-vs-005',
    content:
      'Form 12C is used by notified government employees who are posted outside their constituency during election duty. It allows them to vote as a service voter through postal ballot. Required: Service ID, posting order, Form 12C filled and attested by head of office.',
    metadata: { source: 'ECI — Form 12C', url: 'https://voters.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Forms' },
    score: 0, method: 'vector',
  },

  // ── V5: Complaint / cVIGIL passages ───────────────────────
  {
    id: 'kb-v5-cp-001',
    content:
      'cVIGIL is the Election Commission\'s mobile app for reporting Model Code of Conduct violations. Steps: (1) Download cVIGIL from Play Store/App Store. (2) Enable GPS and camera permissions. (3) Capture photo/video of the violation (max 2 min video). (4) Add a brief description. (5) Submit — the app auto-captures location and timestamp. (6) Receive a tracking ID to follow up. Reports are resolved within 100 minutes under ECI\'s protocol.',
    metadata: { source: 'ECI — cVIGIL', url: 'https://cvigil.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Complaints' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-cp-002',
    content:
      'Types of election violations reportable via cVIGIL: distribution of money (V01), distribution of liquor (V02), paid news/advertisements violating rules (V03), illegal use of vehicles for campaigning (V04), intimidation/threat to voters (V05), illegal hoarding/banners/posters (V06), misuse of government resources (V07), violation of silence period (V08), illegal arms display (V09), campaign during prohibited hours (V10), booth capturing (V11).',
    metadata: { source: 'ECI — Violation Types', url: 'https://cvigil.eci.gov.in/', lastUpdated: '2026-01-15', section: 'Violations' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-cp-003',
    content:
      'Offline complaint alternatives (without cVIGIL app): (1) Call voter helpline 1950. (2) Visit the nearest Returning Officer / Assistant Returning Officer. (3) Write to the District Election Officer. (4) Contact the booth-level officer (BLO) in your area.',
    metadata: { source: 'ECI — Offline Complaints', url: 'https://eci.gov.in/complaints', lastUpdated: '2026-01-15', section: 'Complaints' },
    score: 0, method: 'vector',
  },

  // ── V5: Election Timeline passages ────────────────────────
  {
    id: 'kb-v5-tl-001',
    content:
      '2026 Kerala Legislative Assembly Election key dates: Official dates have NOT yet been announced by the Election Commission of India. Expected announcement window: January–February 2026. All dates including election notification, nomination, scrutiny, withdrawal, poll date, and counting date are currently TBA. Visit eci.gov.in or ceo.kerala.gov.in for updates.',
    metadata: { source: 'ECI — Election Timeline', url: 'https://eci.gov.in/', lastUpdated: '2026-01-15', section: 'Timeline' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-tl-002',
    content:
      'Kottayam district has 9 assembly constituencies for 2026 elections: (42) Vaikom, (43) Kottayam, (44) Puthuppally, (45) Changanassery, (46) Kanjirappally, (47) Pala, (48) Kaduthuruthy, (49) Ettumanoor, (50) Erattupetta. All fall in the House of the People as declared by the Delimitation Commission.',
    metadata: { source: 'CEO Kerala — Constituencies', url: 'https://ceokerala.gov.in/kottayam', lastUpdated: '2026-01-15', section: 'Constituencies' },
    score: 0, method: 'vector',
  },
  {
    id: 'kb-v5-tl-003',
    content:
      'Model Code of Conduct (MCC): The MCC comes into effect from the date of election announcement and is lifted on the date results are declared. It governs the conduct of political parties, candidates, and the ruling government. Current status: NOT IN EFFECT (pending 2026 election announcement).',
    metadata: { source: 'ECI — MCC', url: 'https://eci.gov.in/mcc', lastUpdated: '2026-01-15', section: 'MCC' },
    score: 0, method: 'vector',
  },
];

// ── Load booth data into knowledge base ───────────────────────────

function boothToPassage(booth: BoothRecord): RetrievedPassage {
  return {
    id: booth.id,
    content: booth.content,
    metadata: {
      source: booth.source,
      url: booth.sourceUrl,
      lastUpdated: '2026-02-01',
      section: `Polling Station ${booth.stationNumber}`,
    },
    score: 0,
    method: 'vector',
  };
}

// Merged knowledge base: V5 expanded core + 171 booth entries
let _mergedKB: RetrievedPassage[] | null = null;

function getKnowledgeBase(): RetrievedPassage[] {
  if (_mergedKB) return _mergedKB;
  const boothPassages = getAllBooths().map(boothToPassage);
  _mergedKB = [...CORE_KNOWLEDGE_BASE, ...boothPassages];
  console.log(`[retriever] KB initialized: ${CORE_KNOWLEDGE_BASE.length} core (V5) + ${boothPassages.length} booth = ${_mergedKB.length} total passages`);
  return _mergedKB;
}

/**
 * Simple BM25-style keyword scoring
 */
function bm25Score(query: string, document: string): number {
  const KB = getKnowledgeBase();
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const docTerms = document.toLowerCase().split(/\s+/);
  const docLen = docTerms.length;
  const avgDocLen = 200; // approximation
  const k1 = 1.5;
  const b = 0.75;

  let score = 0;
  for (const term of queryTerms) {
    const tf = docTerms.filter((t) => t.includes(term)).length;
    const idf = Math.log(1 + (KB.length - tf + 0.5) / (tf + 0.5));
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
    score += idf * (numerator / denominator);
  }
  return score;
}

// ── Precomputed embeddings cache (non-blocking background init) ───
let kbEmbeddings: number[][] | null = null;
let kbEmbeddingsSize = 0;
let kbEmbeddingPromise: Promise<void> | null = null;

/**
 * Start KB embedding in the background. Called once on first import.
 * Does NOT block queries — if embeddings aren't ready, BM25 is used.
 */
function warmUpKbEmbeddings(): void {
  if (kbEmbeddingPromise) return; // already running / done

  kbEmbeddingPromise = (async () => {
    const cfg = getConfig();
    if (!cfg.apiKey) {
      kbEmbeddings = [];
      kbEmbeddingsSize = 0;
      return;
    }
    const KB = getKnowledgeBase();
    if (kbEmbeddings && kbEmbeddingsSize === KB.length) return;

    const BATCH_SIZE = 32;
    const contents = KB.map((p) => p.content);
    const allEmbeddings: (number[] | null)[] = new Array(contents.length).fill(null);
    let successCount = 0;
    let failCount = 0;

    // Embed each batch independently — failures skip that batch
    for (let i = 0; i < contents.length; i += BATCH_SIZE) {
      const batch = contents.slice(i, i + BATCH_SIZE);
      try {
        const result = await embedDocuments(batch);
        for (let j = 0; j < result.embeddings.length; j++) {
          allEmbeddings[i + j] = result.embeddings[j];
        }
        successCount += batch.length;
      } catch (err) {
        failCount += batch.length;
        console.warn(`[retriever] KB embed batch ${i / BATCH_SIZE + 1} failed (${batch.length} passages), skipping:`, err instanceof Error ? err.message : err);
        // Leave nulls for this batch — vector search will skip these passages
      }
    }

    // Only mark as ready if we got at least *some* embeddings
    if (successCount > 0) {
      // Replace nulls with zero-vectors so cosine similarity returns 0 for those
      const dim = (allEmbeddings.find((e) => e !== null) as number[]).length;
      kbEmbeddings = allEmbeddings.map((e) => e ?? new Array(dim).fill(0));
      kbEmbeddingsSize = KB.length;
      console.log(`[retriever] Embedded KB: ${successCount} ok, ${failCount} failed (${CORE_KNOWLEDGE_BASE.length} core + ${KB.length - CORE_KNOWLEDGE_BASE.length} booth)`);
    } else {
      console.warn('[retriever] All KB embedding batches failed, using BM25-only');
      kbEmbeddings = [];
      kbEmbeddingsSize = 0;
    }
  })();
}

// Kick off background embedding on module load (non-blocking)
warmUpKbEmbeddings();

/**
 * Get KB embeddings if available. Never blocks — returns [] if still loading.
 */
async function getKbEmbeddings(): Promise<number[][]> {
  const KB = getKnowledgeBase();

  // Already cached and up to date
  if (kbEmbeddings && kbEmbeddingsSize === KB.length) return kbEmbeddings;

  // If background warm-up is running, wait up to 100ms then give up (use BM25)
  if (kbEmbeddingPromise) {
    await Promise.race([
      kbEmbeddingPromise,
      new Promise((r) => setTimeout(r, 100)),
    ]);
    if (kbEmbeddings && kbEmbeddingsSize === KB.length) return kbEmbeddings;
  }

  // Not ready yet — fall back to BM25 (empty array → vector search skipped)
  return [];
}

/**
 * Retrieve relevant passages using hybrid search.
 * Returns top-15 candidates for reranking.
 */
export async function retrievePassages(
  query: string,
  locale: string,
  maxTokens: number
): Promise<RetrievalResult> {
  const startTime = Date.now();
  let queryEmbeddingLatencyMs = 0;

  const KB = getKnowledgeBase();

  // ── BM25 scoring ────────────────────────────────────────────
  const bm25Scored = KB.map((passage) => ({
    ...passage,
    score: bm25Score(query, passage.content),
    method: 'bm25' as const,
  }));

  // ── Vector scoring (if API key available) ───────────────────
  const cfg = getConfig();
  let vectorScored: (RetrievedPassage & { vectorScore: number })[] = [];

  if (cfg.apiKey) {
    try {
      const embStart = Date.now();
      const [queryEmb, kbEmbs] = await Promise.all([
        embedQuery(query),
        getKbEmbeddings(),
      ]);
      queryEmbeddingLatencyMs = Date.now() - embStart;

      if (kbEmbs.length === KB.length) {
        vectorScored = KB.map((passage, i) => ({
          ...passage,
          score: cosineSimilarity(queryEmb, kbEmbs[i]),
          vectorScore: cosineSimilarity(queryEmb, kbEmbs[i]),
          method: 'vector' as const,
        }));
      }
    } catch (err) {
      console.warn('Vector search failed, using BM25-only:', err);
    }
  }

  // ── Hybrid merge ────────────────────────────────────────────
  // Normalize BM25 scores to 0-1
  const maxBm25 = Math.max(...bm25Scored.map((p) => p.score), 0.001);
  const normalizedBm25 = bm25Scored.map((p) => ({
    ...p,
    score: p.score / maxBm25,
  }));

  // Merge: 0.4 * BM25 + 0.6 * vector (if available)
  const merged = KB.map((passage, i) => {
    const bm25 = normalizedBm25[i]?.score ?? 0;
    const vector = vectorScored[i]?.vectorScore ?? 0;
    const hasVector = vectorScored.length > 0;
    const hybridScore = hasVector ? 0.4 * bm25 + 0.6 * vector : bm25;

    return {
      ...passage,
      score: Math.round(hybridScore * 1000) / 1000,
      method: (hasVector ? 'hybrid' : 'bm25') as 'hybrid' | 'bm25' | 'vector',
    };
  });

  // Sort and take top 15
  merged.sort((a, b) => b.score - a.score);
  const top15 = merged.slice(0, 15);

  // Token-budgeted selection
  let tokenCount = 0;
  const selectedPassages: RetrievedPassage[] = [];
  for (const passage of top15) {
    const tokens = passage.content.split(/\s+/).length * 1.3;
    if (tokenCount + tokens > maxTokens) break;
    tokenCount += tokens;
    selectedPassages.push(passage);
  }

  const retrievalLatencyMs = Date.now() - startTime;

  return {
    passages: selectedPassages,
    totalTokens: Math.round(tokenCount),
    queryEmbeddingLatencyMs,
    retrievalLatencyMs,
  };
}
