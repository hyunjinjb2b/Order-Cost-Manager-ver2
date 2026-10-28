import React, { useState, useMemo } from 'react';
import {
  DepositRecord,
  InvoiceRecord,
  CompanyMapping,
  DepositorMapping,
  TrainingRecord,
  DepositInvoiceMatchItem,
  InvoiceDepositMatchItem,
} from '../types';
import {
  buildDepositInvoiceReconciliation,
  exportDepositInvoiceToExcel,
} from '../utils/mappingEngine';
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  Building,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Calendar,
  Link2,
} from 'lucide-react';
import { DepositManualMappingModal } from './DepositManualMappingModal';

interface DepositInvoiceViewProps {
  deposits: DepositRecord[];
  invoices: InvoiceRecord[];
  companyMappings: CompanyMapping[];
  depositorMappings: DepositorMapping[];
  trainings: TrainingRecord[];
  onNavigateToUpload: () => void;
  onAddCompanyMapping: (newMapping: CompanyMapping) => void;
  onAddDepositorMapping: (newMapping: DepositorMapping) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DepositInvoiceView: React.FC<DepositInvoiceViewProps> = ({
  deposits,
  invoices,
  companyMappings,
  depositorMappings,
  trainings,
  onNavigateToUpload,
  onAddCompanyMapping,
  onAddDepositorMapping,
  onShowToast,
}) => {
  // 뷰 모드: 'deposit_centric' (통장 입금 기준) vs 'invoice_centric' (계산서 기준)
  const [viewMode, setViewMode] = useState<'deposit_centric' | 'invoice_centric'>('deposit_centric');

  // 필터 및 검색
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exact' | 'combined' | 'partial' | 'excess' | 'unmatched'>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'collected' | 'partial_collected' | 'uncollected' | 'over_collected'>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // 수동 매핑 모달 상태
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [targetDepositForMapping, setTargetDepositForMapping] = useState<DepositInvoiceMatchItem | null>(null);
  const [targetInvoiceForMapping, setTargetInvoiceForMapping] = useState<InvoiceDepositMatchItem | null>(null);

  // 실시간 대조 데이터 산출
  const reconciliation = useMemo(() => {
    return buildDepositInvoiceReconciliation(
      deposits,
      invoices,
      companyMappings,
      depositorMappings,
      trainings
    );
  }, [deposits, invoices, companyMappings, depositorMappings, trainings]);

  const { depositMatches, invoiceMatches, stats } = reconciliation;

  const handleOpenDepositMapping = (item: DepositInvoiceMatchItem) => {
    setTargetDepositForMapping(item);
    setTargetInvoiceForMapping(null);
    setManualModalOpen(true);
  };

  const handleOpenInvoiceMapping = (item: InvoiceDepositMatchItem) => {
    setTargetInvoiceForMapping(item);
    setTargetDepositForMapping(null);
    setManualModalOpen(true);
  };

  // 통장 입금 기준 필터링
  const filteredDepositMatches = useMemo(() => {
    return depositMatches.filter((item) => {
      // 1. 상태 필터
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // 2. 검색어 필터
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const depMatch =
          item.depositorName.toLowerCase().includes(query) ||
          item.resolvedCustomerName.toLowerCase().includes(query) ||
          item.resolvedCustomerCode.toLowerCase().includes(query) ||
          item.dealDate.includes(query) ||
          item.matchType.toLowerCase().includes(query) ||
          item.explanation.toLowerCase().includes(query);

        const invMatch = item.matchedInvoices.some(
          (inv) =>
            inv.customerName.toLowerCase().includes(query) ||
            inv.businessNumber.replace(/[^0-9]/g, '').includes(query.replace(/[^0-9]/g, '')) ||
            (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(query)) ||
            (inv.approvalNumber && inv.approvalNumber.toLowerCase().includes(query)) ||
            (inv.itemSummary && inv.itemSummary.toLowerCase().includes(query)) ||
            inv.associatedCourses.some((c) => c.toLowerCase().includes(query))
        );

        return depMatch || invMatch;
      }

      return true;
    });
  }, [depositMatches, statusFilter, searchTerm]);

  // 계산서 기준 필터링
  const filteredInvoiceMatches = useMemo(() => {
    return invoiceMatches.filter((item) => {
      if (invoiceStatusFilter !== 'all' && item.status !== invoiceStatusFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const invMatch =
          item.customerName.toLowerCase().includes(query) ||
          item.customerCode.toLowerCase().includes(query) ||
          item.businessNumber.replace(/[^0-9]/g, '').includes(query.replace(/[^0-9]/g, '')) ||
          item.issueDate.includes(query) ||
          (item.approvalNumber && item.approvalNumber.toLowerCase().includes(query)) ||
          item.associatedCourses.some((c) => c.toLowerCase().includes(query));

        const depMatch = item.matchedDeposits.some((d) =>
          d.depositorName.toLowerCase().includes(query)
        );

        return invMatch || depMatch;
      }

      return true;
    });
  }, [invoiceMatches, invoiceStatusFilter, searchTerm]);

  // 엑셀 내보내기 핸들러
  const handleExport = () => {
    exportDepositInvoiceToExcel(depositMatches, invoiceMatches);
  };

  const toggleExpand = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  // 데이터 없을 때
  if (deposits.length === 0 && invoices.length === 0) {
    return (
      <div className="w-full space-y-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3.5 border border-blue-100">
            <CreditCard className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1.5">
            입금내역 및 계산서 데이터가 비어 있습니다
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
            통장 입금내역과 계산서발행내역 원본 엑셀 파일을 업로드하거나 공용폴더를 동기화하면,
            어느 입금이 어느 계산서에 매핑되었는지 상세 추적 정보를 즉시 확인하실 수 있습니다.
          </p>
          <button
            onClick={onNavigateToUpload}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>원본 엑셀 파일 업로드하러 가기</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 w-full">
      {/* 1. 요약 Metric Cards Banner (High Density 1-Row Grid matching DataSheetView) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 총 통장 입금액 */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">총 통장 입금액</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="mt-0.5 text-lg font-bold text-slate-900 leading-tight">
            {stats.totalDepositsAmount.toLocaleString()}<span className="text-[11px] font-normal text-slate-500 ml-1">원</span>
          </p>
          <p className="text-[10px] text-slate-400">총 {stats.totalDepositsCount}건 입금 원본</p>
        </div>

        {/* 계산서 매핑 완료 (1:1 / 합산 완납) */}
        <div
          onClick={() => {
            setViewMode('deposit_centric');
            setStatusFilter(statusFilter === 'exact' ? 'all' : 'exact');
          }}
          className={`p-2.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'exact' && viewMode === 'deposit_centric'
              ? 'bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-400/40'
              : 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800">계산서 매핑 완납</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="mt-0.5 text-lg font-bold text-emerald-950 leading-tight">
            {stats.matchedDepositsCount}<span className="text-[11px] font-normal text-emerald-700 ml-1">건</span>
          </p>
          <p className="text-[10px] text-emerald-700">
            {stats.matchedDepositsAmount.toLocaleString()}원 ({stats.totalDepositsAmount > 0 ? Math.round((stats.matchedDepositsAmount / stats.totalDepositsAmount) * 100) : 0}%)
          </p>
        </div>

        {/* 1:N 합산입금 완납 */}
        <div
          onClick={() => {
            setViewMode('deposit_centric');
            setStatusFilter(statusFilter === 'combined' ? 'all' : 'combined');
          }}
          className={`p-2.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'combined' && viewMode === 'deposit_centric'
              ? 'bg-purple-100/70 border-purple-400 ring-2 ring-purple-400/40'
              : 'bg-purple-50/60 border-purple-200 hover:bg-purple-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-800">1:N 합산 완납</span>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <p className="mt-0.5 text-lg font-bold text-purple-950 leading-tight">
            {depositMatches.filter((d) => d.status === 'combined').length}<span className="text-[11px] font-normal text-purple-700 ml-1">건</span>
          </p>
          <p className="text-[10px] text-purple-700">다중 계산서 전액충당</p>
        </div>

        {/* 분할/초과 잔여 입금 */}
        <div
          onClick={() => {
            setViewMode('deposit_centric');
            setStatusFilter(statusFilter === 'partial' ? 'all' : 'partial');
          }}
          className={`p-2.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'partial' && viewMode === 'deposit_centric'
              ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-400/40'
              : 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800">분할/초과 잔여 입금</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="mt-0.5 text-lg font-bold text-amber-950 leading-tight">
            {stats.partialOrExcessDepositsCount}<span className="text-[11px] font-normal text-amber-700 ml-1">건</span>
          </p>
          <p className="text-[10px] text-amber-700">일부 수금 / 잔여차액 발생</p>
        </div>

        {/* 미매핑 통장 입금 */}
        <div
          onClick={() => {
            setViewMode('deposit_centric');
            setStatusFilter(statusFilter === 'unmatched' ? 'all' : 'unmatched');
          }}
          className={`p-2.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'unmatched' && viewMode === 'deposit_centric'
              ? 'bg-rose-100/70 border-rose-400 ring-2 ring-rose-400/40'
              : 'bg-rose-50/60 border-rose-200 hover:bg-rose-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800">미매핑 통장 입금</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <p className="mt-0.5 text-lg font-bold text-rose-950 leading-tight">
            {stats.unmatchedDepositsCount}<span className="text-[11px] font-normal text-rose-700 ml-1">건</span>
          </p>
          <p className="text-[10px] text-rose-700">
            {stats.unmatchedDepositsAmount.toLocaleString()}원 (수동 연결 대상)
          </p>
        </div>

        {/* 계산서 미수금 (Invoice view 기준) */}
        <div
          onClick={() => {
            setViewMode('invoice_centric');
            setInvoiceStatusFilter(invoiceStatusFilter === 'uncollected' ? 'all' : 'uncollected');
          }}
          className={`p-2.5 rounded-xl border transition cursor-pointer ${
            invoiceStatusFilter === 'uncollected' && viewMode === 'invoice_centric'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/40'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">계산서 미수금</span>
            <Building className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="mt-0.5 text-lg font-bold text-slate-900 leading-tight">
            {invoiceMatches.filter((i) => i.status === 'uncollected').length}<span className="text-[11px] font-normal text-slate-500 ml-1">건</span>
          </p>
          <p className="text-[10px] text-slate-400">
            발행 계산서 총 {invoiceMatches.length}건
          </p>
        </div>
      </div>

      {/* 2. Control Bar (뷰 모드 전환 탭, 검색창, 필터, 엑셀 다운로드 버튼) */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* 뷰 모드 전환 탭 (Light Pill style) */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('deposit_centric')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                viewMode === 'deposit_centric'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3 h-3 text-blue-600" />
              <span>통장 입금 ➔ 계산서 매핑 ({depositMatches.length})</span>
            </button>
            <button
              onClick={() => setViewMode('invoice_centric')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                viewMode === 'invoice_centric'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3 h-3 text-slate-600" />
              <span>계산서 ➔ 통장 입금 수금 ({invoiceMatches.length})</span>
            </button>
          </div>

          {/* 상태 필터 드롭다운 */}
          <div className="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <Filter className="w-3 h-3 text-slate-500" />
            {viewMode === 'deposit_centric' ? (
              <select
                id="filter-deposit-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-[11px] font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">전체 상태 ({depositMatches.length})</option>
                <option value="exact">🟢 1:1 완벽매칭 ({depositMatches.filter((d) => d.status === 'exact').length})</option>
                <option value="combined">🟣 1:N 합산입금 완납 ({depositMatches.filter((d) => d.status === 'combined').length})</option>
                <option value="partial">🟡 분할입금 매칭 ({depositMatches.filter((d) => d.status === 'partial').length})</option>
                <option value="excess">🔵 초과입금/잔여차액 ({depositMatches.filter((d) => d.status === 'excess').length})</option>
                <option value="unmatched">🔴 미매핑 ({depositMatches.filter((d) => d.status === 'unmatched').length})</option>
              </select>
            ) : (
              <select
                id="filter-invoice-status"
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                className="bg-transparent text-[11px] font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">전체 수금상태 ({invoiceMatches.length})</option>
                <option value="collected">🟢 완납 ({invoiceMatches.filter((i) => i.status === 'collected').length})</option>
                <option value="partial_collected">🟡 부분수금 ({invoiceMatches.filter((i) => i.status === 'partial_collected').length})</option>
                <option value="uncollected">🔴 미수금 ({invoiceMatches.filter((i) => i.status === 'uncollected').length})</option>
                <option value="over_collected">🔵 초과수금 ({invoiceMatches.filter((i) => i.status === 'over_collected').length})</option>
              </select>
            )}
          </div>

          {/* 검색창 */}
          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="입금자명, 거래처명, 사업자번호, 계산서 승인번호..."
              className="w-full pl-7 pr-7 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] bg-slate-200/60 rounded px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center space-x-2">
          {stats.unmatchedDepositsCount > 0 && (
            <button
              onClick={() => {
                setViewMode('deposit_centric');
                setStatusFilter('unmatched');
              }}
              className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
            >
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>미매핑 입금 ({stats.unmatchedDepositsCount})</span>
            </button>
          )}

          <button
            onClick={handleExport}
            className="flex items-center space-x-1.5 px-3 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-2xs transition"
            title="입금-계산서 매핑 대조표를 엑셀 파일로 다운로드합니다."
          >
            <Download className="w-3 h-3" />
            <span>대조표 엑셀 다운로드</span>
          </button>
        </div>
      </div>

      {/* 3. 메인 대조표 컨텐츠 영역 (Light Card/Table Container) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full">
        {/* Table Sub-header */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">
              {viewMode === 'deposit_centric' ? '통장 입금 ➔ 계산서 매핑 대조' : '계산서 ➔ 통장 입금 수금 현황'}
            </span>
            <span className="text-slate-300">|</span>
            <span>
              조회 결과: <strong className="text-slate-900">{viewMode === 'deposit_centric' ? filteredDepositMatches.length : filteredInvoiceMatches.length}</strong>건
            </span>
          </div>
          <div className="flex items-center space-x-2.5 text-[10.5px]">
            <span className="inline-flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>완납/완벽</span>
            <span className="inline-flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-1"></span>합산</span>
            <span className="inline-flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1"></span>부분</span>
            <span className="inline-flex items-center"><span className="w-2 h-2 rounded-full bg-rose-500 mr-1"></span>미매핑/미수</span>
            <span className="text-slate-400 ml-1 hidden sm:inline">💡 행을 클릭하면 상세 충당 내역을 펼쳐볼 수 있습니다</span>
          </div>
        </div>

        {/* Data Items List */}
        <div className="w-full max-h-[640px] overflow-y-auto scrollbar-thin divide-y divide-slate-100 p-2 sm:p-2.5 space-y-2">
          {viewMode === 'deposit_centric' ? (
            /* ========================================================================= */
            /* [뷰 1] 통장 입금 ➔ 계산서 매핑 뷰                                       */
            /* ========================================================================= */
            filteredDepositMatches.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p className="text-xs">검색 조건에 일치하는 입금 매핑 내역이 없습니다.</p>
              </div>
            ) : (
              filteredDepositMatches.map((item) => {
                const isExpanded = expandedRowId === item.id;
                const statusBadge =
                  item.status === 'exact' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      1:1 완벽매칭
                    </span>
                  ) : item.status === 'combined' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      1:N 합산완납 ({item.matchedInvoices.length}건)
                    </span>
                  ) : item.status === 'partial' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      분할입금 매칭
                    </span>
                  ) : item.status === 'excess' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                      초과입금/잔여차액
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      미매핑
                    </span>
                  );

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl transition-all overflow-hidden ${
                      isExpanded
                        ? 'border-blue-300 ring-1 ring-blue-200 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                    }`}
                  >
                    {/* 행 헤더 카드 */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="p-3 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition"
                    >
                      {/* 좌측: 통장 입금 정보 */}
                      <div className="flex items-start sm:items-center space-x-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 font-mono text-[10.5px] flex items-center justify-center font-bold border border-slate-200 shrink-0">
                          {item.depositIndex}
                        </span>

                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                              {item.depositorName}
                            </span>
                            {item.resolvedCustomerCode ? (
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-semibold border border-blue-200">
                                {item.resolvedCustomerCode}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[9.5px]">
                                코드미부여
                              </span>
                            )}
                            {item.resolvedCustomerName && item.resolvedCustomerName !== item.depositorName && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                ({item.resolvedCustomerName})
                              </span>
                            )}
                            {statusBadge}
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                              {item.dealDate} {item.dealTime}
                            </span>
                            <span>•</span>
                            <span className="font-bold text-slate-900">
                              입금액: {item.depositAmount.toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 우측: 매핑된 계산서 요약, 수동 매핑 버튼 및 화살표 */}
                      <div className="flex items-center justify-between md:justify-end space-x-2 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-left md:text-right">
                          <div className="flex items-center md:justify-end space-x-1 text-[11px]">
                            <ArrowRight className="w-3 h-3 text-blue-600" />
                            <span className="font-semibold text-slate-800">
                              매핑 계산서: {item.matchedInvoices.length}건 ({item.totalAllocatedAmount.toLocaleString()}원)
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-400 truncate max-w-xs">
                            {item.explanation}
                          </div>
                        </div>

                        {/* 수동 매핑 연결 버튼 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDepositMapping(item);
                          }}
                          className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition flex items-center space-x-1 shrink-0 ${
                            item.status === 'unmatched'
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs'
                              : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200'
                          }`}
                          title="거래처 사전 및 계산서 수동 매핑 강제 연결"
                        >
                          <Link2 className="w-3 h-3" />
                          <span className="hidden sm:inline">수동 매핑</span>
                          <span className="sm:hidden">매핑</span>
                        </button>

                        <div className="text-slate-400 hover:text-slate-600 p-0.5">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* 아코디언 펼침: 매핑된 계산서 상세 내역 */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2 bg-slate-50/80 border-t border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                            <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                            <span>매핑된 계산서 및 연계 훈련과정 상세 내역</span>
                          </h4>
                          {item.remainingDepositAmount !== 0 && (
                            <span className="text-[11px] font-semibold text-amber-700">
                              잔여 차액: {item.remainingDepositAmount.toLocaleString()}원
                            </span>
                          )}
                        </div>

                        {item.matchedInvoices.length === 0 ? (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <div className="flex items-center space-x-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>
                                해당 입금 건은 일치하는 거래처 사전이나 계산서가 없습니다. 수동으로 사전에 연결해보세요.
                              </span>
                            </div>
                            <button
                              onClick={() => handleOpenDepositMapping(item)}
                              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] flex items-center space-x-1 shrink-0 shadow-2xs transition"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>수동 매핑 사전 연결</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {item.matchedInvoices.map((inv, invIdx) => (
                              <div
                                key={invIdx}
                                className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1.5 shadow-2xs"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                                      계산서 #{invIdx + 1}
                                    </span>
                                    <span className="font-bold text-slate-900 text-xs">
                                      {inv.customerName}
                                    </span>
                                    <span className="text-slate-400 font-mono text-[10.5px]">
                                      (사업자: {inv.businessNumber || '미등록'})
                                    </span>
                                  </div>

                                  <div className="flex items-center space-x-2 text-right text-[11px]">
                                    <span className="text-slate-500">발행일: {inv.issueDate}</span>
                                    <span>•</span>
                                    <span className="font-bold text-emerald-700">
                                      계산서 합계: {inv.totalAmount.toLocaleString()}원
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-[10.5px] text-slate-500">
                                  <div>
                                    <span>공급가액: </span>
                                    <span className="text-slate-800 font-medium">
                                      {inv.supplyValue.toLocaleString()}원
                                    </span>
                                  </div>
                                  <div>
                                    <span>세액: </span>
                                    <span className="text-slate-800 font-medium">
                                      {inv.taxValue.toLocaleString()}원
                                    </span>
                                  </div>
                                  <div>
                                    <span>승인번호: </span>
                                    <span className="text-slate-700 font-mono">
                                      {inv.approvalNumber || inv.invoiceNumber || '미기재'}
                                    </span>
                                  </div>
                                  <div>
                                    <span>충당금액: </span>
                                    <span className="text-emerald-700 font-bold">
                                      {inv.allocatedAmount.toLocaleString()}원
                                    </span>
                                  </div>
                                </div>

                                {inv.associatedCourses && inv.associatedCourses.length > 0 && (
                                  <div className="pt-1 border-t border-slate-100 text-[10.5px]">
                                    <span className="text-blue-600 font-semibold mr-1">
                                      연계 훈련과정:
                                    </span>
                                    <span className="text-slate-600">
                                      {inv.associatedCourses.join(' / ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* ========================================================================= */
            /* [뷰 2] 계산서 ➔ 통장 입금 수금 현황 뷰                                  */
            /* ========================================================================= */
            filteredInvoiceMatches.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p className="text-xs">검색 조건에 일치하는 계산서 발행 내역이 없습니다.</p>
              </div>
            ) : (
              filteredInvoiceMatches.map((item) => {
                const isExpanded = expandedRowId === item.id;
                const statusBadge =
                  item.status === 'collected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      수금완납
                    </span>
                  ) : item.status === 'partial_collected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      부분수금 ({Math.round((item.totalCollectedAmount / item.totalAmount) * 100)}%)
                    </span>
                  ) : item.status === 'over_collected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                      초과수금
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      미수금
                    </span>
                  );

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl transition-all overflow-hidden ${
                      isExpanded
                        ? 'border-blue-300 ring-1 ring-blue-200 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                    }`}
                  >
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="p-3 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition"
                    >
                      {/* 좌측: 계산서 기본 정보 */}
                      <div className="flex items-start sm:items-center space-x-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 font-mono text-[10.5px] flex items-center justify-center font-bold border border-slate-200 shrink-0">
                          {item.invoiceIndex}
                        </span>

                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                              {item.customerName}
                            </span>
                            {item.customerCode && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-semibold border border-blue-200">
                                {item.customerCode}
                              </span>
                            )}
                            <span className="text-slate-400 font-mono text-[10.5px]">
                              {item.businessNumber}
                            </span>
                            {statusBadge}
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                              발행일: {item.issueDate}
                            </span>
                            <span>•</span>
                            <span className="font-bold text-slate-900">
                              계산서 총액: {item.totalAmount.toLocaleString()}원
                            </span>
                            {item.approvalNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  승인: {item.approvalNumber}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 우측: 수금액 및 미수액 요약, 수동 연결 버튼 */}
                      <div className="flex items-center justify-between md:justify-end space-x-2 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-left md:text-right">
                          <div className="text-xs font-bold text-emerald-700">
                            수금액: {item.totalCollectedAmount.toLocaleString()}원
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {item.remainingAmount > 0 ? (
                              <span className="text-rose-600 font-semibold">
                                미수잔액: {item.remainingAmount.toLocaleString()}원
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium">정산 완납</span>
                            )}
                          </div>
                        </div>

                        <div className="text-slate-400 hover:text-slate-600 p-0.5">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* 아코디언 펼침: 수금된 통장 입금 상세 내역 */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2 bg-slate-50/80 border-t border-slate-200 space-y-2.5">
                        <h4 className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                          <CreditCard className="w-3 h-3 text-blue-600" />
                          <span>충당된 통장 입금 상세 내역 ({item.matchedDeposits.length}건)</span>
                        </h4>

                        {item.matchedDeposits.length === 0 ? (
                          <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center space-x-2 text-rose-600">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>아직 통장 입금이 확인되지 않은 미수금 상태입니다.</span>
                            </div>
                            <button
                              onClick={() => handleOpenInvoiceMapping(item)}
                              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] flex items-center space-x-1 shrink-0 shadow-2xs transition"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>입금 내역 수동 연결</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {item.matchedDeposits.map((dep, depIdx) => (
                              <div
                                key={depIdx}
                                className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-2xs"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                    입금 #{depIdx + 1}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {dep.depositorName}
                                  </span>
                                  <span className="text-slate-500 text-[10.5px]">
                                    (거래일자: {dep.dealDate} {dep.dealTime})
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2 text-right text-[11px]">
                                  <span className="text-slate-500">
                                    통장원금: {dep.depositAmount.toLocaleString()}원
                                  </span>
                                  <span>•</span>
                                  <span className="font-bold text-emerald-700">
                                    이 계산서 충당액: {dep.allocatedAmount.toLocaleString()}원
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {item.associatedCourses && item.associatedCourses.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-100 text-[10.5px]">
                            <span className="text-blue-600 font-semibold mr-1">
                              연계 훈련과정:
                            </span>
                            <span className="text-slate-600">
                              {item.associatedCourses.join(' / ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* 수동 매핑 연결 모달 */}
      <DepositManualMappingModal
        isOpen={manualModalOpen}
        onClose={() => {
          setManualModalOpen(false);
          setTargetDepositForMapping(null);
          setTargetInvoiceForMapping(null);
        }}
        targetDepositMatch={targetDepositForMapping}
        targetInvoiceMatch={targetInvoiceForMapping}
        companyMappings={companyMappings}
        depositorMappings={depositorMappings}
        invoices={invoices}
        deposits={deposits}
        onAddCompanyMapping={onAddCompanyMapping}
        onAddDepositorMapping={onAddDepositorMapping}
        onSuccessToast={(msg) => {
          if (onShowToast) onShowToast(msg, 'success');
        }}
      />
    </div>
  );
};
