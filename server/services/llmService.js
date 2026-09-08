'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Service to communicate with Google Gemini API for natural language understanding.
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

    try {
      const apiKey = process.env.LLM_API_KEY.trim();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Deterministic classification
        },
      });

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

      const systemPrompt = `You are Sanchay+ Conversational AI Assistant, a compassionate micro-savings assistant for Indian families.
Analyze the user's message and determine the user's intent, extract entities, and detect the language.

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
1. Detect the user's input language. Even for code-mixed queries like "School fees mein ₹50 daal do", identify the dominant Indian language (Hindi in this case) or English.
2. SUPPORTED INTENTS:
   - "record_deposit": User wants to save/add money to a goal (e.g., "Saved ₹100", "आज ₹50 जमा किए", "Add 50 to school fees").
   - "check_progress": User asks about current savings or progress of a goal or overall (e.g., "How is my school fees goal?", "माझा अभ्यास ध्येय कसा आहे?").
   - "check_health": User asks if they are on track or behind (e.g., "Am I on track?", "Is my goal at risk?").
   - "get_prediction": User asks how long it will take, how much daily is needed, or shortfall (e.g., "How much daily for school fees?", "When will I reach my goal?").
   - "list_goals": User asks to see all their goals (e.g., "What are my goals?", "माझे ध्येय दाखवा", "लक्ष्य दिखाओ").
   - "savings_tip": User asks for savings tips, encouragement, or financial advice (e.g., "Give me a tip", "बचत कशी वाढवू?").
   - "check_notifications": User asks if there are any updates, alerts, or reminders (e.g., "Any updates for me?", "कोणत्या सूचना आहेत का?").
   - "unknown": Unclear, gibberish, or irrelevant queries.
3. ENTITIES TO EXTRACT:
   - "amount": Parsed numeric value (e.g. 50, 100, 200). Resolve number words in Hindi/Marathi/English/regional languages. Null if not specified.
   - "goalNameGuess": The name or keyword of the goal referenced.
   - "matchedGoalId": If the goal matches one in the provided ACTIVE FAMILY GOALS, return its exact id. Look at conversation context if user says "that", "it", or "same goal".
   - "date": Date mentioned or "today".
4. CONFIDENCE: "high", "medium", or "low".
5. IMPORTANT: DO NOT invent financial numbers or make up calculations.

ACTIVE FAMILY GOALS:
${JSON.stringify(goalsContext, null, 2)}

RECENT CONVERSATION CONTEXT:
${JSON.stringify(historyContext, null, 2)}

USER APP DEFAULT LANGUAGE:
${appLanguage}

Respond ONLY with a JSON object matching this schema:
{
  "intent": "record_deposit" | "check_progress" | "check_health" | "get_prediction" | "list_goals" | "savings_tip" | "check_notifications" | "unknown",
  "entities": {
    "amount": number | null,
    "goalNameGuess": string | null,
    "matchedGoalId": string | null,
    "date": string | null
  },
  "detectedLanguage": "mr" | "hi" | "en" | "bn" | "gu" | "ta" | "te" | "kn" | "ml" | "pa",
  "confidence": "high" | "medium" | "low",
  "suggestedTone": "encouraging" | "informative" | "clarifying"
}`;

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
        confidence: parsed.confidence || 'medium',
        suggestedTone: parsed.suggestedTone || 'informative',
      };
    } catch (err) {
      // Log technical error server-side ONLY without exposing keys
      console.error('[LLMService] Gemini API call failed or timed out:', err.message);
      return null;
    }
  }
}

module.exports = new LLMService();
