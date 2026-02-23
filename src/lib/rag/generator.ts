/**
 * Generator — qwen3-vl-30b-a3b-thinking via Fireworks
 * ─────────────────────────────────────────────────────
 * Text-only mode for RAG queries (no image unless routed by vision pipeline).
 * Falls back to template-based responses when API is unavailable.
 */

import { chatCompletion, chatCompletionStream, getConfig, estimateTokens, trimToTokenBudget } from '@/lib/fireworks';
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

    // 4. Strip untagged chain-of-thought: if the response contains
    //    reasoning preamble before the actual answer, remove it.
    //    Detects patterns like "Okay, let me tackle...", "First, I'll check...",
    //    "Wait, the instructions say...", "So, I'll list..." etc.
    const cotPatterns = [
      /^(?:Okay|Ok|Alright|Let me|First|Now|Hmm|Wait|So,|Looking|I need to|I should|I'll|The user|Alternatively)[,\s][\s\S]*?\n\n/i,
    ];
    // If the response looks like it starts with reasoning text followed by
    // the actual formatted answer, find where the real answer begins.
    // Real answers typically start with bullet points, bold text, or a direct statement.
    const answerStartMatch = responseText.match(
      /\n\n((?:[-•]\s|\*\*|📍|Polling Station|പോളിംഗ്|Here are|The polling|Your polling|Booth|In (?:Kottayam|Sankranthy|Mudiyoorkkara))[\s\S]*)/i
    );
    if (answerStartMatch && answerStartMatch.index !== undefined) {
      // Check if there's substantial reasoning text before the answer
      const preamble = responseText.substring(0, answerStartMatch.index);
      const reasoningIndicators = (preamble.match(/\b(but|however|wait|let me|I('ll| need| should| have)|check|maybe|alternatively|looking|considering)\b/gi) || []).length;
      if (reasoningIndicators >= 3) {
        responseText = answerStartMatch[1].trim();
      }
    }

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
