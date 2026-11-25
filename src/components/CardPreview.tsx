import React, { useState, useEffect } from 'react';
import { Archive, Rec, Template } from '../types';
import { ExternalLink, Video, X } from 'lucide-react';
import { PronunciationButton } from './PronunciationButton';
import { parseWikiSegments, resolveRecord } from '../utils/parser';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

export const CardPreview = ({
  record,
  archive,
  onSelectRecord,
  onCreateRecord,
}: {
  record: Rec;
  archive?: Archive;
  onSelectRecord?: (id: string) => void;
  onCreateRecord?: (title: string) => void;
}) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const template = templates.find(t => t.id === record.tipo) || templates[0];
  const fields = template.fields;

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  const hasChineseChars = (text: string) => /[\u4e00-\u9fff]/.test(text);
  const audioTarget =
    [
      record.campi?.['ideogramma'],
      record.campi?.['ideogrammi'],
      record.campi?.['ideogramma_principale'],
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join(' ').trim() : ''))
      .find(Boolean) || '';
  const hasChineseAudioTarget = hasChineseChars(audioTarget);

  const renderWikiText = (text: string) => {
    const segments = parseWikiSegments(text);
    if (segments.length === 0) return text;
    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
      }
      const targetTitle = seg.targetTitle || '';
      const label = seg.label || targetTitle;
      const targetRec = archive ? resolveRecord(archive, targetTitle) : undefined;

      if (targetRec) {
        return (
          <button
            key={`${targetTitle}-${idx}`}
            type="button"
            onClick={() => onSelectRecord?.(targetRec.id)}
            className="inline-flex items-center text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 text-sm font-medium transition-colors mx-0.5 cursor-pointer"
            title={`Vai alla scheda: ${targetRec.titolo}`}
          >
            {label}
          </button>
        );
      }

      return (
        <button
          key={`create-${targetTitle}-${idx}`}
          type="button"
          onClick={onCreateRecord ? () => onCreateRecord(targetTitle) : undefined}
          className="inline-flex items-center text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 text-sm font-medium transition-colors mx-0.5 cursor-pointer group"
          title={`Crea nuova scheda: ${targetTitle}`}
        >
          <span className="mr-1 font-bold">+ Crea:</span> {label}
        </button>
      );
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 text-white" style={{ backgroundColor: template.cardColor }}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm uppercase tracking-widest font-bold opacity-70">
            {template.name}
          </div>
          {hasChineseAudioTarget && (
            <PronunciationButton
              text={audioTarget}
              variant="ghost"
              size="xs"
              showSpeedToggle={true}
              title={`Ascolta la pronuncia di "${audioTarget}" in cinese semplificato`}
            />
          )}
        </div>
        <h2 className="text-2xl font-serif font-bold leading-tight">
          {record.titolo}
        </h2>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 flex-1 overflow-auto custom-scrollbar">
        {fields.map(f => {
          const val = record.campi[f.id];
          if (!val || (Array.isArray(val) && val.length === 0)) return null;

          const isAudioField = ['nome_principale', 'ideogramma', 'ideogrammi', 'ideogramma_principale', 'pronuncia', 'nome_alimento', 'nome_erba', 'nome_olio'].includes(f.id);

          return (
            <div key={f.id} className="space-y-1">
              <div className="text-sm uppercase font-bold text-stone-400 tracking-wider flex items-center justify-between">
                <span>{f.label}</span>
                {isAudioField && typeof val === 'string' && val.trim() && hasChineseAudioTarget && (
                  <PronunciationButton
                    text={audioTarget}
                    size="xs"
                    variant="inline"
                    title={`Pronuncia per ${f.label}`}
                  />
                )}
              </div>
              <div className="text-stone-800">
                {f.type === 'text' && (
                  <span className={`font-medium ${f.id === 'ideogramma' || f.id === 'ideogrammi' ? 'text-xl tracking-wider font-serif' : ''}`}>
                    {typeof val === 'string' ? renderWikiText(val) : val}
                  </span>
                )}
                {f.type === 'textarea' && (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {typeof val === 'string' ? renderWikiText(val) : val}
                  </p>
                )}
                {f.type === 'number' && <span className="font-mono text-lg">{val}</span>}
                {f.type === 'list' && (
                  <ul className="list-disc list-inside space-y-1">
                    {val.map((item: string, i: number) => (
                      <li key={i} className="text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span>{item}</span>
                          {f.id === 'nomi_secondari' && typeof item === 'string' && item.trim() && hasChineseChars(item) && (
                            <PronunciationButton text={item.trim()} size="xs" variant="icon" title="Ascolta pronuncia" />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {f.type === 'image' && (() => {
                  const imgs = Array.isArray(val)
                    ? val.filter((u: any) => typeof u === 'string' && u.trim() !== '')
                    : typeof val === 'string' && val.trim() !== ''
                      ? [val]
                      : [];
                  if (imgs.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {imgs.map((url: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="aspect-square rounded-lg overflow-hidden border border-stone-200 block bg-stone-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                        >
                          <img src={url} alt={f.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {f.type === 'video' && (
                  <a href={val} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium p-2 bg-blue-50 rounded-lg">
                    <Video size={16} /> Guarda video
                  </a>
                )}
                {f.type === 'link' && (
                  <a href={val} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-600 hover:underline text-sm font-medium p-2 bg-emerald-50 rounded-lg">
                    <ExternalLink size={16} /> Apri link
                  </a>
                )}
                {f.type === 'select' && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(Array.isArray(val) ? val : [val]).map((v: string) => (
                      <span key={v} className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200">
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {Array.isArray(record.images) && record.images.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <div className="text-sm uppercase font-bold text-stone-400 tracking-wider">
              Galleria immagini ({record.images.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {record.images.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxUrl(url)}
                  className="aspect-square rounded-lg overflow-hidden border border-stone-200 block bg-stone-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                >
                  <img src={url} alt={`Galleria ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-stone-50 border-t flex items-center justify-between text-sm text-stone-400 font-bold">
        <span>ID: {record.id.slice(0, 8)}</span>
        <span>MODIFICATO: {new Date(record.modificato).toLocaleDateString()}</span>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Chiudi immagine"
            >
              <X size={20} />
            </button>
            <img src={lightboxUrl} alt="Anteprima foto" className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl bg-white" />
          </div>
        </div>
      )}
    </div>
  );
};
