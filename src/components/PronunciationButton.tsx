import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Gauge } from 'lucide-react';
import { chineseSpeech } from '../utils/speech';

interface PronunciationButtonProps {
  text?: string;
  fallbackText?: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'ghost' | 'inline' | 'icon';
  showSpeedToggle?: boolean;
  className?: string;
  title?: string;
}

export const PronunciationButton: React.FC<PronunciationButtonProps> = ({
  text = '',
  fallbackText = '',
  label = 'Pronuncia',
  size = 'sm',
  variant = 'secondary',
  showSpeedToggle = false,
  className = '',
  title = 'Ascolta pronuncia in Cinese Semplificato (zh-CN)'
}) => {
  const [speechState, setSpeechState] = useState<{ isSpeaking: boolean; speakingText: string | null }>({
    isSpeaking: false,
    speakingText: null
  });
  const [speed, setSpeed] = useState<number>(0.85); // 0.85x ideale per toni
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = chineseSpeech.subscribe((state) => {
      setSpeechState({ isSpeaking: state.isSpeaking, speakingText: state.speakingText });
    });
    return () => unsub();
  }, []);

  const targetText = (text || fallbackText || '').trim();
  const isCurrentlySpeaking = speechState.isSpeaking && speechState.speakingText === targetText;

  const handleSpeak = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!targetText) {
      setFeedback('Inserisci prima il nome o ideogramma del punto');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    if (isCurrentlySpeaking) {
      chineseSpeech.stop();
    } else {
      chineseSpeech.speak(targetText, { speed });
    }
  };

  const toggleSpeed = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newSpeed = speed === 0.85 ? 1.0 : 0.85;
    setSpeed(newSpeed);
    if (isCurrentlySpeaking) {
      chineseSpeech.speak(targetText, { speed: newSpeed });
    }
  };

  // Stili per dimensioni
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs gap-1 rounded-lg',
    sm: 'px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-xl',
    md: 'px-4 py-2 text-sm font-semibold gap-2 rounded-xl'
  };

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 16
  };

  // Stili per varianti
  const getVariantClasses = () => {
    if (isCurrentlySpeaking) {
      return 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 animate-pulse';
    }
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm border border-transparent';
      case 'ghost':
        return 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20';
      case 'inline':
        return 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200';
      case 'icon':
        return 'p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent rounded-lg';
      case 'secondary':
      default:
        return 'bg-stone-50 hover:bg-blue-50 text-stone-700 hover:text-blue-700 border border-stone-200 hover:border-blue-300 shadow-xs';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 relative ${className}`}>
      <button
        type="button"
        onClick={handleSpeak}
        title={title}
        aria-label={title}
        className={`inline-flex items-center justify-center transition-all cursor-pointer font-medium select-none ${sizeClasses[size]} ${getVariantClasses()}`}
      >
        {isCurrentlySpeaking ? (
          <>
            <span className="flex items-center gap-0.5">
              <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-4 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-2 bg-white rounded-full animate-bounce"></span>
            </span>
            <span>Ascolto...</span>
          </>
        ) : (
          <>
            <Volume2 size={iconSizes[size]} className="shrink-0 text-current" />
            {label && <span>{label}</span>}
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 ml-0.5">
              zh-CN
            </span>
          </>
        )}
      </button>

      {showSpeedToggle && (
        <button
          type="button"
          onClick={toggleSpeed}
          title={`Velocità pronuncia: ${speed}x (clicca per alternare 0.85x e 1.0x)`}
          className="px-1.5 py-1 text-[10px] font-mono font-bold text-stone-500 hover:text-blue-600 bg-stone-100 hover:bg-blue-50 rounded-lg border border-stone-200 transition-colors"
        >
          {speed}x
        </button>
      )}

      {/* Messaggio rapido di feedback in caso di testo vuoto */}
      {feedback && (
        <div className="absolute left-0 bottom-full mb-1 z-30 whitespace-nowrap bg-stone-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg animate-in fade-in zoom-in-95 pointer-events-none flex items-center gap-1.5">
          <span>⚠️ {feedback}</span>
        </div>
      )}
    </div>
  );
};
