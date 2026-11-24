/**
 * Utility per la pronuncia in Cinese Semplificato (zh-CN)
 * Supporta sia Web Speech API (sintesi nativa client-side istantanea)
 * sia fallback audio cloud autenticato tramite /api/tts.
 */
import { auth } from '../lib/firebase';

type SpeechStatusListener = (state: { isSpeaking: boolean; speakingText: string | null; error?: string | null }) => void;

class ChineseSpeechManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private speakingText: string | null = null;
  private listeners: Set<SpeechStatusListener> = new Set();
  private chineseVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  public defaultSpeed = 0.85;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices() || [];
    this.chineseVoices = voices.filter((v) => {
      const l = (v.lang || '').toLowerCase();
      const n = (v.name || '').toLowerCase();
      return (
        l.includes('zh') ||
        l.includes('cmn') ||
        n.includes('chinese') ||
        n.includes('mandarin') ||
        n.includes('putonghua')
      );
    });
    this.voicesLoaded = true;
  }

  public getAvailableChineseVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded) this.loadVoices();
    return this.chineseVoices;
  }

  public hasNativeChineseVoice(): boolean {
    if (!this.voicesLoaded) this.loadVoices();
    return this.chineseVoices.length > 0;
  }

  public subscribe(listener: SpeechStatusListener): () => void {
    this.listeners.add(listener);
    listener({ isSpeaking: this.isSpeaking, speakingText: this.speakingText });
    return () => this.listeners.delete(listener);
  }

  private notify(error: string | null = null) {
    for (const listener of this.listeners) {
      listener({ isSpeaking: this.isSpeaking, speakingText: this.speakingText, error });
    }
  }

  private releaseObjectUrl() {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
    this.releaseObjectUrl();
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.speakingText = null;
    this.notify();
  }

  public async speak(text: string, options?: { speed?: number; preferCloud?: boolean }): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText) return false;

    if (this.isSpeaking && this.speakingText === cleanText) {
      this.stop();
      return false;
    }

    this.stop();

    const speed = options?.speed || this.defaultSpeed;
    const preferCloud = options?.preferCloud ?? false;

    const hasWebSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

    if (!preferCloud && hasWebSpeech && this.hasNativeChineseVoice()) {
      const success = this.speakNative(cleanText, speed);
      if (success) return true;
    }

    return this.speakCloud(cleanText, speed);
  }

  private speakNative(text: string, speed: number): boolean {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = speed;
      utterance.pitch = 1.0;

      const voices = this.getAvailableChineseVoices();
      const preferredVoice =
        voices.find((v) => {
          const l = (v.lang || '').toLowerCase();
          return l === 'zh-cn' || l === 'zh_cn' || l.includes('cmn-hans-cn');
        }) ||
        voices.find((v) => (v.lang || '').toLowerCase().startsWith('zh')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.speakingText = text;
        this.notify();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.speakingText = null;
        this.currentUtterance = null;
        this.notify();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error, provando fallback cloud:', e);
        this.isSpeaking = false;
        this.speakingText = null;
        this.currentUtterance = null;
        void this.speakCloud(text, speed);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      return true;
    } catch (err) {
      console.warn('Errore sintesi vocale nativa:', err);
      return false;
    }
  }

  private async speakCloud(text: string, speed: number): Promise<boolean> {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const url = `/api/tts?text=${encodeURIComponent(text)}&lang=zh-CN`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.releaseObjectUrl();
      this.currentObjectUrl = objectUrl;

      const audio = new Audio(objectUrl);
      audio.playbackRate = speed;

      audio.onplay = () => {
        this.isSpeaking = true;
        this.speakingText = text;
        this.notify();
      };

      audio.onended = () => {
        this.isSpeaking = false;
        this.speakingText = null;
        this.currentAudio = null;
        this.releaseObjectUrl();
        this.notify();
      };

      audio.onerror = () => {
        this.isSpeaking = false;
        this.speakingText = null;
        this.currentAudio = null;
        this.releaseObjectUrl();
        this.notify('Impossibile riprodurre la pronuncia audio.');
      };

      this.currentAudio = audio;
      await audio.play();
      return true;
    } catch (err: any) {
      console.error('Audio cloud init error:', err);
      this.isSpeaking = false;
      this.speakingText = null;
      this.releaseObjectUrl();
      this.notify(err?.message || 'Errore audio');
      return false;
    }
  }
}

export const chineseSpeech = new ChineseSpeechManager();
