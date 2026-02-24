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
          ? '## 📋 വോട്ടർ രജിസ്ട്രേഷൻ - പൂർണ്ണ ഗൈഡ്\n\nവോട്ടറായി രജിസ്റ്റർ ചെയ്യാൻ **ഫോം 6** പൂരിപ്പിക്കുക.\n\n### 📝 രജിസ്ട്രേഷൻ ഘട്ടങ്ങൾ:\n1. **ഓൺലൈൻ:** [voters.eci.gov.in](https://voters.eci.gov.in) അല്ലെങ്കിൽ [nvsp.in](https://www.nvsp.in) സന്ദർശിക്കുക\n2. "New Voter Registration (Form 6)" തിരഞ്ഞെടുക്കുക\n3. വ്യക്തിഗത വിവരങ്ങൾ, വിലാസം, ഫോട്ടോ എന്നിവ നൽകുക\n4. ആവശ്യമായ രേഖകൾ അപ്‌ലോഡ് ചെയ്യുക\n5. അപേക്ഷ സമർപ്പിക്കുക\n\n### 📄 ആവശ്യമായ രേഖകൾ:\n- **പ്രായ തെളിവ്:** ജനന സർട്ടിഫിക്കറ്റ്, 10-ാം ക്ലാസ് മാർക്ക്ഷീറ്റ്, അല്ലെങ്കിൽ പാസ്‌പോർട്ട്\n- **വിലാസ തെളിവ്:** ആധാർ, റേഷൻ കാർഡ്, വൈദ്യുതി ബിൽ, അല്ലെങ്കിൽ വാടക കരാർ\n- **പാസ്‌പോർട്ട് സൈസ് ഫോട്ടോ** (സമീപകാല)\n\n### ✅ യോഗ്യത:\n- ഇന്ത്യൻ പൗരൻ\n- യോഗ്യതാ തീയതിയിൽ **18 വയസ്സ്** പൂർത്തിയായിരിക്കണം\n- കോട്ടയം ജില്ലയിൽ സാധാരണ താമസക്കാരൻ\n\n### 🔗 ഉപയോഗപ്രദമായ ലിങ്കുകൾ:\n- [voters.eci.gov.in](https://voters.eci.gov.in) — ECI വോട്ടർ പോർട്ടൽ\n- [nvsp.in](https://www.nvsp.in) — NVSP പോർട്ടൽ\n- [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in) — രജിസ്ട്രേഷൻ സ്റ്റാറ്റസ് പരിശോധിക്കുക\n\n📞 **ഹെൽപ്‌ലൈൻ:** 1950 | 1800-425-1950 (ടോൾ ഫ്രീ)\n\n[Source: ECI Voter Registration Portal]'
          : '## 📋 Voter Registration - Complete Guide\n\nTo register as a new voter, you need to fill **Form 6** online or offline.\n\n### 📝 Registration Steps:\n1. **Online:** Visit [voters.eci.gov.in](https://voters.eci.gov.in) or [nvsp.in](https://www.nvsp.in)\n2. Select "New Voter Registration (Form 6)"\n3. Fill in your personal details, address, and upload a photo\n4. Upload the required supporting documents\n5. Submit the application and note down the reference number\n\n### 📄 Documents Required:\n- **Proof of Age:** Birth certificate, Class 10 marksheet, or Passport\n- **Proof of Address:** Aadhaar card, Ration card, Electricity bill, or Rent agreement\n- **Recent passport-size photograph**\n\n### ✅ Eligibility:\n- Must be an **Indian citizen**\n- Must be **18 years or older** on the qualifying date\n- Must be a **resident** of Kottayam district\n\n### 🔗 Useful Links:\n- [voters.eci.gov.in](https://voters.eci.gov.in) — ECI Voter Portal\n- [nvsp.in](https://www.nvsp.in) — NVSP Portal\n- [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in) — Check registration status\n\n📞 **Helpline:** 1950 | 1800-425-1950 (Toll Free)\n\n[Source: ECI Voter Registration Portal]',
      confidence: 0.85,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  if (queryLower.includes('booth') || queryLower.includes('ബൂത്ത്')) {
    return {
      text:
        locale === 'ml'
          ? '## 📍 പോളിംഗ് ബൂത്ത് കണ്ടെത്താൻ\n\nനിങ്ങളുടെ പോളിംഗ് സ്റ്റേഷൻ കണ്ടെത്താൻ ഈ മാർഗ്ഗങ്ങൾ ഉപയോഗിക്കുക:\n\n### 🔍 ഓൺലൈൻ:\n1. [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in) സന്ദർശിക്കുക\n2. നിങ്ങളുടെ **EPIC നമ്പർ** (വോട്ടർ ഐഡി) അല്ലെങ്കിൽ **പേര് + വിലാസം** നൽകുക\n3. നിങ്ങളുടെ നിയുക്ത ബൂത്ത് വിവരങ്ങൾ കാണിക്കും\n\n### 📱 SMS വഴി:\n- നിങ്ങളുടെ **EPIC നമ്പർ** SMS ചെയ്യുക **1950** ലേക്ക്\n\n### 📞 ഫോൺ വഴി:\n- **1950** ഹെൽപ്‌ലൈൻ വിളിക്കുക (24/7 ലഭ്യം)\n- **1800-425-1950** (ടോൾ ഫ്രീ)\n\n### 📌 ടിപ്:\nനിങ്ങളുടെ ബൂത്ത് നമ്പർ അറിയാമെങ്കിൽ, "ബൂത്ത് [നമ്പർ]" എന്ന് ടൈപ്പ് ചെയ്യുക — ഞാൻ സ്ഥാന വിവരങ്ങൾ, ലാൻഡ്‌മാർക്ക്, Google Maps ദിശ എന്നിവ നൽകാം.\n\nകോട്ടയം LAC 97-ൽ **171 പോളിംഗ് സ്റ്റേഷനുകൾ** ഉണ്ട്.\n\n[Source: ECI Electoral Search]'
          : '## 📍 Find Your Polling Booth\n\nHere\'s how to find your assigned polling station:\n\n### 🔍 Online:\n1. Visit [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in)\n2. Enter your **EPIC Number** (Voter ID) or search by **Name + Address**\n3. Your assigned polling station details will be displayed\n\n### 📱 Via SMS:\n- SMS your **EPIC Number** to **1950**\n\n### 📞 Via Phone:\n- Call **1950** helpline (available 24/7)\n- **1800-425-1950** (Toll Free)\n\n### 📌 Tip:\nIf you know your booth number, just type "booth [number]" — I can provide the exact location, landmark, and Google Maps directions.\n\nKottayam LAC 97 has **171 polling stations** across the constituency.\n\n[Source: ECI Electoral Search]',
      confidence: 0.85,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  if (queryLower.includes('document') || queryLower.includes('id') || queryLower.includes('രേഖ')) {
    return {
      text:
        locale === 'ml'
          ? '## 🪪 വോട്ടിങ്ങിന് അംഗീകൃത ഐഡി രേഖകൾ\n\nപോളിംഗ് ബൂത്തിൽ **EPIC (വോട്ടർ ഐഡി കാർഡ്)** അല്ലെങ്കിൽ ഇനിപ്പറയുന്ന **12 അംഗീകൃത ഫോട്ടോ ഐഡി രേഖകളിൽ ഏതെങ്കിലും ഒന്ന്** കാണിക്കണം:\n\n### 📄 അംഗീകൃത ഐഡി ലിസ്റ്റ്:\n1. **EPIC** (വോട്ടർ ഐഡി കാർഡ്)\n2. **ആധാർ കാർഡ്**\n3. **പാസ്‌പോർട്ട്**\n4. **ഡ്രൈവിംഗ് ലൈസൻസ്**\n5. **PAN കാർഡ്**\n6. **MNREGA ജോബ് കാർഡ്** (ഫോട്ടോ ഉള്ളത്)\n7. **സ്മാർട്ട് കാർഡ്** (ലേബർ മന്ത്രാലയം)\n8. **ബാങ്ക്/പോസ്റ്റ് ഓഫീസ് പാസ്‌ബുക്ക്** (ഫോട്ടോ ഉള്ളത്)\n9. **ആരോഗ്യ ഇൻഷുറൻസ് കാർഡ്**\n10. **പെൻഷൻ ഡോക്യുമെന്റ്** (ഫോട്ടോ ഉള്ളത്)\n11. **MP/MLA/MLC ഐഡി കാർഡ്**\n12. **സർക്കാർ ജീവനക്കാരുടെ ഫോട്ടോ ഐഡി**\n\n### ⚠️ പ്രധാന കുറിപ്പുകൾ:\n- ഒറിജിനൽ ഡോക്യുമെന്റ് മാത്രം — ഫോട്ടോകോപ്പി **സ്വീകരിക്കില്ല**\n- EPIC ഇല്ലെങ്കിലും മുകളിലെ ഏതെങ്കിലും ഐഡി ഉണ്ടെങ്കിൽ വോട്ട് ചെയ്യാം\n\n📞 **ഹെൽപ്‌ലൈൻ:** 1950\n\n[Source: ECI Approved ID Documents]'
          : '## 🪪 Accepted ID Documents for Voting\n\nAt the polling booth, you must show your **EPIC (Voter ID Card)** or any **one of the 12 approved photo IDs**:\n\n### 📄 Accepted ID List:\n1. **EPIC** (Voter Photo Identity Card)\n2. **Aadhaar Card**\n3. **Passport**\n4. **Driving License**\n5. **PAN Card**\n6. **MNREGA Job Card** (with photo)\n7. **Smart Card** (issued by Ministry of Labour)\n8. **Bank/Post Office Passbook** (with photo)\n9. **Health Insurance Smart Card** (under RSBY scheme)\n10. **Pension Document** (with photo)\n11. **MP/MLA/MLC Identity Card**\n12. **Government Employee Photo ID**\n\n### ⚠️ Important Notes:\n- **Original documents only** — photocopies are NOT accepted\n- Even without EPIC, you can vote if you have any of the above IDs\n- Your name must appear in the voter roll at your assigned booth\n\n📞 **Helpline:** 1950 | 1800-425-1950 (Toll Free)\n\n[Source: ECI Approved ID Documents]',
      confidence: 0.85,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  if (queryLower.includes('violation') || queryLower.includes('report') || queryLower.includes('ലംഘന')) {
    return {
      text:
        locale === 'ml'
          ? '## 🚨 തിരഞ്ഞെടുപ്പ് ലംഘനം റിപ്പോർട്ട് ചെയ്യാൻ\n\nതിരഞ്ഞെടുപ്പ് ലംഘനങ്ങൾ റിപ്പോർട്ട് ചെയ്യാൻ ഇനിപ്പറയുന്ന മാർഗ്ഗങ്ങൾ ഉപയോഗിക്കുക:\n\n### 📱 cVIGIL ആപ്പ് (ശുപാർശ ചെയ്യുന്നത്):\n1. Google Play Store / Apple App Store-ൽ നിന്ന് **cVIGIL** ഡൗൺലോഡ് ചെയ്യുക\n2. ലംഘനത്തിന്റെ **ഫോട്ടോ/വീഡിയോ** എടുക്കുക\n3. സ്ഥലം **GPS** വഴി സ്വയം ചേർക്കും\n4. 100 മിനിറ്റിനുള്ളിൽ **ഫ്ലൈയിംഗ് സ്ക്വാഡ്** നടപടി എടുക്കും\n\n### 📞 ഹെൽപ്‌ലൈൻ:\n- **1950** (വോട്ടർ ഹെൽപ്‌ലൈൻ)\n- **1800-425-1950** (ടോൾ ഫ്രീ)\n\n### 📝 ഈ ആപ്പിലും:\nഈ ആപ്പിലെ **"ലംഘനം റിപ്പോർട്ട് ചെയ്യുക"** ബട്ടൺ ഉപയോഗിക്കാം\n\n### ⚡ റിപ്പോർട്ട് ചെയ്യാവുന്ന ലംഘനങ്ങൾ:\n- പണ വിതരണം / കൈക്കൂലി\n- മദ്യ വിതരണം\n- അനധികൃത പോസ്റ്ററുകൾ / ബാനറുകൾ\n- ആൾക്കൂട്ട ഭീഷണി\n- മോഡൽ കോഡ് ഓഫ് കണ്ടക്ട് ലംഘനം\n\n[Source: ECI cVIGIL]'
          : '## 🚨 Report Election Violations\n\nYou can report election violations through the following channels:\n\n### 📱 cVIGIL App (Recommended):\n1. Download **cVIGIL** from Google Play Store / Apple App Store\n2. Capture **photo/video** of the violation\n3. **GPS location** is automatically tagged\n4. **Flying Squad** will take action within 100 minutes\n\n### 📞 Helpline:\n- **1950** (Voter Helpline - 24/7)\n- **1800-425-1950** (Toll Free)\n\n### 📝 In This App:\nYou can also use the **"Report Violation"** feature in this app\n\n### ⚡ Types of Violations You Can Report:\n- **Cash distribution** / Bribery\n- **Liquor distribution**\n- **Unauthorized posters / banners** beyond permitted areas\n- **Voter intimidation** or coercion\n- **Model Code of Conduct (MCC)** violations\n- **Misuse of government machinery**\n- **Paid news** or biased media\n\n📌 Reports are anonymous and your identity is protected.\n\n[Source: ECI cVIGIL]',
      confidence: 0.85,
      tokensUsed: 0,
      ...fallbackMeta,
    };
  }

  // Default fallback
  return {
    text:
      locale === 'ml'
        ? '## ℹ️ കൂടുതൽ വിവരങ്ങൾ ആവശ്യമാണ്\n\nഎനിക്ക് ഈ ചോദ്യത്തിന് ഉറപ്പുള്ള ഉത്തരം ഇപ്പോൾ നൽകാൻ കഴിയുന്നില്ല.\n\n### 🔗 ഔദ്യോഗിക ഉറവിടങ്ങൾ പരിശോധിക്കുക:\n- [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in) — വോട്ടർ തിരയൽ\n- [voters.eci.gov.in](https://voters.eci.gov.in) — വോട്ടർ സേവനങ്ങൾ\n- [ceokerala.gov.in](https://ceokerala.gov.in) — കേരള CEO ഓഫീസ്\n\n📞 **ഹെൽപ്‌ലൈൻ:** 1950 | 1800-425-1950\n\nഒരു ഓപ്പറേറ്ററുമായി ബന്ധിപ്പിക്കണമോ?'
        : '## ℹ️ More Information Needed\n\nI don\'t have a confident answer for this specific question right now.\n\n### 🔗 Please check these official sources:\n- [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in) — Voter Search\n- [voters.eci.gov.in](https://voters.eci.gov.in) — Voter Services Portal\n- [ceokerala.gov.in](https://ceokerala.gov.in) — Kerala CEO Office\n- [nvsp.in](https://www.nvsp.in) — National Voter Service Portal\n\n📞 **Helpline:** 1950 | 1800-425-1950 (Toll Free)\n\nWould you like me to connect you with a human operator?',
    confidence: 0.3,
    tokensUsed: 0,
    ...fallbackMeta,
  };
}
