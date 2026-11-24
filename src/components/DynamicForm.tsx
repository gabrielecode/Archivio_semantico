import React, { useState, useEffect, useRef } from 'react';
import { Template, FieldDef } from '../types';
import { ListField, ImageField, VideoField, LinkField, SelectField } from './DynamicFormFields';
import { inputCls, Field, Button } from './ui';
import { ChevronLeft, Info, Volume2, Image as ImageIcon, Upload, Plus, X, Loader2 } from 'lucide-react';
import { PronunciationButton } from './PronunciationButton';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  mcc: 'Punti di agopuntura medicina classica',
  mtc: 'Punti di agopuntura medicina tradizionale',
  dietetica: 'Alimenti e proprietà terapeutiche',
  moxibustione: 'Punti e tecniche di moxibustione',
  fitoterapia: 'Erbe, rimedi e formule vegetali',
  guasha: 'Punti e tecniche di guasha',
  oli_essenziali: 'Oli essenziali e uso terapeutico',
  patologie: 'Patologie, costituzioni e sindromi energetiche',
  dizionario: 'Termini e ideogrammi di riferimento',
  testi_classici: 'Brani e citazioni da testi classici',
  dinastie: 'Dinastie e storia della Cina',
  libri: 'Libri, dispense, bibliografia e appunti',
  medici: 'Medici e figure storiche cinesi',
  fisiologia: 'Fisiologia secondo MCC e MTC'
};

const MAX_GALLERY_DIM = 1280;

function readGalleryImage(file: File): Promise<string> {
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
          const scale = Math.min(1, MAX_GALLERY_DIM / Math.max(img.width || 1, img.height || 1));
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

interface DynamicFormProps {
  initialValues?: any;
  templateId?: string;
  onSave: (values: any, template: Template, images?: string[]) => void;
  onAutosave?: (values: any, template: Template, images?: string[]) => boolean | void;
  onCancel: () => void;
  onDirty?: (d: boolean) => void;
}

export const DynamicForm = ({ initialValues = {}, templateId, onSave, onAutosave, onCancel, onDirty }: DynamicFormProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    templates.find(t => t.id === (templateId || initialValues.templateId)) || null
  );
  const [values, setValues] = useState<any>(initialValues.campi || {});
  const [images, setImages] = useState<string[]>(
    Array.isArray(initialValues.images) ? initialValues.images.filter((u: any) => typeof u === 'string' && u.trim() !== '') : []
  );
  const [galleryUrl, setGalleryUrl] = useState('');
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const [autosaveTime, setAutosaveTime] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const valuesRef = useRef<any>(values);
  valuesRef.current = values;
  const imagesRef = useRef<string[]>(images);
  imagesRef.current = images;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutosaveRef = useRef(onAutosave);
  onAutosaveRef.current = onAutosave;
  const isEditing = Boolean(initialValues?.id || Object.keys(initialValues || {}).length > 0);

  const clearAutosaveTimer = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAutosaveTimer();
  }, []);

  useEffect(() => {
    if (templateId) {
      const t = templates.find(t => t.id === templateId);
      if (t) setSelectedTemplate(t);
    }
  }, [templateId]);

  const getDerivedTitle = (vals: any, template: Template) => {
    const titleFieldId =
      template.fields.find(f => f.required && f.type === 'text')?.id ||
      template.fields.find(f => f.id.includes('nome') || f.id.includes('titolo'))?.id ||
      template.fields.find(f => f.type === 'text')?.id;
    return titleFieldId ? String(vals[titleFieldId] ?? '').trim() : String(initialValues?.titolo ?? '').trim();
  };

  const scheduleAutosave = (nextValues: any, nextImages: string[]) => {
    clearAutosaveTimer();
    if (selectedTemplate && onAutosaveRef.current) {
      const derivedTitle = getDerivedTitle(nextValues, selectedTemplate);
      if (derivedTitle) {
        const tmpl = selectedTemplate;
        autosaveTimerRef.current = setTimeout(() => {
          autosaveTimerRef.current = null;
          const res = onAutosaveRef.current?.(nextValues, tmpl, nextImages);
          if (res !== false) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            setAutosaveTime(`${hh}:${mm}`);
            dirtyRef.current = false;
            onDirty?.(false);
          }
        }, 1500);
      }
    }
  };

  const handleFieldChange = (id: string, val: any) => {
    const nextValues = { ...valuesRef.current, [id]: val };
    valuesRef.current = nextValues;
    setValues(nextValues);
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      onDirty?.(true);
    }
    scheduleAutosave(nextValues, imagesRef.current);
  };

  const updateImages = (nextImages: string[]) => {
    imagesRef.current = nextImages;
    setImages(nextImages);
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      onDirty?.(true);
    }
    scheduleAutosave(valuesRef.current, nextImages);
  };

  const handleGalleryFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setGalleryError(null);
    setGalleryUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(fileList).map(readGalleryImage));
      updateImages([...imagesRef.current, ...uploaded]);
    } catch (err: any) {
      setGalleryError(err?.message || 'Errore durante il caricamento delle immagini.');
    } finally {
      setGalleryUploading(false);
      if (galleryFileRef.current) galleryFileRef.current.value = '';
    }
  };

  const handleAddGalleryUrl = () => {
    const trimmed = galleryUrl.trim();
    if (!trimmed) return;
    setGalleryError(null);
    updateImages([...imagesRef.current, trimmed]);
    setGalleryUrl('');
  };

  const handleRemoveGalleryImage = (index: number) => {
    updateImages(imagesRef.current.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    clearAutosaveTimer();
    onSave(values, selectedTemplate, images);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {!templateId && !initialValues.templateId && !selectedTemplate && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Seleziona Tipologia</h2>
              <p className="text-sm text-stone-500">Scegli il modello di scheda da creare</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className="group flex items-center gap-4 bg-white p-4 rounded-2xl border border-stone-200 text-left transition-all hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5"
              >
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm transition-transform group-hover:scale-105" 
                  style={{ backgroundColor: t.cardColor }}
                >
                  {t.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-stone-900 uppercase tracking-tight mb-0.5 truncate">{t.name}</div>
                  <div className="text-sm text-stone-500 line-clamp-1">{TEMPLATE_DESCRIPTIONS[t.id] || t.name}</div>
                </div>
                <div className="text-stone-300 group-hover:text-emerald-500 transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                  <ChevronLeft size={16} className="rotate-180" />
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-center pt-4">
            <Button variant="ghost" onClick={onCancel}>Annulla</Button>
          </div>
        </div>
      )}

      {selectedTemplate && (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
            <div 
              className="px-8 py-6 flex flex-wrap items-center justify-between gap-4 border-b border-stone-100"
              style={{ background: `linear-gradient(to right, ${selectedTemplate.cardColor}08, transparent)` }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" 
                  style={{ backgroundColor: selectedTemplate.cardColor }}
                >
                  {selectedTemplate.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-stone-900 leading-tight">Nuova Scheda</h3>
                    {selectedTemplate.id === 'mcc' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <Volume2 size={12} className="text-blue-600" /> Pronuncia zh-CN
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium opacity-60" style={{ color: selectedTemplate.cardColor }}>{selectedTemplate.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {autosaveTime && (
                  <span className="text-xs font-medium text-stone-500">
                    Salvato automaticamente {autosaveTime}
                  </span>
                )}
                {values['nome_principale'] && (
                  <PronunciationButton
                    text={values['nome_principale']}
                    fallbackText={values['ideogramma']}
                    label={`Pronuncia "${values['nome_principale']}"`}
                    size="sm"
                    variant="inline"
                    showSpeedToggle={true}
                  />
                )}
                {!templateId && !isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => { clearAutosaveTimer(); setSelectedTemplate(null); }}>Cambia Tipo</Button>
                )}
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {selectedTemplate.fields.map((f: FieldDef) => {
                  const isFullWidth = f.type === 'textarea' || f.type === 'list' || f.type === 'image' || f.type === 'video' || (f.id.includes('note') || f.id.includes('descrizione'));
                  
                  return (
                    <div key={f.id} className={isFullWidth ? 'md:col-span-2' : ''}>
                      <Field label={f.label} hint={f.required ? 'Obbligatorio' : undefined}>
                        {f.type === 'text' && (() => {
                          const isPointName = f.id === 'nome_principale' || f.id === 'nome_alimento' || f.id === 'nome_erba' || f.id === 'nome_olio';
                          const isIdeogram = f.id === 'ideogramma' || f.id === 'ideogrammi' || f.id === 'ideogramma_principale';
                          const isPronounce = f.id === 'pronuncia';

                          if (isPointName) {
                            return (
                              <div className="space-y-1.5">
                                <div className="flex gap-2">
                                  <input
                                    className={`${inputCls} flex-1`}
                                    required={f.required}
                                    placeholder="Es. 足三里 oppure Zusanli"
                                    value={values[f.id] || ''}
                                    onChange={(e) => handleFieldChange(f.id, e.target.value)}
                                  />
                                  <PronunciationButton
                                    text={values[f.id]}
                                    fallbackText={values['ideogramma'] || values['pronuncia']}
                                    label="Pronuncia"
                                    size="md"
                                    variant="primary"
                                    showSpeedToggle={true}
                                    title="Ascolta la pronuncia vocale in Cinese Semplificato (zh-CN)"
                                  />
                                </div>
                                <p className="text-sm text-stone-500">
                                  💡 Scrivi il nome del punto in cinese o pinyin e clicca su <strong>Pronuncia</strong> per ascoltare la voce in cinese semplificato.
                                </p>
                              </div>
                            );
                          }

                          if (isIdeogram) {
                            return (
                              <div className="flex gap-2">
                                <input
                                  className={`${inputCls} flex-1`}
                                  required={f.required}
                                  placeholder="Es. 足三里"
                                  value={values[f.id] || ''}
                                  onChange={(e) => handleFieldChange(f.id, e.target.value)}
                                />
                                <PronunciationButton
                                  text={values[f.id]}
                                  fallbackText={values['nome_principale']}
                                  label="Pronuncia"
                                  size="md"
                                  variant="secondary"
                                  showSpeedToggle={true}
                                  title="Ascolta la pronuncia dell'ideogramma"
                                />
                              </div>
                            );
                          }

                          if (isPronounce) {
                            return (
                              <div className="space-y-1.5">
                                <div className="flex gap-2">
                                  <input
                                    className={`${inputCls} flex-1`}
                                    required={f.required}
                                    placeholder="Es. Zú Sān Lǐ"
                                    value={values[f.id] || ''}
                                    onChange={(e) => handleFieldChange(f.id, e.target.value)}
                                  />
                                  <PronunciationButton
                                    text={values[f.id] || values['nome_principale'] || values['ideogramma']}
                                    label="Pronuncia"
                                    size="md"
                                    variant="primary"
                                    showSpeedToggle={true}
                                    title="Ascolta la pronuncia vocale del punto"
                                  />
                                </div>
                                <div className="flex items-center justify-between text-sm text-stone-500">
                                  <span>🔊 Clicca su <strong>Pronuncia</strong> per ascoltare in Cinese Semplificato (zh-CN).</span>
                                  {!values['pronuncia'] && (values['nome_principale'] || values['ideogramma']) && (
                                    <button
                                      type="button"
                                      onClick={() => handleFieldChange('pronuncia', values['nome_principale'] || values['ideogramma'])}
                                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                                    >
                                      Usa "{values['nome_principale'] || values['ideogramma']}"
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <input
                              className={inputCls}
                              required={f.required}
                              value={values[f.id] || ''}
                              onChange={(e) => handleFieldChange(f.id, e.target.value)}
                            />
                          );
                        })()}
                        {f.type === 'textarea' && (
                          <textarea
                            className={`${inputCls} min-h-[120px] resize-y`}
                            required={f.required}
                            value={values[f.id] || ''}
                            onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          />
                        )}
                        {f.type === 'number' && (
                          <input
                            type="number"
                            className={inputCls}
                            required={f.required}
                            value={values[f.id] || ''}
                            onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          />
                        )}
                        {f.type === 'list' && (
                          <ListField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'image' && (
                          <ImageField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'video' && (
                          <VideoField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'link' && (
                          <LinkField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'select' && (
                          <SelectField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            options={f.options}
                            multi={f.multi}
                          />
                        )}
                      </Field>
                    </div>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-stone-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={18} className="text-stone-500" />
                    <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wide">Galleria Immagini ({images.length})</h4>
                  </div>
                  <input
                    ref={galleryFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleGalleryFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    disabled={galleryUploading}
                    onClick={() => galleryFileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors disabled:opacity-50"
                  >
                    {galleryUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {galleryUploading ? 'Caricamento...' : 'Carica foto'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={galleryUrl}
                    onChange={(e) => setGalleryUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddGalleryUrl();
                      }
                    }}
                    placeholder="Incolla URL immagine (https://...)"
                    className={`${inputCls} flex-1`}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddGalleryUrl}
                    disabled={!galleryUrl.trim()}
                    icon={Plus}
                    className="sm:w-auto"
                  >
                    Aggiungi URL
                  </Button>
                </div>

                {galleryError && <p className="text-xs font-medium text-red-600">{galleryError}</p>}

                {images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((src, idx) => (
                      <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden border border-stone-200 bg-stone-50">
                        <img src={src} alt={`Immagine galleria ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(idx)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-stone-900/75 text-white hover:bg-red-600 transition-colors shadow-sm"
                          title="Rimuovi foto"
                          aria-label={`Rimuovi immagine ${idx + 1}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">Nessuna immagine nella galleria di questa scheda.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pb-12">
            <Button variant="ghost" onClick={onCancel} className="w-full sm:w-auto px-8">
              Annulla
            </Button>
            <Button 
              type="submit" 
              size="lg"
              className="w-full sm:w-auto px-12"
              style={{ backgroundColor: selectedTemplate.cardColor }}
            >
              Salva Scheda
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

