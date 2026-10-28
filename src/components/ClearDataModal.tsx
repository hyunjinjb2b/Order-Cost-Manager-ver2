import React, { useState } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Building,
  CreditCard,
  CheckSquare,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';

export interface ClearDataTargets {
  trainings: boolean;
  invoices: boolean;
  deposits: boolean;
  userEditsAndExpenses: boolean;
  companyMappings: boolean;
  depositorMappings: boolean;
}

export interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainingsCount: number;
  invoicesCount: number;
  depositsCount: number;
  companyMappingsCount: number;
  depositorMappingsCount: number;
  hasUserEdits: boolean;
  hasExpenseChecks: boolean;
  onExecuteClear: (targets: ClearDataTargets) => void;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  trainingsCount,
  invoicesCount,
  depositsCount,
  companyMappingsCount,
  depositorMappingsCount,
  hasUserEdits,
  hasExpenseChecks,
  onExecuteClear,
}) => {
  if (!isOpen) return null;

  // 초기화 모드 프리셋: 'sources_only' (3대 원본만) | 'all' (전체) | 'custom' (직접 선택)
  const [preset, setPreset] = useState<'sources_only' | 'all' | 'custom'>('sources_only');

  const [targets, setTargets] = useState<ClearDataTargets>({
    trainings: true,
    invoices: true,
    deposits: true,
    userEditsAndExpenses: true,
    companyMappings: false,
    depositorMappings: false,
  });

  const handleSelectPreset = (mode: 'sources_only' | 'all' | 'custom') => {
    setPreset(mode);
    if (mode === 'sources_only') {
      setTargets({
        trainings: true,
        invoices: true,
        deposits: true,
        userEditsAndExpenses: true,
        companyMappings: false,
        depositorMappings: false,
      });
    } else if (mode === 'all') {
      setTargets({
        trainings: true,
        invoices: true,
        deposits: true,
        userEditsAndExpenses: true,
        companyMappings: true,
        depositorMappings: true,
      });
    }
  };

  const toggleTarget = (key: keyof ClearDataTargets) => {
    setPreset('custom');
    setTargets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedCount = Object.values(targets).filter(Boolean).length;

  const handleConfirm = () => {
    if (selectedCount === 0) {
      return;
    }
    onExecuteClear(targets);
    onClose();
  };

  return (
    <div
      id="clear-data-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>저장 데이터 초기화</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  데이터 관리
                </span>
              </h3>
              <p className="text-xs text-slate-600">
                브라우저에 보존된 원본 데이터 및 매핑 사전을 안전하게 초기화합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
          {/* 프리셋 선택 버튼 그룹 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">초기화 방식 선택</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('sources_only')}
                className={`p-3 rounded-xl border text-left transition ${
                  preset === 'sources_only'
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">3대 원본만 비우기</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-600 text-white">
                    추천
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  훈련/계산서/입금 데이터 비움 (사전은 보존)
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className={`p-3 rounded-xl border text-left transition ${
                  preset === 'all'
                    ? 'bg-rose-50/80 border-rose-500 ring-1 ring-rose-500 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-rose-700">전체 초기화</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white">
                    전체
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  매핑 사전까지 모두 완전 삭제
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPreset('custom')}
                className={`p-3 rounded-xl border text-left transition ${
                  preset === 'custom'
                    ? 'bg-purple-50/80 border-purple-500 ring-1 ring-purple-500 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-purple-700">항목별 선택</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  초기화할 항목을 직접 체크
                </p>
              </button>
            </div>
          </div>

          {/* 대상 항목 체크박스 리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">초기화 대상 항목 목록</label>
              <span className="text-[11px] text-slate-500 font-medium">
                선택됨: <strong className="text-rose-600">{selectedCount}</strong> / 6개
              </span>
            </div>

            <div className="space-y-1.5">
              {/* 1. 훈련내역 */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  targets.trainings
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={targets.trainings}
                    onChange={() => toggleTarget('trainings')}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">1. 훈련내역 원본</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {trainingsCount}행
                </span>
              </label>

              {/* 2. 계산서발행내역 */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  targets.invoices
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={targets.invoices}
                    onChange={() => toggleTarget('invoices')}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">2. 계산서발행내역</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {invoicesCount}건
                </span>
              </label>

              {/* 3. 통장 입금내역 */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  targets.deposits
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={targets.deposits}
                    onChange={() => toggleTarget('deposits')}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">3. 입금내역 (통장)</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {depositsCount}건
                </span>
              </label>

              {/* 4. 비용신청 체크박스 및 사용자 수동 수정 메모 */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  targets.userEditsAndExpenses
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={targets.userEditsAndExpenses}
                    onChange={() => toggleTarget('userEditsAndExpenses')}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-900">
                      비용신청 체크박스 & 수동 수정 메모
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {hasExpenseChecks || hasUserEdits ? '저장된 내용 있음' : '없음'}
                </span>
              </label>

              {/* 5. 거래처 매핑 사전 */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  targets.companyMappings
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={targets.companyMappings}
                    onChange={() => toggleTarget('companyMappings')}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">거래처 매핑 사전 (사업장명↔거래처코드)</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {companyMappingsCount}개
                </span>
              </label>

              {/* 6. 입금자 매핑 사전 */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  targets.depositorMappings
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={targets.depositorMappings}
                    onChange={() => toggleTarget('depositorMappings')}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-900">입금자 매핑 사전 (입금자명↔거래처코드)</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {depositorMappingsCount}개
                </span>
              </label>
            </div>
          </div>

          {/* 주의 안내 배너 */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">초기화 시 유의사항</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                초기화된 데이터는 즉시 삭제됩니다. 언제든지 <strong>[공용폴더 원본 새로고침]</strong> 또는 <strong>[엑셀 파일 업로드]</strong>를 통해 최신 데이터를 다시 불러올 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 모달 하단 버튼 바 */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-2xs"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-xl shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>선택한 데이터 초기화 실행</span>
          </button>
        </div>
      </div>
    </div>
  );
};
