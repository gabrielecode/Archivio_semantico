/**
 * Utility per la pronuncia in Cinese Semplificato (zh-CN)
 * Supporta sia Web Speech API (sintesi nativa client-side istantanea)
 * sia fallback audio cloud ad alta fedeltà tramite /api/tts.
 */

type SpeechStatusListener = (state: { isSpeaking: boolean; speakingText: string | null; error?: string | null }) => void;

class ChineseSpeechManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private speakingText: string | null = null;
  private listeners: Set<SpeechStatusListener> = new Set();
  private chineseVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  public defaultSpeed = 0.85; // 0.85x per una chiara scansione di toni e sillabe

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
    this.chineseVoices = voices.filter(v => {
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
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.speakingText = null;
    this.notify();
  }

  public async speak(text: string, options?: { speed?: number; preferCloud?: boolean }): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText) return false;

    // Se sta già pronunciando lo stesso testo, ferma la riproduzione (toggle)
    if (this.isSpeaking && this.speakingText === cleanText) {
      this.stop();
      return false;
    }

    this.stop();

    const speed = options?.speed || this.defaultSpeed;
    const preferCloud = options?.preferCloud ?? false;

    // Se è preferito il cloud o non c'è supporto per SpeechSynthesis, usa il fallback /api/tts
    const hasWebSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const hasVoice = this.hasNativeChineseVoice();

    if (!preferCloud && hasWebSpeech) {
      const success = this.speakNative(cleanText, speed);
      if (success) return true;
    }

    // Fallback cloud
    return this.speakCloud(cleanText, speed);
  }

  private speakNative(text: string, speed: number): boolean {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = speed;
      utterance.pitch = 1.0;

      // Trova la migliore voce per il Cinese Semplificato (Mandarin)
      const voices = this.getAvailableChineseVoices();
      const preferredVoice =
        voices.find(v => {
          const l = (v.lang || '').toLowerCase();
          return l === 'zh-cn' || l === 'zh_cn' || l.includes('cmn-hans-cn');
        }) ||
        voices.find(v => (v.lang || '').toLowerCase().startsWith('zh')) ||
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
        this.speakCloud(text, speed);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);

      // Risolvi il bug di Chrome che può mettere in pausa speechSynthesis
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      return true;
    } catch (err) {
      console.warn('Errore sintesi vocale nativa:', err);
      return false;
    }
  }

  private speakCloud(text: string, speed: number): boolean {
    try {
      const url = `/api/tts?text=${encodeURIComponent(text)}&lang=zh-CN`;
      const audio = new Audio(url);
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
        this.notify();
      };

      audio.onerror = (e) => {
        console.error('Errore riproduzione audio cloud:', e);
        this.isSpeaking = false;
        this.speakingText = null;
        this.currentAudio = null;
        this.notify('Impossibile riprodurre la pronuncia audio.');
      };

      this.currentAudio = audio;
      audio.play().catch(err => {
        console.error('Play audio error:', err);
        this.isSpeaking = false;
        this.speakingText = null;
        this.notify(err.message);
      });

      return true;
    } catch (err: any) {
      console.error('Audio cloud init error:', err);
      this.isSpeaking = false;
      this.speakingText = null;
      this.notify(err?.message || 'Errore audio');
      return false;
    }
  }
}

export const chineseSpeech = new ChineseSpeechManager();
