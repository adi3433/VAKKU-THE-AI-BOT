/**
 * Generator — qwen3-vl-30b-a3b-thinking via Fireworks
 * ─────────────────────────────────────────────────────
 * Text-only mode for RAG queries (no image unless routed by vision pipeline).
 * Falls back to template-based responses when API is unavailable.
 */

import { chatCompletion, chatCompletionStream, getConfig, trimToTokenBudget } from '@/lib/fireworks';
import type { ChatMessage as FWMessage } from '@/lib/fireworks';

interface GenerationResult {
  text: string;
  confidence: number;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

/**
 * Robust untagged chain-of-thought stripping.
 * Qwen3-thinking may leak reasoning even with /no_think directive.
 * This function detects reasoning paragraphs and strips them, keeping only
 * the actual user-facing answer.
 */
const REASONING_INDICATOR = /\b(?:let me|I need to|I should|I'll|I can see|I must|I have to|I want to|I can't|the user(?:'s| is| has| asked| didn't| previously| tried| might| may| wants)|from the (?:context|source|provided|conversation|data)|check (?:if|the|for|whether|any)|looking at|wait,|hmm,?|first,?\s*I|also,?\s*(?:the|I)|but (?:the instructions?|wait|since|I|to be)|however,?\s*(?:the|I)|now (?:that|I|let)|so (?:the (?:response|answer)|I (?:should|need|can|must)|maybe|it)|this (?:means|suggests|is (?:a |the ))|before I|maybe I|alternatively|considering|my (?:approach|plan|reasoning)|the (?:instructions?|format|rules?) (?:says?|is|are|requires?)|to be safe|the (?:response|answer|output) (?:should|must|needs?)|I (?:don't|do not) (?:need|want|have)|since (?:the|they|we)|the (?:relevant|key|important) (?:details?|info|source)|no code-switching|the confidence)\b/i;

function stripUntaggedReasoning(text: string): string {
  const trimmed = text.trim();

  // Early exit: if text starts with formatted answer content, it's clean
  if (/^(?:\*\*|[-•●]\s|📍|📞|✅|❌|➡️|#{1,3}\s|\d+\.\s\*\*)/.test(trimmed)) {
    return trimmed;
  }

  // Split into paragraphs
  const paragraphs = trimmed.split(/\n\n+/);
  if (paragraphs.length <= 1) {
    // Single paragraph: check if it's reasoning
    if (REASONING_INDICATOR.test(trimmed) && trimmed.length > 200) {
      return ''; // All reasoning, no answer — will trigger fallback
    }
    return trimmed;
  }

  // Score each paragraph: reasoning vs answer content
  let answerStartIdx = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;

    const isReasoning = REASONING_INDICATOR.test(para);
    const isFormatted = /^(?:\*\*|[-•●]\s|📍|📞|✅|❌|➡️|✓|#{1,3}\s|\d+\.\s\*\*)/.test(para);

    // Found a non-reasoning paragraph that looks like actual answer content
    if (!isReasoning && isFormatted) {
      answerStartIdx = i;
      break;
    }
    // Non-reasoning, non-formatted but substantial text (not meta-commentary)
    if (!isReasoning && para.length > 30) {
      answerStartIdx = i;
      break;
    }
  }

  if (answerStartIdx > 0) {
    const answer = paragraphs.slice(answerStartIdx).join('\n\n').trim();
    // Sanity check: if what remains is still substantially reasoning, return empty
    if (answer.length < 20) return '';
    return answer;
  }

  // If ALL paragraphs are reasoning and there are many, the model failed
  // to produce a clean answer — return empty to trigger fallback
  if (answerStartIdx === -1 && paragraphs.length >= 3) {
    const allReasoning = paragraphs.every(
      (p) => !p.trim() || REASONING_INDICATOR.test(p.trim())
    );
    if (allReasoning) return '';
  }

  return trimmed;
}

/**
 * Generate an answer using qwen3-vl-30b-a3b-thinking (text-only mode)
 */
export async function generateAnswer(
  systemPrompt: string,
  userPrompt: string,
  locale: string
): Promise<GenerationResult> {
  const cfg = getConfig();

  if (!cfg.apiKey) {
    console.warn('No FIREWORKS_API_KEY configured. Using template fallback.');
    return templateFallback(userPrompt, locale);
  }

  // Token trimming — keep prompt within budget
  const maxPromptTokens = cfg.maxContextTokens - cfg.maxGenerationTokens;
  const trimmedPrompt = trimToTokenBudget(userPrompt, maxPromptTokens);

  const messages: FWMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: trimmedPrompt },
  ];

  try {
    const result = await chatCompletion({
      messages,
      maxTokens: cfg.maxGenerationTokens,
      temperature: 0.3,
      topP: 0.9,
    });

    // Strip thinking tokens from response (qwen3-*-thinking models)
    let responseText = result.text;

    // 1. Strip explicit <think>...</think> blocks
    const thinkEnd = responseText.lastIndexOf('</think>');
    if (thinkEnd !== -1) {
      responseText = responseText.substring(thinkEnd + '</think>'.length).trim();
    }
    // 2. Strip any remaining <think> tags (nested or malformed)
    responseText = responseText.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    // 3. Strip orphan <think> tag without closing
    responseText = responseText.replace(/<think>[\s\S]*/g, '').trim();

    // 4. Robust untagged chain-of-thought stripping
    //    Qwen3-thinking may leak reasoning outside <think> tags even with /no_think.
    responseText = stripUntaggedReasoning(responseText);

    // Confidence heuristic: based on response length and finish reason
    let confidence = 0.85;
    if (responseText.length < 50) confidence = 0.5;
    if (result.finishReason === 'length') confidence = Math.min(confidence, 0.65);

    return {
      text: responseText,
      confidence,
      tokensUsed: result.tokensUsed,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      model: result.model,
    };
  } catch (error) {
    console.error('Generator error:', error);
    return templateFallback(userPrompt, locale);
  }
}

/**
 * Stream answer — returns a ReadableStream<string> of text chunks
 */
export async function generateAnswerStream(
  systemPrompt: string,
  userPrompt: string,
  locale: string
): Promise<ReadableStream<string>> {
  const cfg = getConfig();

  if (!cfg.apiKey) {
    // Return a simple stream with template fallback
    const fallback = templateFallback(userPrompt, locale);
    return new ReadableStream<string>({
      start(controller) {
        controller.enqueue(fallback.text);
        controller.close();
      },
    });
  }

  const maxPromptTokens = cfg.maxContextTokens - cfg.maxGenerationTokens;
  const trimmedPrompt = trimToTokenBudget(userPrompt, maxPromptTokens);

  const messages: FWMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: trimmedPrompt },
  ];

  return chatCompletionStream({
    messages,
    maxTokens: cfg.maxGenerationTokens,
    temperature: 0.3,
    topP: 0.9,
  });
}

/**
 * Template-based fallback when LLM is unavailable
 */
function templateFallback(userPrompt: string, locale: string): GenerationResult {
  const queryLower = userPrompt.toLowerCase();
  const fallbackMeta = { promptTokens: 0, completionTokens: 0, model: 'template-fallback' };

  // Match common intents
  if (queryLower.includes('register') || queryLower.includes('രജിസ്')) {
    return {
      text:
        locale === 'ml'
          ? 'വോട്ടറായി രജിസ്റ്റർ ചെയ്യാൻ, voters.eci.gov.in-ൽ ഫോം 6 പൂരിപ്പിക്കുക. പ്രായ തെളിവ്, വിലാസ തെളിവ്, ഫോട്ടോ എന്നിവ ആവശ്യമാണ്. [Source: ECI Voter Registration Portal]'
          : 'To register as a voter, fill Form 6 at voters.eci.gov.in. You need proof of age, address proof, and a photograph. [Source: ECI Voter Registration Portal]',
      confidence: 0.75,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  if (queryLower.includes('booth') || queryLower.includes('ബൂത്ത്')) {
    return {
      text:
        locale === 'ml'
          ? 'നിങ്ങളുടെ പോളിംഗ് ബൂത്ത് കണ്ടെത്താൻ, electoralsearch.eci.gov.in സന്ദർശിക്കുക അല്ലെങ്കിൽ EPIC നമ്പർ 1950-ലേക്ക് SMS ചെയ്യുക. [Source: ECI Electoral Search]'
          : 'To find your polling booth, visit electoralsearch.eci.gov.in or SMS your EPIC number to 1950. [Source: ECI Electoral Search]',
      confidence: 0.75,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  if (queryLower.includes('document') || queryLower.includes('id') || queryLower.includes('രേഖ')) {
    return {
      text:
        locale === 'ml'
          ? 'പോളിംഗ് ബൂത്തിൽ EPIC (വോട്ടർ ഐഡി കാർഡ്) അല്ലെങ്കിൽ 12 അംഗീകൃത ഫോട്ടോ ഐഡി രേഖകളിൽ ഒന്ന് കൊണ്ടുവരിക: ആധാർ, പാസ്‌പോർട്ട്, ഡ്രൈവിംഗ് ലൈസൻസ്, PAN കാർഡ് മുതലായവ. [Source: ECI Approved ID Documents]'
          : 'Bring your EPIC (Voter ID card) or any of the 12 approved photo IDs: Aadhaar, Passport, Driving License, PAN Card, etc. [Source: ECI Approved ID Documents]',
      confidence: 0.75,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  if (queryLower.includes('violation') || queryLower.includes('report') || queryLower.includes('ലംഘന')) {
    return {
      text:
        locale === 'ml'
          ? 'തിരഞ്ഞെടുപ്പ് ലംഘനങ്ങൾ റിപ്പോർട്ട് ചെയ്യാൻ cVIGIL ആപ്പ് ഉപയോഗിക്കുക, 1950 ഹെൽപ്‌ലൈൻ വിളിക്കുക, അല്ലെങ്കിൽ ഈ ആപ്പിലെ "ലംഘനം റിപ്പോർട്ട് ചെയ്യുക" ഫീച്ചർ ഉപയോഗിക്കുക. [Source: ECI cVIGIL]'
          : 'To report election violations, use the cVIGIL app, call helpline 1950, or use the "Report Violation" feature in this app. [Source: ECI cVIGIL]',
      confidence: 0.75,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  // Default fallback
  return {
    text:
      locale === 'ml'
        ? 'എനിക്ക് ഈ ചോദ്യത്തിന് ഉറപ്പുള്ള ഉത്തരം നൽകാൻ കഴിയുന്നില്ല. ദയവായി electoralsearch.eci.gov.in അല്ലെങ്കിൽ ceokerala.gov.in പരിശോധിക്കുക. ഒരു ഓപ്പറേറ്ററുമായി ബന്ധിപ്പിക്കണമോ?'
        : "I don't have a confident answer for this question. Please check electoralsearch.eci.gov.in or ceokerala.gov.in. Would you like me to connect you with a human operator?",
    confidence: 0.3,
    tokensUsed: 0,
    ...fallbackMeta,
  };
}
