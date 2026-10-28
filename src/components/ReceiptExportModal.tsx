import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Download,
  Eye,
  FileText,
  ImagePlus,
  Search,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { IntegratedDataRow } from '../types';
import {
  buildReceiptHtml,
  DEFAULT_RECEIPT_SETTINGS,
  groupReceiptRows,
  isReceiptEligible,
  ReceiptGroup,
  ReceiptSettings,
} from '../utils/receiptDocument';

interface ReceiptExportModalProps {
  isOpen: boolean;
  data: IntegratedDataRow[];
  initialGroupKey?: string | null;
  onClose: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onExported?: (rowIds: string[]) => void;
}

const SETTINGS_KEY = 'hrd_sync_receipt_settings_v1';
const LEGACY_DEFAULT_STAMP_LENGTH = 2574310;
const LEGACY_DEFAULT_STAMP_FNV1A = 0x3f1a0a80;

const isLegacyDefaultStamp = (value: string) => {
  if (value.length !== LEGACY_DEFAULT_STAMP_LENGTH) return false;

  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0) === LEGACY_DEFAULT_STAMP_FNV1A;
};

const loadSettings = (): ReceiptSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_RECEIPT_SETTINGS;
    const parsed = JSON.parse(saved) as Partial<ReceiptSettings>;
    return {
      ...DEFAULT_RECEIPT_SETTINGS,
      ...parsed,
      stampDataUrl: !parsed.stampDataUrl || isLegacyDefaultStamp(parsed.stampDataUrl)
        ? DEFAULT_RECEIPT_SETTINGS.stampDataUrl
        : parsed.stampDataUrl,
    };
  } catch {
    return DEFAULT_RECEIPT_SETTINGS;
  }
};

const printHtml = (html: string) => new Promise<void>((resolve) => {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.opacity = '0';
  frame.setAttribute('aria-hidden', 'true');
  frame.srcdoc = html;
  document.body.appendChild(frame);
  frame.onload = () => {
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      resolve();
      window.setTimeout(() => frame.remove(), 1500);
    }, 250);
  };
});

const combineHtmlForPrint = (documents: string[]) => {
  const parser = new DOMParser();
  const parsed = documents.map((html) => parser.parseFromString(html, 'text/html'));
  const style = parsed[0]?.head.querySelector('style')?.textContent || '';
  const pages = parsed
    .map((doc, index) => {
      const page = doc.body.querySelector('.page')?.outerHTML || doc.body.innerHTML;
      return `<div class="receipt-batch-page ${index < parsed.length - 1 ? 'has-next' : ''}">${page}</div>`;
    })
    .join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${style}
    .receipt-batch-page.has-next { break-after: page; page-break-after: always; }
  </style></head><body>${pages}</body></html>`;
};

export const ReceiptExportModal: React.FC<ReceiptExportModalProps> = ({
  isOpen,
  data,
  initialGroupKey,
  onClose,
  onShowToast,
  onExported,
}) => {
  const groups = useMemo(() => groupReceiptRows(data), [data]);
  const partialExcludedCount = useMemo(
    () => data.filter((row) => Boolean((row.depositDate || '').trim()) && !isReceiptEligible(row)).length,
    [data]
  );
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ReceiptSettings>(loadSettings);
  const [saving, setSaving] = useState(false);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) =>
      [group.companyName, group.round, ...group.rows.flatMap((row) => [row.courseName, row.claimMonth])]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [groups, search]);

  const previewGroup = groups.find((group) => group.key === previewKey) || groups[0] || null;
  const previewHtml = previewGroup ? buildReceiptHtml(previewGroup, settings) : '';

  useEffect(() => {
    if (!isOpen) return;
    const initial = initialGroupKey && groups.some((group) => group.key === initialGroupKey)
      ? initialGroupKey
      : groups[0]?.key || null;
    setPreviewKey(initial);
    setSelectedKeys(initialGroupKey && initial ? new Set([initial]) : new Set());
    setSearch('');
  }, [isOpen, initialGroupKey, groups]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  if (!isOpen) return null;

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allFilteredSelected = filteredGroups.length > 0 && filteredGroups.every((group) => selectedKeys.has(group.key));
  const toggleAllFiltered = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredGroups.forEach((group) => next.delete(group.key));
      else filteredGroups.forEach((group) => next.add(group.key));
      return next;
    });
  };

  const saveOne = async (group: ReceiptGroup) => {
    const html = buildReceiptHtml(group, settings);
    try {
      setSaving(true);
      if (window.receiptPdf) {
        const result = await window.receiptPdf.saveOne({fileName: group.fileName, html});
        if (result.saved) {
          onExported?.(group.rows.map((row) => row.id));
          onShowToast?.(`${group.fileName} 저장을 완료했습니다.`, 'success');
        }
      } else {
        await printHtml(html);
        onExported?.(group.rows.map((row) => row.id));
        onShowToast?.('인쇄 창에서 대상 항목을 PDF로 저장해주세요.', 'info');
      }
    } catch (error) {
      onShowToast?.(`PDF 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async () => {
    const selected = groups.filter((group) => selectedKeys.has(group.key));
    if (selected.length === 0) {
      onShowToast?.('출력할 수납확인서를 선택해주세요.', 'info');
      return;
    }

    const documents = selected.map((group) => ({
      fileName: group.fileName,
      html: buildReceiptHtml(group, settings),
    }));

    try {
      setSaving(true);
      if (window.receiptPdf) {
        const result = await window.receiptPdf.saveMany({documents});
        if (result.saved) {
          onExported?.(selected.flatMap((group) => group.rows.map((row) => row.id)));
          onShowToast?.(`수납확인서 ${result.count || selected.length}건을 저장했습니다.`, 'success');
        }
      } else {
        await printHtml(combineHtmlForPrint(documents.map((document) => document.html)));
        onExported?.(selected.flatMap((group) => group.rows.map((row) => row.id)));
        onShowToast?.('인쇄 창에서 선택한 문서를 하나의 PDF로 저장해주세요.', 'info');
      }
    } catch (error) {
      onShowToast?.(`PDF 일괄 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof ReceiptSettings, value: string) => {
    setSettings((current) => ({...current, [key]: value}));
  };

  const handleStampUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast?.('직인은 이미지 파일을 선택해주세요.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateSetting('stampDataUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center" onClick={onClose}>
      <div
        id="receipt-export-modal"
        className="w-full max-w-[1500px] h-[92vh] bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">수납확인서 출력 관리</h2>
              <p className="text-[11px] text-slate-500">수금일자가 확인된 사업장·회차별 확인서를 미리보고 PDF로 저장합니다.</p>
            </div>
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              출력 가능 {groups.length}건
            </span>
            {partialExcludedCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                부분입금 제외 {partialExcludedCount}건
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                settingsOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> 기본 설정
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {settingsOpen && (
          <section className="px-5 py-3 bg-slate-800 text-white border-b border-slate-700 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
            <label className="col-span-2 text-[10px] text-slate-300">주소
              <input value={settings.address} onChange={(e) => updateSetting('address', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-300">전화번호
              <input value={settings.tel} onChange={(e) => updateSetting('tel', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-300">팩스
              <input value={settings.fax} onChange={(e) => updateSetting('fax', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-300">담당자
              <input value={settings.contact} onChange={(e) => updateSetting('contact', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-300">발행자
              <input value={settings.issuer} onChange={(e) => updateSetting('issuer', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-300">고용 여부
              <input value={settings.employmentLabel} onChange={(e) => updateSetting('employmentLabel', e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white" />
            </label>
            <div className="text-[10px] text-slate-300">직인 이미지
              <input ref={stampInputRef} type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
              <button type="button" onClick={() => stampInputRef.current?.click()} className="mt-1 w-full px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-xs text-white inline-flex items-center justify-center gap-1">
                <ImagePlus className="w-3.5 h-3.5" /> {settings.stampDataUrl ? '직인 변경' : '직인 등록'}
              </button>
            </div>
          </section>
        )}

        <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[440px_1fr]">
          <section className="min-h-0 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="사업장명, 과정명, 회차, 월 검색"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <button type="button" onClick={toggleAllFiltered} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-blue-700">
                {allFilteredSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5" />}
                검색 결과 전체 선택 ({filteredGroups.length})
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
              {filteredGroups.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">출력 가능한 수납확인서가 없습니다.</div>
              ) : filteredGroups.map((group) => {
                const selected = selectedKeys.has(group.key);
                const active = previewGroup?.key === group.key;
                return (
                  <div key={group.key} className={`rounded-xl border p-2.5 transition ${active ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => toggleSelected(group.key)} className="mt-0.5 shrink-0" aria-label="선택">
                        {selected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </button>
                      <button type="button" onClick={() => setPreviewKey(group.key)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-xs text-slate-900">{group.companyName}</strong>
                          <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600">{group.round}</span>
                        </div>
                        <p className="mt-1 text-[10.5px] text-slate-500 truncate">{group.rows.map((row) => row.courseName).join(', ')}</p>
                        <p className="mt-1 text-[10px] text-slate-400">수금 {group.latestDepositDate} · {group.rows.length}개 과정</p>
                      </button>
                      <button type="button" onClick={() => setPreviewKey(group.key)} className="p-1.5 self-center rounded-lg text-slate-400 hover:bg-white hover:text-blue-600" title="미리보기">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="min-h-0 flex flex-col bg-slate-200/70">
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="text-xs text-slate-800">PDF 미리보기</strong>
                <span className="ml-2 text-[10.5px] text-slate-500">{previewGroup?.fileName || '-'}</span>
              </div>
              {previewGroup && (
                <button type="button" disabled={saving} onClick={() => saveOne(previewGroup)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> 이 확인서 PDF 저장
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 p-3 flex items-start justify-center overflow-auto">
              {previewGroup ? (
                <iframe title="수납확인서 미리보기" srcDoc={previewHtml} className="bg-white border-0 shadow-xl w-full aspect-[1.414/1] max-w-[1050px]" />
              ) : (
                <div className="m-auto text-sm text-slate-500">미리볼 문서가 없습니다.</div>
              )}
            </div>
          </section>
        </div>

        <footer className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-[10.5px] text-slate-500">
            동일 사업장·동일 회차는 한 문서로 묶이며, 교육비는 총교육비 ÷ 인원으로 계산됩니다.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">닫기</button>
            <button type="button" disabled={saving || selectedKeys.size === 0} onClick={saveSelected} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-40">
              <Download className="w-4 h-4" /> 선택한 확인서 저장 ({selectedKeys.size})
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
