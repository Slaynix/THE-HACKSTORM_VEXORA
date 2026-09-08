/**
 * voice.js — Voice input & speech recognition modal controller.
 *
 * Responsibilities:
 *   - Web Speech API integration with graceful fallback
 *   - Visual listening wave animation
 *   - Live transcript display
 *   - Calls backend POST /api/voice/parse to extract amount + goal
 *   - Explicit Confirm / Edit UI step (NEVER saves silently)
 *   - Calls API to record deposit only upon confirmation
 */

import { t, formatINR, getLanguage } from './i18n.js';
import { authFetch } from './auth.js';
import { showToast } from './ui-states.js';
import { listGoals } from './goals.js';

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const isVoiceSupported = Boolean(SpeechRecognition);

let _modalEl = null;
let _backdropEl = null;
let _activeRecognition = null;
let _parsedData = null;
let _onConfirmedCallback = null;

/**
 * Ensures the Voice Modal DOM elements exist.
 */
function _ensureModalDOM() {
  if (_modalEl) return;

  _backdropEl = document.createElement('div');
  _backdropEl.id = 'voice-modal-backdrop';
  _backdropEl.className = 'sheet-backdrop';
  _backdropEl.setAttribute('aria-hidden', 'true');

  _modalEl = document.createElement('div');
  _modalEl.id = 'voice-bottom-sheet';
  _modalEl.className = 'bottom-sheet';
  _modalEl.setAttribute('role', 'dialog');
  _modalEl.setAttribute('aria-modal', 'true');
  _modalEl.setAttribute('aria-labelledby', 'voice-sheet-title');

  document.body.appendChild(_backdropEl);
  document.body.appendChild(_modalEl);

  _backdropEl.addEventListener('click', closeVoiceModal);
}

/**
 * Opens the Voice Modal and begins listening.
 *
 * @param {Object} [options]
 * @param {Function} [options.onConfirmed]
 * @param {string} [options.defaultGoalId]
 */
export async function openVoiceModal({ onConfirmed = null, defaultGoalId = null } = {}) {
  _ensureModalDOM();
  _onConfirmedCallback = onConfirmed;
  _parsedData = null;

  const goals = await listGoals();
  const currentLang = getLanguage();
  const recognitionLang = currentLang === 'hi' ? 'hi-IN' : (currentLang === 'mr' ? 'mr-IN' : 'en-IN');

  // Quick suggestion chips based on user's language & active goals
  const primaryGoal = goals[0] || { name: 'School Fees' };
  const quickChips = currentLang === 'hi' ? [
    `स्कूल फीस के लिए ₹100`,
    `फोन के लिए ₹50 जमा करो`,
    `खेती के लिए ₹500`,
  ] : (currentLang === 'mr' ? [
    `शाळेच्या फीसाठी ₹100 जमा करा`,
    `फोनसाठी ₹50`,
    `शेतीसाठी ₹500`,
  ] : [
    `Save ₹100 for ${primaryGoal.name}`,
    `Save ₹50 for New Phone`,
    `Save ₹500 for Farming`,
  ]);

  _modalEl.innerHTML = `
    <div class="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
      <div class="flex items-center gap-2">
        <span class="text-xl">🎙️</span>
        <h2 id="voice-sheet-title" class="text-base font-bold text-gray-900">${t('voice.title')}</h2>
      </div>
      <button id="voice-close-btn" class="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="${t('common.cancel')}">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>

    <!-- Listening animation view -->
    <div id="voice-listening-view" class="text-center py-4">
      <div class="voice-mic-container">
        <div class="voice-pulse-ring"></div>
        <div class="voice-pulse-ring"></div>
        <div class="relative z-10 w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-lg">
          🎙️
        </div>
      </div>

      <p id="voice-status-text" class="text-sm font-semibold text-emerald-800 mb-1" aria-live="polite">
        ${t('voice.listening')}
      </p>
      <p class="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
        ${t('voice.instruction')}
      </p>

      <!-- Live transcript area -->
      <div id="voice-transcript-card" class="bg-gray-50 border border-gray-200 rounded-xl p-3 min-h-[56px] flex items-center justify-center mb-4 text-xs font-medium text-gray-700 italic">
        "${t('voice.example')}"
      </div>

      <!-- Quick tap chips for noisy environments or simulated voice -->
      <div class="mt-2 text-left">
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">${t('voice.quickPhrases')}</p>
        <div class="flex flex-wrap gap-2" id="voice-quick-chips">
          ${quickChips.map(chip => `
            <button class="voice-chip px-3 py-2 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all text-left min-h-[44px]">
              🗣️ "${chip}"
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Confirmation / Edit view (Hidden until transcript received) -->
    <div id="voice-confirm-view" class="hidden py-2 space-y-4">
      <div class="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
        <p class="text-xs text-emerald-700 font-semibold mb-1" id="voice-confirm-transcript"></p>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div class="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">${t('voice.detectedAmount')}</span>
            <div id="voice-amount-display" class="text-2xl font-black text-emerald-700">₹0</div>
            <input id="voice-amount-edit" type="number" class="form-input text-lg font-bold py-1 px-2 hidden" min="1" step="1" />
          </div>
          <div class="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">${t('voice.detectedGoal')}</span>
            <div id="voice-goal-display" class="text-sm font-bold text-gray-900 truncate mt-1">Goal</div>
            <select id="voice-goal-select" class="form-input text-xs py-1 px-1 mt-1 hidden">
              ${goals.map(g => `<option value="${g.id}">${g.icon || '🎯'} ${g.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Action Buttons (Strictly explicit confirmation required) -->
      <div class="space-y-2 pt-2">
        <button id="voice-confirm-btn" class="btn-primary w-full shadow-md text-base py-3.5">
          ${t('voice.confirmBtn', { amount: '0' })}
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button id="voice-edit-btn" class="btn-secondary text-xs py-2.5">
            ✏️ ${t('voice.editBtn')}
          </button>
          <button id="voice-retry-btn" class="btn-ghost text-xs py-2.5 border border-gray-200">
            🔄 ${t('voice.tryAgain')}
          </button>
        </div>
      </div>
    </div>
  `;

  // Show bottom sheet
  _backdropEl.classList.add('active');
  _modalEl.classList.add('active');

  // Close handlers
  _modalEl.querySelector('#voice-close-btn').addEventListener('click', closeVoiceModal);

  // Quick chips tap
  _modalEl.querySelectorAll('.voice-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.textContent.replace('🗣️', '').replace(/"/g, '').trim();
      _handleTranscript(text, goals, defaultGoalId);
    });
  });

  // Start SpeechRecognition if available
  if (SpeechRecognition) {
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = recognitionLang;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const transcriptEl = _modalEl.querySelector('#voice-transcript-card');

      recognition.onresult = (e) => {
        const transcript = Array.from(e.results)
          .map(result => result[0].transcript)
          .join(' ');
        if (transcriptEl) transcriptEl.textContent = `"${transcript}"`;

        if (e.results[0].isFinal) {
          _handleTranscript(transcript, goals, defaultGoalId);
        }
      };

      recognition.onerror = (err) => {
        console.warn('[voice] Speech recognition event:', err.error);
        const statusEl = _modalEl.querySelector('#voice-status-text');
        if (statusEl) statusEl.textContent = t('voice.instruction');
      };

      recognition.start();
      _activeRecognition = recognition;
    } catch (recErr) {
      console.warn('[voice] Recognition init warning:', recErr);
    }
  }
}

/**
 * Handles incoming transcript, queries backend parser, and transitions to confirmation UI.
 */
async function _handleTranscript(transcript, goals, defaultGoalId) {
  if (_activeRecognition) {
    try { _activeRecognition.stop(); } catch (_) {}
    _activeRecognition = null;
  }

  const statusEl = _modalEl.querySelector('#voice-status-text');
  if (statusEl) statusEl.textContent = t('common.syncing');

  try {
    // Call backend natural language voice parser
    let parsed = null;
    const res = await authFetch('/api/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });

    if (res.ok) {
      const resJson = await res.json();
      if (resJson.success && resJson.parsed) {
        parsed = resJson.parsed;
      }
    }

    // Fallback parser if API unreachable
    if (!parsed) {
      const numMatch = transcript.match(/\d+/);
      const amount = numMatch ? parseInt(numMatch[0], 10) : 100;
      parsed = {
        amount,
        goalId: defaultGoalId || (goals[0] ? goals[0].id : 'goal-1'),
        goalName: goals[0] ? goals[0].name : 'Savings',
        note: `Voice Save: "${transcript}"`,
      };
    }

    _parsedData = {
      amount: parsed.amount || 100,
      goalId: parsed.goalId || (goals[0] ? goals[0].id : 'goal-1'),
      note: parsed.note || `Voice: "${transcript}"`,
      rawTranscript: transcript,
    };

    // Switch view to Confirmation Step (Explicit Confirm/Edit)
    _renderConfirmationView(goals);
  } catch (err) {
    console.error('[voice parse error]', err);
    showToast(t('common.error'), 'error');
  }
}

/**
 * Renders the explicit Confirmation / Edit state.
 */
function _renderConfirmationView(goals) {
  const listeningView = _modalEl.querySelector('#voice-listening-view');
  const confirmView   = _modalEl.querySelector('#voice-confirm-view');
  if (!listeningView || !confirmView) return;

  listeningView.classList.add('hidden');
  confirmView.classList.remove('hidden');

  const transcriptEl  = confirmView.querySelector('#voice-confirm-transcript');
  const amountDispEl  = confirmView.querySelector('#voice-amount-display');
  const amountEditEl  = confirmView.querySelector('#voice-amount-edit');
  const goalDispEl    = confirmView.querySelector('#voice-goal-display');
  const goalSelectEl  = confirmView.querySelector('#voice-goal-select');
  const confirmBtn    = confirmView.querySelector('#voice-confirm-btn');
  const editBtn       = confirmView.querySelector('#voice-edit-btn');
  const retryBtn      = confirmView.querySelector('#voice-retry-btn');

  const matchedGoal = goals.find(g => g.id === _parsedData.goalId) || goals[0];

  transcriptEl.textContent = t('voice.transcript', { text: _parsedData.rawTranscript });
  amountDispEl.textContent = formatINR(_parsedData.amount);
  amountEditEl.value = _parsedData.amount;

  goalDispEl.textContent = `${matchedGoal ? matchedGoal.icon || '🎯' : '🎯'} ${matchedGoal ? matchedGoal.name : 'Savings'}`;
  goalSelectEl.value = _parsedData.goalId;

  confirmBtn.textContent = t('voice.confirmBtn', { amount: formatINR(_parsedData.amount) });

  let isEditing = false;
  editBtn.addEventListener('click', () => {
    isEditing = !isEditing;
    if (isEditing) {
      amountDispEl.classList.add('hidden');
      amountEditEl.classList.remove('hidden');
      goalDispEl.classList.add('hidden');
      goalSelectEl.classList.remove('hidden');
      editBtn.textContent = '💾 Done Editing';
    } else {
      _parsedData.amount = Number(amountEditEl.value) || _parsedData.amount;
      _parsedData.goalId = goalSelectEl.value;

      amountDispEl.textContent = formatINR(_parsedData.amount);
      amountDispEl.classList.remove('hidden');
      amountEditEl.classList.add('hidden');

      const g = goals.find(item => item.id === _parsedData.goalId);
      goalDispEl.textContent = `${g ? g.icon || '🎯' : '🎯'} ${g ? g.name : 'Savings'}`;
      goalDispEl.classList.remove('hidden');
      goalSelectEl.classList.add('hidden');

      confirmBtn.textContent = t('voice.confirmBtn', { amount: formatINR(_parsedData.amount) });
      editBtn.textContent = `✏️ ${t('voice.editBtn')}`;
    }
  });

  amountEditEl.addEventListener('input', () => {
    const val = Number(amountEditEl.value) || 0;
    confirmBtn.textContent = t('voice.confirmBtn', { amount: formatINR(val) });
  });

  retryBtn.addEventListener('click', () => {
    confirmView.classList.add('hidden');
    listeningView.classList.remove('hidden');
    openVoiceModal({ onConfirmed: _onConfirmedCallback, defaultGoalId: _parsedData.goalId });
  });

  // CONFIRM & SAVE — Explicit action
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = t('common.syncing');

    try {
      const goalId = _parsedData.goalId;
      const amount = Number(isEditing ? amountEditEl.value : _parsedData.amount);

      // Call API to save deposit
      const res = await authFetch(`/api/goals/${goalId}/deposits`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          source: 'voice',
          notes: _parsedData.note,
        }),
      });

      if (!res.ok) {
        throw new Error('Deposit save failed');
      }

      showToast(t('voice.savedSuccess'), 'success');
      closeVoiceModal();

      if (_onConfirmedCallback) {
        _onConfirmedCallback({ goalId, amount });
      }
    } catch (saveErr) {
      console.error('[voice save error]', saveErr);
      showToast(t('common.error'), 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = t('voice.confirmBtn', { amount: formatINR(_parsedData.amount) });
    }
  });
}

/**
 * Closes and resets the Voice Modal.
 */
export function closeVoiceModal() {
  if (_activeRecognition) {
    try { _activeRecognition.stop(); } catch (_) {}
    _activeRecognition = null;
  }
  if (_backdropEl) _backdropEl.classList.remove('active');
  if (_modalEl) _modalEl.classList.remove('active');
}
