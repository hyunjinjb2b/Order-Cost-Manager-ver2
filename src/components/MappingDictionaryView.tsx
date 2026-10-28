import React, { useState, useMemo } from 'react';
import {
  CompanyMapping,
  DepositorMapping,
  TrainingRecord,
  InvoiceRecord,
  DepositRecord,
} from '../types';
import {
  Search,
  Plus,
  BookOpen,
  Trash2,
  CheckCircle2,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  autoDiscoverCompanyMappings,
  autoDiscoverDepositorMappings,
} from '../utils/mappingEngine';

interface MappingDictionaryViewProps {
  trainings?: TrainingRecord[];
  invoices?: InvoiceRecord[];
  deposits?: DepositRecord[];
  companyMappings: CompanyMapping[];
  depositorMappings: DepositorMapping[];
  onAddCompanyMapping: (newMapping: CompanyMapping) => void;
  onAddBatchCompanyMappings?: (newMappings: CompanyMapping[]) => void;
  onDeleteCompanyMapping: (index: number) => void;
  onAddDepositorMapping: (newMapping: DepositorMapping) => void;
  onAddBatchDepositorMappings?: (newMappings: DepositorMapping[]) => void;
  onDeleteDepositorMapping: (index: number) => void;
}

export const MappingDictionaryView: React.FC<MappingDictionaryViewProps> = ({
  trainings = [],
  invoices = [],
  deposits = [],
  companyMappings,
  depositorMappings,
  onAddCompanyMapping,
  onAddBatchCompanyMappings,
  onDeleteCompanyMapping,
  onAddDepositorMapping,
  onAddBatchDepositorMappings,
  onDeleteDepositorMapping,
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'depositor'>('company');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAutoDiscoveryDetails, setShowAutoDiscoveryDetails] = useState(false);
  const [showAutoDepositorDetails, setShowAutoDepositorDetails] = useState(false);

  // 실시간 신규 거래처 자동 발굴 계산
  const autoDiscovery = useMemo(() => {
    return autoDiscoverCompanyMappings(trainings, invoices, companyMappings);
  }, [trainings, invoices, companyMappings]);

  // 실시간 신규 입금자(적요) 자동 발굴 계산
  const autoDepositorDiscovery = useMemo(() => {
    return autoDiscoverDepositorMappings(deposits, companyMappings, depositorMappings);
  }, [deposits, companyMappings, depositorMappings]);

  // 신규 거래처 등록 폼
  const [newCompany, setNewCompany] = useState({
    companyName: '',
    customerCode: '',
    accountingName: '',
    businessNumber: '',
  });

  // 신규 입금자 등록 폼
  const [newDepositor, setNewDepositor] = useState({
    depositorName: '',
    customerCode: '',
    accountingName: '',
    category: '자동매칭',
    note: '',
  });

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.companyName || !newCompany.customerCode) return;
    onAddCompanyMapping({
      ...newCompany,
      accountingName: newCompany.accountingName || newCompany.companyName,
    });
    setNewCompany({ companyName: '', customerCode: '', accountingName: '', businessNumber: '' });
  };

  const handleApplyAllDiscovered = () => {
    if (autoDiscovery.newMappings.length === 0) return;
    if (onAddBatchCompanyMappings) {
      onAddBatchCompanyMappings(autoDiscovery.newMappings);
    } else {
      autoDiscovery.newMappings.forEach((m) => onAddCompanyMapping(m));
    }
  };

  const handleApplySingleDiscovered = (mapping: CompanyMapping) => {
    onAddCompanyMapping(mapping);
  };

  const handleApplyAllDepositors = () => {
    if (autoDepositorDiscovery.newMappings.length === 0) return;
    if (onAddBatchDepositorMappings) {
      onAddBatchDepositorMappings(autoDepositorDiscovery.newMappings);
    } else {
      autoDepositorDiscovery.newMappings.forEach((m) => onAddDepositorMapping(m));
    }
  };

  const handleApplySingleDepositor = (mapping: DepositorMapping) => {
    onAddDepositorMapping(mapping);
  };

  const handleAddDepositor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepositor.depositorName || !newDepositor.customerCode) return;
    onAddDepositorMapping(newDepositor);
    setNewDepositor({ depositorName: '', customerCode: '', accountingName: '', category: '자동매칭', note: '' });
  };

  const filteredCompanies = companyMappings.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      c.customerCode.toLowerCase().includes(q) ||
      c.accountingName.toLowerCase().includes(q)
    );
  });

  const filteredDepositors = depositorMappings.filter((d) => {
    const q = searchTerm.toLowerCase();
    return (
      d.depositorName.toLowerCase().includes(q) ||
      d.customerCode.toLowerCase().includes(q) ||
      d.accountingName.toLowerCase().includes(q) ||
      (d.note || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>매핑 사전 (사내 마스터 데이터) 관리</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            회사명이나 통장 입금자명이 매핑되지 않을 경우, 원본 파일들과 대조하여 자동 발굴되거나 직접 등록하여 영구 관리할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'company'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏢 거래처 매핑 ({companyMappings.length})
          </button>
          <button
            onClick={() => setActiveTab('depositor')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'depositor'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💰 입금자 매핑 ({depositorMappings.length})
          </button>
        </div>
      </div>

      {/* 🌟 1. 거래처 자동 발굴 섹션 (Auto Discovery Banner & Actions) */}
      {activeTab === 'company' && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-blue-800/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <Sparkles className="w-4 h-4 text-blue-300" />
                </span>
                <h3 className="text-sm font-bold text-white">
                  원본 훈련내역 & 계산서발행내역 기반 거래처 자동 발굴 시스템
                </h3>
                {autoDiscovery.newMappings.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold">
                    신규 {autoDiscovery.newMappings.length}건 발견
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-medium border border-emerald-400/30">
                    전체 100% 매핑 완료
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                공용폴더의 <strong>훈련내역(사업장명)</strong>과 <strong>계산서발행내역(거래처명/거래처코드)</strong>을 실시간 대조하여,
                기존 사전에 없는 신규 거래처를 자동 분석하고 중복 없이 즉시 등록합니다.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {autoDiscovery.newMappings.length > 0 ? (
                <>
                  <button
                    id="btn-auto-apply-all-mappings"
                    type="button"
                    onClick={handleApplyAllDiscovered}
                    className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5"
                  >
                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>신규 거래처 {autoDiscovery.newMappings.length}건 일괄 등록</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAutoDiscoveryDetails(!showAutoDiscoveryDetails)}
                    className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/20 transition flex items-center space-x-1"
                  >
                    <span>상세 내역</span>
                    {showAutoDiscoveryDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </>
              ) : (
                <div className="px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>추가할 신규 거래처 없음 (중복 방지 완료)</span>
                </div>
              )}
            </div>
          </div>

          {/* 발굴 내역 상세 테이블 펼치기 */}
          {showAutoDiscoveryDetails && autoDiscovery.newMappings.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-white">🔎 자동 매칭된 신규 거래처 목록 (중복 제외된 신규 건만 표시)</span>
                <span className="text-[11px] text-slate-400">기존 등록 {autoDiscovery.duplicatesSkipped}건 자동 제외됨</span>
              </div>

              <div className="bg-slate-950/60 rounded-xl border border-white/10 overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-900/90 text-[11px] text-slate-400 sticky top-0 border-b border-white/10">
                    <tr>
                      <th className="py-2 px-3">훈련실시사업장명</th>
                      <th className="py-2 px-3">발견된 거래처코드</th>
                      <th className="py-2 px-3">계산서 거래처명</th>
                      <th className="py-2 px-3">사업자번호</th>
                      <th className="py-2 px-3">매칭 근거</th>
                      <th className="py-2 px-2 text-center w-16">등록</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-normal">
                    {autoDiscovery.matchedDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="py-2 px-3 font-semibold text-white">{item.companyName}</td>
                        <td className="py-2 px-3 font-mono text-blue-300 font-bold">{item.customerCode}</td>
                        <td className="py-2 px-3 text-slate-300">{item.accountingName}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{item.businessNumber || '-'}</td>
                        <td className="py-2 px-3 text-[11px] text-amber-300">{item.matchReason}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleApplySingleDiscovered({
                                companyName: item.companyName,
                                customerCode: item.customerCode,
                                accountingName: item.accountingName,
                                businessNumber: item.businessNumber,
                              })
                            }
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold"
                          >
                            + 등록
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🌟 2. 입금자 자동 발굴 섹션 (Auto Depositor Discovery Banner & Actions) */}
      {activeTab === 'depositor' && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-emerald-800/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                </span>
                <h3 className="text-sm font-bold text-white">
                  통장 입금내역 & 거래처매핑 기반 입금자(적요) 자동 발굴 시스템
                </h3>
                {autoDepositorDiscovery.newMappings.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold">
                    신규 {autoDepositorDiscovery.newMappings.length}건 발견
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-medium border border-emerald-400/30">
                    입금자 매핑 완료
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                통장 <strong>입금내역(적요/입금자명)</strong>과 <strong>거래처 매핑 사본(사업장명/회계명)</strong>을 실시간 대조하여,
                기존 사전에 없는 신규 통장 입금자명을 자동 분석하고 거래처코드와 즉시 연결합니다.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {autoDepositorDiscovery.newMappings.length > 0 ? (
                <>
                  <button
                    id="btn-auto-apply-all-depositors"
                    type="button"
                    onClick={handleApplyAllDepositors}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5"
                  >
                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>신규 입금자 {autoDepositorDiscovery.newMappings.length}건 일괄 등록</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAutoDepositorDetails(!showAutoDepositorDetails)}
                    className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/20 transition flex items-center space-x-1"
                  >
                    <span>상세 내역</span>
                    {showAutoDepositorDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </>
              ) : (
                <div className="px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>추가할 신규 입금자 없음 (중복 방지 완료)</span>
                </div>
              )}
            </div>
          </div>

          {/* 입금자 발굴 내역 상세 테이블 펼치기 */}
          {showAutoDepositorDetails && autoDepositorDiscovery.newMappings.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-white">🔎 자동 매칭된 통장 입금자 목록 (중복 제외된 신규 건만 표시)</span>
                <span className="text-[11px] text-slate-400">기존 등록 {autoDepositorDiscovery.duplicatesSkipped}건 자동 제외됨</span>
              </div>

              <div className="bg-slate-950/60 rounded-xl border border-white/10 overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-900/90 text-[11px] text-slate-400 sticky top-0 border-b border-white/10">
                    <tr>
                      <th className="py-2 px-3">통장 입금자명 (적요)</th>
                      <th className="py-2 px-3">연결된 거래처코드</th>
                      <th className="py-2 px-3">매칭 거래처명</th>
                      <th className="py-2 px-3">최근 입금액/일자</th>
                      <th className="py-2 px-3">매칭 근거</th>
                      <th className="py-2 px-2 text-center w-16">등록</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-normal">
                    {autoDepositorDiscovery.matchedDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="py-2 px-3 font-semibold text-white">{item.depositorName}</td>
                        <td className="py-2 px-3 font-mono text-emerald-400 font-bold">{item.customerCode}</td>
                        <td className="py-2 px-3 text-slate-300">{item.companyName}</td>
                        <td className="py-2 px-3 font-mono text-slate-300 text-[11px]">
                          {item.depositAmount ? `${item.depositAmount.toLocaleString()}원` : '-'}
                          {item.dealDate ? ` (${item.dealDate})` : ''}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-amber-300">{item.matchReason}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleApplySingleDepositor({
                                depositorName: item.depositorName,
                                customerCode: item.customerCode,
                                accountingName: item.accountingName,
                                category: '거래처자동연동',
                                note: `원장 대조: ${item.companyName} (${item.matchReason})`,
                              })
                            }
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                          >
                            + 등록
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Add Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Table list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'company' ? '사업장명, 거래처코드 검색...' : '입금자명, 거래처코드 검색...'}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {activeTab === 'company' ? filteredCompanies.length : filteredDepositors.length}건 등록됨
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="max-h-[460px] overflow-y-auto scrollbar-thin">
              {activeTab === 'company' ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-700 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">훈련실시사업장명</th>
                      <th className="py-2.5 px-3">거래처코드</th>
                      <th className="py-2.5 px-3">회계거래처명</th>
                      <th className="py-2.5 px-3">사업자번호</th>
                      <th className="py-2.5 px-2 text-center w-12">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCompanies.map((cm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{cm.companyName}</td>
                        <td className="py-2 px-3 font-mono text-blue-600 font-medium">{cm.customerCode}</td>
                        <td className="py-2 px-3 text-slate-600">{cm.accountingName}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{cm.businessNumber || '-'}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => onDeleteCompanyMapping(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-700 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">입금자명/적요</th>
                      <th className="py-2.5 px-3">거래처코드</th>
                      <th className="py-2.5 px-3">회계거래처명</th>
                      <th className="py-2.5 px-3">구분</th>
                      <th className="py-2.5 px-3">비고</th>
                      <th className="py-2.5 px-2 text-center w-12">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDepositors.map((dm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{dm.depositorName}</td>
                        <td className="py-2 px-3 font-mono text-blue-600 font-medium">{dm.customerCode}</td>
                        <td className="py-2 px-3 text-slate-600">{dm.accountingName}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 font-medium">
                            {dm.category || '자동매칭'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{dm.note || '-'}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => onDeleteDepositorMapping(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Quick Add Form */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5 mb-3">
            <Plus className="w-4 h-4 text-blue-600" />
            <span>신규 {activeTab === 'company' ? '거래처 매핑' : '입금자 매핑'} 직접 추가</span>
          </h3>

          {activeTab === 'company' ? (
            <form onSubmit={handleAddCompany} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">훈련실시사업장명 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 주식회사 샘플테크"
                  value={newCompany.companyName}
                  onChange={(e) => setNewCompany({ ...newCompany, companyName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래처코드 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 8947099"
                  value={newCompany.customerCode}
                  onChange={(e) => setNewCompany({ ...newCompany, customerCode: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">회계거래처명</label>
                <input
                  type="text"
                  placeholder="공란 시 사업장명과 동일 적용"
                  value={newCompany.accountingName}
                  onChange={(e) => setNewCompany({ ...newCompany, accountingName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">사업자번호</label>
                <input
                  type="text"
                  placeholder="예: 123-45-67890"
                  value={newCompany.businessNumber}
                  onChange={(e) => setNewCompany({ ...newCompany, businessNumber: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-xs transition"
              >
                사전에 등록하기
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddDepositor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">입금자명 / 적요 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 샘플테크(주"
                  value={newDepositor.depositorName}
                  onChange={(e) => setNewDepositor({ ...newDepositor, depositorName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래처코드 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 8947099"
                  value={newDepositor.customerCode}
                  onChange={(e) => setNewDepositor({ ...newDepositor, customerCode: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">회계거래처명</label>
                <input
                  type="text"
                  placeholder="예: 주식회사 샘플테크"
                  value={newDepositor.accountingName}
                  onChange={(e) => setNewDepositor({ ...newDepositor, accountingName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">비고 / 매칭 메모</label>
                <input
                  type="text"
                  placeholder="예: 상호 축약 표기 일치"
                  value={newDepositor.note}
                  onChange={(e) => setNewDepositor({ ...newDepositor, note: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-xs transition"
              >
                입금자 사전에 등록하기
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
