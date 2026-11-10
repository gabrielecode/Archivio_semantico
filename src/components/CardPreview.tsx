import React from 'react';
import { Rec, Template } from '../types';
import { ExternalLink, Video, List, FileText } from 'lucide-react';
import { PronunciationButton } from './PronunciationButton';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

export const CardPreview = ({ record }: { record: Rec }) => {
  const template = templates.find(t => t.id === record.tipo) || templates[0];
  const fields = template.fields;

  const audioTarget = record.campi['ideogramma'] || record.campi['nome_principale'] || record.titolo;

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 text-white" style={{ backgroundColor: template.cardColor }}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">
            {template.name}
          </div>
          {audioTarget && (
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
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider flex items-center justify-between">
                <span>{f.label}</span>
                {isAudioField && typeof val === 'string' && val.trim() && (
                  <PronunciationButton
                    text={val}
                    fallbackText={audioTarget}
                    size="xs"
                    variant="inline"
                    title={`Pronuncia per ${f.label}`}
                  />
                )}
              </div>
              <div className="text-stone-800">
                {f.type === 'text' && (
                  <span className={`font-medium ${f.id === 'ideogramma' || f.id === 'ideogrammi' ? 'text-xl tracking-wider font-serif' : ''}`}>
                    {val}
                  </span>
                )}
                {f.type === 'textarea' && <p className="whitespace-pre-wrap leading-relaxed">{val}</p>}
                {f.type === 'number' && <span className="font-mono text-lg">{val}</span>}
                {f.type === 'list' && (
                  <ul className="list-disc list-inside space-y-1">
                    {val.map((item: string, i: number) => (
                      <li key={i} className="text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span>{item}</span>
                          {f.id === 'nomi_secondari' && item && item.trim() && (
                            <PronunciationButton text={item} size="xs" variant="icon" title="Ascolta pronuncia" />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {f.type === 'image' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {val.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-stone-100 block">
                        <img src={url} alt={f.label} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
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
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-stone-50 border-t flex items-center justify-between text-[10px] text-stone-400 font-bold">
        <span>ID: {record.id.slice(0, 8)}</span>
        <span>MODIFICATO: {new Date(record.modificato).toLocaleDateString()}</span>
      </div>
    </div>
  );
};
