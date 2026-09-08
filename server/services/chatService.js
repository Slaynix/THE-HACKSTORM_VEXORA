'use strict';

const { getFirestore } = require('../config/firebase');
const GoalsService = require('./goalsService');
const DepositsService = require('./depositsService');
const PredictionService = require('./predictionService');
const NotificationService = require('./notificationService');
const LLMService = require('./llmService');
const VoiceService = require('./voiceService');

// Localized strings and templates for 10 Indian languages
const RESPONSES = {
  en: {
    confirmDeposit: (amt, goal) => `You want to add ₹${amt} to **${goal}**.`,
    confirmSpeech: (amt, goal) => `You want to add ${amt} rupees to ${goal}. Please confirm.`,
    depositRecorded: (amt, goal) => `✓ ₹${amt} added to **${goal}** successfully!`,
    depositRecordedSpeech: (amt, goal) => `${amt} rupees added to ${goal} successfully.`,
    noGoalFound: (amt) => `You want to save ₹${amt}, but which goal would you like to add it to?`,
    noGoalSpeech: (amt) => `You want to save ${amt} rupees. Which goal would you like to add it to?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nSaved: ₹${saved.toLocaleString('en-IN')} / ₹${target.toLocaleString('en-IN')}\nProgress: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} is at ${pct} percent. You have saved ${saved} rupees out of ${target} rupees.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}** status: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} is currently ${status.toLowerCase().replace('_', ' ')}. ${reason}`,
    predictionReport: (goal, reqDaily, daysLeft, aheadBehind) => `📊 **${goal}**\nDaily target required: **₹${reqDaily}/day**\nDays remaining: **${daysLeft} days**\n${aheadBehind}`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `For ${goal}, you need to save ${reqDaily} rupees daily for the remaining ${daysLeft} days.`,
    listGoalsHeader: (count) => `You have **${count} active goals**:`,
    listGoalsSpeech: (count, names) => `You have ${count} goals: ${names.join(', ')}.`,
    noGoals: "You don't have any active goals yet. Tap Create Goal to begin!",
    noGoalsSpeech: "You don't have any active goals yet. Tap Create Goal to begin.",
    tips: [
      "Consistent small daily savings of ₹20-50 can help you reach your targets faster without stress.",
      "Try adding loose coins or leftover market change to your School Fees goal daily.",
      "Celebrate small milestones! Every 25% completed brings your family closer to financial peace.",
    ],
    tipsSpeech: "Consistent small daily savings of 20 to 50 rupees can help you reach your goals faster.",
    noUpdates: "No new notifications right now. Your family savings are safe and up to date!",
    noUpdatesSpeech: "No new notifications right now. Your savings are up to date.",
    updatesHeader: (count) => `Here are your latest **${count} updates**:`,
    unknown: "I’m not sure I understood. Please try again or use **Add Saving**.",
    unknownSpeech: "I'm not sure I understood. Please try again or use Add Saving.",
  },
  mr: {
    confirmDeposit: (amt, goal) => `तुम्हाला **${goal}** मध्ये ₹${amt} जमा करायचे आहेत.`,
    confirmSpeech: (amt, goal) => `तुम्हाला ${goal} मध्ये ${amt} रुपये जमा करायचे आहेत. कृपया खात्री करा.`,
    depositRecorded: (amt, goal) => `✓ **${goal}** मध्ये ₹${amt} यशस्वीरीत्या जमा झाले!`,
    depositRecordedSpeech: (amt, goal) => `${goal} मध्ये ${amt} रुपये जमा झाले आहेत.`,
    noGoalFound: (amt) => `तुम्हाला ₹${amt} वाचवायचे आहेत, पण कोणत्या ध्येयासाठी?`,
    noGoalSpeech: (amt) => `तुम्हाला ${amt} रुपये वाचवायचे आहेत, पण कोणत्या ध्येयासाठी?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nजमा: ₹${saved.toLocaleString('en-IN')} / ₹${target.toLocaleString('en-IN')}\nप्रगती: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} चे काम ${pct} टक्के पूर्ण झाले आहे. आपण ${target} पैकी ${saved} रुपये वाचवले आहेत.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}** स्थिती: **${status === 'ON_TRACK' ? 'वेळेवर (On Track)' : status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} योग्य मार्गावर आहे. ${reason}`,
    predictionReport: (goal, reqDaily, daysLeft, aheadBehind) => `📊 **${goal}**\nरोजची बचत: **₹${reqDaily}/दिवस**\nशिल्लक दिवस: **${daysLeft} दिवस**\n${aheadBehind}`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} साठी उर्वरित ${daysLeft} दिवसात दररोज ${reqDaily} रुपये बचत करणे आवश्यक आहे.`,
    listGoalsHeader: (count) => `तुमची **${count} सक्रिय ध्येये** आहेत:`,
    listGoalsSpeech: (count, names) => `तुमची ${count} ध्येये आहेत: ${names.join(', ')}.`,
    noGoals: "सध्या कोणतेही सक्रिय ध्येय नाही. नवीन ध्येय तयार करा!",
    noGoalsSpeech: "सध्या कोणतेही सक्रिय ध्येय नाही. नवीन ध्येय तयार करा.",
    tips: [
      "दररोज ₹२० ते ₹५० ची छोटी बचत तुमच्या कुटुंबाला लवकर आर्थिक स्थैर्य देते.",
      "बाजारहाटातून शिल्लक उरलेले पैसे लगेच शाळेच्या फीसमध्ये जमा करा.",
      "प्रत्येक टप्पा महत्त्वाचा आहे! नियमित बचतीने मोठी स्वप्ने पूर्ण होतात.",
    ],
    tipsSpeech: "दररोज २० ते ५० रुपयांची छोटी बचत कुटुंबाला लवकर आर्थिक स्थैर्य देते.",
    noUpdates: "सध्या कोणतीही नवीन सूचना नाही. तुमची बचत सुरक्षित आहे!",
    noUpdatesSpeech: "कोणतीही नवीन सूचना नाही. तुमची बचत सुरक्षित आहे.",
    updatesHeader: (count) => `तुमच्यासाठी **${count} ताज्या सूचना**:`,
    unknown: "मला समजले नाही. कृपया पुन्हा सांगा किंवा **बचत जोडा** वापरा.",
    unknownSpeech: "मला समजले नाही. कृपया पुन्हा सांगा किंवा बचत जोडा वापरा.",
  },
  hi: {
    confirmDeposit: (amt, goal) => `आप **${goal}** में ₹${amt} जमा करना चाहते हैं।`,
    confirmSpeech: (amt, goal) => `आप ${goal} में ${amt} रुपये जमा करना चाहते हैं। कृपया पुष्टि करें।`,
    depositRecorded: (amt, goal) => `✓ **${goal}** में ₹${amt} सफलतापूर्वक जमा हो गए!`,
    depositRecordedSpeech: (amt, goal) => `${goal} में ${amt} रुपये सफलतापूर्वक जमा हो गए हैं।`,
    noGoalFound: (amt) => `आप ₹${amt} बचाना चाहते हैं, पर किस लक्ष्य में जोड़ना है?`,
    noGoalSpeech: (amt) => `आप ${amt} रुपये बचाना चाहते हैं, पर किस लक्ष्य में जोड़ना है?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nकुल जमा: ₹${saved.toLocaleString('en-IN')} / ₹${target.toLocaleString('en-IN')}\nप्रगति: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} में ${pct} प्रतिशत बचत पूरी हो चुकी है। कुल ${target} में से ${saved} रुपये जमा हैं।`,
    healthReport: (goal, status, reason) => `🎯 **${goal}** स्थिति: **${status === 'ON_TRACK' ? 'सही दिशा में (On Track)' : status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} का लक्ष्य सही दिशा में है। ${reason}`,
    predictionReport: (goal, reqDaily, daysLeft, aheadBehind) => `📊 **${goal}**\nदैनिक बचत जरूरत: **₹${reqDaily}/दिन**\nबचे हुए दिन: **${daysLeft} दिन**\n${aheadBehind}`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} के लिए बाकी ${daysLeft} दिनों में रोज ${reqDaily} रुपये बचाने होंगे।`,
    listGoalsHeader: (count) => `आपके **${count} सक्रिय लक्ष्य** हैं:`,
    listGoalsSpeech: (count, names) => `आपके ${count} लक्ष्य हैं: ${names.join(', ')}.`,
    noGoals: "अभी कोई सक्रिय लक्ष्य नहीं है। 'नया लक्ष्य' पर टैप करके शुरू करें!",
    noGoalsSpeech: "अभी कोई सक्रिय लक्ष्य नहीं है। नया लक्ष्य जोड़ें।",
    tips: [
      "रोज ₹20-50 की छोटी बचत आपके बड़े लक्ष्यों को बिना तनाव के पूरा करती है।",
      "बाजार से बचा हुआ छुट्टा पैसा तुरंत अपने लक्ष्य में जमा करें।",
      "निरंतरता सबसे जरूरी है। हर छोटी बचत आपके परिवार को सुरक्षित बनाती है।",
    ],
    tipsSpeech: "रोज 20 से 50 रुपये की छोटी बचत आपके बड़े लक्ष्यों को पूरा करने में मदद करती है।",
    noUpdates: "अभी कोई नई सूचना नहीं है। आपकी बचत बिल्कुल सुरक्षित है!",
    noUpdatesSpeech: "अभी कोई नई सूचना नहीं है। आपकी बचत सुरक्षित है।",
    updatesHeader: (count) => `आपकी **${count} नई सूचनाएं**:`,
    unknown: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा बोलें या **बचत जोड़ें** चुनें।",
    unknownSpeech: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा बोलें या बचत जोड़ें चुनें।",
  },
  bn: {
    confirmDeposit: (amt, goal) => `আপনি **${goal}**-এ ₹${amt} জমা করতে চান।`,
    confirmSpeech: (amt, goal) => `আপনি ${goal}-এ ${amt} টাকা জমা করতে চান। নিশ্চিত করুন।`,
    depositRecorded: (amt, goal) => `✓ **${goal}**-এ ₹${amt} সফলভাবে জমা হয়েছে!`,
    depositRecordedSpeech: (amt, goal) => `${goal}-এ ${amt} টাকা জমা হয়েছে।`,
    noGoalFound: (amt) => `আপনি ₹${amt} সঞ্চয় করতে চান, কিন্তু কোন লক্ষ্যের জন্য?`,
    noGoalSpeech: (amt) => `আপনি ${amt} টাকা সঞ্চয় করতে চান, কিন্তু কোন লক্ষ্যের জন্য?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nসঞ্চয়: ₹${saved} / ₹${target}\nঅগ্রগতি: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ${pct} শতাংশ সম্পন্ন হয়েছে।`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} ${status} অবস্থায় আছে।`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nপ্রতিদিন প্রয়োজন: **₹${reqDaily}**\nবাকি দিন: **${daysLeft} দিন**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal}-এর জন্য প্রতিদিন ${reqDaily} টাকা জমা করতে হবে।`,
    listGoalsHeader: (count) => `আপনার **${count}টি সক্রিয় লক্ষ্য** আছে:`,
    listGoalsSpeech: (count, names) => `আপনার ${count}টি লক্ষ্য আছে: ${names.join(', ')}.`,
    noGoals: "কোনো সক্রিয় লক্ষ্য নেই। নতুন লক্ষ্য তৈরি করুন!",
    noGoalsSpeech: "কোনো সক্রিয় লক্ষ্য নেই।",
    tips: ["প্রতিদিন ছোট ছোট সঞ্চয় আপনাকে বড় আর্থিক সুরক্ষা দেয়।"],
    tipsSpeech: "প্রতিদিন ছোট ছোট সঞ্চয় আপনাকে সুরক্ষা দেয়।",
    noUpdates: "কোনো নতুন আপডেট নেই।",
    noUpdatesSpeech: "কোনো নতুন আপডেট নেই।",
    updatesHeader: (count) => `আপনার **${count}টি আপডেট**:`,
    unknown: "আমি বুঝতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।",
    unknownSpeech: "আমি বুঝতে পারিনি। আবার চেষ্টা করুন।",
  },
  gu: {
    confirmDeposit: (amt, goal) => `તમે **${goal}** માં ₹${amt} ઉમેરવા માંગો છો.`,
    confirmSpeech: (amt, goal) => `તમે ${goal} માં ${amt} રૂપિયા ઉમેરવા માંગો છો. પુષ્ટિ કરો.`,
    depositRecorded: (amt, goal) => `✓ **${goal}** માં ₹${amt} સફળતાપૂર્વક જમા થયા!`,
    depositRecordedSpeech: (amt, goal) => `${goal} માં ${amt} રૂપિયા જમા થયા.`,
    noGoalFound: (amt) => `તમે ₹${amt} બચાવવા માંગો છો, પણ કયા લક્ષ્ય માટે?`,
    noGoalSpeech: (amt) => `તમે ${amt} રૂપિયા બચાવવા માંગો છો, પણ કયા લક્ષ્ય માટે?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nબચત: ₹${saved} / ₹${target}\nપ્રગતિ: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ${pct} ટકા પૂર્ણ થયું છે.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} યોગ્ય સ્થિતિમાં છે.`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nરોજની જરૂરિયાત: **₹${reqDaily}**\nબાકી દિવસો: **${daysLeft} દિવસ**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} માટે દરરોજ ${reqDaily} રૂપિયા બચાવવા પડશે.`,
    listGoalsHeader: (count) => `તમારા **${count} સક્રિય લક્ષ્યો** છે:`,
    listGoalsSpeech: (count, names) => `તમારા ${count} લક્ષ્યો છે: ${names.join(', ')}.`,
    noGoals: "હજુ સુધી કોઈ સક્રિય લક્ષ્ય નથી.",
    noGoalsSpeech: "કોઈ સક્રિય લક્ષ્ય નથી.",
    tips: ["દરરોજ નાની બચત કરવાથી મોટું લક્ષ્ય આસાનીથી સિદ્ધ થાય છે."],
    tipsSpeech: "દરરોજ નાની બચત કરવાથી લક્ષ્ય સિદ્ધ થાય છે.",
    noUpdates: "હમણાં કોઈ નવી સૂચના નથી.",
    noUpdatesSpeech: "કોઈ નવી સૂચના નથી.",
    updatesHeader: (count) => `તમારી **${count} નવી સૂચનાઓ**:`,
    unknown: "મને સમજાયું નથી. કૃપા કરીને ફરીથી પ્રયાસ કરો.",
    unknownSpeech: "મને સમજાયું નથી. ફરીથી પ્રયાસ કરો.",
  },
  ta: {
    confirmDeposit: (amt, goal) => `நீங்கள் **${goal}** இல் ₹${amt} சேர்க்க விரும்புகிறீர்கள்.`,
    confirmSpeech: (amt, goal) => `நீங்கள் ${goal} இல் ${amt} ரூபாய் சேர்க்க விரும்புகிறீர்கள். உறுதிப்படுத்தவும்.`,
    depositRecorded: (amt, goal) => `✓ **${goal}** இல் ₹${amt} வெற்றிகரமாக சேர்க்கப்பட்டது!`,
    depositRecordedSpeech: (amt, goal) => `${goal} இல் ${amt} ரூபாய் சேர்க்கப்பட்டது.`,
    noGoalFound: (amt) => `நீங்கள் ₹${amt} சேமிக்க விரும்புகிறீர்கள், ஆனால் எந்த இலக்கிற்கு?`,
    noGoalSpeech: (amt) => `நீங்கள் ${amt} ரூபாய் சேமிக்க விரும்புகிறீர்கள், எந்த இலக்கிற்கு?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nசேமிப்பு: ₹${saved} / ₹${target}\nமுன்னேற்றம்: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ${pct} சதவீதம் முடிந்தது.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} நிலை நன்றாக உள்ளது.`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nதினசரி தேவை: **₹${reqDaily}**\nமீதமுள்ள நாட்கள்: **${daysLeft} நாட்கள்**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} இலக்கிற்கு தினமும் ${reqDaily} ரூபாய் சேமிக்கவும்.`,
    listGoalsHeader: (count) => `உங்களிடம் **${count} இலக்குகள்** உள்ளன:`,
    listGoalsSpeech: (count, names) => `உங்களிடம் ${count} இலக்குகள் உள்ளன: ${names.join(', ')}.`,
    noGoals: "செயலில் உள்ள இலக்குகள் எதுவும் இல்லை.",
    noGoalsSpeech: "இலக்குகள் எதுவும் இல்லை.",
    tips: ["தினசரி சிறு சேமிப்பு குடும்பத்தின் எதிர்காலத்திற்கு நல்லது."],
    tipsSpeech: "தினசரி சிறு சேமிப்பு நல்லது.",
    noUpdates: "புதிய அறிவிப்புகள் எதுவும் இல்லை.",
    noUpdatesSpeech: "புதிய அறிவிப்புகள் இல்லை.",
    updatesHeader: (count) => `உங்களுக்கு **${count} புதிய அறிவிப்புகள்**:`,
    unknown: "எனக்கு புரியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
    unknownSpeech: "எனக்கு புரியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  },
  te: {
    confirmDeposit: (amt, goal) => `మీరు **${goal}** లో ₹${amt} జోడించాలనుకుంటున్నారు.`,
    confirmSpeech: (amt, goal) => `మీరు ${goal} లో ${amt} రూపాయలు జమ చేయాలనుకుంటున్నారు. ధృవీకరించండి.`,
    depositRecorded: (amt, goal) => `✓ **${goal}** లో ₹${amt} విజయవంతంగా జమ చేయబడింది!`,
    depositRecordedSpeech: (amt, goal) => `${goal} లో ${amt} రూపాయలు జమ అయ్యాయి.`,
    noGoalFound: (amt) => `మీరు ₹${amt} ఆదా చేయాలనుకుంటున్నారు, కానీ ఏ లక్ష్యానికి?`,
    noGoalSpeech: (amt) => `మీరు ${amt} రూపాయలు ఆదా చేయాలనుకుంటున్నారు, ఏ లక్ష్యానికి?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nఆదా: ₹${saved} / ₹${target}\nపురోగతి: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ${pct} శాతం పూర్తయింది.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} పురోగతి బాగుంది.`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nరోజువారీ అవసరం: **₹${reqDaily}**\nమిగిలిన రోజులు: **${daysLeft} రోజులు**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} కోసం రోజుకు ${reqDaily} రూపాయలు ఆదా చేయాలి.`,
    listGoalsHeader: (count) => `మీకు **${count} క్రియాశీల లక్ష్యాలు** ఉన్నాయి:`,
    listGoalsSpeech: (count, names) => `మీకు ${count} లక్ష్యాలు ఉన్నాయి: ${names.join(', ')}.`,
    noGoals: "ప్రస్తుతం ఏ లక్ష్యాలూ లేవు.",
    noGoalsSpeech: "ఏ లక్ష్యాలూ లేవు.",
    tips: ["రోజూ కొద్దికొద్దిగా ఆదా చేయడం మీ కుటుంబానికి ఎంతో మేలు చేస్తుంది."],
    tipsSpeech: "రోజూ కొద్దికొద్దిగా ఆదా చేయడం మంచిది.",
    noUpdates: "ప్రస్తుతం కొత్త హెచ్చరికలు లేవు.",
    noUpdatesSpeech: "కొత్త హెచ్చరికలు లేవు.",
    updatesHeader: (count) => `మీ తాజా **${count} అప్‌డేట్‌లు**:`,
    unknown: "నాకు అర్థం కాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    unknownSpeech: "నాకు అర్థం కాలేదు. మళ్ళీ ప్రయత్నించండి.",
  },
  kn: {
    confirmDeposit: (amt, goal) => `ನೀವು **${goal}** ಗುರಿಗೆ ₹${amt} ಸೇರಿಸಲು ಬಯಸುತ್ತೀರಿ.`,
    confirmSpeech: (amt, goal) => `ನೀವು ${goal} ಗುರಿಗೆ ${amt} ರೂಪಾಯಿ ಜಮೆ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ. ದೃಢೀಕರಿಸಿ.`,
    depositRecorded: (amt, goal) => `✓ **${goal}** ನಲ್ಲಿ ₹${amt} ಯಶಸ್ವಿಯಾಗಿ ಜಮೆಯಾಗಿದೆ!`,
    depositRecordedSpeech: (amt, goal) => `${goal} ನಲ್ಲಿ ${amt} ರೂಪಾಯಿ ಜಮೆಯಾಗಿದೆ.`,
    noGoalFound: (amt) => `ನೀವು ₹${amt} ಉಳಿಸಲು ಬಯಸುತ್ತೀರಿ, ಆದರೆ ಯಾವ ಗುರಿಗೆ?`,
    noGoalSpeech: (amt) => `ನೀವು ${amt} ರೂಪಾಯಿ ಉಳಿಸಲು ಬಯಸುತ್ತೀರಿ, ಯಾವ ಗುರಿಗೆ?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nಉಳಿತಾಯ: ₹${saved} / ₹${target}\nಪ್ರಗತಿ: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ${pct} ಪ್ರತಿಶತ ಪೂರ್ಣಗೊಂಡಿದೆ.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} ಸ್ಥಿತಿ ಉತ್ತಮವಾಗಿದೆ.`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nದೈನಂದಿನ ಗುರಿ: **₹${reqDaily}**\nಉಳಿದ ದಿನಗಳು: **${daysLeft} ದಿನಗಳು**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} ಗಾಗಿ ದಿನಕ್ಕೆ ${reqDaily} ರೂಪಾಯಿ ಉಳಿತಾಯ ಮಾಡಿ.`,
    listGoalsHeader: (count) => `ನಿಮ್ಮಲ್ಲಿ **${count} ಸಕ್ರಿಯ ಗುರಿಗಳಿವೆ**:`,
    listGoalsSpeech: (count, names) => `ನಿಮ್ಮಲ್ಲಿ ${count} ಗುರಿಗಳಿವೆ: ${names.join(', ')}.`,
    noGoals: "ಯಾವುದೇ ಸಕ್ರಿಯ ಗುರಿಗಳಿಲ್ಲ.",
    noGoalsSpeech: "ಯಾವುದೇ ಗುರಿಗಳಿಲ್ಲ.",
    tips: ["ಪ್ರತಿದಿನ ಸಣ್ಣ ಮೊತ್ತದ ಉಳಿತಾಯ ದೊಡ್ಡ ಗುರಿಯನ್ನು ತಲುಪಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ."],
    tipsSpeech: "ಪ್ರತಿದಿನ ಸಣ್ಣ ಮೊತ್ತದ ಉಳಿತಾಯ ಮಾಡಿ.",
    noUpdates: "ಯಾವುದೇ ಹೊಸ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.",
    noUpdatesSpeech: "ಯಾವುದೇ ಹೊಸ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.",
    updatesHeader: (count) => `ನಿಮ್ಮ **${count} ನವೀಕರಣಗಳು**:`,
    unknown: "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    unknownSpeech: "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  ml: {
    confirmDeposit: (amt, goal) => `നിങ്ങൾ **${goal}** ലേക്ക് ₹${amt} ചേർക്കാൻ ആഗ്രഹിക്കുന്നു.`,
    confirmSpeech: (amt, goal) => `നിങ്ങൾ ${goal} ലേക്ക് ${amt} രൂപ ചേർക്കാൻ ആഗ്രഹിക്കുന്നു. ദയവായി സ്ഥിരീകരിക്കുക.`,
    depositRecorded: (amt, goal) => `✓ **${goal}** ലേക്ക് ₹${amt} വിജയകരമായി ചേർത്തു!`,
    depositRecordedSpeech: (amt, goal) => `${goal} ലേക്ക് ${amt} രൂപ ചേർത്തു.`,
    noGoalFound: (amt) => `നിങ്ങൾ ₹${amt} ലാഭിക്കാൻ ആഗ്രഹിക്കുന്നു, എന്നാൽ ഏത് ലക്ഷ്യത്തിലേക്ക്?`,
    noGoalSpeech: (amt) => `നിങ്ങൾ ${amt} രൂപ ലാഭിക്കാൻ ആഗ്രഹിക്കുന്നു, ഏത് ലക്ഷ്യത്തിലേക്ക്?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nസമ്പാദ്യം: ₹${saved} / ₹${target}\nപുരോഗതി: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ${pct} ശതമാനം പൂർത്തിയായി.`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} മികച്ച രീതിയിൽ പുരോഗമിക്കുന്നു.`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nദിവസേന ആവശ്യം: **₹${reqDaily}**\nശേഷിക്കുന്ന ദിവസങ്ങൾ: **${daysLeft} ദിവസങ്ങൾ**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} നായി ദിവസവും ${reqDaily} രൂപ സമ്പാദിക്കുക.`,
    listGoalsHeader: (count) => `നിങ്ങൾക്ക് **${count} ലക്ഷ്യങ്ങളുണ്ട്**:`,
    listGoalsSpeech: (count, names) => `നിങ്ങൾക്ക് ${count} ലക്ഷ്യങ്ങളുണ്ട്: ${names.join(', ')}.`,
    noGoals: "സജീവമായ ലക്ഷ്യങ്ങൾ ഒന്നുമില്ല.",
    noGoalsSpeech: "ലക്ഷ്യങ്ങൾ ഒന്നുമില്ല.",
    tips: ["ദിവസേനയുള്ള ചെറിയ സമ്പാദ്യം കുടുംബത്തിന്റെ ഭാവി സുരക്ഷിതമാക്കുന്നു."],
    tipsSpeech: "ചെറിയ സമ്പാദ്യം കുടുംബത്തെ സഹായിക്കുന്നു.",
    noUpdates: "പുതിയ അറിയിപ്പുകളൊന്നുമില്ല.",
    noUpdatesSpeech: "പുതിയ അറിയിപ്പുകളൊന്നുമില്ല.",
    updatesHeader: (count) => `നിങ്ങളുടെ **${count} പുതിയ അറിയിപ്പുകൾ**:`,
    unknown: "എനിക്ക് മനസ്സിലായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
    unknownSpeech: "എനിക്ക് മനസ്സിലായില്ല. വീണ്ടും ശ്രമിക്കുക.",
  },
  pa: {
    confirmDeposit: (amt, goal) => `ਤੁਸੀਂ **${goal}** ਵਿੱਚ ₹${amt} ਜਮ੍ਹਾ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ।`,
    confirmSpeech: (amt, goal) => `ਤੁਸੀਂ ${goal} ਵਿੱਚ ${amt} ਰੁਪਏ ਜਮ੍ਹਾ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ। ਪੁਸ਼ਟੀ ਕਰੋ।`,
    depositRecorded: (amt, goal) => `✓ **${goal}** ਵਿੱਚ ₹${amt} ਸਫਲਤਾਪੂਰਵਕ ਜਮ੍ਹਾ ਹੋ ਗਏ!`,
    depositRecordedSpeech: (amt, goal) => `${goal} ਵਿੱਚ ${amt} ਰੁਪਏ ਜਮ੍ਹਾ ਹੋ ਗਏ ਹਨ।`,
    noGoalFound: (amt) => `ਤੁਸੀਂ ₹${amt} ਬਚਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ, ਪਰ ਕਿਹੜੇ ਟੀਚੇ ਲਈ?`,
    noGoalSpeech: (amt) => `ਤੁਸੀਂ ${amt} ਰੁਪਏ ਬਚਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ, ਪਰ ਕਿਹੜੇ ਟੀਚੇ ਲਈ?`,
    progressReport: (goal, saved, target, pct) => `🎓 **${goal}**\nਕੁੱਲ ਜਮ੍ਹਾ: ₹${saved} / ₹${target}\nਤਰੱਕੀ: **${pct}%**`,
    progressSpeech: (goal, saved, target, pct) => `${goal} ਵਿੱਚ ${pct} ਫੀਸਦੀ ਬਚਤ ਪੂਰੀ ਹੋ ਗਈ ਹੈ।`,
    healthReport: (goal, status, reason) => `🎯 **${goal}**: **${status}**\n💡 ${reason}`,
    healthSpeech: (goal, status, reason) => `${goal} ਦਾ ਟੀਚਾ ਸਹੀ ਚੱਲ ਰਿਹਾ ਹੈ।`,
    predictionReport: (goal, reqDaily, daysLeft) => `📊 **${goal}**\nਰੋਜ਼ਾਨਾ ਲੋੜ: **₹${reqDaily}**\nਬਾਕੀ ਦਿਨ: **${daysLeft} ਦਿਨ**`,
    predictionSpeech: (goal, reqDaily, daysLeft) => `${goal} ਲਈ ਰੋਜ਼ਾਨਾ ${reqDaily} ਰੁਪਏ ਬਚਾਉਣ ਦੀ ਲੋੜ ਹੈ।`,
    listGoalsHeader: (count) => `ਤੁਹਾਡੇ **${count} ਸਰਗਰਮ ਟੀਚੇ** ਹਨ:`,
    listGoalsSpeech: (count, names) => `ਤੁਹਾਡੇ ${count} ਟੀਚੇ ਹਨ: ${names.join(', ')}.`,
    noGoals: "ਕੋਈ ਸਰਗਰਮ ਟੀਚਾ ਨਹੀਂ ਹੈ।",
    noGoalsSpeech: "ਕੋਈ ਸਰਗਰਮ ਟੀਚਾ ਨਹੀਂ ਹੈ।",
    tips: ["ਰੋਜ਼ਾਨਾ ਛੋਟੀ ਬਚਤ ਵੱਡੇ ਸੁਪਨੇ ਪੂਰੇ ਕਰਦੀ ਹੈ।"],
    tipsSpeech: "ਰੋਜ਼ਾਨਾ ਛੋਟੀ ਬਚਤ ਕਰੋ।",
    noUpdates: "ਕੋਈ ਨਵਾਂ ਸੁਨੇਹਾ ਨਹੀਂ ਹੈ।",
    noUpdatesSpeech: "ਕੋਈ ਨਵਾਂ ਸੁਨੇਹਾ ਨਹੀਂ ਹੈ।",
    updatesHeader: (count) => `ਤੁਹਾਡੇ **${count} ਨਵੇਂ ਸੁਨੇਹੇ**:`,
    unknown: "ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    unknownSpeech: "ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  },
};

class ChatService {
  /**
   * Helper to get response templates for a specific language with English fallback.
   */
  getLangTemplates(lang) {
    return RESPONSES[lang] || RESPONSES.en;
  }

  /**
   * Clean string for speech synthesis by removing Markdown, HTML, and emoji.
   */
  cleanForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/₹/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[✓💡🎯🎓📊]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Main orchestrator for conversational user messages.
   *
   * @param {Object} params
   * @param {string} params.message
   * @param {string} params.inputMode - 'text' | 'voice'
   * @param {string} params.conversationId
   * @param {string} params.familyId
   * @param {string} params.memberId
   * @param {string} params.memberName
   * @param {string} [params.appLanguage='en']
   * @returns {Promise<Object>} Formatted chat response payload
   */
  async processMessage({ message, inputMode = 'text', conversationId, familyId, memberId, memberName = 'Member', appLanguage = 'en' }) {
    const db = getFirestore();

    // 1. Fetch real active goals from backend service
    const goals = await GoalsService.listByFamily(familyId);

    // 2. Fetch last ~6 messages from Firestore chatMessages collection for conversational context
    const recentMessages = [];
    try {
      const snap = await db.collection('chatMessages')
        .where('conversationId', '==', conversationId)
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get();

      snap.forEach(doc => recentMessages.push(doc.data()));
      recentMessages.reverse();
    } catch (err) {
      // In-memory or emulator without index fallback
    }

    // 3. Natural language understanding via Gemini API (with fallback parser)
    let nluResult = null;
    if (LLMService.isConfigured()) {
      nluResult = await LLMService.analyzeMessage({
        message,
        conversationHistory: recentMessages,
        familyGoals: goals,
        appLanguage,
      });
    }

    // Fallback if LLM is not configured, times out, or errors
    if (!nluResult) {
      const fallbackResult = await VoiceService.parseVoiceCommand(message, familyId, goals);
      nluResult = {
        intent: fallbackResult.intent || 'unknown',
        entities: fallbackResult.entities || { amount: null, goalNameGuess: null, matchedGoalId: null, date: 'today' },
        detectedLanguage: fallbackResult.detectedLanguage || VoiceService.detectLanguage(message, appLanguage),
        confidence: fallbackResult.confidence || 'medium',
      };
    }

    const lang = nluResult.detectedLanguage || appLanguage || 'en';
    const t = this.getLangTemplates(lang);

    let replyText = '';
    let replySpeech = '';
    let requiresConfirmation = false;
    let uiCard = null;
    const finalEntities = { ...nluResult.entities };

    // Resolve matchedGoal if goalNameGuess or matchedGoalId is provided
    let targetGoal = null;
    if (finalEntities.matchedGoalId) {
      targetGoal = goals.find(g => g.id === finalEntities.matchedGoalId) || null;
    }
    if (!targetGoal && finalEntities.goalNameGuess) {
      const guess = finalEntities.goalNameGuess.toLowerCase();
      targetGoal = goals.find(g => (g.name || '').toLowerCase().includes(guess)) || null;
    }
    // Contextual fallback: if user says "that", "it" and previous message referenced a goal
    if (!targetGoal && recentMessages.length > 0) {
      const lastAssistantMsg = [...recentMessages].reverse().find(m => m.role === 'assistant' && m.goalId);
      if (lastAssistantMsg && lastAssistantMsg.goalId) {
        targetGoal = goals.find(g => g.id === lastAssistantMsg.goalId) || null;
      }
    }
    // If user has exactly one active goal, match it
    if (!targetGoal && goals.length === 1) {
      targetGoal = goals[0];
    }
    if (targetGoal) {
      finalEntities.matchedGoalId = targetGoal.id;
      finalEntities.goalNameGuess = targetGoal.name;
    }

    // 4. Route intent to existing Sanchay+ business services (NO HALLUCINATED NUMBERS)
    switch (nluResult.intent) {
      case 'record_deposit': {
        const amount = finalEntities.amount;
        if (!amount || amount <= 0) {
          replyText = t.unknown;
          replySpeech = t.unknownSpeech;
          nluResult.intent = 'unknown';
        } else if (!targetGoal) {
          replyText = t.noGoalFound(amount);
          replySpeech = t.noGoalSpeech(amount);
          requiresConfirmation = false;
          uiCard = {
            type: 'goal_picker',
            data: {
              amount,
              goals: goals.map(g => ({ id: g.id, name: g.name, category: g.category })),
            },
          };
        } else {
          // Mandatory two-step confirmation
          requiresConfirmation = true;
          replyText = t.confirmDeposit(amount, targetGoal.name);
          replySpeech = t.confirmSpeech(amount, targetGoal.name);
          uiCard = {
            type: 'deposit_confirm',
            data: {
              amount,
              goalId: targetGoal.id,
              goalName: targetGoal.name,
              category: targetGoal.category,
              currentSaved: targetGoal.savedAmount || 0,
              targetAmount: targetGoal.targetAmount || 0,
            },
          };
        }
        break;
      }

      case 'check_progress': {
        const goalToInspect = targetGoal || goals[0];
        if (!goalToInspect) {
          replyText = t.noGoals;
          replySpeech = t.noGoalsSpeech;
        } else {
          const progress = await PredictionService.getProgress(goalToInspect.id, familyId);
          const pct = (progress && progress.percentage !== undefined) ? progress.percentage : (progress?.progressPercent || 0);
          const savedAmt = progress?.savedAmount || goalToInspect.savedAmount || 0;
          const tgtAmt = progress?.targetAmount || goalToInspect.targetAmount || 0;
          replyText = t.progressReport(goalToInspect.name, savedAmt, tgtAmt, pct);
          replySpeech = t.progressSpeech(goalToInspect.name, savedAmt, tgtAmt, pct);
          uiCard = {
            type: 'goal_progress',
            data: {
              goalId: goalToInspect.id,
              goalName: goalToInspect.name,
              category: goalToInspect.category,
              savedAmount: savedAmt,
              targetAmount: tgtAmt,
              progressPercent: pct,
              status: progress?.isCompleted ? 'COMPLETED' : 'ON_TRACK',
            },
          };
        }
        break;
      }

      case 'check_health': {
        const goalToInspect = targetGoal || goals[0];
        if (!goalToInspect) {
          replyText = t.noGoals;
          replySpeech = t.noGoalsSpeech;
        } else {
          const health = await PredictionService.getHealth(goalToInspect.id, familyId);
          const status = health.status || 'ON_TRACK';
          replyText = t.healthReport(goalToInspect.name, status, health.reason);
          replySpeech = t.healthSpeech(goalToInspect.name, status, health.reason);
          uiCard = {
            type: 'goal_health',
            data: {
              goalId: goalToInspect.id,
              goalName: goalToInspect.name,
              health: status,
              reason: health.reason,
              daysRemaining: health.daysRemaining,
              requiredDailySaving: health.requiredDailySaving,
            },
          };
        }
        break;
      }

      case 'get_prediction': {
        const goalToInspect = targetGoal || goals[0];
        if (!goalToInspect) {
          replyText = t.noGoals;
          replySpeech = t.noGoalsSpeech;
        } else {
          const prediction = await PredictionService.getPrediction(goalToInspect.id, familyId);
          const health = await PredictionService.getHealth(goalToInspect.id, familyId);
          const daysLeft = health.daysRemaining || 0;
          const daysAhead = typeof prediction.daysAheadOrBehind === 'number' ? prediction.daysAheadOrBehind : 0;
          const aheadBehind = daysAhead >= 0
            ? `🟢 Ahead of schedule by ${daysAhead} days!`
            : `🟡 Behind by ${Math.abs(daysAhead)} days.`;

          replyText = t.predictionReport(goalToInspect.name, prediction.requiredDailySaving, daysLeft, aheadBehind);
          replySpeech = t.predictionSpeech(goalToInspect.name, prediction.requiredDailySaving, daysLeft);
          uiCard = {
            type: 'goal_prediction',
            data: {
              goalId: goalToInspect.id,
              goalName: goalToInspect.name,
              currentDailySavingRate: prediction.currentSavingRate,
              requiredDailySaving: prediction.requiredDailySaving,
              daysRemaining: daysLeft,
              daysAheadBehind: daysAhead,
              estimatedCompletionDate: prediction.projectedCompletionDate,
            },
          };
        }
        break;
      }

      case 'list_goals': {
        if (goals.length === 0) {
          replyText = t.noGoals;
          replySpeech = t.noGoalsSpeech;
        } else {
          const lines = goals.map(g => `• **${g.name}**: ₹${(g.savedAmount || 0).toLocaleString('en-IN')} / ₹${(g.targetAmount || 0).toLocaleString('en-IN')} (${g.progressPercent || Math.round(((g.savedAmount || 0) / (g.targetAmount || 1)) * 100)}%)`);
          replyText = `${t.listGoalsHeader(goals.length)}\n${lines.join('\n')}`;
          replySpeech = t.listGoalsSpeech(goals.length, goals.map(g => g.name));
          uiCard = {
            type: 'goals_list',
            data: {
              goals: goals.map(g => ({
                id: g.id,
                name: g.name,
                category: g.category,
                savedAmount: g.savedAmount || 0,
                targetAmount: g.targetAmount || 0,
                progressPercent: g.progressPercent || 0,
                status: g.status || 'ON_TRACK',
              })),
            },
          };
        }
        break;
      }

      case 'savings_tip': {
        const tipIndex = Math.floor(Math.random() * t.tips.length);
        replyText = `💡 **Sanchay+ Saving Tip**\n${t.tips[tipIndex]}`;
        replySpeech = t.tipsSpeech;
        uiCard = {
          type: 'tip_card',
          data: { tip: t.tips[tipIndex] },
        };
        break;
      }

      case 'check_notifications': {
        const notifs = await NotificationService.listByFamily(familyId);
        if (notifs.length === 0) {
          replyText = t.noUpdates;
          replySpeech = t.noUpdatesSpeech;
        } else {
          const recentNotifs = notifs.slice(0, 3);
          const lines = recentNotifs.map(n => `• **${n.title}**: ${n.message}`);
          replyText = `${t.updatesHeader(recentNotifs.length)}\n${lines.join('\n')}`;
          replySpeech = `You have ${recentNotifs.length} updates. ${recentNotifs[0].title}: ${recentNotifs[0].message}`;
          uiCard = {
            type: 'notifications_list',
            data: { notifications: recentNotifs },
          };
        }
        break;
      }

      case 'general_chat': {
        replyText = nluResult.naturalReplyText || "Hello! I am your Sanchay+ savings assistant. How can I help you today?";
        replySpeech = nluResult.naturalReplySpeech || replyText;
        uiCard = {
          type: 'help_options',
          data: {
            suggestions: [
              'Save ₹50 to School Fees',
              'How is my goal progress?',
              'Am I on track?',
              'What are my goals?',
            ],
          },
        };
        break;
      }

      default: {
        if (nluResult.naturalReplyText && nluResult.naturalReplyText.length > 5) {
          replyText = nluResult.naturalReplyText;
          replySpeech = nluResult.naturalReplySpeech || replyText;
        } else {
          replyText = t.unknown;
          replySpeech = t.unknownSpeech;
        }
        uiCard = {
          type: 'help_options',
          data: {
            suggestions: [
              'Save ₹50 to School Fees',
              'How is my goal progress?',
              'Am I on track?',
              'What are my goals?',
            ],
          },
        };
        break;
      }
    }

    // 5. Store conversation entry in Firestore `chatMessages`
    const now = new Date().toISOString();
    try {
      // User message
      await db.collection('chatMessages').add({
        conversationId,
        familyId,
        memberId,
        role: 'user',
        text: message,
        language: lang,
        intent: nluResult.intent,
        confirmed: false,
        createdAt: now,
      });

      // Assistant message
      await db.collection('chatMessages').add({
        conversationId,
        familyId,
        memberId,
        role: 'assistant',
        text: replyText,
        language: lang,
        intent: nluResult.intent,
        goalId: targetGoal ? targetGoal.id : null,
        confirmed: !requiresConfirmation,
        createdAt: new Date(Date.now() + 10).toISOString(),
      });
    } catch (err) {
      console.warn('[ChatService] Could not write to chatMessages collection:', err.message);
    }

    return {
      replyText,
      replySpeech: this.cleanForSpeech(replySpeech),
      detectedLanguage: lang,
      intent: nluResult.intent,
      entities: finalEntities,
      requiresConfirmation,
      confidence: nluResult.confidence,
      uiCard,
    };
  }

  /**
   * Confirm and execute a deposit from the assistant interface.
   *
   * @param {Object} params
   * @param {string} params.goalId
   * @param {number} params.amount
   * @param {string} params.familyId
   * @param {string} params.memberId
   * @param {string} params.memberName
   * @param {string} params.clientTxnId
   * @param {string} [params.appLanguage='en']
   * @returns {Promise<Object>}
   */
  async confirmDeposit({ goalId, amount, familyId, memberId, memberName = 'Member', clientTxnId, appLanguage = 'en' }) {
    if (!goalId || !amount || amount <= 0) {
      throw new Error('Invalid deposit confirmation parameters');
    }

    const result = await DepositsService.add(goalId, familyId, memberId, memberName, {
      amount,
      note: 'Added via Sanchay+ AI Assistant',
      clientTxnId: clientTxnId || `chat-tx-${Date.now()}`,
    });

    const goal = await GoalsService.getById(goalId, familyId);
    const t = this.getLangTemplates(appLanguage);

    return {
      success: true,
      deposit: result.deposit,
      milestonesCrossed: result.milestonesCrossed,
      streak: result.streak,
      goal,
      replyText: t.depositRecorded(amount, goal ? goal.name : 'Goal'),
      replySpeech: this.cleanForSpeech(t.depositRecordedSpeech(amount, goal ? goal.name : 'Goal')),
    };
  }
}

module.exports = new ChatService();
