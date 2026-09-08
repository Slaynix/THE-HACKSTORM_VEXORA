'use strict';

const { getFirestore } = require('../config/firebase');

const NUMBER_WORDS = {
  'ten': 10, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000,
  'sau': 100, 'so': 100, 'do sau': 200, 'tin sau': 300, 'panch sau': 500,
  'hazaar': 1000, 'hazar': 1000,
  'dus': 10, 'das': 10, 'bees': 20, 'tees': 30, 'chaalis': 40, 'pachaas': 50,
  'saath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90,
  // Marathi
  'दहा': 10, 'वीस': 20, 'तीस': 30, 'चाळीस': 40, 'पन्नास': 50,
  'साठ': 60, 'सत्तर': 70, 'ऐंशी': 80, 'नव्वद': 90,
  'शंभर': 100, 'दोनशे': 200, 'तीनशे': 300, 'पाचशे': 500, 'हजार': 1000,
  // Hindi
  'दस': 10, 'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50,
  'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
  'सौ': 100, 'दो सौ': 200, 'तीन सौ': 300, 'पांच सौ': 500, 'हज़ार': 1000,
  // Bengali
  'দশ': 10, 'কুড়ি': 20, 'পঞ্চাশ': 50, 'একশ': 100, 'হাজার': 1000,
  // Gujarati
  'દસ': 10, 'વીસ': 20, 'પચાસ': 50, 'સો': 100, 'હજાર': 1000,
  // Tamil
  'பத்து': 10, 'இருபது': 20, 'ஐம்பது': 50, 'நூறு': 100, 'ஆயிரம்': 1000,
  // Telugu
  'పది': 10, 'ఇరవై': 20, 'యాభై': 50, 'వంద': 100, 'వెయ్యి': 1000,
  // Kannada
  'ಹತ್ತು': 10, 'ಇಪ್ಪತ್ತು': 20, 'ಐವತ್ತು': 50, 'ನೂರು': 100, 'ಸಾವಿರ': 1000,
  // Malayalam
  'പത്ത്': 10, 'ഇരുപത്': 20, 'അമ്പത്': 50, 'നൂറ്': 100, 'ആയിരം': 1000,
  // Punjabi
  'ਦਸ': 10, 'ਵੀਹ': 20, 'ਪੰਜਾਹ': 50, 'ਸੌ': 100, 'ਹਜ਼ਾਰ': 1000,
};

const CATEGORY_KEYWORDS = {
  education: ['school', 'fees', 'riya', 'education', 'book', 'padhai', 'shikshan', 'शाळा', 'फीस', 'शिक्षण', 'पढ़ाई', 'स्कूल', 'স্কুল', 'શાળા', 'பள்ளி', 'పాఠశాల', 'ಶಾಲೆ', 'സ്കൂൾ', 'ਸਕੂਲ'],
  phone:     ['phone', 'mobile', 'smartphone', 'samsung', 'redmi', 'फोन', 'मोबाइल', 'मोबाईल', 'ফোন', 'ફોન', 'போன்', 'ఫోన్', 'ಫೋನ್', 'ഫോൺ', 'ਫੋਨ'],
  festival:  ['diwali', 'festival', 'celebration', 'puja', 'utsav', 'त्योहार', 'दिवाली', 'दिवाळी', 'सण', 'উৎসব', 'તહેવાર', 'திருவிழா', 'పండుగ', 'ಹಬ್ಬ', 'ഉത്സവം', 'ਤਿਉਹਾਰ'],
  farming:   ['farming', 'seeds', 'kisan', 'kheti', 'fertilizer', 'khat', 'sheti', 'खेती', 'किसान', 'शेती', 'बियाणे', 'কৃষি', 'ખેતી', 'விவசாயம்', 'వ్యవసాయం', 'ಕೃಷಿ', 'കൃഷി', 'ਖੇਤੀ'],
  home:      ['home', 'house', 'repair', 'cement', 'roof', 'ghar', 'kamra', 'घर', 'दुरुस्ती', 'मकान', 'বাড়ি', 'ઘર', 'வீடு', 'ఇల్లు', 'ಮನೆ', 'വീട്', 'ਘਰ'],
  emergency: ['health', 'hospital', 'doctor', 'medicine', 'emergency', 'ilaj', 'dawa', 'दवा', 'इलाज', 'हॉस्पिटल', 'आरोग्य', 'চিকিৎসা', 'આરોગ્ય', 'மருத்துவம்', 'ఆరోగ్యం', 'ಆರೋಗ್ಯ', 'ആരോഗ്യം', 'ਸਿਹਤ'],
};

/**
 * Detect language from text using script ranges and common keywords.
 * @param {string} text
 * @param {string} [fallback='en']
 * @returns {string}
 */
function detectLanguage(text, fallback = 'en') {
  if (!text || typeof text !== 'string') return fallback;
  const str = text.trim();

  // Regional Indic scripts
  if (/[\u0980-\u09FF]/.test(str)) return 'bn'; // Bengali
  if (/[\u0A80-\u0AFF]/.test(str)) return 'gu'; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(str)) return 'pa'; // Punjabi
  if (/[\u0B80-\u0BFF]/.test(str)) return 'ta'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(str)) return 'te'; // Telugu
  if (/[\u0C80-\u0CFF]/.test(str)) return 'kn'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(str)) return 'ml'; // Malayalam

  // Devanagari script (Marathi vs Hindi)
  if (/[\u0900-\u097F]/.test(str)) {
    const marathiTokens = ['आहे', 'वाचवले', 'माझे', 'शाळा', 'ध्येय', 'पन्नास', 'शंभर', 'दोनशे', 'कसा', 'किती', 'झाले', 'करा', 'टाका', 'होय'];
    const hindiTokens = ['में', 'किए', 'किया', 'है', 'रुपए', 'स्कूल', 'पचास', 'सौ', 'हज़ार', 'दिखाओ', 'कितना', 'कैसा', 'चाहिए', 'करना', 'हाँ'];

    let mrScore = marathiTokens.filter(t => str.includes(t)).length;
    let hiScore = hindiTokens.filter(t => str.includes(t)).length;

    if (mrScore > hiScore) return 'mr';
    if (hiScore > mrScore) return 'hi';
    return fallback === 'mr' ? 'mr' : 'hi';
  }

  // Romanized Hindi / Marathi / Code-mixed patterns
  const lower = str.toLowerCase();
  const romanHindi = ['mein', 'me', 'daal', 'jama', 'rupaye', 'bhai', 'kitna', 'kaisa', 'karein', 'bachat'];
  const romanMarathi = ['ahe', 'kasa', 'kiti', 'zale', 'vachavle', 'dhyey', 'sheti'];

  if (romanMarathi.some(w => new RegExp(`\\b${w}\\b`).test(lower))) return 'mr';
  if (romanHindi.some(w => new RegExp(`\\b${w}\\b`).test(lower))) return 'hi';

  return fallback;
}

const VoiceService = {
  detectLanguage,
  NUMBER_WORDS,
  CATEGORY_KEYWORDS,

  /**
   * Parse natural-language text to extract saving amount, target goal, and intent.
   * Serves as both the legacy parser and the zero-fail offline fallback.
   *
   * @param {string} transcript
   * @param {string} familyId
   * @param {Array<Object>} [preloadedGoals=null]
   * @returns {Promise<Object>}
   */
  async parseVoiceCommand(transcript, familyId, preloadedGoals = null) {
    if (!transcript || typeof transcript !== 'string') {
      return { success: false, error: 'Empty transcript provided' };
    }

    const text = transcript.toLowerCase();
    const detectedLang = detectLanguage(transcript, 'en');

    // 1. Extract Amount
    let amount = null;

    // Direct digit matching e.g. "₹50", "50 rupees", "100 rupaye", "₹ 200"
    const digitMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|rupees|rupaye|rupay|रुपये|रु|টাকা|રૂપિયા|ரூபாய்|రూపాయలు|ರೂಪಾಯಿ|രൂപ|ਰੁਪਏ)?/i);
    if (digitMatch && digitMatch[1]) {
      const parsed = parseFloat(digitMatch[1]);
      if (parsed > 0) amount = parsed;
    }

    // Number words fallback
    if (!amount) {
      for (const [word, val] of Object.entries(NUMBER_WORDS)) {
        const regex = new RegExp(`(^|\\s)${word}($|\\s|[.,!])`, 'i');
        if (regex.test(text)) {
          amount = val;
          break;
        }
      }
    }

    // 2. Identify Category
    let detectedCategory = null;
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        detectedCategory = category;
        break;
      }
    }

    // 3. Match against user's actual active goals in family
    let familyGoals = preloadedGoals;
    if (!familyGoals) {
      const db = getFirestore();
      const snap = await db.collection('goals').where('familyId', '==', familyId).get();
      familyGoals = [];
      snap.forEach((doc) => familyGoals.push({ id: doc.id, ...doc.data() }));
    }

    let matchedGoal = null;
    let goalNameGuess = null;

    if (familyGoals && familyGoals.length > 0) {
      // First, try matching by goal name words
      for (const goal of familyGoals) {
        const goalWords = (goal.name || '').toLowerCase().split(/\s+/);
        if (goalWords.some(w => w.length > 2 && text.includes(w))) {
          matchedGoal = goal;
          goalNameGuess = goal.name;
          break;
        }
      }

      // Second, try matching by category
      if (!matchedGoal && detectedCategory) {
        matchedGoal = familyGoals.find(g => g.category === detectedCategory) || null;
        if (matchedGoal) goalNameGuess = matchedGoal.name;
      }

      // Fallback: If only 1 goal exists in family
      if (!matchedGoal && familyGoals.length === 1) {
        matchedGoal = familyGoals[0];
        goalNameGuess = matchedGoal.name;
      }
    }

    // 4. Intent Classification Heuristics for fallback
    let intent = 'unknown';
    const hasDepositAction = /(save|saved|add|deposit|put|जमा|वाचवले|टाक|डाला|डाल|बचत|saved|saving)/i.test(text);
    const hasGoalQuery = /(all goals|what are my goals|list goals|goals|ध्येय|लक्ष्य|সব লক্ষ্য|બધા લક્ષ્યો|இலக்குகள்|లక్ష్యాలు|ಗುರಿಗಳು|ലക്ഷ്യങ്ങൾ|ਟੀਚੇ)/i.test(text);
    const hasProgressQuery = /(progress|how is|kasa ahe|kaisa hai|status|कितना हुआ|कसा आहे|प्रगती|স্থিতি|પ્રગતિ|நிலை|పురోగతి|ಪ್ರಗತಿ|പുരോഗതി|ਤਰੱਕੀ)/i.test(text);
    const hasHealthQuery = /(on track|behind|at risk|health|theek hai|barobar|आरोग्य|स्वास्थ्य|ਸਿਹਤ)/i.test(text);
    const hasPredictionQuery = /(daily|how much|shortfall|when will|reach|कितने दिन|कितना रोज|रोज किती|प्रतिदिन|કેટલા દિવસ|நாட்கள்|రోజులు|ದಿನಗಳು|ദിവസങ്ങൾ|ਦਿਨ)/i.test(text);
    const hasTipQuery = /(tip|tips|advice|salah|guide|मदत|सल्ला|सुझाव|টিপস|સલાહ|உதவிக்குறிப்பு|చిట్కా|ಸಲಹೆ|സഹായം|ਸਲਾਹ)/i.test(text);
    const hasNotifQuery = /(update|alert|notification|सूचना|अपडेट|सूचनाएं|আপডেট|ચેતવણી|அறிவிப்பு|హెచ్చరిక|ಎಚ್ಚರಿಕೆ|അറിയിപ്പ്|ਸੂਚਨਾ)/i.test(text);

    if (hasPredictionQuery) {
      intent = 'get_prediction';
    } else if (hasHealthQuery) {
      intent = 'check_health';
    } else if (hasProgressQuery) {
      intent = 'check_progress';
    } else if (hasGoalQuery && !amount) {
      intent = 'list_goals';
    } else if (hasTipQuery) {
      intent = 'savings_tip';
    } else if (hasNotifQuery) {
      intent = 'check_notifications';
    } else if (amount !== null || (hasDepositAction && matchedGoal)) {
      intent = 'record_deposit';
    }

    const confidence = (amount && matchedGoal) ? 'high' : (amount || matchedGoal ? 'medium' : 'low');

    return {
      success: true,
      parsed: {
        amount: amount || 0,
        goalId: matchedGoal ? matchedGoal.id : null,
        goalName: matchedGoal ? matchedGoal.name : (detectedCategory || goalNameGuess || null),
        category: detectedCategory || (matchedGoal ? matchedGoal.category : 'other'),
        note: `Voice Save: "${transcript.trim()}"`,
        confidence: confidence === 'high' ? 0.95 : (confidence === 'medium' ? 0.75 : 0.4),
        rawTranscript: transcript.trim(),
      },
      // Enhanced Phase 6 fields
      intent,
      entities: {
        amount: amount || null,
        goalNameGuess: goalNameGuess || (matchedGoal ? matchedGoal.name : null),
        matchedGoalId: matchedGoal ? matchedGoal.id : null,
        date: 'today',
      },
      detectedLanguage: detectedLang,
      confidence,
    };
  },
};

module.exports = VoiceService;
