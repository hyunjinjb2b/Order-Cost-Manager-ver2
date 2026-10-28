import React, { useState, useMemo } from 'react';
import {
  DepositInvoiceMatchItem,
  InvoiceDepositMatchItem,
  CompanyMapping,
  DepositorMapping,
  InvoiceRecord,
  DepositRecord,
} from '../types';
import {
  X,
  Link2,
  Building,
  CreditCard,
  FileSpreadsheet,
  Search,
  Check,
  Calendar,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Info,
  Plus,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { normalizeName } from '../utils/mappingEngine';

export interface DepositManualMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDepositMatch: DepositInvoiceMatchItem | null;
  targetInvoiceMatch?: InvoiceDepositMatchItem | null;
  companyMappings: CompanyMapping[];
  depositorMappings: DepositorMapping[];
  invoices: InvoiceRecord[];
  deposits: DepositRecord[];
  onAddCompanyMapping: (newMapping: CompanyMapping) => void;
  onAddDepositorMapping: (newMapping: DepositorMapping) => void;
  onSuccessToast?: (msg: string) => void;
}

export const DepositManualMappingModal: React.FC<DepositManualMappingModalProps> = ({
  isOpen,
  onClose,
  targetDepositMatch,
  targetInvoiceMatch,
  companyMappings,
  depositorMappings,
  invoices,
  deposits,
  onAddCompanyMapping,
  onAddDepositorMapping,
  onSuccessToast,
}) => {
  if (!isOpen || (!targetDepositMatch && !targetInvoiceMatch)) return null;

  // 대상이 통장 입금인지, 세금계산서인지 판별
  const isDepositTarget = !!targetDepositMatch;

  // 탭 상태: 'dictionary' (매핑 사전에서 선택) | 'invoice' (계산서에서 선택) | 'custom' (신규 사전 직접 입력 등록)
  const [activeTab, setActiveTab] = useState<'dictionary' | 'invoice' | 'custom'>('dictionary');
  const [validationError, setValidationError] = useState<string | null>(null);

  // 검색어 상태
  const [companySearch, setCompanySearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // 선택된 매핑 정보
  const [selectedCompany, setSelectedCompany] = useState<CompanyMapping | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  // 직접 등록 폼 상태
  const [customForm, setCustomForm] = useState({
    customerCode: '',
    companyName: targetDepositMatch?.depositorName || targetInvoiceMatch?.customerName || '',
    accountingName: targetDepositMatch?.depositorName || targetInvoiceMatch?.customerName || '',
    businessNumber: targetInvoiceMatch?.businessNumber || '',
    depositorName: targetDepositMatch?.depositorName || '',
  });

  // 입금자명 정규화 (추천 알고리즘용)
  const targetDepositorName = targetDepositMatch?.depositorName || '';
  const targetAmount = targetDepositMatch?.depositAmount || targetInvoiceMatch?.totalAmount || 0;
  const normDepositor = useMemo(() => normalizeName(targetDepositorName), [targetDepositorName]);

  // 1. 거래처 사전 (CompanyMappings) 검색 및 추천 스코어링
  const scoredCompanies = useMemo(() => {
    return companyMappings.map((cm) => {
      const normCm = normalizeName(cm.companyName || '');
      const normAcc = normalizeName(cm.accountingName || '');

      // 입금자 사전(DepositorMapping)에 등록된 적이 있는지 확인
      const hasDepositorMapping = depositorMappings.some(
        (dm) =>
          dm.customerCode === cm.customerCode &&
          normalizeName(dm.depositorName) === normDepositor
      );

      let score = 0;
      let reason = '';

      if (hasDepositorMapping) {
        score = 100;
        reason = '입금자 사전에 등록된 거래처';
      } else if (normCm === normDepositor || normAcc === normDepositor) {
        score = 95;
        reason = '사업장명/회계명 100% 일치';
      } else if (
        (normCm.length >= 2 && normDepositor.includes(normCm)) ||
        (normDepositor.length >= 2 && normCm.includes(normDepositor))
      ) {
        score = 75;
        reason = '사업장명 키워드 부분 일치';
      } else if (
        (normAcc.length >= 2 && normDepositor.includes(normAcc)) ||
        (normDepositor.length >= 2 && normAcc.includes(normDepositor))
      ) {
        score = 70;
        reason = '회계명 키워드 부분 일치';
      }

      return {
        ...cm,
        score,
        reason,
      };
    });
  }, [companyMappings, depositorMappings, normDepositor]);

  // 거래처 사전 필터링 & 정렬
  const filteredCompanies = useMemo(() => {
    let list = scoredCompanies;
    if (companySearch.trim()) {
      const q = companySearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          c.accountingName.toLowerCase().includes(q) ||
          c.customerCode.toLowerCase().includes(q) ||
          c.businessNumber.includes(q)
      );
    }
    return [...list].sort((a, b) => b.score - a.score);
  }, [scoredCompanies, companySearch]);

  // 2. 세금계산서 (Invoices) 검색 및 추천 스코어링
  const scoredInvoices = useMemo(() => {
    return invoices.map((inv) => {
      const normInvName = normalizeName(inv.customerName || '');
      const isAmountExact = inv.totalAmount === targetAmount;
      const isNameExact = normInvName === normDepositor && normDepositor.length > 0;
      const isNamePartial =
        (normInvName.length >= 2 && normDepositor.includes(normInvName)) ||
        (normDepositor.length >= 2 && normInvName.includes(normDepositor));

      let score = 0;
      const reasons: string[] = [];

      if (isAmountExact) {
        score += 60;
        reasons.push('금액 100% 일치');
      }
      if (isNameExact) {
        score += 40;
        reasons.push('거래처명 일치');
      } else if (isNamePartial) {
        score += 25;
        reasons.push('거래처명 유사');
      }

      return {
        ...inv,
        score,
        reason: reasons.join(' + '),
      };
    });
  }, [invoices, targetAmount, normDepositor]);

  // 세금계산서 필터링 & 정렬
  const filteredInvoices = useMemo(() => {
    let list = scoredInvoices;
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.trim().toLowerCase();
      list = list.filter(
        (inv) =>
          inv.customerName.toLowerCase().includes(q) ||
          inv.businessNumber.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')) ||
          (inv.approvalNumber && inv.approvalNumber.toLowerCase().includes(q)) ||
          (inv.customerCode && inv.customerCode.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => b.score - a.score);
  }, [scoredInvoices, invoiceSearch]);

  // 적용 실행
  const handleApply = () => {
    setValidationError(null);
    if (isDepositTarget && targetDepositMatch) {
      const depName = targetDepositMatch.depositorName;

      if (activeTab === 'dictionary') {
        if (!selectedCompany) {
          setValidationError('연결할 거래처 사전 항목을 목록에서 선택해주세요.');
          return;
        }

        // 1. 입금자명 -> 선택된 거래처코드로 입금자 사전에 추가
        onAddDepositorMapping({
          depositorName: depName,
          customerCode: selectedCompany.customerCode,
          accountingName: selectedCompany.accountingName || selectedCompany.companyName,
          category: '수동 매핑',
          note: `수동 연결: ${selectedCompany.companyName}`,
        });

        if (onSuccessToast) {
          onSuccessToast(
            `✅ 입금자 '${depName}' ➔ 거래처 '${selectedCompany.companyName}' (${selectedCompany.customerCode}) 매핑 사전에 연결되었습니다!`
          );
        }
      } else if (activeTab === 'invoice') {
        if (!selectedInvoice) {
          setValidationError('연결할 세금계산서를 목록에서 선택해주세요.');
          return;
        }

        // 계산서에 거래처코드가 있으면 입금자 사전에 추가
        const custCode = selectedInvoice.customerCode || selectedInvoice.customerName;
        onAddDepositorMapping({
          depositorName: depName,
          customerCode: custCode,
          accountingName: selectedInvoice.customerName,
          category: '수동 매핑',
          note: `계산서 수동 연결: ${selectedInvoice.customerName}`,
        });

        // 거래처 사전에도 등록 보완
        if (selectedInvoice.customerName) {
          onAddCompanyMapping({
            companyName: selectedInvoice.customerName,
            customerCode: custCode,
            accountingName: selectedInvoice.customerName,
            businessNumber: selectedInvoice.businessNumber || '',
          });
        }

        if (onSuccessToast) {
          onSuccessToast(
            `✅ 입금자 '${depName}' ➔ 계산서 '${selectedInvoice.customerName}' (${custCode}) 강제 연결 완료!`
          );
        }
      } else if (activeTab === 'custom') {
        if (!customForm.customerCode.trim() || !customForm.companyName.trim()) {
          setValidationError('거래처코드와 사업장명은 필수 입력 항목입니다.');
          return;
        }

        // 1. 거래처 사전 등록
        onAddCompanyMapping({
          companyName: customForm.companyName.trim(),
          customerCode: customForm.customerCode.trim(),
          accountingName: customForm.accountingName.trim() || customForm.companyName.trim(),
          businessNumber: customForm.businessNumber.trim(),
        });

        // 2. 입금자 사전 등록
        onAddDepositorMapping({
          depositorName: customForm.depositorName.trim() || depName,
          customerCode: customForm.customerCode.trim(),
          accountingName: customForm.accountingName.trim() || customForm.companyName.trim(),
          category: '수동 매핑',
          note: `신규 거래처 수동 연결: ${customForm.companyName.trim()}`,
        });

        if (onSuccessToast) {
          onSuccessToast(
            `✅ 신규 거래처 '${customForm.companyName}' (${customForm.customerCode}) 등록 및 입금자 연결 완료!`
          );
        }
      }
    }

    onClose();
  };

  return (
    <div
      id="deposit-manual-mapping-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>입금-계산서 수동 매핑 사전 연결</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  미매핑 강제 해결
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                식별되지 않은 입금 내역을 거래처 사전 또는 세금계산서와 강제 매칭하여 자동 대조를 완료합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 대상 항목 정보 요약 배너 */}
        <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {targetDepositMatch && (
            <>
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-white text-slate-700 font-mono text-xs flex items-center justify-center font-bold border border-slate-200 shadow-2xs">
                  {targetDepositMatch.depositIndex}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500">대상 입금자명:</span>
                    <strong className="text-slate-900 font-bold text-xs bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                      {targetDepositMatch.depositorName}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      ({targetDepositMatch.dealDate} {targetDepositMatch.dealTime})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    현재 상태: <span className="text-rose-600 font-semibold">{targetDepositMatch.matchType}</span>
                    <span className="text-slate-300 mx-1.5">•</span>
                    {targetDepositMatch.explanation}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10.5px] text-slate-400 block">입금 금액</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  {targetDepositMatch.depositAmount.toLocaleString()}원
                </span>
              </div>
            </>
          )}
        </div>

        {/* 탭 네비게이션 */}
        <div className="px-5 pt-2.5 pb-2 bg-white border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'dictionary'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-blue-600" />
            <span>🏢 거래처 사전에서 선택 ({companyMappings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'invoice'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>📄 세금계산서 강제 매칭 ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'custom'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>➕ 신규 사전 직접 등록</span>
          </button>
        </div>

        {/* 탭 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          {validationError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{validationError}</span>
              </div>
              <button
                onClick={() => setValidationError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}
          {/* ========================================================================= */}
          {/* [탭 1] 거래처 사전에서 선택 연결                                         */}
          {/* ========================================================================= */}
          {activeTab === 'dictionary' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="사전 내 거래처명, 회계프로그램명, 거래처코드, 사업자번호 검색..."
                    className="w-full pl-8.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                  {companySearch && (
                    <button
                      onClick={() => setCompanySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 안내 문구 */}
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span>
                    아래 목록에서 이 입금건과 매칭되는 거래처를 선택하세요. 상호 유사도 및 사전 일치 여부에 따라{' '}
                    <strong>추천 거래처</strong>가 상단에 표시됩니다.
                  </span>
                </div>
              </div>

              {/* 거래처 목록 카드 리스트 */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                {filteredCompanies.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs">일치하는 거래처 사전 내역이 없습니다.</p>
                    <button
                      onClick={() => setActiveTab('custom')}
                      className="mt-2 text-xs text-blue-600 hover:underline font-semibold"
                    >
                      + [신규 매핑 사전 즉시 등록] 탭에서 새로 등록하기
                    </button>
                  </div>
                ) : (
                  filteredCompanies.map((cm, idx) => {
                    const isSelected = selectedCompany?.customerCode === cm.customerCode && selectedCompany?.companyName === cm.companyName;
                    const isTopRecommended = cm.score >= 70;

                    return (
                      <div
                        key={`${cm.customerCode}-${cm.companyName}-${idx}`}
                        onClick={() => setSelectedCompany(cm)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 shadow-2xs'
                            : isTopRecommended
                            ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                          </div>

                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900 text-xs">
                                {cm.companyName}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">
                                {cm.customerCode}
                              </span>
                              {cm.accountingName && cm.accountingName !== cm.companyName && (
                                <span className="text-[10.5px] text-slate-500">
                                  (회계명: {cm.accountingName})
                                </span>
                              )}
                              {isTopRecommended && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-200 flex items-center space-x-0.5">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                                  <span>{cm.reason || '추천 매칭'}</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              <span>사업자번호: {cm.businessNumber || '미기재'}</span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-xs font-bold text-blue-600 flex items-center space-x-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>선택됨</span>
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* [탭 2] 세금계산서 직접 강제 매칭                                         */}
          {/* ========================================================================= */}
          {activeTab === 'invoice' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="계산서 거래처명, 사업자번호, 승인번호, 공급가액 검색..."
                    className="w-full pl-8.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                  {invoiceSearch && (
                    <button
                      onClick={() => setInvoiceSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 안내 문구 */}
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 flex items-start space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span>
                    발행된 세금계산서 중 이 입금 건에 해당하는 계산서를 선택하세요. 입금 금액({targetAmount.toLocaleString()}원)과
                    일치하는 계산서가 상단에 우선 추천됩니다.
                  </span>
                </div>
              </div>

              {/* 계산서 목록 */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                {filteredInvoices.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs">일치하는 세금계산서 내역이 없습니다.</p>
                  </div>
                ) : (
                  filteredInvoices.map((inv, idx) => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    const isRecommended = inv.score >= 40;

                    return (
                      <div
                        key={inv.id || idx}
                        onClick={() => setSelectedInvoice(inv)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 shadow-2xs'
                            : isRecommended
                            ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                          </div>

                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900 text-xs">
                                {inv.customerName}
                              </span>
                              {inv.customerCode && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">
                                  {inv.customerCode}
                                </span>
                              )}
                              <span className="text-[10.5px] text-slate-500 font-mono">
                                (발행일: {inv.issueDate})
                              </span>
                              {isRecommended && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-200 flex items-center space-x-0.5">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                                  <span>{inv.reason || '추천 매칭'}</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[10.5px] text-slate-500 mt-0.5 flex items-center space-x-2">
                              <span>사업자: {inv.businessNumber || '미등록'}</span>
                              <span>•</span>
                              <span>공급가액: {inv.supplyValue.toLocaleString()}원</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-emerald-700 font-mono block">
                            {inv.totalAmount.toLocaleString()}원
                          </span>
                          {isSelected && (
                            <span className="text-[10.5px] font-bold text-blue-600 flex items-center justify-end space-x-0.5 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>선택됨</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* [탭 3] 신규 매핑 사전 즉시 직접 등록                                     */}
          {/* ========================================================================= */}
          {activeTab === 'custom' && (
            <div className="space-y-3.5 max-w-xl mx-auto">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <span className="font-bold text-blue-700 flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-blue-600 mr-1" />
                  신규 거래처 및 입금자 사전 즉시 등록
                </span>
                <p className="text-slate-500 text-[11px]">
                  사전에 없는 새로운 거래처인 경우 아래 정보를 입력하여 거래처 사전 및 입금자 사전에 즉시 등록할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    거래처코드 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customForm.customerCode}
                    onChange={(e) => setCustomForm({ ...customForm, customerCode: e.target.value })}
                    placeholder="예: C0123 또는 C100"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    훈련실시사업장명 (거래처명) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customForm.companyName}
                    onChange={(e) => setCustomForm({ ...customForm, companyName: e.target.value })}
                    placeholder="예: 주식회사 한국기술교육"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      회계프로그램 등록명 (선택)
                    </label>
                    <input
                      type="text"
                      value={customForm.accountingName}
                      onChange={(e) => setCustomForm({ ...customForm, accountingName: e.target.value })}
                      placeholder="회계용 축약 상호명"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      사업자등록번호 (선택)
                    </label>
                    <input
                      type="text"
                      value={customForm.businessNumber}
                      onChange={(e) => setCustomForm({ ...customForm, businessNumber: e.target.value })}
                      placeholder="000-00-00000"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    통장 입금자명 연결
                  </label>
                  <input
                    type="text"
                    value={customForm.depositorName}
                    onChange={(e) => setCustomForm({ ...customForm, depositorName: e.target.value })}
                    placeholder="통장에 찍힌 입금자명"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 모달 하단 버튼 바 */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[10.5px] text-slate-500 flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>연결 즉시 사전에 반영되며 실시간으로 재대조됩니다.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition shadow-2xs"
            >
              취소
            </button>

            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-2xs transition flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>수동 매핑 연결 적용</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
