'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Service to communicate with Google Gemini API for natural language understanding and responses.
 * Strictly executes server-side. Never exposes LLM_API_KEY to clients.
 */
class LLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'gemini';
  }

  /**
   * Check if Gemini API key is configured.
   * @returns {boolean}
   */
  isConfigured() {
    const key = process.env.LLM_API_KEY;
    return typeof key === 'string' && key.trim().length > 0;
  }

  /**
   * Process a conversational user message using Gemini API.
   *
   * @param {Object} params
   * @param {string} params.message - Raw user input (text or transcribed voice)
   * @param {Array<Object>} params.conversationHistory - Recent messages for context
   * @param {Array<Object>} params.familyGoals - Active family goals [{ id, name, category, targetAmount, savedAmount }]
   * @param {string} [params.appLanguage='en'] - Fallback app language
   * @returns {Promise<Object|null>} Structured NLU result or null if LLM unavailable
   */
  async analyzeMessage({ message, conversationHistory = [], familyGoals = [], appLanguage = 'en' }) {
    if (!this.isConfigured()) {
      return null;
    }

    const candidateModels = [
      'gemini-3.6-flash',
      'gemini-2.5-flash',
    ];

    const apiKey = process.env.LLM_API_KEY.trim();
    const genAI = new GoogleGenerativeAI(apiKey);

    const goalsContext = familyGoals.map(g => ({
      id: g.id,
      name: g.name,
      category: g.category,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
    }));

    const historyContext = conversationHistory.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      text: msg.text || msg.message || '',
    }));

    const systemPrompt = `You are Sanchay+ Conversational AI Assistant, an empathetic, encouraging smart micro-savings companion for Indian families.
Analyze the user's message, determine intent, extract entities, identify the exact language/dialect, and craft a natural reply in that same language.

SUPPORTED LANGUAGES:
- mr (Marathi)
- hi (Hindi)
- en (English)
- bn (Bengali)
- gu (Gujarati)
- ta (Tamil)
- te (Telugu)
- kn (Kannada)
- ml (Malayalam)
- pa (Punjabi)

CRITICAL RULES:
1. Detect user language accurately (e.g. Hindi, Marathi, English, or Code-Mixed Hinglish/Marathi-English like "School fees madhe ₹50 taka" or "School fees mein ₹50 daal do").
2. SUPPORTED INTENTS:
   - "record_deposit": User wants to save/deposit money (e.g. "Saved ₹100", "आज ₹50 जमा किए", "Add 50 to school fees").
   - "check_progress": User asks about current savings/progress of a goal or overall.
   - "check_health": User asks if they are on track or behind.
   - "get_prediction": User asks how long it will take or how much daily is needed.
   - "list_goals": User asks to see their goals.
   - "savings_tip": User asks for savings tips, encouragement, or financial advice.
   - "check_notifications": User asks if there are any updates or reminders.
   - "general_chat": Greetings, polite conversation, asking "who are you", "what can you do", "help".
   - "unknown": Truly unintelligible or unrelated queries.
3. ENTITIES TO EXTRACT:
   - "amount": Parsed numeric value (e.g. 50, 100, 200). Resolve number words in Indic languages. Null if not mentioned.
   - "goalNameGuess": Name/keyword of the referenced goal.
   - "matchedGoalId": If the goal matches one in ACTIVE FAMILY GOALS, return its exact id.
   - "date": Date mentioned or "today".
4. GENERATE NATURAL RESPONSE:
   - "naturalReplyText": A warm, encouraging, helpful reply written naturally in the DETECTED LANGUAGE (using native script e.g. Devanagari for Hindi/Marathi, or English if user wrote English).
   - "naturalReplySpeech": A clean spoken version suitable for Text-to-Speech (no emojis, asterisks, or markdown symbols).
5. DO NOT invent false balances or fake mathematical calculations.

ACTIVE FAMILY GOALS:
${JSON.stringify(goalsContext, null, 2)}

RECENT CONVERSATION CONTEXT:
${JSON.stringify(historyContext, null, 2)}

USER APP DEFAULT LANGUAGE:
${appLanguage}

Respond ONLY with a JSON object matching this schema:
{
  "intent": "record_deposit" | "check_progress" | "check_health" | "get_prediction" | "list_goals" | "savings_tip" | "check_notifications" | "general_chat" | "unknown",
  "entities": {
    "amount": number | null,
    "goalNameGuess": string | null,
    "matchedGoalId": string | null,
    "date": string | null
  },
  "detectedLanguage": "mr" | "hi" | "en" | "bn" | "gu" | "ta" | "te" | "kn" | "ml" | "pa",
  "confidence": "high" | "medium" | "low",
  "suggestedTone": "encouraging" | "informative" | "clarifying",
  "naturalReplyText": string,
  "naturalReplySpeech": string
}`;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const result = await model.generateContent([
          { text: systemPrompt },
          { text: `USER MESSAGE: "${message}"` }
        ]);

        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        return {
          intent: parsed.intent || 'unknown',
          entities: {
            amount: typeof parsed.entities?.amount === 'number' ? parsed.entities.amount : null,
            goalNameGuess: parsed.entities?.goalNameGuess || null,
            matchedGoalId: parsed.entities?.matchedGoalId || null,
            date: parsed.entities?.date || 'today',
          },
          detectedLanguage: parsed.detectedLanguage || appLanguage || 'en',
          confidence: parsed.confidence || 'high',
          suggestedTone: parsed.suggestedTone || 'encouraging',
          naturalReplyText: parsed.naturalReplyText || null,
          naturalReplySpeech: parsed.naturalReplySpeech || null,
        };
      } catch (err) {
        console.warn(`[LLMService] Model ${modelName} attempt failed: ${err.message}`);
        // Try next candidate model in list
      }
    }

    console.error('[LLMService] All Gemini candidate models failed. Falling back to Indic rule-based parser.');
    return null;
  }
}

module.exports = new LLMService();
