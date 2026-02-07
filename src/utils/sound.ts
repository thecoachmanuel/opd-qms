export class SoundManager {
  private audioContext: AudioContext | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    this.loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  public async initAudio() {
    if (typeof window === 'undefined') return;

    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.isInitialized = true;
    console.log("Audio Initialized");
  }

  public playBeep() {
    // Attempt init if not ready, though browser might block if not user triggered
    if (!this.audioContext) {
        try {
            this.initAudio();
        } catch (e) {
            console.warn("Could not auto-init audio context", e);
        }
    }
    
    if (!this.audioContext) return;

    try {
        const ctx = this.audioContext;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Error playing beep:", e);
    }
  }

  public speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel existing to prevent backlog
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select Voice
    // Prefer English female voices often sound clearer for announcements
    const preferredVoice = this.voices.find(v => v.name.includes("Google US English")) || 
                           this.voices.find(v => v.name.includes("Samantha")) ||
                           this.voices.find(v => v.lang === "en-US") || 
                           this.voices.find(v => v.lang.startsWith("en"));
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    console.log(`Speaking: "${text}" using voice: ${preferredVoice?.name || 'Default'}`);
    window.speechSynthesis.speak(utterance);
  }
}

export const soundManager = new SoundManager();
