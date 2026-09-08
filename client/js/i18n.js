/**
 * i18n.js — Internationalisation and formatting utilities (client-side).
 *
 * Conventions:
 *   - Currency : ₹ with Indian digit grouping (₹1,00,000)
 *   - Timezone : Asia/Kolkata for every date calculation
 *   - Locales  : English ('en'), Hindi ('hi'), Marathi ('mr')
 *
 * All user-facing strings are keyed here with 100% parity across languages.
 */

const LOCALE   = 'en-IN';
const TIMEZONE = 'Asia/Kolkata';

// ── Currency ──────────────────────────────────────────────────────────────────

/**
 * Formats a number as Indian Rupees.
 * e.g. formatINR(100000) → "₹1,00,000"
 */
export function formatINR(amount) {
  return new Intl.NumberFormat(LOCALE, {
    style:                 'currency',
    currency:              'INR',
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable date string in IST.  e.g. "8 Sep 2026"
 */
export function formatDate(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day:      'numeric',
      month:    'short',
      year:     'numeric',
      timeZone: TIMEZONE,
    }).format(new Date(date));
  } catch (_) {
    return String(date);
  }
}

/**
 * Returns number of days remaining until a deadline (IST).
 */
export function daysUntil(deadline) {
  if (!deadline) return 0;
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  const diffMs = new Date(deadline) - nowIST;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns time-of-day key: 'morning' | 'afternoon' | 'evening'
 */
export function getTimeOfDay() {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE })).getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ── String translations ───────────────────────────────────────────────────────

export const strings = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  ENGLISH
  // ═══════════════════════════════════════════════════════════════════════════
  en: {
    // ── Landing ────────────────────────────────────────────────────────────
    'landing.appName':        'Sanchay+',
    'landing.tagline':        'Small savings. Big goals.',
    'landing.startSaving':    'Start Saving',
    'landing.login':          'I already have an account',
    'landing.chooseLanguage': 'Choose your language',
    'landing.langEn':         'English',
    'landing.langHi':         'हिंदी',
    'landing.langMr':         'मराठी',

    // ── Onboarding ─────────────────────────────────────────────────────────
    'onboarding.title':         'Let\'s set up your account',
    'onboarding.familyName':    'Family Name',
    'onboarding.familyPlaceholder': 'e.g. Patil',
    'onboarding.memberName':    'Your Name',
    'onboarding.memberPlaceholder': 'e.g. Arun',
    'onboarding.preferredLang': 'Preferred Language',
    'onboarding.next':          'Next',
    'onboarding.back':          'Back',
    'onboarding.getStarted':    'Get Started →',
    'onboarding.step':          'Step {current} of {total}',

    // ── Dashboard ──────────────────────────────────────────────────────────
    'dashboard.greetMorning':    'Good morning, {name}! ☀️',
    'dashboard.greetAfternoon':  'Good afternoon, {name}!',
    'dashboard.greetEvening':    'Good evening, {name}! 🌙',
    'dashboard.familySuffix':    '{name} Family',
    'dashboard.heroTitle':       'Today\'s Saving Target',
    'dashboard.heroSubtitle':    'Save a small amount today to stay on track',
    'dashboard.heroAddBtn':      'Add Today\'s Saving',
    'dashboard.streakEncourage': '🔥 {count}-day streak! Every small saving adds up.',
    'dashboard.streakGentle':    'Save when you can. Consistency grows with care.',
    'dashboard.activeGoalTitle': 'Primary Goal Spotlight',
    'dashboard.remainingMeta':   '{days} days remaining · {rate}/day required',
    'dashboard.totalSavings':    'Total Savings',
    'dashboard.activeGoals':     'Active Goals',
    'dashboard.todaysTarget':    'Today\'s Target',
    'dashboard.savingStreak':    'Saving Streak',
    'dashboard.streakDays':      '{count} days',
    'dashboard.quickActions':    'Quick Actions',
    'dashboard.voiceSave':       'Voice Save',
    'dashboard.addSavings':      'Add Savings',
    'dashboard.newGoal':         'Create Goal',
    'dashboard.recentSavings':   'Recent Savings',
    'dashboard.activeGoalsTitle':'Your Goals',
    'dashboard.viewAll':         'View All',

    // ── Goals ──────────────────────────────────────────────────────────────
    'goals.title':             'My Goals',
    'goals.createButton':      '+ New Goal',
    'goals.saved':             '{amount} saved',
    'goals.target':            'Goal: {amount}',
    'goals.daysLeft':          '{count} days left',
    'goals.overdue':           '{count} days overdue',
    'goals.dueToday':          'Due today',
    'goals.requiredDaily':     '₹{amount}/day needed',
    'goals.completed':         'Completed! 🎉',

    // ── Create Goal ────────────────────────────────────────────────────────
    'createGoal.title':        'Create a Goal',
    'createGoal.pickCategory': 'What are you saving for?',
    'createGoal.goalName':     'Goal Name',
    'createGoal.namePlaceholder': 'e.g. Farming Equipment',
    'createGoal.targetAmount': 'Target Amount (₹)',
    'createGoal.amountPlaceholder': 'e.g. 20,000',
    'createGoal.deadline':     'Target Date',
    'createGoal.deadlineHint': 'Must be a future date',
    'createGoal.deadlineError':'Please pick a date in the future',
    'createGoal.create':       'Create Goal',
    'createGoal.catEducation': 'Education',
    'createGoal.catPhone':     'Phone',
    'createGoal.catFestival':  'Festival',
    'createGoal.catFarming':   'Farming',
    'createGoal.catHome':      'Home',
    'createGoal.catEmergency': 'Emergency',
    'createGoal.catOther':     'Other',

    // ── Goal Details ───────────────────────────────────────────────────────
    'goalDetails.target':          'Target Amount',
    'goalDetails.saved':           'Total Saved',
    'goalDetails.remaining':       'Remaining',
    'goalDetails.daysLeft':        'Days Left',
    'goalDetails.requiredDaily':   'Required Daily',
    'goalDetails.currentRate':     'Current Rate',
    'goalDetails.targetDate':      'Target Completion Date',
    'goalDetails.predictedDate':   'Predicted Completion',
    'goalDetails.healthReason':    'You\'re saving {current}/day, you need {required}/day',
    'goalDetails.recentDeposits':  'Recent Deposits',
    'goalDetails.milestones':      'Milestones',
    'goalDetails.addSaving':       '+ Add Saving to this Goal',
    'goalDetails.noDeposits':      'No deposits yet. Start saving today!',

    // ── Prediction Card ────────────────────────────────────────────────────
    'prediction.title':              'Savings Prediction',
    'prediction.rateComparison':     'Current rate: {current}/day · Required: {required}/day',
    'prediction.statusOnTrack':      'At your current pace, you will reach your goal {days} days ahead of deadline!',
    'prediction.statusBehind':       'At your current rate, you will reach your goal in {projectedDays} days (Deadline: {deadlineDays} days).',
    'prediction.recoverySuggestion': 'Save ₹{amount} more per day to get back on track.',
    'prediction.completed':          'Goal target achieved! Congratulations! 🏆',

    // ── Voice UI ───────────────────────────────────────────────────────────
    'voice.title':             'Voice Micro-Save',
    'voice.listening':         'Listening…',
    'voice.instruction':       'Speak your saving amount and goal name',
    'voice.example':           'e.g. "Save ₹100 for School Fees" or "Phone ke liye ₹50"',
    'voice.detectedAmount':    'Detected Amount',
    'voice.detectedGoal':      'Target Goal',
    'voice.transcript':        'You said: "{text}"',
    'voice.confirmBtn':        'Confirm & Save ₹{amount}',
    'voice.editBtn':           'Edit Details',
    'voice.cancelBtn':         'Cancel',
    'voice.tryAgain':          'Tap to speak again',
    'voice.savedSuccess':      'Voice deposit recorded successfully! ✅',
    'voice.quickPhrases':      'Or tap a quick phrase:',

    // ── Milestones Celebration ─────────────────────────────────────────────
    'milestone.celebrationTitle': 'Milestone Reached! 🏆',
    'milestone.celebration100':   'Goal 100% Completed! 🎉🥳',
    'milestone.msg25':            'You\'ve saved 25% of your goal! A great beginning.',
    'milestone.msg50':            'Halfway there! 50% milestone completed with consistency.',
    'milestone.msg75':            '75% achieved! The finish line is within your reach.',
    'milestone.msg100':           'Congratulations! You fully reached your savings target!',
    'milestone.continue':         'Awesome, Continue!',

    // ── Add Saving ─────────────────────────────────────────────────────────
    'addSaving.title':          'Add a Saving',
    'addSaving.quickAmounts':   'Quick Amount',
    'addSaving.orCustom':       'or enter custom amount',
    'addSaving.customPlaceholder': 'Enter amount (₹)',
    'addSaving.selectGoal':     'Which goal?',
    'addSaving.selectGoalPlaceholder': 'Choose a goal…',
    'addSaving.date':           'Date',
    'addSaving.note':           'Note (optional)',
    'addSaving.notePlaceholder':'e.g. Weekly vegetable sale',
    'addSaving.confirm':        'Save ₹{amount}',
    'addSaving.confirmDisabled':'Select amount & goal',
    'addSaving.successTitle':   'Deposit Recorded! ✅',
    'addSaving.successMsg':     '₹{amount} saved toward {goal}!',
    'addSaving.successCta':     'View Goal Details',
    'addSaving.addAnother':     '+ Add Another Saving',

    // ── Notifications ──────────────────────────────────────────────────────
    'notifications.title':      'Notifications & Alerts',
    'notifications.markAllRead':'Mark all read',
    'notifications.empty':      'All caught up!',
    'notifications.emptyHint':  'Reminders, streak alerts, and milestone updates will appear here.',
    'notifications.typeReminder': 'Reminder',
    'notifications.typeWarning':  'Risk Alert',
    'notifications.typeMilestone':'Milestone',
    'notifications.typeDeadline': 'Deadline Alert',
    'notifications.typeCompleted':'Completed',
    'notifications.typeSuccess':  'Deposit Saved',

    // ── Settings ───────────────────────────────────────────────────────────
    'settings.title':           'Settings',
    'settings.language':        'App Language',
    'settings.notifications':   'Savings Reminders',
    'settings.notifOn':         'Enabled',
    'settings.notifOff':        'Disabled',
    'settings.comingSoon':      'Coming soon!',
    'settings.familyInfo':      'Family Profile',
    'settings.familyLabel':     'Family Name',
    'settings.memberLabel':     'Primary Member',
    'settings.syncStatus':      'Offline & Sync Status',
    'settings.lastSynced':      'Last synced: {time}',
    'settings.offlineStatus':   'Connection',
    'settings.online':          'Online (Connected to Firestore)',
    'settings.offline':         'Offline (Local storage active)',
    'settings.offlineReassure': 'Your savings are safe on this device. Changes sync automatically when online.',
    'settings.appVersion':      'Sanchay+ v1.0.0',
    'settings.signOut':         'Sign Out',

    // ── Health States ──────────────────────────────────────────────────────
    'health.onTrack':  'ON TRACK',
    'health.atRisk':   'AT RISK',
    'health.behind':   'BEHIND',

    // ── Common / Shared UI States ──────────────────────────────────────────
    'common.loading':     'Loading…',
    'common.error':       'Something went wrong',
    'common.retry':       'Try Again',
    'common.offlineBanner': 'You\'re offline — your savings are safe on this device',
    'common.syncing':     'Syncing…',
    'common.synced':      'Synced',
    'common.noData':      'Nothing here yet',
    'common.back':        'Back',
    'common.save':        'Save',
    'common.cancel':      'Cancel',
    'common.today':       'Today',
    'common.yesterday':   'Yesterday',

    // ── Bottom Nav ─────────────────────────────────────────────────────────
    'nav.home':          'Home',
    'nav.goals':         'Goals',
    'nav.add':           'Add',
    'nav.notifications': 'Alerts',
    'nav.settings':      'Settings',

    // ── AI Assistant ────────────────────────────────────────────────────────
    'assistant.title':          'Sanchay+ Assistant',
    'assistant.subtitle':       'Voice & Text Savings Companion',
    'assistant.welcome':        'Namaste! How can I help with your family savings today?',
    'assistant.placeholder':    'Ask anything or say "Saved ₹50"...',
    'assistant.send':           'Send',
    'assistant.listening':      'Listening… Speak now',
    'assistant.thinking':       'Thinking…',
    'assistant.confirm':        'Confirm Deposit',
    'assistant.edit':           'Edit',
    'assistant.confirmed':      'Confirmed ✓',
    'assistant.mute':           'Mute Voice',
    'assistant.unmute':         'Unmute Voice',
    'assistant.quickSaved50':   '💰 Saved ₹50',
    'assistant.quickSchool':    '📊 School Fees status',
    'assistant.quickGoals':     '🎯 What are my goals?',
    'nav.calendar':             'Calendar',

    // ── Savings Calendar ───────────────────────────────────────────────────
    'calendar.title':           'Savings Calendar',
    'calendar.subtitle':        'Record of your daily and monthly savings',
    'calendar.monthTarget':     'Monthly Target',
    'calendar.totalSaved':      'Total Saved This Month',
    'calendar.daysActive':      'Days Saved',
    'calendar.missedDays':      'Missed Days',
    'calendar.today':           'Today',
    'calendar.dailyView':       'Daily View',
    'calendar.monthlyView':     'Monthly View',
    'calendar.dayDetails':      'Saving Details',
    'calendar.statusSaved':     'Saved',
    'calendar.statusMissed':    'Missed',
    'calendar.statusFuture':    'Planned',
    'calendar.statusNoActivity':'No Activity',
    'calendar.addSavingForDay': 'Add Saving for this Day',
    'calendar.catchUp':         'Catch Up Now',
    'calendar.savingSource':    'Source',
    'calendar.goalName':        'Goal',
    'calendar.amountSaved':     'Amount Saved',
    'calendar.noSavingsDay':    'No savings recorded on this date.',
    'calendar.monthlyCompleted':'Monthly Target Completed! 🎉',
    'calendar.monthlyMissed':   'Monthly Target Incomplete',
    'calendar.monthlyProgress': '{percent}% achieved · ₹{remaining} remaining',

    // ── Savings Recovery & Plan Adjustment ─────────────────────────────────
    'recovery.title':           'Automatic Savings Recovery',
    'recovery.subtitle':        'Smart plan adjustment for missed savings',
    'recovery.adjustedNotice':  'Your saving plan has been adjusted.',
    'recovery.targetAmount':    'Target Amount',
    'recovery.totalSaved':      'Total Saved',
    'recovery.remaining':       'Remaining Amount',
    'recovery.daysRemaining':   'Days Remaining',
    'recovery.originalDaily':   'Original Required Daily',
    'recovery.newRequired':     'New Required Daily',
    'recovery.missedDaysCount': 'Missed Days',
    'recovery.missedShortfall': 'Missed Shortfall',
    'recovery.status':          'Recovery Status',
    'recovery.chooseOption':    'Choose a Recovery Option',
    'recovery.optIncrease':     'Option 1: Increase Daily Saving',
    'recovery.optExtend':       'Option 2: Extend Deadline',
    'recovery.optAdjust':       'Option 3: Adjust Goal Target',
    'recovery.appliedSuccess':  'Plan updated successfully! 🎉',
    'recovery.history':         'Adjustment History',
    'recovery.onTrack':         'All caught up! Saving pace is healthy.',
    'recovery.catchUpEncourage':'Great work catching up on your savings!',
    'settings.muteVoice':       'Mute Voice Assistant',
    'settings.muteVoiceDesc':   'Disable spoken voice replies and keep text responses only',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  HINDI (हिंदी)
  // ═══════════════════════════════════════════════════════════════════════════
  hi: {
    // ── Landing ────────────────────────────────────────────────────────────
    'landing.appName':        'संचय+',
    'landing.tagline':        'छोटी बचत। बड़े लक्ष्य।',
    'landing.startSaving':    'बचत शुरू करें',
    'landing.login':          'मेरा पहले से खाता है',
    'landing.chooseLanguage': 'अपनी भाषा चुनें',
    'landing.langEn':         'English',
    'landing.langHi':         'हिंदी',
    'landing.langMr':         'मराठी',

    // ── Onboarding ─────────────────────────────────────────────────────────
    'onboarding.title':         'आइए आपका खाता तैयार करें',
    'onboarding.familyName':    'परिवार का नाम',
    'onboarding.familyPlaceholder': 'उदा. पाटिल',
    'onboarding.memberName':    'आपका नाम',
    'onboarding.memberPlaceholder': 'उदा. अरुण',
    'onboarding.preferredLang': 'पसंदीदा भाषा',
    'onboarding.next':          'आगे बढ़ें',
    'onboarding.back':          'पीछे',
    'onboarding.getStarted':    'शुरू करें →',
    'onboarding.step':          'कदम {current} / {total}',

    // ── Dashboard ──────────────────────────────────────────────────────────
    'dashboard.greetMorning':    'सुप्रभात, {name}! ☀️',
    'dashboard.greetAfternoon':  'नमस्कार, {name}!',
    'dashboard.greetEvening':    'शुभ संध्या, {name}! 🌙',
    'dashboard.familySuffix':    '{name} परिवार',
    'dashboard.heroTitle':       'आज का बचत लक्ष्य',
    'dashboard.heroSubtitle':    'लक्ष्य पर बने रहने के लिए आज छोटी सी बचत करें',
    'dashboard.heroAddBtn':      'आज की बचत जोड़ें',
    'dashboard.streakEncourage': '🔥 {count} दिनों की लगातार बचत! हर छोटी बचत मायने रखती है।',
    'dashboard.streakGentle':    'जब संभव हो बचाएं। निरंतरता से समृद्धि आती है।',
    'dashboard.activeGoalTitle': 'प्रमुख सक्रिय लक्ष्य',
    'dashboard.remainingMeta':   '{days} दिन शेष · ₹{rate}/दिन आवश्यक',
    'dashboard.totalSavings':    'कुल बचत',
    'dashboard.activeGoals':     'सक्रिय लक्ष्य',
    'dashboard.todaysTarget':    'आज का लक्ष्य',
    'dashboard.savingStreak':    'बचत स्ट्रीक',
    'dashboard.streakDays':      '{count} दिन',
    'dashboard.quickActions':    'त्वरित कार्य',
    'dashboard.voiceSave':       'आवाज से बचत',
    'dashboard.addSavings':      'बचत जोड़ें',
    'dashboard.newGoal':         'नया लक्ष्य',
    'dashboard.recentSavings':   'हाल की बचत',
    'dashboard.activeGoalsTitle':'आपके लक्ष्य',
    'dashboard.viewAll':         'सभी देखें',

    // ── Goals ──────────────────────────────────────────────────────────────
    'goals.title':             'मेरे लक्ष्य',
    'goals.createButton':      '+ नया लक्ष्य',
    'goals.saved':             '{amount} बचाए गए',
    'goals.target':            'लक्ष्य: {amount}',
    'goals.daysLeft':          '{count} दिन शेष',
    'goals.overdue':           '{count} दिन समाप्त',
    'goals.dueToday':          'आज अंतिम दिन है',
    'goals.requiredDaily':     '₹{amount}/दिन आवश्यक',
    'goals.completed':         'पूर्ण हुआ! 🎉',

    // ── Create Goal ────────────────────────────────────────────────────────
    'createGoal.title':        'नया लक्ष्य बनाएं',
    'createGoal.pickCategory': 'आप किसके लिए बचत कर रहे हैं?',
    'createGoal.goalName':     'लक्ष्य का नाम',
    'createGoal.namePlaceholder': 'उदा. कृषि उपकरण',
    'createGoal.targetAmount': 'लक्ष्य राशि (₹)',
    'createGoal.amountPlaceholder': 'उदा. 20,000',
    'createGoal.deadline':     'अंतिम तारीख',
    'createGoal.deadlineHint': 'भविष्य की तारीख होनी चाहिए',
    'createGoal.deadlineError':'कृपया भविष्य की तारीख चुनें',
    'createGoal.create':       'लक्ष्य बनाएं',
    'createGoal.catEducation': 'शिक्षा',
    'createGoal.catPhone':     'मोबाइल फोन',
    'createGoal.catFestival':  'त्योहार',
    'createGoal.catFarming':   'खेती-बाड़ी',
    'createGoal.catHome':      'घर का काम',
    'createGoal.catEmergency': 'आपातकालीन',
    'createGoal.catOther':     'अन्य',

    // ── Goal Details ───────────────────────────────────────────────────────
    'goalDetails.target':          'लक्ष्य राशि',
    'goalDetails.saved':           'कुल जमा',
    'goalDetails.remaining':       'बाकी राशि',
    'goalDetails.daysLeft':        'दिन बाकी',
    'goalDetails.requiredDaily':   'दैनिक आवश्यकता',
    'goalDetails.currentRate':     'वर्तमान दैनिक दर',
    'goalDetails.targetDate':      'लक्ष्य पूरा करने की तारीख',
    'goalDetails.predictedDate':   'संभावित पूर्णता तारीख',
    'goalDetails.healthReason':    'आप ₹{current}/दिन बचा रहे हैं, आवश्यक ₹{required}/दिन है',
    'goalDetails.recentDeposits':  'हाल के जमा',
    'goalDetails.milestones':      'पड़ाव (माइलस्टोन्स)',
    'goalDetails.addSaving':       '+ इस लक्ष्य में पैसे जोड़ें',
    'goalDetails.noDeposits':      'अभी तक कोई जमा नहीं। आज ही बचत शुरू करें!',

    // ── Prediction Card ────────────────────────────────────────────────────
    'prediction.title':              'बचत पूर्वानुमान',
    'prediction.rateComparison':     'वर्तमान दर: ₹{current}/दिन · आवश्यक: ₹{required}/दिन',
    'prediction.statusOnTrack':      'वर्तमान गति से आप अपने लक्ष्य को अंतिम तारीख से {days} दिन पहले पूरा कर लेंगे!',
    'prediction.statusBehind':       'वर्तमान दर पर लक्ष्य पूरा होने में {projectedDays} दिन लगेंगे (अंतिम समय: {deadlineDays} दिन)।',
    'prediction.recoverySuggestion': 'लक्ष्य पर लौटने के लिए हर दिन ₹{amount} और बचाएं।',
    'prediction.completed':          'लक्ष्य पूरा हुआ! बहुत-बहुत बधाई! 🏆',

    // ── Voice UI ───────────────────────────────────────────────────────────
    'voice.title':             'आवाज से बचत',
    'voice.listening':         'सुन रहे हैं…',
    'voice.instruction':       'बचत राशि और लक्ष्य का नाम बोलें',
    'voice.example':           'उदा. "स्कूल फीस के लिए ₹200 बचाएं" या "फोन के लिए ₹50"',
    'voice.detectedAmount':    'पहचानी गई राशि',
    'voice.detectedGoal':      'लक्ष्य',
    'voice.transcript':        'आपने कहा: "{text}"',
    'voice.confirmBtn':        'स्वीकारें और ₹{amount} जमा करें',
    'voice.editBtn':           'बदलें',
    'voice.cancelBtn':         'रद्द करें',
    'voice.tryAgain':          'फिर से बोलने के लिए टैप करें',
    'voice.savedSuccess':      'आवाज से जमा सफलतापूर्वक दर्ज हुआ! ✅',
    'voice.quickPhrases':      'या इनमें से चुनें:',

    // ── Milestones Celebration ─────────────────────────────────────────────
    'milestone.celebrationTitle': 'नया पड़ाव पार हुआ! 🏆',
    'milestone.celebration100':   'लक्ष्य 100% पूरा हुआ! 🎉🥳',
    'milestone.msg25':            'आपने 25% लक्ष्य पार कर लिया! बेहतरीन शुरुआत।',
    'milestone.msg50':            'आधा रास्ता तय हुआ! 50% पड़ाव पूरा।',
    'milestone.msg75':            '75% पूरा! आप मंजिल के बेहद करीब हैं।',
    'milestone.msg100':           'बधाई हो! आपने अपना पूरा बचत लक्ष्य हासिल कर लिया!',
    'milestone.continue':         'शानदार, आगे बढ़ें!',

    // ── Add Saving ─────────────────────────────────────────────────────────
    'addSaving.title':          'पैसे जोड़ें',
    'addSaving.quickAmounts':   'त्वरित राशि',
    'addSaving.orCustom':       'या अपनी पसंद की राशि डालें',
    'addSaving.customPlaceholder': 'राशि दर्ज करें (₹)',
    'addSaving.selectGoal':     'किस लक्ष्य के लिए?',
    'addSaving.selectGoalPlaceholder': 'लक्ष्य चुनें…',
    'addSaving.date':           'तारीख',
    'addSaving.note':           'नोट (वैकल्पिक)',
    'addSaving.notePlaceholder':'उदा. सब्जी मंडी बचत',
    'addSaving.confirm':        '₹{amount} जमा करें',
    'addSaving.confirmDisabled':'राशि और लक्ष्य चुनें',
    'addSaving.successTitle':   'जमा सफल! ✅',
    'addSaving.successMsg':     '{goal} के लिए ₹{amount} जमा हो गए!',
    'addSaving.successCta':     'लक्ष्य विवरण देखें',
    'addSaving.addAnother':     '+ एक और बचत जोड़ें',

    // ── Notifications ──────────────────────────────────────────────────────
    'notifications.title':      'सूचनाएं और संदेश',
    'notifications.markAllRead':'सभी पढ़े गए चिह्नित करें',
    'notifications.empty':      'कोई नई सूचना नहीं!',
    'notifications.emptyHint':  'बचत अनुस्मारक और पड़ाव संदेश यहाँ दिखाई देंगे।',
    'notifications.typeReminder': 'याद दिलाना',
    'notifications.typeWarning':  'सतर्कता',
    'notifications.typeMilestone':'पड़ाव',
    'notifications.typeDeadline': 'समय सीमा चेतावनी',
    'notifications.typeCompleted':'पूर्ण',
    'notifications.typeSuccess':  'जमा सफल',

    // ── Settings ───────────────────────────────────────────────────────────
    'settings.title':           'सेटिंग्स',
    'settings.language':        'ऐप की भाषा',
    'settings.notifications':   'बचत अनुस्मारक',
    'settings.notifOn':         'सक्रिय',
    'settings.notifOff':        'निष्क्रिय',
    'settings.comingSoon':      'शीघ्र उपलब्ध!',
    'settings.familyInfo':      'पारिवारिक प्रोफ़ाइल',
    'settings.familyLabel':     'परिवार का नाम',
    'settings.memberLabel':     'प्रमुख सदस्य',
    'settings.syncStatus':      'ऑफ़लाइन व सिंक स्थिति',
    'settings.lastSynced':      'अंतिम सिंक: {time}',
    'settings.offlineStatus':   'कनेक्शन',
    'settings.online':          'ऑनलाइन (फायरस्टोर से जुड़ा)',
    'settings.offline':         'ऑफ़लाइन (लोकल स्टोरेज सक्रिय)',
    'settings.offlineReassure': 'आपकी बचत इस डिवाइस पर सुरक्षित है। ऑनलाइन आते ही सिंक हो जाएगी।',
    'settings.appVersion':      'संचय+ v1.0.0',
    'settings.signOut':         'लॉग आउट',

    // ── Health States ──────────────────────────────────────────────────────
    'health.onTrack':  'सही रास्ते पर',
    'health.atRisk':   'जोखिम में',
    'health.behind':   'पीछे',

    // ── Common / Shared UI States ──────────────────────────────────────────
    'common.loading':     'लोड हो रहा है…',
    'common.error':       'कुछ समस्या आई',
    'common.retry':       'पुनः प्रयास करें',
    'common.offlineBanner': 'आप ऑफ़लाइन हैं — आपकी बचत इस डिवाइस पर सुरक्षित है',
    'common.syncing':     'सिंक हो रहा है…',
    'common.synced':      'सिंक हुआ',
    'common.noData':      'यहाँ कुछ नहीं है',
    'common.back':        'पीछे',
    'common.save':        'सहेजें',
    'common.cancel':      'रद्द करें',
    'common.today':       'आज',
    'common.yesterday':   'कल',

    // ── Bottom Nav ─────────────────────────────────────────────────────────
    'nav.home':          'होम',
    'nav.goals':         'लक्ष्य',
    'nav.add':           'जोड़ें',
    'nav.notifications': 'सूचनाएं',
    'nav.settings':      'सेटिंग्स',

    // ── AI Assistant ────────────────────────────────────────────────────────
    'assistant.title':          'संचय+ सहायक',
    'assistant.subtitle':       'आवाज और चैट बचत साथी',
    'assistant.welcome':        'नमस्ते! आज मैं आपके परिवार की बचत में कैसे मदद कर सकता हूँ?',
    'assistant.placeholder':    'कुछ भी पूछें या कहें "₹50 बचाए"...',
    'assistant.send':           'भेजें',
    'assistant.listening':      'सुन रहा हूँ… अब बोलें',
    'assistant.thinking':       'सोच रहा हूँ…',
    'assistant.confirm':        'जमा की पुष्टि करें',
    'assistant.edit':           'संपादित करें',
    'assistant.confirmed':      'पुष्टि हो गई ✓',
    'assistant.mute':           'आवाज बंद करें',
    'assistant.unmute':         'आवाज चालू करें',
    'assistant.quickSaved50':   '💰 ₹50 जमा किए',
    'assistant.quickSchool':    '📊 स्कूल फीस प्रगति',
    'nav.calendar':             'कैलेंडर',

    // ── Savings Calendar ───────────────────────────────────────────────────
    'calendar.title':           'बचत कैलेंडर',
    'calendar.subtitle':        'आपकी दैनिक और मासिक बचत का पूरा रिकॉर्ड',
    'calendar.monthTarget':     'मासिक लक्ष्य',
    'calendar.totalSaved':      'इस महीने कुल बचत',
    'calendar.daysActive':      'बचत के दिन',
    'calendar.missedDays':      'छूटे हुए दिन',
    'calendar.today':           'आज',
    'calendar.dailyView':       'दैनिक दृश्य',
    'calendar.monthlyView':     'मासिक दृश्य',
    'calendar.dayDetails':      'बचत का विवरण',
    'calendar.statusSaved':     'बचत हुई',
    'calendar.statusMissed':    'छूट गया',
    'calendar.statusFuture':    'नियोजित',
    'calendar.statusNoActivity':'कोई गतिविधि नहीं',
    'calendar.addSavingForDay': 'इस दिन के लिए बचत जोड़ें',
    'calendar.catchUp':         'अभी भरपाई करें',
    'calendar.savingSource':    'स्रोत',
    'calendar.goalName':        'लक्ष्य',
    'calendar.amountSaved':     'जमा राशि',
    'calendar.noSavingsDay':    'इस तारीख को कोई बचत दर्ज नहीं है।',
    'calendar.monthlyCompleted':'मासिक लक्ष्य पूरा हुआ! 🎉',
    'calendar.monthlyMissed':   'मासिक लक्ष्य अभी अधूरा',
    'calendar.monthlyProgress': '{percent}% पूरा · ₹{remaining} बाकी',

    // ── Savings Recovery & Plan Adjustment ─────────────────────────────────
    'recovery.title':           'स्वचालित बचत सुधार योजना',
    'recovery.subtitle':        'छूटी हुई बचत के लिए स्मार्ट योजना समायोजन',
    'recovery.adjustedNotice':  'आपकी बचत योजना समायोजित कर दी गई है।',
    'recovery.targetAmount':    'लक्ष्य राशि',
    'recovery.totalSaved':      'कुल बचत',
    'recovery.remaining':       'शेष राशि',
    'recovery.daysRemaining':   'शेष दिन',
    'recovery.originalDaily':   'मूल दैनिक आवश्यकता',
    'recovery.newRequired':     'नई दैनिक आवश्यकता',
    'recovery.missedDaysCount': 'छूटे हुए दिन',
    'recovery.missedShortfall': 'कमी राशि',
    'recovery.status':          'सुधार स्थिति',
    'recovery.chooseOption':    'सुधार का विकल्प चुनें',
    'recovery.optIncrease':     'विकल्प 1: दैनिक बचत बढ़ाएं',
    'recovery.optExtend':       'विकल्प 2: समय सीमा बढ़ाएं',
    'recovery.optAdjust':       'विकल्प 3: लक्ष्य राशि समायोजित करें',
    'recovery.appliedSuccess':  'योजना सफलतापूर्वक अपडेट हो गई! 🎉',
    'recovery.history':         'समायोजन इतिहास',
    'recovery.onTrack':         'सब ठीक है! बचत की गति सही है।',
    'recovery.catchUpEncourage':'बचत की भरपाई करने के लिए शाबाश!',
    'settings.muteVoice':       'सहायक की आवाज़ म्यूट करें',
    'settings.muteVoiceDesc':   'बोलकर जवाब देना बंद करें और केवल टेक्स्ट में उत्तर देखें',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  MARATHI (मराठी)
  // ═══════════════════════════════════════════════════════════════════════════
  mr: {
    // ── Landing ────────────────────────────────────────────────────────────
    'landing.appName':        'संचय+',
    'landing.tagline':        'छोटी बचत. मोठी स्वप्ने.',
    'landing.startSaving':    'बचत सुरू करा',
    'landing.login':          'माझे आधीच खाते आहे',
    'landing.chooseLanguage': 'तुमची भाषा निवडा',
    'landing.langEn':         'English',
    'landing.langHi':         'हिंदी',
    'landing.langMr':         'मराठी',

    // ── Onboarding ─────────────────────────────────────────────────────────
    'onboarding.title':         'चला तुमचे खाते तयार करूया',
    'onboarding.familyName':    'कुटुंबाचे नाव',
    'onboarding.familyPlaceholder': 'उदा. पाटील',
    'onboarding.memberName':    'तुमचे नाव',
    'onboarding.memberPlaceholder': 'उदा. अरुण',
    'onboarding.preferredLang': 'पसंतीची भाषा',
    'onboarding.next':          'पुढे',
    'onboarding.back':          'मागे',
    'onboarding.getStarted':    'सुरू करा →',
    'onboarding.step':          'टप्पा {current} / {total}',

    // ── Dashboard ──────────────────────────────────────────────────────────
    'dashboard.greetMorning':    'शुभ सकाळ, {name}! ☀️',
    'dashboard.greetAfternoon':  'नमस्कार, {name}!',
    'dashboard.greetEvening':    'शुभ संध्याकाळ, {name}! 🌙',
    'dashboard.familySuffix':    '{name} कुटुंब',
    'dashboard.heroTitle':       'आजचे बचत उद्दिष्ट',
    'dashboard.heroSubtitle':    'ध्येयावर राहण्यासाठी आज छोटीशी बचत करा',
    'dashboard.heroAddBtn':      'आजची बचत जमा करा',
    'dashboard.streakEncourage': '🔥 {count} दिवसांची सातत्यपूर्ण बचत! प्रत्येक रुपया मोलाचा आहे.',
    'dashboard.streakGentle':    'जमेल तेव्हा बचत करा. सातत्याने समृद्धी येते.',
    'dashboard.activeGoalTitle': 'प्रमुख सक्रिय ध्येय',
    'dashboard.remainingMeta':   '{days} दिवस शिल्लक · ₹{rate}/दिवस आवश्यक',
    'dashboard.totalSavings':    'एकूण बचत',
    'dashboard.activeGoals':     'सक्रिय ध्येये',
    'dashboard.todaysTarget':    'आजचे उद्दिष्ट',
    'dashboard.savingStreak':    'बचत सातत्य',
    'dashboard.streakDays':      '{count} दिवस',
    'dashboard.quickActions':    'त्वरित कृती',
    'dashboard.voiceSave':       'आवाजाने बचत',
    'dashboard.addSavings':      'बचत जोडा',
    'dashboard.newGoal':         'नवीन ध्येय',
    'dashboard.recentSavings':   'अलीकडील बचत',
    'dashboard.activeGoalsTitle':'तुमची ध्येये',
    'dashboard.viewAll':         'सर्व पहा',

    // ── Goals ──────────────────────────────────────────────────────────────
    'goals.title':             'माझी ध्येये',
    'goals.createButton':      '+ नवीन ध्येय',
    'goals.saved':             '{amount} जमा झाले',
    'goals.target':            'उद्दिष्ट: {amount}',
    'goals.daysLeft':          '{count} दिवस शिल्लक',
    'goals.overdue':           '{count} दिवस उलटून गेले',
    'goals.dueToday':          'आज शेवटचा दिवस',
    'goals.requiredDaily':     '₹{amount}/दिवस आवश्यक',
    'goals.completed':         'पूर्ण झाले! 🎉',

    // ── Create Goal ────────────────────────────────────────────────────────
    'createGoal.title':        'नवीन ध्येय ठरवा',
    'createGoal.pickCategory': 'तुम्ही कशासाठी बचत करत आहात?',
    'createGoal.goalName':     'ध्येयाचे नाव',
    'createGoal.namePlaceholder': 'उदा. शेती अवजारे',
    'createGoal.targetAmount': 'उद्दिष्ट रक्कम (₹)',
    'createGoal.amountPlaceholder': 'उदा. २०,०००',
    'createGoal.deadline':     'शेवटची तारीख',
    'createGoal.deadlineHint': 'पुढील तारीख असावी',
    'createGoal.deadlineError':'कृपया भविष्यातील तारीख निवडा',
    'createGoal.create':       'ध्येय तयार करा',
    'createGoal.catEducation': 'शिक्षण',
    'createGoal.catPhone':     'मोबाईल',
    'createGoal.catFestival':  'सण / उत्सव',
    'createGoal.catFarming':   'शेती',
    'createGoal.catHome':      'घरदुरुस्ती',
    'createGoal.catEmergency': 'तातडीचे / आरोग्य',
    'createGoal.catOther':     'इतर',

    // ── Goal Details ───────────────────────────────────────────────────────
    'goalDetails.target':          'उद्दिष्ट रक्कम',
    'goalDetails.saved':           'एकूण बचत',
    'goalDetails.remaining':       'शिल्लक रक्कम',
    'goalDetails.daysLeft':        'दिवस शिल्लक',
    'goalDetails.requiredDaily':   'रोज आवश्यक रक्कम',
    'goalDetails.currentRate':     'सध्याचा दैनिक दर',
    'goalDetails.targetDate':      'ध्येयपूर्ती तारीख',
    'goalDetails.predictedDate':   'अपेक्षित पूर्णता',
    'goalDetails.healthReason':    'तुम्ही ₹{current}/दिवस वाचवत आहात, ₹{required}/दिवस आवश्यक',
    'goalDetails.recentDeposits':  'अलीकडील जमा',
    'goalDetails.milestones':      'टप्पे (माईलस्टोन्स)',
    'goalDetails.addSaving':       '+ या ध्येयासाठी पैसे जोडा',
    'goalDetails.noDeposits':      'अद्याप कोणतीही बचत नाही. आजच सुरुवात करा!',

    // ── Prediction Card ────────────────────────────────────────────────────
    'prediction.title':              'बचत अंदाज व सल्ला',
    'prediction.rateComparison':     'सध्याचा दर: ₹{current}/दिवस · आवश्यक: ₹{required}/दिवस',
    'prediction.statusOnTrack':      'सध्याच्या गतीने तुम्ही ध्येय मुदतीआधी {days} दिवस पूर्ण कराल!',
    'prediction.statusBehind':       'सध्याच्या गतीने ध्येय गाठायला {projectedDays} दिवस लागतील (मुदत: {deadlineDays} दिवस).',
    'prediction.recoverySuggestion': 'ध्येयावर परत येण्यासाठी रोज ₹{amount} अधिक वाचवा.',
    'prediction.completed':          'ध्येय पूर्ण झाले! अभिनंदन! 🏆',

    // ── Voice UI ───────────────────────────────────────────────────────────
    'voice.title':             'आवाजाने बचत',
    'voice.listening':         'ऐकत आहोत…',
    'voice.instruction':       'बचतीची रक्कम आणि ध्येयाचे नाव बोला',
    'voice.example':           'उदा. "शाळेच्या फीसाठी ₹२०० जमा करा" किंवा "फोनसाठी ₹५०"',
    'voice.detectedAmount':    'ओळखलेली रक्कम',
    'voice.detectedGoal':      'निवडलेले ध्येय',
    'voice.transcript':        'तुम्ही म्हणालात: "{text}"',
    'voice.confirmBtn':        'खात्री करा आणि ₹{amount} जमा करा',
    'voice.editBtn':           'बदल करा',
    'voice.cancelBtn':         'रद्द करा',
    'voice.tryAgain':          'पुन्हा बोलण्यासाठी टॅप करा',
    'voice.savedSuccess':      'आवाजाने बचत यशस्वीरीत्या जमा झाली! ✅',
    'voice.quickPhrases':      'किंवा यापैकी निवडा:',

    // ── Milestones Celebration ─────────────────────────────────────────────
    'milestone.celebrationTitle': 'नवीन टप्पा गाठला! 🏆',
    'milestone.celebration100':   'ध्येय १००% पूर्ण झाले! 🎉🥳',
    'milestone.msg25':            'तुम्ही २५% टप्पा ओलांडला! उत्तम सुरुवात.',
    'milestone.msg50':            'अर्धा पल्ला गाठला! ५०% टप्पा सातत्याने पूर्ण.',
    'milestone.msg75':            '७५% पूर्ण! तुम्ही यशाच्या अगदी जवळ आहात.',
    'milestone.msg100':           'अभिनंदन! तुम्ही तुमचे पूर्ण उद्दिष्ट साध्य केले आहे!',
    'milestone.continue':         'छान, पुढे चला!',

    // ── Add Saving ─────────────────────────────────────────────────────────
    'addSaving.title':          'बचत जमा करा',
    'addSaving.quickAmounts':   'त्वरित रक्कम',
    'addSaving.orCustom':       'किंवा रक्कम टाईप करा',
    'addSaving.customPlaceholder': 'रक्कम टाका (₹)',
    'addSaving.selectGoal':     'कोणत्या ध्येयासाठी?',
    'addSaving.selectGoalPlaceholder': 'ध्येय निवडा…',
    'addSaving.date':           'तारीख',
    'addSaving.note':           'नोंद (ऐच्छिक)',
    'addSaving.notePlaceholder':'उदा. भाजीपाला विक्री बचत',
    'addSaving.confirm':        '₹{amount} जमा करा',
    'addSaving.confirmDisabled':'रक्कम व ध्येय निवडा',
    'addSaving.successTitle':   'बचत जमा झाली! ✅',
    'addSaving.successMsg':     '{goal} साठी ₹{amount} जमा झाले!',
    'addSaving.successCta':     'ध्येय तपशील पहा',
    'addSaving.addAnother':     '+ आणखी बचत जोडा',

    // ── Notifications ──────────────────────────────────────────────────────
    'notifications.title':      'सूचना व संदेश',
    'notifications.markAllRead':'सर्व वाचले म्हणून खूण करा',
    'notifications.empty':      'कोणतीही नवीन सूचना नाही!',
    'notifications.emptyHint':  'बचत स्मरणपत्रे आणि टप्प्यांचे संदेश येथे दिसतील.',
    'notifications.typeReminder': 'स्मरणपत्र',
    'notifications.typeWarning':  'धोक्याचा इशारा',
    'notifications.typeMilestone':'टप्पा गाठला',
    'notifications.typeDeadline': 'मुदत सूचना',
    'notifications.typeCompleted':'पूर्ण झाले',
    'notifications.typeSuccess':  'बचत जमा',

    // ── Settings ───────────────────────────────────────────────────────────
    'settings.title':           'सेटिंग्ज',
    'settings.language':        'अॅपची भाषा',
    'settings.notifications':   'बचत स्मरणपत्रे',
    'settings.notifOn':         'सुरू',
    'settings.notifOff':        'बंद',
    'settings.comingSoon':      'लवकरच उपलब्ध!',
    'settings.familyInfo':      'कुटुंब प्रोफाईल',
    'settings.familyLabel':     'कुटुंबाचे नाव',
    'settings.memberLabel':     'प्रमुख सदस्य',
    'settings.syncStatus':      'ऑफलाइन व सिंक स्थिती',
    'settings.lastSynced':      'शेवटचे सिंक: {time}',
    'settings.offlineStatus':   'इंटरनेट जोडणी',
    'settings.online':          'ऑनलाइन (फायरस्टोरशी जोडलेले)',
    'settings.offline':         'ऑफलाइन (डिव्हाइसवर सुरक्षित)',
    'settings.offlineReassure': 'तुमची बचत या डिव्हाइसवर पूर्ण सुरक्षित आहे. इंटरनेट येताच सिंक होईल.',
    'settings.appVersion':      'संचय+ v1.0.0',
    'settings.signOut':         'लॉग आउट',

    // ── Health States ──────────────────────────────────────────────────────
    'health.onTrack':  'योग्य मार्गावर',
    'health.atRisk':   'धोक्यात',
    'health.behind':   'मागे',

    // ── Common / Shared UI States ──────────────────────────────────────────
    'common.loading':     'लोड होत आहे…',
    'common.error':       'काहीतरी अडचण आली',
    'common.retry':       'पुन्हा प्रयत्न करा',
    'common.offlineBanner': 'तुम्ही ऑफलाइन आहात — तुमची बचत या डिव्हाइसवर सुरक्षित आहे',
    'common.syncing':     'सिंक होत आहे…',
    'common.synced':      'सिंक झाले',
    'common.noData':      'येथे काहीही नाही',
    'common.back':        'मागे',
    'common.save':        'जतन करा',
    'common.cancel':      'रद्द करा',
    'common.today':       'आज',
    'common.yesterday':   'काल',

    // ── Bottom Nav ─────────────────────────────────────────────────────────
    'nav.home':          'होम',
    'nav.goals':         'ध्येय',
    'nav.add':           'जोडा',
    'nav.notifications': 'सूचना',
    'nav.settings':      'सेटिंग्ज',

    // ── AI Assistant ────────────────────────────────────────────────────────
    'assistant.title':          'संचय+ सहाय्यक',
    'assistant.subtitle':       'आवाज व मजकूर बचत साथी',
    'assistant.welcome':        'नमस्कार! आज मी आपल्या कुटुंबाच्या बचतीसाठी कशी मदत करू?',
    'assistant.placeholder':    'काहीही विचारा किंवा म्हणा "₹50 वाचवले"...',
    'assistant.send':           'पाठवा',
    'assistant.listening':      'ऐकत आहे… आता बोला',
    'assistant.thinking':       'विचार करत आहे…',
    'assistant.confirm':        'ठेव निश्चित करा',
    'assistant.edit':           'बदला',
    'assistant.confirmed':      'निश्चित झाले ✓',
    'assistant.mute':           'आवाज म्यूट करा',
    'assistant.unmute':         'आवाज सुरू करा',
    'assistant.quickSaved50':   '💰 ₹50 वाचवले',
    'assistant.quickSchool':    '📊 शाळेच्या फीची स्थिती',
    'nav.calendar':             'कॅलेंडर',

    // ── Savings Calendar ───────────────────────────────────────────────────
    'calendar.title':           'बचत कॅलेंडर',
    'calendar.subtitle':        'तुमच्या दैनंदिन आणि मासिक बचतीचा संपूर्ण तपशील',
    'calendar.monthTarget':     'मासिक उद्दिष्ट',
    'calendar.totalSaved':      'या महिन्यातील एकूण बचत',
    'calendar.daysActive':      'बचतीचे दिवस',
    'calendar.missedDays':      'सुटलेले दिवस',
    'calendar.today':           'आज',
    'calendar.dailyView':       'दैनंदिन दृश्य',
    'calendar.monthlyView':     'मासिक दृश्य',
    'calendar.dayDetails':      'बचतीचा तपशील',
    'calendar.statusSaved':     'बचत झाली',
    'calendar.statusMissed':    'सुटले',
    'calendar.statusFuture':    'नियोजित',
    'calendar.statusNoActivity':'कोणतीही हालचाल नाही',
    'calendar.addSavingForDay': 'या दिवसासाठी बचत जोडा',
    'calendar.catchUp':         'आता भरपाई करा',
    'calendar.savingSource':    'स्रोत',
    'calendar.goalName':        'ध्येय',
    'calendar.amountSaved':     'जमा रक्कम',
    'calendar.noSavingsDay':    'या तारखेला कोणतीही बचत नोंदवलेली नाही.',
    'calendar.monthlyCompleted':'मासिक उद्दिष्ट पूर्ण झाले! 🎉',
    'calendar.monthlyMissed':   'मासिक उद्दिष्ट अपूर्ण',
    'calendar.monthlyProgress': '{percent}% पूर्ण · ₹{remaining} शिल्लक',

    // ── Savings Recovery & Plan Adjustment ─────────────────────────────────
    'recovery.title':           'स्वयंचलित बचत पुनर्प्राप्ती योजना',
    'recovery.subtitle':        'सुटलेल्या बचतीसाठी स्मार्ट योजना समायोजन',
    'recovery.adjustedNotice':  'तुमची बचत योजना समायोजित केली आहे.',
    'recovery.targetAmount':    'उद्दिष्ट रक्कम',
    'recovery.totalSaved':      'एकूण बचत',
    'recovery.remaining':       'शिल्लक रक्कम',
    'recovery.daysRemaining':   'शिल्लक दिवस',
    'recovery.originalDaily':   'मूळ दैनंदिन गरज',
    'recovery.newRequired':     'नवीन दैनंदिन गरज',
    'recovery.missedDaysCount': 'सुटलेले दिवस',
    'recovery.missedShortfall': 'तुटवडा रक्कम',
    'recovery.status':          'स्थिती',
    'recovery.chooseOption':    'पुनर्प्राप्तीचा पर्याय निवडा',
    'recovery.optIncrease':     'पर्याय 1: दैनंदिन बचत वाढवा',
    'recovery.optExtend':       'पर्याय 2: मुदत वाढवा',
    'recovery.optAdjust':       'पर्याय 3: ध्येय रक्कम समायोजित करा',
    'recovery.appliedSuccess':  'योजना यशस्वीरीत्या अद्ययावत झाली! 🎉',
    'recovery.history':         'समायोजन इतिहास',
    'recovery.onTrack':         'सर्व व्यवस्थित आहे! बचतीचा वेग योग्य आहे.',
    'recovery.catchUpEncourage':'बचत भरून काढल्याबद्दल छान प्रयत्न!',
    'settings.muteVoice':       'सहाय्यकाचा आवाज म्यूट करा',
    'settings.muteVoiceDesc':   'फक्त मजकूर उत्तरे दाखवा, बोललेला आवाज बंद करा',
  },

  // ── Regional Indic Locales Fallbacks ───────────────────────────────────────
  bn: { 'assistant.title': 'সঞ্চয়+ সহকারী', 'assistant.placeholder': 'কিছু জিজ্ঞাসা করুন...' },
  gu: { 'assistant.title': 'સંચય+ સહાયક', 'assistant.placeholder': 'કંઈપણ પૂછો...' },
  ta: { 'assistant.title': 'சஞ்சய்+ உதவியாளர்', 'assistant.placeholder': 'ஏதேனும் கேளுங்கள்...' },
  te: { 'assistant.title': 'సంచయ్+ అసిస్టెంట్', 'assistant.placeholder': 'ఏదైనా అడగండి...' },
  kn: { 'assistant.title': 'ಸಂಚಯ್+ ಸಹಾಯಕ', 'assistant.placeholder': 'ಏನನ್ನಾದರೂ ಕೇಳಿ...' },
  ml: { 'assistant.title': 'സഞ്ചയ്+ അസിസ്റ്റന്റ്', 'assistant.placeholder': 'എന്തെങ്കിലും ചോദിക്കൂ...' },
  pa: { 'assistant.title': 'ਸੰਚੈ+ ਸਹਾਇਕ', 'assistant.placeholder': 'ਕੁਝ ਵੀ ਪੁੱਛੋ...' },
};

// ── Language state ─────────────────────────────────────────────────────────────

let _lang = 'en';
try {
  if (typeof localStorage !== 'undefined') {
    _lang = localStorage.getItem('sanchay_lang') || 'en';
  }
} catch (_) {}

export function setLanguage(lang) {
  _lang = lang;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sanchay_lang', lang);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  } catch (_) {}
}

export function getLanguage() {
  return _lang;
}

/**
 * Translate a key. Supports interpolation: t('greet', { name: 'Arun' })
 * Falls back to English if key not found in current language.
 */
export function t(key, vars = {}) {
  let str = (strings[_lang] ?? strings['en'])[key]
         ?? strings['en'][key]
         ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

/**
 * Scans a container (default document) and translates all elements marked with data-i18n attributes.
 *
 * @param {HTMLElement|Document} [container=document]
 */
export function applyI18n(container = document) {
  document.documentElement.lang = _lang;

  // Text content
  container.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });

  // Placeholders
  container.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  });

  // Aria labels
  container.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute('aria-label', t(key));
  });

  // Titles
  container.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });
}
