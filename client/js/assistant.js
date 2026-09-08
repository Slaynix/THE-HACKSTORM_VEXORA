/**
 * assistant.js — Conversational AI Assistant page controller.
 *
 * Implements:
 *   - Text & Voice chat via POST /api/chat
 *   - Multilingual natural language responses
 *   - SpeechRecognition (voice input) & SpeechSynthesis (voice output)
 *   - Safe financial UI cards (confirmations, progress, health, prediction, goals)
 *   - Two-step deposit confirmation with idempotency (clientTxnId)
 *   - Mute voice toggle with persistent state
 */

import { authFetch, getMockUser } from './auth.js';
import { formatINR, getLanguage, t, applyI18n } from './i18n.js';

// ── DOM Elements ──────────────────────────────────────────────────────────────
const messagesContainer = document.getElementById('chat-messages');
const chatInput         = document.getElementById('chat-input');
const sendBtn           = document.getElementById('send-btn');
const micBtn            = document.getElementById('mic-btn');
const micIcon           = document.getElementById('mic-icon');
const voiceBanner       = document.getElementById('voice-banner');
const cancelVoiceBtn    = document.getElementById('cancel-voice-btn');
const thinkingIndicator = document.getElementById('thinking-indicator');
const toggleMuteBtn     = document.getElementById('toggle-voice-mute');
const muteIcon          = document.getElementById('voice-mute-icon');
const langBadge         = document.getElementById('chat-lang-badge');
const quickChips        = document.getElementById('quick-chips');

// ── State ─────────────────────────────────────────────────────────────────────
let isVoiceMuted = false;
let isListening = false;
let recognition = null;
let conversationId = '';

const LANG_LOCALES = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
};

// ── Helper: Format Markdown Text ──────────────────────────────────────────────
function formatMessageText(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

// ── Voice Output (SpeechSynthesis) ────────────────────────────────────────────
let _cachedVoices = [];
function getAvailableVoices() {
  if (_cachedVoices && _cachedVoices.length > 0) return _cachedVoices;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    _cachedVoices = window.speechSynthesis.getVoices();
  }
  return _cachedVoices || [];
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    _cachedVoices = window.speechSynthesis.getVoices();
  };
}

function speakText(text, langCode = 'en') {
  if (isVoiceMuted || !('speechSynthesis' in window)) return;
  if (!text || text.trim().length === 0) return;

  try {
    window.speechSynthesis.cancel(); // Stop any pending utterances
    const clean = text.replace(/[✓💡🎯🎓📊•#*]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    const targetLocale = LANG_LOCALES[langCode] || 'en-IN';
    utterance.lang = targetLocale;
    utterance.rate = 0.95;

    const voices = getAvailableVoices();
    if (voices.length > 0) {
      let match = voices.find(v => v.lang === targetLocale || v.lang.replace('_', '-') === targetLocale);
      if (!match) {
        match = voices.find(v => v.lang.startsWith(langCode));
      }
      if (!match) {
        match = voices.find(v => v.lang.includes('IN') || v.name.toLowerCase().includes('india'));
      }
      if (match) utterance.voice = match;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[Assistant] SpeechSynthesis error:', err);
  }
}

// ── Append Messages to UI ─────────────────────────────────────────────────────
function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-end';

  const bubble = document.createElement('div');
  bubble.className = 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm text-sm font-medium leading-relaxed break-words';
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messagesContainer.insertBefore(wrapper, thinkingIndicator);
  scrollToBottom();
}

function appendAssistantMessage({ replyText, replySpeech, detectedLanguage, uiCard, requiresConfirmation }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-start gap-2.5 max-w-[92%] assistant-bubble';

  const avatar = document.createElement('div');
  avatar.className = 'w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm shrink-0 font-bold mt-1';
  avatar.textContent = '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'bg-white border border-gray-100 rounded-2xl rounded-tl-sm p-3.5 shadow-sm space-y-2.5 text-sm text-gray-800 w-full leading-relaxed';

  // Formatted Text
  const textP = document.createElement('div');
  textP.innerHTML = formatMessageText(replyText);
  bubble.appendChild(textP);

  // Render UI Card if present
  if (uiCard) {
    const cardEl = renderUiCard(uiCard, detectedLanguage);
    if (cardEl) bubble.appendChild(cardEl);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);

  messagesContainer.insertBefore(wrapper, thinkingIndicator);
  scrollToBottom();

  // Update language badge if returned
  if (detectedLanguage && langBadge) {
    langBadge.textContent = detectedLanguage.toUpperCase();
  }

  // Voice output
  if (replySpeech) {
    speakText(replySpeech, detectedLanguage);
  }
}

// ── Render Structured UI Cards ────────────────────────────────────────────────
function renderUiCard(uiCard, langCode) {
  const { type, data } = uiCard;
  const card = document.createElement('div');
  card.className = 'mt-2.5 pt-2.5 border-t border-gray-100';

  switch (type) {
    case 'deposit_confirm': {
      card.innerHTML = `
        <div class="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-700">Confirm Deposit</span>
            <span class="text-lg font-black text-emerald-700">₹${Number(data.amount).toLocaleString('en-IN')}</span>
          </div>
          <div class="text-xs space-y-1">
            <p><strong>Goal:</strong> ${data.goalName}</p>
            <p class="text-emerald-800">Current progress: ₹${(data.currentSaved || 0).toLocaleString('en-IN')} / ₹${(data.targetAmount || 0).toLocaleString('en-IN')}</p>
          </div>
          <div class="flex items-center gap-2 pt-1" id="confirm-btn-container">
            <button type="button" class="btn-confirm-deposit flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1 min-h-[42px]">
              ✓ Confirm
            </button>
            <button type="button" class="btn-edit-deposit py-2.5 px-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 active:scale-95 transition-all min-h-[42px]">
              Edit
            </button>
          </div>
        </div>
      `;

      const confirmBtn = card.querySelector('.btn-confirm-deposit');
      const editBtn    = card.querySelector('.btn-edit-deposit');
      const container  = card.querySelector('#confirm-btn-container');

      confirmBtn.addEventListener('click', async () => {
        // Prevent double click
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> Saving…';
        if (editBtn) editBtn.remove();

        const clientTxnId = `chat-tx-${Date.now()}`;

        try {
          const res = await authFetch('/api/chat/confirm', {
            method: 'POST',
            body: JSON.stringify({
              goalId: data.goalId,
              amount: data.amount,
              clientTxnId,
              appLanguage: langCode || getLanguage(),
            }),
          });

          if (!res.ok) throw new Error('Failed to record deposit');
          const result = await res.json();

          container.innerHTML = `
            <div class="w-full p-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
              <span>✓</span> Saved ₹${data.amount} to ${data.goalName}!
            </div>
          `;

          if (result.replySpeech) {
            speakText(result.replySpeech, langCode);
          }
        } catch (err) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Retry Confirm';
          alert('Could not save deposit. Please try again.');
        }
      });

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          chatInput.value = `Add ₹ to ${data.goalName}`;
          chatInput.focus();
        });
      }
      return card;
    }

    case 'goal_progress': {
      card.innerHTML = `
        <div class="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs space-y-2">
          <div class="flex items-center justify-between font-bold">
            <span class="text-gray-900">${data.goalName}</span>
            <span class="text-emerald-700 font-extrabold">${data.progressPercent}%</span>
          </div>
          <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-600 rounded-full" style="width: ${Math.min(data.progressPercent, 100)}%;"></div>
          </div>
          <div class="flex items-center justify-between text-gray-500 font-medium">
            <span>Saved: ₹${(data.savedAmount || 0).toLocaleString('en-IN')}</span>
            <span>Target: ₹${(data.targetAmount || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      `;
      return card;
    }

    case 'goal_health': {
      const isOk = data.health === 'ON_TRACK';
      card.innerHTML = `
        <div class="p-3 rounded-xl ${isOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} border text-xs space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-gray-900">${data.goalName}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${isOk ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}">${data.health}</span>
          </div>
          <p class="text-gray-700 leading-relaxed font-medium">${data.reason || ''}</p>
        </div>
      `;
      return card;
    }

    case 'goal_prediction': {
      card.innerHTML = `
        <div class="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs space-y-2">
          <p class="font-bold text-gray-900">${data.goalName} Forecast</p>
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div class="p-2 rounded-lg bg-white border border-gray-200">
              <span class="text-gray-400 block">Daily Target</span>
              <span class="font-extrabold text-emerald-700 text-sm">₹${data.requiredDailySaving}/day</span>
            </div>
            <div class="p-2 rounded-lg bg-white border border-gray-200">
              <span class="text-gray-400 block">Days Left</span>
              <span class="font-extrabold text-gray-900 text-sm">${data.daysRemaining} days</span>
            </div>
          </div>
        </div>
      `;
      return card;
    }

    case 'goals_list': {
      const items = (data.goals || []).map(g => `
        <div class="p-2.5 rounded-lg bg-white border border-gray-100 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-gray-900">${g.name}</p>
            <p class="text-gray-400 text-[11px]">₹${g.savedAmount.toLocaleString('en-IN')} of ₹${g.targetAmount.toLocaleString('en-IN')}</p>
          </div>
          <span class="font-black text-emerald-700">${g.progressPercent}%</span>
        </div>
      `).join('');

      card.innerHTML = `<div class="space-y-1.5 pt-1">${items}</div>`;
      return card;
    }

    case 'tip_card': {
      card.innerHTML = `
        <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <span class="text-base shrink-0">💡</span>
          <span class="font-medium leading-relaxed">${data.tip}</span>
        </div>
      `;
      return card;
    }

    default:
      return null;
  }
}

function scrollToBottom() {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 50);
}

// ── Send Message Pipeline ─────────────────────────────────────────────────────
async function handleSendMessage(rawText, inputMode = 'text') {
  const text = (rawText || chatInput.value || '').trim();
  if (!text) return;

  chatInput.value = '';
  if (quickChips) quickChips.classList.add('hidden'); // Hide chips after initial interaction

  appendUserMessage(text);
  thinkingIndicator.classList.remove('hidden');
  scrollToBottom();

  try {
    const user = getMockUser();
    const appLang = getLanguage();

    const res = await authFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: text,
        inputMode,
        conversationId,
        familyId: user?.familyId || 'fam-patil-1',
        memberId: user?.uid || 'user-patil-1',
        appLanguage: appLang,
      }),
    });

    thinkingIndicator.classList.add('hidden');

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    if (data.conversationId) conversationId = data.conversationId;

    appendAssistantMessage(data);
  } catch (err) {
    thinkingIndicator.classList.add('hidden');
    console.error('[Assistant] Send error:', err);
    appendAssistantMessage({
      replyText: 'I could not connect to the assistant right now. Please check your connection or try again.',
      replySpeech: 'I could not connect to the assistant right now.',
      detectedLanguage: 'en',
    });
  }
}

// ── Web Speech API: Voice Recognition ─────────────────────────────────────────
function setupSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    console.warn('[Assistant] SpeechRecognition not supported in this browser');
    if (micBtn) {
      micBtn.title = 'Voice input not supported in this browser';
    }
    return;
  }

  const voiceLangSelect = document.getElementById('voice-lang-select');
  const interimTextEl   = document.getElementById('voice-interim-text');
  const bannerStatus    = document.getElementById('voice-banner-status');

  recognition = new SpeechRec();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('bg-red-500', 'text-white', 'listening-pulse');
    micBtn.classList.remove('bg-emerald-50', 'text-emerald-700');
    if (voiceBanner) voiceBanner.classList.remove('hidden');
    if (bannerStatus) bannerStatus.textContent = 'Listening… Speak now';
    if (interimTextEl) interimTextEl.textContent = 'Listening...';
  };

  recognition.onresult = (event) => {
    let interim = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    if (interim && interimTextEl) {
      interimTextEl.textContent = `"${interim}"`;
      if (chatInput) chatInput.value = interim;
    }

    if (finalTranscript && finalTranscript.trim().length > 0) {
      if (chatInput) chatInput.value = finalTranscript.trim();
      if (interimTextEl) interimTextEl.textContent = `✓ "${finalTranscript.trim()}"`;
      stopListening();
      handleSendMessage(finalTranscript.trim(), 'voice');
    }
  };

  recognition.onerror = (event) => {
    console.warn('[Assistant] Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('Microphone permission was blocked. Please allow microphone access in your browser settings to use voice input.');
    } else if (event.error === 'no-speech') {
      if (interimTextEl) interimTextEl.textContent = 'No speech heard. Tap mic to try again.';
    }
    stopListening();
  };

  recognition.onend = () => {
    stopListening();
  };
}

function startListening() {
  if (!recognition) {
    setupSpeechRecognition();
  }
  if (!recognition) {
    alert('Voice input is not supported in this browser. Please use Chrome or Edge, or type your message!');
    return;
  }

  const voiceLangSelect = document.getElementById('voice-lang-select');
  const appLang = getLanguage();
  const selectedLocale = (voiceLangSelect && voiceLangSelect.value)
    ? voiceLangSelect.value
    : (LANG_LOCALES[appLang] || 'en-IN');

  recognition.lang = selectedLocale;

  try {
    recognition.start();
  } catch (e) {
    stopListening();
    try { recognition.start(); } catch (_) {}
  }
}

function stopListening() {
  isListening = false;
  if (micBtn) {
    micBtn.classList.remove('bg-red-500', 'text-white', 'listening-pulse');
    micBtn.classList.add('bg-emerald-50', 'text-emerald-700');
  }
  if (voiceBanner) voiceBanner.classList.add('hidden');
  try {
    if (recognition) recognition.stop();
  } catch (_) {}
}

// ── Voice Mute State ──────────────────────────────────────────────────────────
function initVoiceMute() {
  isVoiceMuted = localStorage.getItem('sanchay_mute_voice') === 'true';
  updateMuteIcon();

  if (toggleMuteBtn) {
    toggleMuteBtn.addEventListener('click', () => {
      isVoiceMuted = !isVoiceMuted;
      localStorage.setItem('sanchay_mute_voice', isVoiceMuted);
      updateMuteIcon();

      if (isVoiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    });
  }
}

function updateMuteIcon() {
  if (muteIcon) {
    muteIcon.textContent = isVoiceMuted ? '🔇' : '🔊';
  }
  if (toggleMuteBtn) {
    toggleMuteBtn.title = isVoiceMuted ? 'Unmute Voice Assistant' : 'Mute Voice Assistant';
  }
}

// ── Initialisation ────────────────────────────────────────────────────────────
function init() {
  applyI18n();
  initVoiceMute();
  setupSpeechRecognition();

  // Voice language selector sync
  const voiceLangSelect = document.getElementById('voice-lang-select');
  if (voiceLangSelect) {
    const currentLang = getLanguage();
    if (LANG_LOCALES[currentLang]) {
      voiceLangSelect.value = LANG_LOCALES[currentLang];
    }
    voiceLangSelect.addEventListener('change', () => {
      if (recognition) {
        recognition.lang = voiceLangSelect.value;
      }
    });
  }

  // Persistent conversationId for the session
  conversationId = sessionStorage.getItem('sanchay_conv_id') || `conv-${Date.now()}`;
  sessionStorage.setItem('sanchay_conv_id', conversationId);

  // Send button & enter key
  if (sendBtn) {
    sendBtn.addEventListener('click', () => handleSendMessage());
  }
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  // Mic button
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  }
  if (cancelVoiceBtn) {
    cancelVoiceBtn.addEventListener('click', stopListening);
  }

  // Quick prompt chips
  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) handleSendMessage(prompt);
    });
  });

  // Auto-start voice if ?voice=true query parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('voice') === 'true') {
    setTimeout(() => {
      startListening();
    }, 400);
  }
}

document.addEventListener('DOMContentLoaded', init);
