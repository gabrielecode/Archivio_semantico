import React, { useRef, useState } from 'react';
import { Plus, X, Image as ImageIcon, Video, Link as LinkIcon, ChevronDown, Upload, Loader2 } from 'lucide-react';
import { inputCls } from './ui';
import { PronunciationButton } from './PronunciationButton';

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
        <div key={i} className="flex items-center gap-2">
          <input
            className={inputCls}
            value={item}
            onChange={(e) => update(i, e.target.value)}
            style={{ borderLeftColor: fieldColor, borderLeftWidth: item ? '4px' : '1px' }}
          />
          {item && item.trim() && (
            <PronunciationButton
              text={item}
              size="xs"
              variant="icon"
              title="Ascolta pronuncia elemento in cinese"
            />
          )}
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

const MAX_IMAGE_DIM = 1280;

function readAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`Il file "${file.name}" non è un'immagine valida.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Impossibile leggere "${file.name}".`));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const outType = file.type === 'image/png' && file.size < 300_000 ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(outType, 0.82));
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ImageField = ({ value = [], onChange, fieldColor }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items: string[] = Array.isArray(value)
    ? value
    : typeof value === 'string' && value
      ? [value]
      : [];

  const addUrl = () => onChange([...items, '']);
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const update = (index: number, val: string) => {
    const next = [...items];
    next[index] = val;
    onChange(next);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const files = Array.from(fileList);
      const compressed = await Promise.all(files.map(readAndCompressImage));
      const cleaned = items.filter((v) => v !== '');
      onChange([...cleaned, ...compressed]);
    } catch (err: any) {
      setError(err?.message || 'Errore durante il caricamento della foto.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((url: string, i: number) => {
            const isUploaded = url.startsWith('data:image/');
            return (
              <div
                key={i}
                className="space-y-2 p-3 border rounded-xl bg-stone-50"
                style={{ borderLeftColor: url ? fieldColor : undefined, borderLeftWidth: url ? '3px' : undefined }}
              >
                {isUploaded ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-stone-500" />
                      Foto caricata #{i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Rimuovi foto"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                      <input
                        className={`${inputCls} pl-10`}
                        placeholder="URL Immagine (https://...)"
                        value={url}
                        onChange={(e) => update(i, e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Rimuovi immagine"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {url && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-white border border-stone-200">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-dashed transition-colors ${
          dragOver ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-300 bg-stone-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-50 shadow-xs disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Caricamento...' : 'Carica foto'}
          </button>
          <button
            type="button"
            onClick={addUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            <Plus size={16} /> Aggiungi da URL
          </button>
        </div>
        <span className="text-xs text-stone-400">oppure trascina qui le foto</span>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
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
