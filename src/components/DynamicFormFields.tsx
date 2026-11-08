import React from 'react';
import { Plus, X, Image as ImageIcon, Video, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { inputCls } from './ui';

export const ListField = ({ value = [], onChange, fieldColor }: any) => {
  const add = () => onChange([...value, '']);
  const remove = (index: number) => onChange(value.filter((_: any, i: number) => i !== index));
  const update = (index: number, val: string) => {
    const next = [...value];
    next[index] = val;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.map((item: string, i: number) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputCls}
            value={item}
            onChange={(e) => update(i, e.target.value)}
            style={{ borderLeftColor: fieldColor, borderLeftWidth: item ? '4px' : '1px' }}
          />
          <button type="button" onClick={() => remove(i)} className="p-2 text-red-500 hover:bg-red-50 rounded">
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <Plus size={16} /> Aggiungi elemento
      </button>
    </div>
  );
};

export const ImageField = ({ value = [], onChange, fieldColor }: any) => {
  const add = () => onChange([...value, '']);
  const remove = (index: number) => onChange(value.filter((_: any, i: number) => i !== index));
  const update = (index: number, val: string) => {
    const next = [...value];
    next[index] = val;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((url: string, i: number) => (
        <div key={i} className="space-y-2 p-3 border rounded-lg bg-stone-50">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                className={`${inputCls} pl-10`}
                placeholder="URL Immagine"
                value={url}
                onChange={(e) => update(i, e.target.value)}
              />
            </div>
            <button type="button" onClick={() => remove(i)} className="p-2 text-red-500 hover:bg-red-50 rounded">
              <X size={16} />
            </button>
          </div>
          {url && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-white border">
              <img src={url} alt="Preview" className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <Plus size={16} /> Aggiungi immagine
      </button>
    </div>
  );
};

export const VideoField = ({ value, onChange, fieldColor }: any) => {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
        <input
          className={`${inputCls} pl-10`}
          placeholder="URL Video (YouTube, Vimeo, etc.)"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {value && (
        <div className="p-2 bg-stone-100 rounded-lg text-xs text-stone-500 flex items-center gap-2">
          <Video size={12} /> Preview video non disponibile in edit
        </div>
      )}
    </div>
  );
};

export const LinkField = ({ value, onChange, fieldColor }: any) => {
  return (
    <div className="relative">
      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
      <input
        className={`${inputCls} pl-10`}
        placeholder="https://..."
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export const SelectField = ({ value, onChange, options = [], multi }: any) => {
  if (multi) {
    const selected = Array.isArray(value) ? value : (value ? [value] : []);
    const toggle = (opt: string) => {
      if (selected.includes(opt)) onChange(selected.filter((s: string) => s !== opt));
      else onChange([...selected, opt]);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt: string) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              selected.includes(opt)
                ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        className={`${inputCls} appearance-none pr-10`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seleziona...</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
    </div>
  );
};
