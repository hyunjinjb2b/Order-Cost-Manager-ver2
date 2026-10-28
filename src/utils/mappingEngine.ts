import * as XLSX from 'xlsx';
import {
  TrainingRecord,
  CompanyMapping,
  DepositorMapping,
  InvoiceRecord,
  DepositRecord,
  IntegratedDataRow,
  DepositInvoiceMatchItem,
  InvoiceDepositMatchItem,
  MatchedInvoiceDetail,
} from '../types';

/**
 * 훈련내역과 계산서발행내역을 비교/분석하여
 * 기존 거래처 매핑 사전에 없는 새로운 거래처를 자동으로 발굴하는 결과 인터페이스
 */
export interface AutoDiscoveryDetail {
  companyName: string; // 훈련실시사업장명
  customerCode: string; // 계산서에서 찾은 거래처코드
  accountingName: string; // 계산서 거래처명
  businessNumber: string; // 계산서 사업자번호
  matchReason: string; // 매칭 사유
  invoiceDate?: string;
}

export interface AutoDiscoveryResult {
  newMappings: CompanyMapping[];
  duplicatesSkipped: number;
  totalCandidateCount: number;
  matchedDetails: AutoDiscoveryDetail[];
}

/**
 * 훈련내역(TrainingRecord)과 계산서발행내역(InvoiceRecord)을 대조하여
 * 기존 거래처매핑 사전에 등록되지 않은 신규 거래처를 자동 발굴
 */
export function autoDiscoverCompanyMappings(
  trainings: TrainingRecord[],
  invoices: InvoiceRecord[],
  currentMappings: CompanyMapping[]
): AutoDiscoveryResult {
  if (!trainings || trainings.length === 0 || !invoices || invoices.length === 0) {
    return {
      newMappings: [],
      duplicatesSkipped: 0,
      totalCandidateCount: 0,
      matchedDetails: [],
    };
  }

  // 1. 기존 매핑 사전 색인
  const existingNames = new Set<string>();
  const existingNormNames = new Set<string>();

  (currentMappings || []).forEach((cm) => {
    if (cm.companyName) {
      existingNames.add(cm.companyName.trim());
      const norm = normalizeName(cm.companyName);
      if (norm) existingNormNames.add(norm);
    }
  });

  // 2. 계산서 데이터 색인 구성
  // 2-1. 거래처명 정확 매핑
  const invExactMap = new Map<string, InvoiceRecord>();
  // 2-2. 거래처명 정규화 매핑
  const invNormMap = new Map<string, InvoiceRecord>();
  // 2-3. 모든 유효 계산서 거래처 목록
  const uniqueInvoices: InvoiceRecord[] = [];
  const seenInvoiceCodes = new Set<string>();

  invoices.forEach((inv) => {
    const rawInvName = (inv.customerName || '').trim();
    const normInvName = normalizeName(rawInvName);
    const code = (inv.customerCode || '').trim();

    if (rawInvName && code) {
      if (!invExactMap.has(rawInvName)) invExactMap.set(rawInvName, inv);
      if (normInvName && !invNormMap.has(normInvName)) invNormMap.set(normInvName, inv);

      const uniqueKey = `${code}_${normInvName}`;
      if (!seenInvoiceCodes.has(uniqueKey)) {
        seenInvoiceCodes.add(uniqueKey);
        uniqueInvoices.push(inv);
      }
    }
  });

  const discoveredMappings: CompanyMapping[] = [];
  const matchedDetails: AutoDiscoveryDetail[] = [];
  const addedNormNames = new Set<string>();
  let duplicatesSkipped = 0;

  // 3. 훈련내역의 고유 사업장명 순회
  const uniqueTrainingNames = Array.from(
    new Set(trainings.map((t) => (t.companyName || '').trim()).filter(Boolean))
  );

  uniqueTrainingNames.forEach((rawTrName) => {
    const normTrName = normalizeName(rawTrName);

    // 이미 기존 매핑 사전에 존재하는 경우 스킵 (중복 방지)
    if (existingNames.has(rawTrName) || existingNormNames.has(normTrName)) {
      duplicatesSkipped++;
      return;
    }

    // 이미 이번 탐색에서 추가된 경우 스킵
    if (addedNormNames.has(normTrName) || addedNormNames.has(rawTrName)) {
      return;
    }

    let matchedInv: InvoiceRecord | null = null;
    let matchReason = '';

    // [전략 1] 정확한 이름 일치
    if (invExactMap.has(rawTrName)) {
      matchedInv = invExactMap.get(rawTrName)!;
      matchReason = '사업장명 - 계산서 거래처명 정확히 일치';
    }
    // [전략 2] 정규화 이름 일치 ((주), 주식회사, 공백 등 통일)
    else if (invNormMap.has(normTrName)) {
      matchedInv = invNormMap.get(normTrName)!;
      matchReason = '상호 정규화((주)/주식회사/공백 통일) 일치';
    }
    // [전략 3] 상호 포함(유사도) 매칭 (최소 3자 이상)
    else {
      for (const inv of uniqueInvoices) {
        const normInvName = normalizeName(inv.customerName || '');
        if (normInvName.length >= 3 && normTrName.length >= 3) {
          if (normInvName.includes(normTrName) || normTrName.includes(normInvName)) {
            matchedInv = inv;
            matchReason = `상호 부분 포함 일치 ('${inv.customerName}' 감지)`;
            break;
          }
        }
      }
    }

    // 매칭된 계산서가 있고 거래처코드가 유효한 경우 신규 등록 대상에 추가
    if (matchedInv && matchedInv.customerCode && matchedInv.customerCode.trim()) {
      const customerCode = matchedInv.customerCode.trim();
      const accountingName = (matchedInv.customerName || rawTrName).trim();
      const businessNumber = (matchedInv.businessNumber || '').trim();

      const newMapping: CompanyMapping = {
        companyName: rawTrName,
        customerCode,
        accountingName,
        businessNumber,
      };

      discoveredMappings.push(newMapping);
      matchedDetails.push({
        companyName: rawTrName,
        customerCode,
        accountingName,
        businessNumber,
        matchReason,
        invoiceDate: matchedInv.issueDate,
      });

      addedNormNames.add(normTrName);
      addedNormNames.add(rawTrName);
    }
  });

  return {
    newMappings: discoveredMappings,
    duplicatesSkipped,
    totalCandidateCount: discoveredMappings.length,
    matchedDetails,
  };
}

/**
 * 기존 거래처 매핑 목록에 신규 매핑 목록을 중복 없이 병합
 */
export function mergeCompanyMappings(
  currentList: CompanyMapping[],
  newMappings: CompanyMapping[]
): { mergedList: CompanyMapping[]; addedCount: number } {
  const existingNames = new Set<string>();
  const existingNorms = new Set<string>();

  (currentList || []).forEach((item) => {
    if (item.companyName) {
      existingNames.add(item.companyName.trim());
      const norm = normalizeName(item.companyName);
      if (norm) existingNorms.add(norm);
    }
  });

  const merged = [...(currentList || [])];
  let addedCount = 0;

  (newMappings || []).forEach((newItem) => {
    const rawName = (newItem.companyName || '').trim();
    const norm = normalizeName(rawName);

    if (rawName && !existingNames.has(rawName) && !existingNorms.has(norm)) {
      merged.push({
        companyName: rawName,
        customerCode: newItem.customerCode.trim(),
        accountingName: (newItem.accountingName || rawName).trim(),
        businessNumber: (newItem.businessNumber || '').trim(),
      });
      existingNames.add(rawName);
      if (norm) existingNorms.add(norm);
      addedCount++;
    }
  });

  return { mergedList: merged, addedCount };
}

/**
 * 훈련내역 레코드의 고유 식별 키(Fingerprint) 생성
 */
export function getTrainingRecordKey(tr: Partial<TrainingRecord | IntegratedDataRow>): string {
  if (!tr) return '';
  const month = (tr.claimMonth || '').trim();
  const company = normalizeName(tr.companyName || '');
  const course = (tr.courseName || '').trim();
  const period = (tr.period || '').trim();
  const round = String(tr.hrdRound || '').trim();
  const cost = Math.round(parseNumber((tr as any).totalCost || 0));
  return `${month}__${company}__${course}__${period}__${round}__${cost}`;
}

/**
 * 기존 훈련내역에 신규 훈련내역을 중복 없이 아래에 덧붙여 병합
 * - 기존 행의 위치 및 사용자 수정(비용신청, 환급일자 등) 상태 완벽 보존
 * - 영구 저장된 비용신청(expenseMap) 상태와 동기화
 */
export function mergeTrainingRecords(
  currentList: TrainingRecord[],
  incomingList: TrainingRecord[],
  persistentExpenseMap?: Record<string, boolean>
): { mergedList: TrainingRecord[]; addedCount: number } {
  const existingMap = new Map<string, TrainingRecord>();
  const existingIdSet = new Set<string>();

  (currentList || []).forEach((item) => {
    const key = getTrainingRecordKey(item);
    if (key) existingMap.set(key, item);
    if (item.id) existingIdSet.add(item.id);
  });

  // 기존 항목들을 복사하면서 영구 저장된 expenseApplied 값 보정
  const merged: TrainingRecord[] = (currentList || []).map((item) => {
    const key = getTrainingRecordKey(item);
    let expenseApplied = item.expenseApplied === true || String(item.expenseApplied).toUpperCase() === 'TRUE';
    if (persistentExpenseMap && persistentExpenseMap[key] !== undefined) {
      expenseApplied = persistentExpenseMap[key];
    } else if (persistentExpenseMap && item.id && persistentExpenseMap[item.id] !== undefined) {
      expenseApplied = persistentExpenseMap[item.id];
    }
    return {
      ...item,
      expenseApplied,
    };
  });

  let addedCount = 0;

  (incomingList || []).forEach((newItem, idx) => {
    const key = getTrainingRecordKey(newItem);
    if (!key) return;

    if (!existingMap.has(key)) {
      // 신규 추가된 행인 경우
      let uniqueId = newItem.id;
      if (!uniqueId || existingIdSet.has(uniqueId)) {
        uniqueId = `tr-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      }
      existingIdSet.add(uniqueId);

      // 비용신청 영구 설정 확인 (이전에 체크해둔 적이 있는지)
      let expenseApplied = newItem.expenseApplied === true || String(newItem.expenseApplied).toUpperCase() === 'TRUE';
      if (persistentExpenseMap && persistentExpenseMap[key] !== undefined) {
        expenseApplied = persistentExpenseMap[key];
      } else if (persistentExpenseMap && persistentExpenseMap[uniqueId] !== undefined) {
        expenseApplied = persistentExpenseMap[uniqueId];
      }

      const itemToAdd: TrainingRecord = {
        ...newItem,
        id: uniqueId,
        expenseApplied,
      };

      merged.push(itemToAdd);
      existingMap.set(key, itemToAdd);
      addedCount++;
    } else {
      // 이미 존재하는 항목: 기존의 비용신청이나 수정사항을 덮어쓰지 않고 보존
      const existing = existingMap.get(key)!;
      if (persistentExpenseMap && persistentExpenseMap[key] !== undefined) {
        existing.expenseApplied = persistentExpenseMap[key];
      }
    }
  });

  return { mergedList: merged, addedCount };
}

/**
 * 계산서 발행내역 중복 없이 아래에 덧붙여 병합
 */
export function mergeInvoiceRecords(
  currentList: InvoiceRecord[],
  incomingList: InvoiceRecord[]
): { mergedList: InvoiceRecord[]; addedCount: number } {
  const existingKeys = new Set<string>();

  const getInvoiceKey = (inv: InvoiceRecord): string => {
    if (inv.approvalNumber && inv.approvalNumber.trim()) return `app_${inv.approvalNumber.trim()}`;
    if (inv.invoiceNumber && inv.invoiceNumber.trim()) return `no_${inv.invoiceNumber.trim()}`;
    const date = (inv.issueDate || '').trim();
    const cust = normalizeName(inv.customerName || '');
    const amt = Math.round(parseNumber(inv.totalAmount || 0));
    const biz = (inv.businessNumber || '').trim();
    return `${date}__${cust}__${amt}__${biz}`;
  };

  (currentList || []).forEach((inv) => {
    existingKeys.add(getInvoiceKey(inv));
  });

  const merged: InvoiceRecord[] = [...(currentList || [])];
  let addedCount = 0;

  (incomingList || []).forEach((inv) => {
    const key = getInvoiceKey(inv);
    if (!existingKeys.has(key)) {
      merged.push(inv);
      existingKeys.add(key);
      addedCount++;
    }
  });

  return { mergedList: merged, addedCount };
}

/**
 * 입금내역(통장) 중복 없이 아래에 덧붙여 병합
 */
export function mergeDepositRecords(
  currentList: DepositRecord[],
  incomingList: DepositRecord[]
): { mergedList: DepositRecord[]; addedCount: number } {
  const existingKeys = new Set<string>();

  const getDepositKey = (dep: DepositRecord): string => {
    const date = (dep.dealDate || '').trim();
    const time = (dep.dealTime || '').trim();
    const name = normalizeName(dep.depositorName || '');
    const amt = Math.round(parseNumber(dep.amount || 0));
    return `${date}__${time}__${name}__${amt}`;
  };

  (currentList || []).forEach((dep) => {
    existingKeys.add(getDepositKey(dep));
  });

  const merged: DepositRecord[] = [...(currentList || [])];
  let addedCount = 0;

  (incomingList || []).forEach((dep) => {
    const key = getDepositKey(dep);
    if (!existingKeys.has(key)) {
      merged.push(dep);
      existingKeys.add(key);
      addedCount++;
    }
  });

  return { mergedList: merged, addedCount };
}

/**
 * 입금내역과 거래처매핑 사전을 비교하여
 * 입금자 매핑 사전에 없는 새로운 입금자(적요)를 자동으로 발굴하는 결과 인터페이스
 */
export interface AutoDepositorDiscoveryDetail {
  depositorName: string; // 입금자명/적요
  customerCode: string; // 매칭된 거래처코드
  accountingName: string; // 회계거래처명
  companyName: string; // 매칭된 훈련실시사업장명
  matchReason: string; // 매칭 사유
  depositAmount?: number;
  dealDate?: string;
}

export interface AutoDepositorDiscoveryResult {
  newMappings: DepositorMapping[];
  duplicatesSkipped: number;
  totalCandidateCount: number;
  matchedDetails: AutoDepositorDiscoveryDetail[];
}

/**
 * 입금내역(DepositRecord)과 거래처매핑(CompanyMapping) 내역을 대조하여
 * 기존 입금자 매핑 사전에 등록되지 않은 신규 입금자/적요를 자동 발굴
 */
export function autoDiscoverDepositorMappings(
  deposits: DepositRecord[],
  companyMappings: CompanyMapping[],
  currentDepositorMappings: DepositorMapping[]
): AutoDepositorDiscoveryResult {
  if (!deposits || deposits.length === 0 || !companyMappings || companyMappings.length === 0) {
    return {
      newMappings: [],
      duplicatesSkipped: 0,
      totalCandidateCount: 0,
      matchedDetails: [],
    };
  }

  // 1. 기존 입금자 매핑 사전 색인
  const existingNames = new Set<string>();
  const existingNormNames = new Set<string>();

  (currentDepositorMappings || []).forEach((dm) => {
    if (dm.depositorName) {
      existingNames.add(dm.depositorName.trim());
      const norm = normalizeName(dm.depositorName);
      if (norm) existingNormNames.add(norm);
    }
  });

  // 2. 거래처 매핑 사전 색인 구성
  const compExactMap = new Map<string, CompanyMapping>();
  const compNormMap = new Map<string, CompanyMapping>();
  const compAccountingExactMap = new Map<string, CompanyMapping>();
  const compAccountingNormMap = new Map<string, CompanyMapping>();

  companyMappings.forEach((cm) => {
    const rawComp = (cm.companyName || '').trim();
    const normComp = normalizeName(rawComp);
    const rawAcc = (cm.accountingName || '').trim();
    const normAcc = normalizeName(rawAcc);

    if (rawComp && cm.customerCode) {
      if (!compExactMap.has(rawComp)) compExactMap.set(rawComp, cm);
      if (normComp && !compNormMap.has(normComp)) compNormMap.set(normComp, cm);
    }
    if (rawAcc && cm.customerCode) {
      if (!compAccountingExactMap.has(rawAcc)) compAccountingExactMap.set(rawAcc, cm);
      if (normAcc && !compAccountingNormMap.has(normAcc)) compAccountingNormMap.set(normAcc, cm);
    }
  });

  const discoveredMappings: DepositorMapping[] = [];
  const matchedDetails: AutoDepositorDiscoveryDetail[] = [];
  const addedNormNames = new Set<string>();
  let duplicatesSkipped = 0;

  // 3. 입금내역의 고유 입금자명/적요 수집 (가장 최근 거래일자 및 금액 보존)
  const depositInfoMap = new Map<string, DepositRecord>();
  deposits.forEach((dep) => {
    const rawName = (dep.depositorName || '').trim();
    if (rawName && !depositInfoMap.has(rawName)) {
      depositInfoMap.set(rawName, dep);
    }
  });

  // 4. 입금자명 순회 및 매핑 발굴
  depositInfoMap.forEach((dep, rawDepName) => {
    const normDepName = normalizeName(rawDepName);

    // 이미 기존 입금자 매핑 사전에 존재하는 경우 스킵
    if (existingNames.has(rawDepName) || existingNormNames.has(normDepName)) {
      duplicatesSkipped++;
      return;
    }

    // 이번 탐색에서 이미 추가된 경우 스킵
    if (addedNormNames.has(normDepName) || addedNormNames.has(rawDepName)) {
      return;
    }

    let matchedCm: CompanyMapping | null = null;
    let matchReason = '';

    // [전략 1] 사업장명 정확 일치
    if (compExactMap.has(rawDepName)) {
      matchedCm = compExactMap.get(rawDepName)!;
      matchReason = '사업장명과 입금자명 정확히 일치';
    }
    // [전략 2] 회계거래처명 정확 일치
    else if (compAccountingExactMap.has(rawDepName)) {
      matchedCm = compAccountingExactMap.get(rawDepName)!;
      matchReason = '회계거래처명과 입금자명 정확히 일치';
    }
    // [전략 3] 정규화 이름 일치 ((주), 주식회사, 공백 제거 후 비교)
    else if (compNormMap.has(normDepName)) {
      matchedCm = compNormMap.get(normDepName)!;
      matchReason = '상호 정규화((주)/주식회사/공백 통일) 일치';
    } else if (compAccountingNormMap.has(normDepName)) {
      matchedCm = compAccountingNormMap.get(normDepName)!;
      matchReason = '회계거래처 상호 정규화 일치';
    }
    // [전략 4] 상호 부분 포함/축약 매칭 (최소 2자 이상)
    else {
      for (const cm of companyMappings) {
        const normComp = normalizeName(cm.companyName);
        const normAcc = normalizeName(cm.accountingName);

        if (normDepName.length >= 2) {
          if (normComp && (normComp.includes(normDepName) || normDepName.includes(normComp))) {
            matchedCm = cm;
            matchReason = `상호 부분 포함 일치 ('${cm.companyName}' 감지)`;
            break;
          }
          if (normAcc && (normAcc.includes(normDepName) || normDepName.includes(normAcc))) {
            matchedCm = cm;
            matchReason = `회계거래처명 부분 포함 일치 ('${cm.accountingName}' 감지)`;
            break;
          }
        }
      }
    }

    // 매칭된 거래처가 있으면 신규 입금자 매핑에 추가
    if (matchedCm && matchedCm.customerCode && matchedCm.customerCode.trim()) {
      const customerCode = matchedCm.customerCode.trim();
      const accountingName = (matchedCm.accountingName || matchedCm.companyName).trim();

      const newMapping: DepositorMapping = {
        depositorName: rawDepName,
        customerCode,
        accountingName,
        category: '거래처자동연동',
        note: `원장 대조: ${matchedCm.companyName} (${matchReason})`,
      };

      discoveredMappings.push(newMapping);
      matchedDetails.push({
        depositorName: rawDepName,
        customerCode,
        accountingName,
        companyName: matchedCm.companyName,
        matchReason,
        depositAmount: dep.amount,
        dealDate: dep.dealDate,
      });

      addedNormNames.add(normDepName);
      addedNormNames.add(rawDepName);
    }
  });

  return {
    newMappings: discoveredMappings,
    duplicatesSkipped,
    totalCandidateCount: discoveredMappings.length,
    matchedDetails,
  };
}

/**
 * 기존 입금자 매핑 목록에 신규 매핑 목록을 중복 없이 병합
 */
export function mergeDepositorMappings(
  currentList: DepositorMapping[],
  newMappings: DepositorMapping[],
  overwriteExisting = false
): { mergedList: DepositorMapping[]; addedCount: number } {
  const existingNames = new Set<string>();
  const existingNorms = new Set<string>();

  (currentList || []).forEach((item) => {
    if (item.depositorName) {
      existingNames.add(item.depositorName.trim());
      const norm = normalizeName(item.depositorName);
      if (norm) existingNorms.add(norm);
    }
  });

  const merged = [...(currentList || [])];
  let addedCount = 0;

  (newMappings || []).forEach((newItem) => {
    const rawName = (newItem.depositorName || '').trim();
    const norm = normalizeName(rawName);

    if (!rawName) return;

    const existingIndex = merged.findIndex((item) => {
      const existingRawName = (item.depositorName || '').trim();
      return existingRawName === rawName || (!!norm && normalizeName(existingRawName) === norm);
    });

    if (existingIndex !== -1) {
      if (overwriteExisting) {
        const existing = merged[existingIndex];
        merged[existingIndex] = {
          ...existing,
          depositorName: rawName,
          customerCode: newItem.customerCode.trim(),
          accountingName: (newItem.accountingName || existing.accountingName || rawName).trim(),
          category: newItem.category || existing.category || '수동 매핑',
          note: newItem.note || existing.note || '수동 매핑 변경',
        };
      }
      return;
    }

    if (!existingNames.has(rawName) && !existingNorms.has(norm)) {
      merged.push({
        depositorName: rawName,
        customerCode: newItem.customerCode.trim(),
        accountingName: (newItem.accountingName || rawName).trim(),
        category: newItem.category || '거래처자동연동',
        note: newItem.note || '자동 발굴 등록',
      });
      existingNames.add(rawName);
      if (norm) existingNorms.add(norm);
      addedCount++;
    }
  });

  return { mergedList: merged, addedCount };
}

/**
 * 이름 정규화 및 표준화 (공백, 특수문자, 문장부호, (주)/주식회사 등 법인 형태 완벽 제거)
 * 예:
 * - "(주) 덕천-산업 ." -> "덕천산업"
 * - "주식회사 한울_A&B" -> "한울ab"
 * - " [유] 삼진  상사  " -> "삼진상사"
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return String(name)
    // 1. 법인 및 사업자 형태 수식어 제거 ((주), ㈜, [주], {주}, 주식회사, 유한회사, 사단법인 등)
    .replace(
      /㈜|㈲|㈳|㈵|\(\s*주\s*\)|\[\s*주\s*\]|\{\s*주\s*\}|\(\s*유\s*\)|\[\s*유\s*\]|\(\s*자\s*\)|\[\s*자\s*\]|\(\s*사\s*\)|\[\s*사\s*\]|\(\s*재\s*\)|\[\s*재\s*\]|\(\s*학\s*\)|\(\s*의\s*\)|주식회사|유한회사|합자회사|합명회사|사단법인|재단법인|농업회사법인|어업회사법인|학교법인|의료법인|사회복지법인/gi,
      ''
    )
    // 2. 모든 공백(스페이스, 탭, 줄바꿈, 유니코드 공백 등) 제거
    .replace(/[\s\u00A0\u3000\u200B\u200C\u200D\uFEFF]+/g, '')
    // 3. 한글, 영문, 숫자 이외의 모든 특수문자, 기호, 괄호, 구두점, 언더바, 대시, 슬래시, 따옴표 등 제거
    .replace(/[^a-zA-Z0-9\uAC00-\uD7A3\u3131-\u318E]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * 상호명 및 입금자명 간의 안전하고 정밀한 유사 일치 판정 헬퍼
 * ('에너지', '디자인' 등 단순 포함으로 인한 엉뚱한 타사 입금 오매칭 원천 방지)
 */
export function isStrictNameMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  const nA = normalizeName(nameA);
  const nB = normalizeName(nameB);
  if (!nA || !nB) return false;
  if (nA === nB) return true;

  const minLen = Math.min(nA.length, nB.length);
  const maxLen = Math.max(nA.length, nB.length);
  
  // 4글자 이상이고 앞부분이 일치하며 길이 비율이 70% 이상인 경우에만 동일 상호 변형으로 인정
  if (minLen >= 4 && (nA.startsWith(nB) || nB.startsWith(nA)) && minLen / maxLen >= 0.7) {
    return true;
  }
  return false;
}

/**
 * 엑셀 날짜 및 시리얼 번호 파싱 헬퍼
 * (예: 46235 -> '08월' 또는 '2026.08.01')
 */
export function formatExcelDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    if (val > 25000 && val < 65000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}.${m}.${d}`;
    }
    return String(val);
  }
  const str = String(val).trim();
  const num = Number(str);
  if (!isNaN(num) && num > 25000 && num < 65000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }
  // 2026-08-01 -> 2026.08.01 변환
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10).replace(/-/g, '.');
  }
  if (/^\d{8}$/.test(str)) {
    return `${str.substring(0, 4)}.${str.substring(4, 6)}.${str.substring(6, 8)}`;
  }
  return str;
}

/**
 * 청구월 포맷 헬퍼 (46235 -> '08월', '8' -> '08월', '08' -> '08월', '8월' -> '08월')
 */
export function formatExcelMonth(val: any, fallback = '08월'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') {
    if (val > 25000 && val < 65000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      return `${m}월`;
    }
    if (val >= 1 && val <= 12) {
      return `${String(val).padStart(2, '0')}월`;
    }
  }
  const str = String(val).trim();
  const num = Number(str);
  if (!isNaN(num) && num > 25000 && num < 65000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${m}월`;
  }
  if (/^\d{1,2}월$/.test(str)) {
    const m = parseInt(str.replace('월', ''), 10);
    return `${String(m).padStart(2, '0')}월`;
  }
  if (/^\d{1,2}$/.test(str)) {
    const m = parseInt(str, 10);
    if (m >= 1 && m <= 12) return `${String(m).padStart(2, '0')}월`;
  }
  if (/^\d{4}[.-/]\d{2}/.test(str)) {
    const m = str.substring(5, 7);
    return `${m}월`;
  }
  return str || fallback;
}

/**
 * 숫자 및 통화 문자열을 안전하게 number로 파싱
 */
export function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 엑셀 행 객체에서 다양한 별칭의 컬럼 키값을 안전하게 추출
 */
function getRowField(row: any, candidates: string[], fallback: any = ''): any {
  if (!row || typeof row !== 'object') return fallback;
  const rowKeys = Object.keys(row);
  
  // 1. 정확 일치
  for (const cand of candidates) {
    if (row[cand] !== undefined && row[cand] !== null && String(row[cand]).trim() !== '') {
      return String(row[cand]).trim();
    }
  }
  
  // 2. 공백 제거 및 소문자 정규화 일치
  const normalizedCandidates = candidates.map((c) => c.replace(/\s+/g, '').toLowerCase());
  for (const k of rowKeys) {
    const normK = k.replace(/\s+/g, '').toLowerCase();
    const idx = normalizedCandidates.indexOf(normK);
    if (idx !== -1 && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }

  // 3. 부분 포함 일치
  for (const cand of normalizedCandidates) {
    for (const k of rowKeys) {
      const normK = k.replace(/\s+/g, '').toLowerCase();
      if (normK.includes(cand) || cand.includes(normK)) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
    }
  }

  return fallback;
}

/**
 * 훈련내역, 계산서발행내역, 입금내역, 거래처매핑, 입금자매핑을 종합하여
 * DATA 시트 형태의 통합 데이터를 생성하는 핵심 매핑 엔진
 * (훈련비총액 vs 계산서합계 vs 통장입금액 3단 정밀 금액 대조 알고리즘 적용)
 */
export function processMapping(
  trainings: TrainingRecord[],
  companyMappings: CompanyMapping[],
  depositorMappings: DepositorMapping[],
  invoices: InvoiceRecord[],
  deposits: DepositRecord[]
): IntegratedDataRow[] {
  // 1. 거래처 매핑 맵 생성 (회사명 / 표준화 정규화명 / 사업자번호 -> 거래처코드)
  const companyCodeMap = new Map<string, string>();
  const companyBizNumMap = new Map<string, string>(); // 사업자번호 -> 거래처코드
  const companyToBizNum = new Map<string, string>(); // 거래처코드 -> 사업자번호
  const codeToAccName = new Map<string, string>(); // 거래처코드 -> 회계거래처명

  companyMappings.forEach((cm) => {
    const rawName = (cm.companyName || '').trim();
    const normName = normalizeName(rawName);
    const code = (cm.customerCode || '').trim();
    const accName = (cm.accountingName || rawName).trim();
    const normAcc = normalizeName(accName);
    const rawBiz = (cm.businessNumber || '').trim();
    const cleanBiz = rawBiz.replace(/[^0-9]/g, '');

    if (code) {
      if (rawName) companyCodeMap.set(rawName, code);
      if (normName) companyCodeMap.set(normName, code);
      if (accName) companyCodeMap.set(accName, code);
      if (normAcc) companyCodeMap.set(normAcc, code);
      
      // 공백만 단순 제거한 키도 추가 등록
      const spaceStrippedRaw = rawName.replace(/\s+/g, '').toLowerCase();
      const spaceStrippedAcc = accName.replace(/\s+/g, '').toLowerCase();
      if (spaceStrippedRaw) companyCodeMap.set(spaceStrippedRaw, code);
      if (spaceStrippedAcc) companyCodeMap.set(spaceStrippedAcc, code);

      if (cleanBiz) {
        companyBizNumMap.set(cleanBiz, code);
        companyToBizNum.set(code, cleanBiz);
      }
      codeToAccName.set(code, accName);
    }
  });

  // 2. 입금자 매핑 맵 생성 (입금자명 -> 거래처코드)
  const depositorCodeMap = new Map<string, string>();
  depositorMappings.forEach((dm) => {
    const rawName = (dm.depositorName || '').trim();
    const normName = normalizeName(rawName);
    const spaceStripped = rawName.replace(/\s+/g, '').toLowerCase();
    const code = (dm.customerCode || '').trim();
    if (code) {
      if (rawName) depositorCodeMap.set(rawName, code);
      if (normName) depositorCodeMap.set(normName, code);
      if (spaceStripped) depositorCodeMap.set(spaceStripped, code);
    }
  });

  // 3. 계산서 데이터 보강 (누락된 거래처코드 자동 복원 및 정규화)
  const enrichedInvoices: (InvoiceRecord & { resolvedCode: string; normCustName: string; cleanBiz: string })[] = [];
  invoices.forEach((inv) => {
    const rawCustName = (inv.customerName || '').trim();
    const normCustName = normalizeName(rawCustName);
    const spaceStrippedCust = rawCustName.replace(/\s+/g, '').toLowerCase();
    const rawBiz = (inv.businessNumber || '').trim();
    const cleanBiz = rawBiz.replace(/[^0-9]/g, '');
    let resolvedCode = (inv.customerCode || '').trim();

    // 거래처코드가 비어있는 경우 계산서 거래처명 또는 사업자번호로 거래처코드 자동 탐색
    if (!resolvedCode) {
      if (cleanBiz && companyBizNumMap.has(cleanBiz)) {
        resolvedCode = companyBizNumMap.get(cleanBiz)!;
      } else if (rawCustName && companyCodeMap.has(rawCustName)) {
        resolvedCode = companyCodeMap.get(rawCustName)!;
      } else if (normCustName && companyCodeMap.has(normCustName)) {
        resolvedCode = companyCodeMap.get(normCustName)!;
      } else if (spaceStrippedCust && companyCodeMap.has(spaceStrippedCust)) {
        resolvedCode = companyCodeMap.get(spaceStrippedCust)!;
      } else {
        // 훈련내역에서도 동일 사업장명이 있는지 탐색 (표준화 문자열 대조)
        for (const tr of trainings) {
          const trNorm = normalizeName(tr.companyName || '');
          if (
            trNorm &&
            normCustName &&
            (trNorm === normCustName ||
              (trNorm.length >= 2 && normCustName.length >= 2 && (trNorm.includes(normCustName) || normCustName.includes(trNorm))))
          ) {
            const foundCode =
              companyCodeMap.get(tr.companyName.trim()) ||
              companyCodeMap.get(trNorm) ||
              companyCodeMap.get(tr.companyName.replace(/\s+/g, '').toLowerCase());
            if (foundCode) {
              resolvedCode = foundCode;
              break;
            }
          }
        }
      }
    }

    enrichedInvoices.push({
      ...inv,
      issueDate: formatExcelDate(inv.issueDate),
      resolvedCode,
      normCustName,
      cleanBiz,
    });
  });

  // 4. 입금내역 데이터 보강 (거래처코드 및 입금자명 정규화)
  const enrichedDeposits: (DepositRecord & { resolvedCode: string; normDepName: string })[] = [];
  deposits.forEach((dep) => {
    const rawName = (dep.depositorName || '').trim();
    const normName = normalizeName(rawName);
    const spaceStripped = rawName.replace(/\s+/g, '').toLowerCase();
    let resolvedCode =
      depositorCodeMap.get(rawName) ||
      depositorCodeMap.get(normName) ||
      depositorCodeMap.get(spaceStripped) ||
      '';

    if (!resolvedCode) {
      resolvedCode =
        companyCodeMap.get(rawName) ||
        companyCodeMap.get(normName) ||
        companyCodeMap.get(spaceStripped) ||
        '';
    }

    if (!resolvedCode) {
      for (const cm of companyMappings) {
        const normCm = normalizeName(cm.companyName);
        const normAcc = normalizeName(cm.accountingName);
        if (
          (normCm && isStrictNameMatch(normCm, normName)) ||
          (normAcc && isStrictNameMatch(normAcc, normName))
        ) {
          resolvedCode = cm.customerCode;
          break;
        }
      }
    }

    enrichedDeposits.push({
      ...dep,
      dealDate: formatExcelDate(dep.dealDate),
      resolvedCode,
      normDepName: normName,
    });
  });

  // 5. 훈련내역을 거래처코드(또는 사업장명)별로 그룹화
  const trainingGroups = new Map<string, {
    customerCode: string;
    companyName: string;
    normName: string;
    records: TrainingRecord[];
  }>();

  trainings.forEach((tr) => {
    const rawName = (tr.companyName || '').trim();
    const normName = normalizeName(rawName);
    const spaceStripped = rawName.replace(/\s+/g, '').toLowerCase();

    let customerCode =
      companyCodeMap.get(rawName) ||
      companyCodeMap.get(normName) ||
      companyCodeMap.get(spaceStripped) ||
      '';

    // 표준화 문자열 기반 안전 일치 탐색
    if (!customerCode) {
      for (const cm of companyMappings) {
        const normCm = normalizeName(cm.companyName);
        const normAcc = normalizeName(cm.accountingName);
        if (normCm && isStrictNameMatch(normCm, normName)) {
          customerCode = cm.customerCode;
          break;
        }
        if (normAcc && isStrictNameMatch(normAcc, normName)) {
          customerCode = cm.customerCode;
          break;
        }
      }
    }

    const groupKey = customerCode || `NAME_${normName || spaceStripped || rawName}`;
    if (!trainingGroups.has(groupKey)) {
      trainingGroups.set(groupKey, {
        customerCode,
        companyName: rawName,
        normName,
        records: [],
      });
    }
    trainingGroups.get(groupKey)!.records.push(tr);
  });

  // 6. 각 거래처 그룹별로 계산서 및 입금내역 매칭 수행
  const intermediateRowMap = new Map<string, {
    customerCode: string;
    invoiceDate: string;
    depositDate: string;
    totalDeposited: number;
    note: string;
    status: IntegratedDataRow['status'];
  }>();

  // 사용된 계산서 및 입금 추적
  const usedInvoiceIndices = new Set<number>();
  const usedDepositIndices = new Set<number>();

  trainingGroups.forEach((groupInfo) => {
    const { customerCode, companyName, normName, records: groupTrs } = groupInfo;
    const bizNum = customerCode ? companyToBizNum.get(customerCode) || '' : '';
    const accName = customerCode ? codeToAccName.get(customerCode) || '' : '';
    const normAcc = normalizeName(accName);

    // 해당 그룹에 매칭 가능한 후보 계산서 풀 수집
    const groupCandidateInvoices: { index: number; inv: typeof enrichedInvoices[0] }[] = [];
    enrichedInvoices.forEach((inv, idx) => {
      let isMatch = false;

      // 1) 거래처코드 일치
      if (customerCode && (inv.resolvedCode === customerCode || (inv.customerCode && inv.customerCode.trim() === customerCode))) {
        isMatch = true;
      }
      // 2) 사업자번호 일치
      else if (bizNum && inv.cleanBiz && bizNum === inv.cleanBiz) {
        isMatch = true;
      }
      // 3) 상호 정규화명 일치 (예: 덕천산업(주) <-> 덕천산업, 주식회사 한울 <-> (주)한울)
      else if (normName && inv.normCustName && (normName === inv.normCustName || normAcc === inv.normCustName)) {
        isMatch = true;
      }
      // 4) 상호 엄격 유사 일치
      else if (normName && inv.normCustName && isStrictNameMatch(normName, inv.normCustName)) {
        isMatch = true;
      }

      if (isMatch) {
        groupCandidateInvoices.push({ index: idx, inv });
      }
    });

    // 해당 그룹에 매칭 가능한 후보 입금 풀 수집
    const groupCandidateDeposits: { index: number; dep: typeof enrichedDeposits[0] }[] = [];
    enrichedDeposits.forEach((dep, idx) => {
      let isMatch = false;

      if (customerCode && dep.resolvedCode === customerCode) {
        isMatch = true;
      } else if (normName && dep.normDepName && (normName === dep.normDepName || normAcc === dep.normDepName)) {
        isMatch = true;
      } else if (normName && dep.normDepName && isStrictNameMatch(normName, dep.normDepName)) {
        isMatch = true;
      }

      if (isMatch) {
        groupCandidateDeposits.push({ index: idx, dep });
      }
    });

    // 그룹 내 결과 맵
    const groupResults = new Map<string, {
      invoiceDate: string;
      depositDate: string;
      totalDeposited: number;
      note: string;
      status: IntegratedDataRow['status'];
    }>();

    // -------------------------------------------------------------------------
    // [Step 1: 계산서 1차 매칭 - 훈련비총액 우선 대조]
    // -------------------------------------------------------------------------
    groupTrs.forEach((tr) => {
      const trCost = parseNumber(tr.totalCost);
      let matchedInvDate = '';

      // 1-1. 훈련비총액과 계산서 합계(또는 공급가액)가 정확히 일치하는 미사용 계산서 탐색
      const exactInvCandidate = groupCandidateInvoices.find(
        (cand) => !usedInvoiceIndices.has(cand.index) && (
          Math.abs(parseNumber(cand.inv.totalAmount) - trCost) < 1 ||
          Math.abs(parseNumber(cand.inv.supplyValue) - trCost) < 1
        )
      );

      if (exactInvCandidate) {
        usedInvoiceIndices.add(exactInvCandidate.index);
        matchedInvDate = exactInvCandidate.inv.issueDate;
      }

      // 1-2. 품목/적요에 과정명이 포함되어 있는 경우 매칭
      if (!matchedInvDate && tr.courseName) {
        const itemMatchCandidate = groupCandidateInvoices.find(
          (cand) => !usedInvoiceIndices.has(cand.index) && cand.inv.itemSummary && (
            cand.inv.itemSummary.includes(tr.courseName) ||
            tr.courseName.includes(cand.inv.itemSummary)
          )
        );
        if (itemMatchCandidate) {
          usedInvoiceIndices.add(itemMatchCandidate.index);
          matchedInvDate = itemMatchCandidate.inv.issueDate;
        }
      }

      groupResults.set(tr.id, {
        invoiceDate: matchedInvDate,
        depositDate: '',
        totalDeposited: 0,
        note: '',
        status: 'normal',
      });
    });

    // 1-3. 계산서 금액이 완전히 일치하지 않더라도 잔여 계산서가 있으면 순차 배정
    groupTrs.forEach((tr) => {
      const res = groupResults.get(tr.id)!;
      if (!res.invoiceDate) {
        const remainingInvCandidate = groupCandidateInvoices.find((cand) => !usedInvoiceIndices.has(cand.index));
        if (remainingInvCandidate) {
          usedInvoiceIndices.add(remainingInvCandidate.index);
          res.invoiceDate = remainingInvCandidate.inv.issueDate;
        }
      }
    });

    // -------------------------------------------------------------------------
    // [Step 2: 통장 입금내역 2차 매칭 - 훈련비총액 우선 대조]
    // -------------------------------------------------------------------------
    // 2-1. [개별 정밀 매칭] 훈련비총액과 입금액이 1:1로 정확히 일치하는 경우
    groupTrs.forEach((tr) => {
      const trCost = parseNumber(tr.totalCost);
      const res = groupResults.get(tr.id)!;

      const exactDepCandidate = groupCandidateDeposits.find(
        (cand) => !usedDepositIndices.has(cand.index) && Math.abs(parseNumber(cand.dep.amount) - trCost) < 1
      );

      if (exactDepCandidate) {
        usedDepositIndices.add(exactDepCandidate.index);
        res.depositDate = exactDepCandidate.dep.dealDate;
        res.totalDeposited = parseNumber(exactDepCandidate.dep.amount);
        if (res.invoiceDate) {
          res.note = '';
          res.status = 'normal';
        }
      }
    });

    // 2-2. [합산입금 감지] 미매칭 훈련과정들의 훈련비총액 합계와 일치하는 입금 건이 있는 경우
    const unmatchedTrainings = groupTrs.filter((tr) => !groupResults.get(tr.id)!.depositDate);
    if (unmatchedTrainings.length > 1) {
      const totalUnmatchedCost = unmatchedTrainings.reduce(
        (acc, cur) => acc + parseNumber(cur.totalCost),
        0
      );

      const combinedDepCandidate = groupCandidateDeposits.find(
        (cand) => !usedDepositIndices.has(cand.index) && Math.abs(parseNumber(cand.dep.amount) - totalUnmatchedCost) < 1
      );

      if (combinedDepCandidate) {
        usedDepositIndices.add(combinedDepCandidate.index);
        unmatchedTrainings.forEach((tr) => {
          const res = groupResults.get(tr.id)!;
          res.depositDate = combinedDepCandidate.dep.dealDate;
          res.totalDeposited = parseNumber(tr.totalCost);
          res.note = '합산입금 확인필요';
          res.status = 'combined_deposit';
        });
      }
    }

    // 2-3. [잔여 입금 배정 및 부분입금/미입금 판정]
    const remainingTrainings = groupTrs.filter((tr) => !groupResults.get(tr.id)!.depositDate);
    const unusedDeps = groupCandidateDeposits.filter((d) => !usedDepositIndices.has(d.index));

    if (remainingTrainings.length === 1 && unusedDeps.length > 0) {
      const singleTr = remainingTrainings[0];
      const singleTrCost = parseNumber(singleTr.totalCost);
      const res = groupResults.get(singleTr.id)!;

      const depDates = Array.from(
        new Set(unusedDeps.map((d) => d.dep.dealDate).filter(Boolean))
      ).sort();
      const depSum = unusedDeps.reduce(
        (acc, cur) => acc + parseNumber(cur.dep.amount),
        0
      );

      unusedDeps.forEach((d) => usedDepositIndices.add(d.index));

      res.depositDate = depDates.join(', ');
      res.totalDeposited = depSum;

      if (depSum < singleTrCost && depSum > 0) {
        res.note = '부분입금 확인필요';
        res.status = 'partial_deposit';
      } else if (depDates.length > 1) {
        res.note = '부분입금 확인필요';
        res.status = 'partial_deposit';
      } else if (depSum >= singleTrCost) {
        res.note = '';
        res.status = 'normal';
      }
    } else if (remainingTrainings.length > 1 && unusedDeps.length > 0) {
      const depDates = Array.from(
        new Set(unusedDeps.map((d) => d.dep.dealDate).filter(Boolean))
      ).sort();
      const depSum = unusedDeps.reduce(
        (acc, cur) => acc + parseNumber(cur.dep.amount),
        0
      );

      unusedDeps.forEach((d) => usedDepositIndices.add(d.index));

      remainingTrainings.forEach((tr) => {
        const res = groupResults.get(tr.id)!;
        res.depositDate = depDates.join(', ');
        res.totalDeposited = depSum;
        res.note = '합산입금 확인필요';
        res.status = 'combined_deposit';
      });
    }

    // 2-4. [최종 비고 및 예외 상태 확정]
    groupTrs.forEach((tr) => {
      const res = groupResults.get(tr.id)!;
      if (!customerCode) {
        res.note = '거래처코드 미매핑';
        res.status = 'unmapped_company';
      } else if (!res.invoiceDate) {
        res.note = '계산서 미발행/미매칭';
        res.status = 'unmapped_invoice';
      } else if (!res.depositDate || res.totalDeposited === 0) {
        res.note = '입금 미확인';
        res.status = 'unmapped_deposit';
      }

      intermediateRowMap.set(tr.id, {
        customerCode,
        invoiceDate: res.invoiceDate,
        depositDate: res.depositDate,
        totalDeposited: res.totalDeposited,
        note: res.note,
        status: res.status,
      });
    });
  });

  // 7. 최종 통합 데이터 행 반환
  const result: IntegratedDataRow[] = trainings.map((tr) => {
    const meta = intermediateRowMap.get(tr.id) || {
      customerCode: '',
      invoiceDate: '',
      depositDate: '',
      totalDeposited: 0,
      note: '거래처코드 미매핑',
      status: 'unmapped_company' as const,
    };

    return {
      id: tr.id,
      claimMonth: formatExcelMonth(tr.claimMonth, '08월'),
      customerCode: meta.customerCode,
      companyName: tr.companyName,
      courseName: tr.courseName,
      period: tr.period,
      hrdRound: tr.hrdRound,
      headcount: tr.headcount,
      totalCost: tr.totalCost,
      govSubsidy: tr.govSubsidy,
      invoiceDate: meta.invoiceDate,
      depositDate: meta.depositDate,
      receiptIssued: false,
      expenseApplied: tr.expenseApplied === true || tr.expenseApplied === 'TRUE',
      refundDate: formatExcelDate(tr.refundDate) || '',
      note: meta.note,
      status: meta.status,
      matchedDepositAmount: meta.totalDeposited,
    };
  });

  return result;
}

/**
 * 엑셀 파일 내보내기 (DATA 시트 및 전체 시트 포함 통합 파일 생성)
 */
export function exportToExcel(
  dataRows: IntegratedDataRow[],
  companyMappings?: CompanyMapping[],
  depositorMappings?: DepositorMapping[],
  invoices?: InvoiceRecord[],
  deposits?: DepositRecord[],
  centerName?: string
) {
  const wb = XLSX.utils.book_new();

  // 1. DATA 시트 생성
  const dataExport = dataRows.map((r) => ({
    청구월: r.claimMonth,
    거래처코드: r.customerCode,
    훈련실시사업장명: r.companyName,
    과정명: r.courseName,
    훈련기간: r.period,
    HRD회차: r.hrdRound,
    실시인원: r.headcount,
    훈련비총액: r.totalCost,
    정부지원금: r.govSubsidy,
    계산서발행일자: r.invoiceDate,
    수금일자: r.depositDate,
    수납확인서: r.receiptIssued ? 'TRUE' : 'FALSE',
    비용신청여부: r.expenseApplied ? 'TRUE' : 'FALSE',
    환급일자: r.refundDate,
    비고: r.note,
  }));

  const dataWs = XLSX.utils.json_to_sheet(dataExport);
  XLSX.utils.book_append_sheet(wb, dataWs, 'DATA');

  // 2. 거래처매핑 시트
  if (companyMappings && companyMappings.length > 0) {
    const cmExport = companyMappings.map((c) => ({
      훈련실시사업장명: c.companyName,
      거래처코드: c.customerCode,
      회계거래처명: c.accountingName,
      사업자번호: c.businessNumber,
    }));
    const cmWs = XLSX.utils.json_to_sheet(cmExport);
    XLSX.utils.book_append_sheet(wb, cmWs, '거래처매핑');
  }

  // 3. 입금자매핑 시트
  if (depositorMappings && depositorMappings.length > 0) {
    const dmExport = depositorMappings.map((d) => ({
      '입금자명/적요': d.depositorName,
      거래처코드: d.customerCode,
      회계거래처명: d.accountingName,
      구분: d.category,
      비고: d.note || '',
    }));
    const dmWs = XLSX.utils.json_to_sheet(dmExport);
    XLSX.utils.book_append_sheet(wb, dmWs, '입금자매핑');
  }

  // 4. 계산서발행내역 시트
  if (invoices && invoices.length > 0) {
    const invExport = invoices.map((i) => ({
      발행일: i.issueDate,
      신고기준월: i.standardMonth,
      거래처코드: i.customerCode,
      거래처명: i.customerName,
      사업자번호: i.businessNumber,
      공급가액: i.supplyValue,
      세액: i.taxValue,
      합계: i.totalAmount,
      '적요/품목': i.itemSummary || '',
      전자계산서번호: i.invoiceNumber || '',
      국세청승인번호: i.approvalNumber || '',
    }));
    const invWs = XLSX.utils.json_to_sheet(invExport);
    XLSX.utils.book_append_sheet(wb, invWs, '계산서발행내역');
  }

  // 5. 입금내역 시트
  if (deposits && deposits.length > 0) {
    const depExport = deposits.map((d) => ({
      거래일자: d.dealDate,
      거래시간: d.dealTime || '',
      입금액: d.amount,
      '적요/입금자명': d.depositorName,
    }));
    const depWs = XLSX.utils.json_to_sheet(depExport);
    XLSX.utils.book_append_sheet(wb, depWs, '입금내역');
  }

  // 파일 다운로드
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeCenterName = centerName?.replace(/[\\/:*?"<>|]/g, '').trim();
  const centerPrefix = safeCenterName ? `${safeCenterName}_` : '';
  XLSX.writeFile(wb, `${centerPrefix}수주비용통합관리_DATA_${dateStr}.xlsx`);
}

/**
 * 통장 입금내역과 계산서발행내역 간의 상세 대조 및 매핑 추적 매트릭스 생성 함수
 */
export function buildDepositInvoiceReconciliation(
  deposits: DepositRecord[],
  invoices: InvoiceRecord[],
  companyMappings: CompanyMapping[],
  depositorMappings: DepositorMapping[],
  trainings: TrainingRecord[]
): {
  depositMatches: DepositInvoiceMatchItem[];
  invoiceMatches: InvoiceDepositMatchItem[];
  stats: {
    totalDepositsCount: number;
    totalDepositsAmount: number;
    matchedDepositsCount: number;
    matchedDepositsAmount: number;
    unmatchedDepositsCount: number;
    unmatchedDepositsAmount: number;
    partialOrExcessDepositsCount: number;
    totalInvoicesCount: number;
    totalInvoicesAmount: number;
    fullyCollectedInvoicesCount: number;
    fullyCollectedInvoicesAmount: number;
    uncollectedInvoicesCount: number;
    uncollectedInvoicesAmount: number;
    partialCollectedInvoicesCount: number;
    matchRate: number;
  };
} {
  // 1. 거래처 매핑 및 정규화 사전 구축
  const companyCodeMap = new Map<string, string>();
  const codeToAccName = new Map<string, string>();
  const companyBizNumMap = new Map<string, string>();
  const depositorCodeMap = new Map<string, string>();

  companyMappings.forEach((cm) => {
    const rawName = (cm.companyName || '').trim();
    const normName = normalizeName(rawName);
    const accName = (cm.accountingName || '').trim();
    const normAcc = normalizeName(accName);
    const code = (cm.customerCode || '').trim();
    const cleanBiz = (cm.businessNumber || '').replace(/[^0-9]/g, '');

    if (code) {
      if (rawName) companyCodeMap.set(rawName, code);
      if (normName) companyCodeMap.set(normName, code);
      if (accName) companyCodeMap.set(accName, code);
      if (normAcc) companyCodeMap.set(normAcc, code);
      const spaceStrippedRaw = rawName.replace(/\s+/g, '').toLowerCase();
      const spaceStrippedAcc = accName.replace(/\s+/g, '').toLowerCase();
      if (spaceStrippedRaw) companyCodeMap.set(spaceStrippedRaw, code);
      if (spaceStrippedAcc) companyCodeMap.set(spaceStrippedAcc, code);

      if (cleanBiz) companyBizNumMap.set(cleanBiz, code);
      if (accName) codeToAccName.set(code, accName);
      else if (rawName && !codeToAccName.has(code)) codeToAccName.set(code, rawName);
    }
  });

  depositorMappings.forEach((dm) => {
    const rawName = (dm.depositorName || '').trim();
    const normName = normalizeName(rawName);
    const spaceStripped = rawName.replace(/\s+/g, '').toLowerCase();
    const code = (dm.customerCode || '').trim();
    if (code) {
      if (rawName) depositorCodeMap.set(rawName, code);
      if (normName) depositorCodeMap.set(normName, code);
      if (spaceStripped) depositorCodeMap.set(spaceStripped, code);
      if (dm.accountingName && !codeToAccName.has(code)) {
        codeToAccName.set(code, dm.accountingName.trim());
      }
    }
  });

  // 2. 계산서 보강 및 연계 훈련과정 색인
  const enrichedInvoices = invoices.map((inv, idx) => {
    const rawCustName = (inv.customerName || '').trim();
    const normCustName = normalizeName(rawCustName);
    const rawBiz = (inv.businessNumber || '').trim();
    const cleanBiz = rawBiz.replace(/[^0-9]/g, '');
    let resolvedCode = (inv.customerCode || '').trim();

    if (!resolvedCode) {
      if (cleanBiz && companyBizNumMap.has(cleanBiz)) {
        resolvedCode = companyBizNumMap.get(cleanBiz)!;
      } else if (companyCodeMap.has(rawCustName)) {
        resolvedCode = companyCodeMap.get(rawCustName)!;
      } else if (normCustName && companyCodeMap.has(normCustName)) {
        resolvedCode = companyCodeMap.get(normCustName)!;
      }
    }

    const totalAmount = parseNumber(inv.totalAmount);
    const supplyValue = parseNumber(inv.supplyValue);
    const taxValue = parseNumber(inv.taxValue);

    // 해당 계산서와 연계된 훈련과정명 수집
    const associatedCourses: string[] = [];
    trainings.forEach((tr) => {
      const trNorm = normalizeName(tr.companyName || '');
      const isCompanyMatch =
        (resolvedCode && companyCodeMap.get(tr.companyName.trim()) === resolvedCode) ||
        (normCustName && trNorm && (trNorm === normCustName || trNorm.includes(normCustName) || normCustName.includes(trNorm)));

      if (isCompanyMatch) {
        const desc = `${tr.courseName || '훈련과정'} (${tr.period || '기간미지정'}, ${tr.hrdRound || '1'}회차)`;
        if (!associatedCourses.includes(desc)) {
          associatedCourses.push(desc);
        }
      }
    });

    return {
      index: idx,
      inv,
      issueDate: formatExcelDate(inv.issueDate),
      resolvedCode,
      resolvedCustomerName: (resolvedCode && codeToAccName.get(resolvedCode)) || rawCustName,
      normCustName,
      cleanBiz,
      totalAmount,
      supplyValue,
      taxValue,
      associatedCourses,
    };
  });

  // 3. 통장 입금내역 보강
  const enrichedDeposits = deposits.map((dep, idx) => {
    const rawName = (dep.depositorName || '').trim();
    const normName = normalizeName(rawName);
    const spaceStripped = rawName.replace(/\s+/g, '').toLowerCase();

    let resolvedCode =
      depositorCodeMap.get(rawName) ||
      depositorCodeMap.get(normName) ||
      depositorCodeMap.get(spaceStripped) ||
      '';

    if (!resolvedCode) {
      resolvedCode =
        companyCodeMap.get(rawName) ||
        companyCodeMap.get(normName) ||
        companyCodeMap.get(spaceStripped) ||
        '';
    }

    if (!resolvedCode) {
      for (const cm of companyMappings) {
        const normCm = normalizeName(cm.companyName);
        const normAcc = normalizeName(cm.accountingName);
        if (
          (normCm && isStrictNameMatch(normCm, normName)) ||
          (normAcc && isStrictNameMatch(normAcc, normName))
        ) {
          resolvedCode = cm.customerCode;
          break;
        }
      }
    }

    const resolvedCustomerName = (resolvedCode && codeToAccName.get(resolvedCode)) || rawName;
    const amount = parseNumber(dep.amount);

    return {
      index: idx,
      dep,
      dealDate: formatExcelDate(dep.dealDate),
      dealTime: dep.dealTime || '',
      depositorName: rawName,
      normDepName: normName,
      resolvedCode,
      resolvedCustomerName,
      amount,
    };
  });

  // 4. 매칭 추적 데이터 구조
  const invoiceRemainingBalances = enrichedInvoices.map((inv) => inv.totalAmount);
  const depositRemainingBalances = enrichedDeposits.map((dep) => dep.amount);

  const depositMatchedInvoices: {
    invoiceDetail: MatchedInvoiceDetail;
    allocated: number;
  }[][] = enrichedDeposits.map(() => []);

  const invoiceMatchedDeposits: {
    dealDate: string;
    dealTime?: string;
    depositorName: string;
    depositAmount: number;
    allocatedAmount: number;
  }[][] = enrichedInvoices.map(() => []);

  // ---------------------------------------------------------------------------
  // [Pass 1: 동일 거래처 + 금액 1:1 완벽 일치 매칭]
  // ---------------------------------------------------------------------------
  enrichedDeposits.forEach((dep, depIdx) => {
    if (depositRemainingBalances[depIdx] <= 0) return;

    // 해당 입금과 동일한 거래처(코드/사업자/상호)의 계산서 중 잔여금액이 입금액과 정확히 일치하는 건 탐색
    const exactInvIdx = enrichedInvoices.findIndex((inv, invIdx) => {
      if (invoiceRemainingBalances[invIdx] <= 0) return false;
      const isSameCustomer =
        (dep.resolvedCode && inv.resolvedCode && dep.resolvedCode === inv.resolvedCode) ||
        (dep.normDepName && inv.normCustName && (dep.normDepName === inv.normCustName || isStrictNameMatch(dep.normDepName, inv.normCustName)));

      if (!isSameCustomer) return false;
      return Math.abs(invoiceRemainingBalances[invIdx] - dep.amount) < 1;
    });

    if (exactInvIdx !== -1) {
      const inv = enrichedInvoices[exactInvIdx];
      const alloc = dep.amount;

      invoiceRemainingBalances[exactInvIdx] -= alloc;
      depositRemainingBalances[depIdx] = 0;

      const detail: MatchedInvoiceDetail = {
        invoice: inv.inv,
        issueDate: inv.issueDate,
        customerName: inv.inv.customerName,
        businessNumber: inv.inv.businessNumber,
        totalAmount: inv.totalAmount,
        supplyValue: inv.supplyValue,
        taxValue: inv.taxValue,
        invoiceNumber: inv.inv.invoiceNumber,
        approvalNumber: inv.inv.approvalNumber,
        itemSummary: inv.inv.itemSummary,
        allocatedAmount: alloc,
        associatedCourses: inv.associatedCourses,
      };

      depositMatchedInvoices[depIdx].push({ invoiceDetail: detail, allocated: alloc });
      invoiceMatchedDeposits[exactInvIdx].push({
        dealDate: dep.dealDate,
        dealTime: dep.dealTime,
        depositorName: dep.depositorName,
        depositAmount: dep.amount,
        allocatedAmount: alloc,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // [Pass 2: 동일 거래처 합산입금 / 분할입금 FIFO 잔여 충당]
  // ---------------------------------------------------------------------------
  enrichedDeposits.forEach((dep, depIdx) => {
    let depRem = depositRemainingBalances[depIdx];
    if (depRem <= 0) return;

    // 동일 거래처의 미정산 계산서 목록
    const candidateInvIndices: number[] = [];
    enrichedInvoices.forEach((inv, invIdx) => {
      if (invoiceRemainingBalances[invIdx] <= 0) return;
      const isSameCustomer =
        (dep.resolvedCode && inv.resolvedCode && dep.resolvedCode === inv.resolvedCode) ||
        (dep.normDepName && inv.normCustName && (dep.normDepName === inv.normCustName || isStrictNameMatch(dep.normDepName, inv.normCustName)));

      if (isSameCustomer) {
        candidateInvIndices.push(invIdx);
      }
    });

    for (const invIdx of candidateInvIndices) {
      if (depRem <= 0) break;
      const inv = enrichedInvoices[invIdx];
      const invRem = invoiceRemainingBalances[invIdx];
      if (invRem <= 0) continue;

      const alloc = Math.min(depRem, invRem);
      if (alloc <= 0) continue;

      invoiceRemainingBalances[invIdx] -= alloc;
      depRem -= alloc;
      depositRemainingBalances[depIdx] = depRem;

      const detail: MatchedInvoiceDetail = {
        invoice: inv.inv,
        issueDate: inv.issueDate,
        customerName: inv.inv.customerName,
        businessNumber: inv.inv.businessNumber,
        totalAmount: inv.totalAmount,
        supplyValue: inv.supplyValue,
        taxValue: inv.taxValue,
        invoiceNumber: inv.inv.invoiceNumber,
        approvalNumber: inv.inv.approvalNumber,
        itemSummary: inv.inv.itemSummary,
        allocatedAmount: alloc,
        associatedCourses: inv.associatedCourses,
      };

      depositMatchedInvoices[depIdx].push({ invoiceDetail: detail, allocated: alloc });
      invoiceMatchedDeposits[invIdx].push({
        dealDate: dep.dealDate,
        dealTime: dep.dealTime,
        depositorName: dep.depositorName,
        depositAmount: dep.amount,
        allocatedAmount: alloc,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // [5. 통장 입금 기준 매핑 결과 생성 (Deposit-Centric)]
  // ---------------------------------------------------------------------------
  const depositMatches: DepositInvoiceMatchItem[] = enrichedDeposits.map((dep, depIdx) => {
    const matchedList = depositMatchedInvoices[depIdx];
    const totalAllocatedAmount = matchedList.reduce((sum, item) => sum + item.allocated, 0);
    const remainingDepositAmount = dep.amount - totalAllocatedAmount;

    let status: DepositInvoiceMatchItem['status'] = 'unmatched';
    let matchType = '미매핑';
    let explanation = '';

    if (matchedList.length === 0) {
      status = 'unmatched';
      if (dep.resolvedCode) {
        matchType = '계산서 미발행/과거분';
        explanation = `거래처(${dep.resolvedCustomerName})는 확인되었으나, 일치하는 미정산 계산서가 없습니다 (선입금 또는 과거 미수금 수금)`;
      } else {
        matchType = '미식별 입금자';
        explanation = `통장 입금자명('${dep.depositorName}')이 거래처 사전에 등록되어 있지 않아 계산서를 특정할 수 없습니다.`;
      }
    } else if (matchedList.length === 1) {
      const match = matchedList[0];
      if (remainingDepositAmount === 0 && Math.abs(match.invoiceDetail.totalAmount - dep.amount) < 1) {
        status = 'exact';
        matchType = '1:1 완벽매칭';
        explanation = `${match.invoiceDetail.customerName}의 계산서(${match.invoiceDetail.issueDate} 발행, ${match.invoiceDetail.totalAmount.toLocaleString()}원)에 전액 1:1 매핑 완료`;
      } else if (remainingDepositAmount > 0) {
        status = 'excess';
        matchType = '초과입금/잔여차액';
        explanation = `계산서(${match.invoiceDetail.totalAmount.toLocaleString()}원)에 ${match.allocated.toLocaleString()}원 충당 후 잔여 입금액 ${remainingDepositAmount.toLocaleString()}원 발생`;
      } else {
        status = 'partial';
        matchType = '분할입금 매칭';
        explanation = `계산서 총액(${match.invoiceDetail.totalAmount.toLocaleString()}원) 중 ${match.allocated.toLocaleString()}원 분할 수금 매핑`;
      }
    } else {
      // 2건 이상 계산서에 매칭
      if (remainingDepositAmount === 0) {
        status = 'combined';
        matchType = '1:N 합산입금 완납';
        explanation = `동일 거래처(${dep.resolvedCustomerName})의 계산서 ${matchedList.length}건 총 ${totalAllocatedAmount.toLocaleString()}원에 전액 합산 매핑 완료`;
      } else {
        status = 'excess';
        matchType = '1:N 합산 + 잔액';
        explanation = `계산서 ${matchedList.length}건에 ${totalAllocatedAmount.toLocaleString()}원 충당 후 잔여 입금액 ${remainingDepositAmount.toLocaleString()}원 발생`;
      }
    }

    return {
      id: `dep-match-${depIdx}-${dep.dealDate}`,
      depositIndex: depIdx + 1,
      dealDate: dep.dealDate,
      dealTime: dep.dealTime,
      depositorName: dep.depositorName,
      depositAmount: dep.amount,
      resolvedCustomerCode: dep.resolvedCode,
      resolvedCustomerName: dep.resolvedCustomerName,
      matchedInvoices: matchedList.map((m) => m.invoiceDetail),
      totalAllocatedAmount,
      remainingDepositAmount,
      status,
      matchType,
      explanation,
    };
  });

  // ---------------------------------------------------------------------------
  // [6. 계산서 기준 입금 수금 결과 생성 (Invoice-Centric)]
  // ---------------------------------------------------------------------------
  const invoiceMatches: InvoiceDepositMatchItem[] = enrichedInvoices.map((inv, invIdx) => {
    const matchedDeposits = invoiceMatchedDeposits[invIdx];
    const totalCollectedAmount = matchedDeposits.reduce((sum, item) => sum + item.allocatedAmount, 0);
    const remainingAmount = inv.totalAmount - totalCollectedAmount;

    let status: InvoiceDepositMatchItem['status'] = 'uncollected';
    if (totalCollectedAmount <= 0) {
      status = 'uncollected';
    } else if (remainingAmount <= 0) {
      status = totalCollectedAmount > inv.totalAmount ? 'over_collected' : 'collected';
    } else {
      status = 'partial_collected';
    }

    return {
      id: `inv-match-${invIdx}-${inv.issueDate}`,
      invoiceIndex: invIdx + 1,
      issueDate: inv.issueDate,
      customerCode: inv.resolvedCode || inv.inv.customerCode,
      customerName: inv.inv.customerName,
      businessNumber: inv.inv.businessNumber,
      totalAmount: inv.totalAmount,
      supplyValue: inv.supplyValue,
      taxValue: inv.taxValue,
      invoiceNumber: inv.inv.invoiceNumber,
      approvalNumber: inv.inv.approvalNumber,
      itemSummary: inv.inv.itemSummary,
      associatedCourses: inv.associatedCourses,
      matchedDeposits,
      totalCollectedAmount,
      remainingAmount,
      status,
    };
  });

  // ---------------------------------------------------------------------------
  // [7. 집계 통계 산출]
  // ---------------------------------------------------------------------------
  const totalDepositsCount = deposits.length;
  const totalDepositsAmount = deposits.reduce((sum, d) => sum + parseNumber(d.amount), 0);

  const matchedDeposits = depositMatches.filter((d) => d.status === 'exact' || d.status === 'combined');
  const matchedDepositsCount = matchedDeposits.length;
  const matchedDepositsAmount = matchedDeposits.reduce((sum, d) => sum + d.depositAmount, 0);

  const unmatchedDeposits = depositMatches.filter((d) => d.status === 'unmatched');
  const unmatchedDepositsCount = unmatchedDeposits.length;
  const unmatchedDepositsAmount = unmatchedDeposits.reduce((sum, d) => sum + d.depositAmount, 0);

  const partialOrExcessDeposits = depositMatches.filter((d) => d.status === 'partial' || d.status === 'excess');
  const partialOrExcessDepositsCount = partialOrExcessDeposits.length;

  const totalInvoicesCount = invoices.length;
  const totalInvoicesAmount = invoices.reduce((sum, i) => sum + parseNumber(i.totalAmount), 0);

  const fullyCollectedInvoices = invoiceMatches.filter((i) => i.status === 'collected');
  const fullyCollectedInvoicesCount = fullyCollectedInvoices.length;
  const fullyCollectedInvoicesAmount = fullyCollectedInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  const uncollectedInvoices = invoiceMatches.filter((i) => i.status === 'uncollected');
  const uncollectedInvoicesCount = uncollectedInvoices.length;
  const uncollectedInvoicesAmount = uncollectedInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  const partialCollectedInvoices = invoiceMatches.filter((i) => i.status === 'partial_collected');
  const partialCollectedInvoicesCount = partialCollectedInvoices.length;

  const matchRate =
    totalDepositsCount > 0
      ? Math.round(((matchedDepositsCount + partialOrExcessDepositsCount) / totalDepositsCount) * 100)
      : 0;

  return {
    depositMatches,
    invoiceMatches,
    stats: {
      totalDepositsCount,
      totalDepositsAmount,
      matchedDepositsCount,
      matchedDepositsAmount,
      unmatchedDepositsCount,
      unmatchedDepositsAmount,
      partialOrExcessDepositsCount,
      totalInvoicesCount,
      totalInvoicesAmount,
      fullyCollectedInvoicesCount,
      fullyCollectedInvoicesAmount,
      uncollectedInvoicesCount,
      uncollectedInvoicesAmount,
      partialCollectedInvoicesCount,
      matchRate,
    },
  };
}

/**
 * 입금-계산서 매핑 대조표 엑셀 파일 내보내기
 */
export function exportDepositInvoiceToExcel(
  depositMatches: DepositInvoiceMatchItem[],
  invoiceMatches: InvoiceDepositMatchItem[]
) {
  const wb = XLSX.utils.book_new();

  // 1. [입금 기준] 계산서 매핑 내역 시트
  const depData = depositMatches.map((d) => {
    const invoiceDates = d.matchedInvoices.map((m) => m.issueDate).join(', ');
    const invoiceAmounts = d.matchedInvoices.map((m) => m.totalAmount.toLocaleString() + '원').join(', ');
    const invoiceCusts = d.matchedInvoices.map((m) => m.customerName).join(', ');
    const invoiceBizNums = d.matchedInvoices.map((m) => m.businessNumber).join(', ');
    const invoiceApprovals = d.matchedInvoices.map((m) => m.approvalNumber || m.invoiceNumber || '').filter(Boolean).join(', ');
    const courses = d.matchedInvoices.flatMap((m) => m.associatedCourses).join(' / ');

    return {
      순번: d.depositIndex,
      거래일자: d.dealDate,
      거래시간: d.dealTime || '',
      적요_입금자명: d.depositorName,
      입금금액: d.depositAmount,
      매핑상태: d.matchType,
      식별_거래처코드: d.resolvedCustomerCode || '-',
      식별_거래처명: d.resolvedCustomerName,
      매핑_계산서_건수: d.matchedInvoices.length,
      매핑_계산서_총액: d.totalAllocatedAmount,
      잔여_차액: d.remainingDepositAmount,
      매핑_계산서_발행일: invoiceDates || '-',
      매핑_계산서_상호: invoiceCusts || '-',
      매핑_계산서_사업자번호: invoiceBizNums || '-',
      매핑_계산서_금액: invoiceAmounts || '-',
      계산서_승인번호: invoiceApprovals || '-',
      연계_훈련과정: courses || '-',
      매핑_상세설명: d.explanation,
    };
  });

  const depWs = XLSX.utils.json_to_sheet(depData);
  XLSX.utils.book_append_sheet(wb, depWs, '입금_기준_계산서매핑');

  // 2. [계산서 기준] 입금 수금 내역 시트
  const invData = invoiceMatches.map((i) => {
    const depositDates = i.matchedDeposits.map((m) => m.dealDate).join(', ');
    const depositorNames = i.matchedDeposits.map((m) => m.depositorName).join(', ');
    const depositAmounts = i.matchedDeposits.map((m) => m.allocatedAmount.toLocaleString() + '원').join(', ');

    return {
      순번: i.invoiceIndex,
      발행일자: i.issueDate,
      거래처코드: i.customerCode || '-',
      공급받는자_상호: i.customerName,
      사업자번호: i.businessNumber,
      계산서_합계: i.totalAmount,
      공급가액: i.supplyValue,
      세액: i.taxValue,
      수금상태:
        i.status === 'collected'
          ? '완납'
          : i.status === 'partial_collected'
          ? '부분수금'
          : i.status === 'over_collected'
          ? '초과수금'
          : '미수금',
      수금완료액: i.totalCollectedAmount,
      미수_잔여액: i.remainingAmount,
      수금_입금일자: depositDates || '-',
      수금_입금자명: depositorNames || '-',
      수금_입금금액: depositAmounts || '-',
      연계_훈련과정: i.associatedCourses.join(' / ') || '-',
      승인번호: i.approvalNumber || i.invoiceNumber || '-',
      품목_적요: i.itemSummary || '-',
    };
  });

  const invWs = XLSX.utils.json_to_sheet(invData);
  XLSX.utils.book_append_sheet(wb, invWs, '계산서_기준_수금현황');

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `입금_계산서_매핑대조표_${dateStr}.xlsx`);
}


/**
 * 업로드된 엑셀 파일 파싱 (단일 통합 파일 또는 개별 시트 파일)
 */
export async function parseExcelFile(file: File): Promise<{
  trainings?: TrainingRecord[];
  companyMappings?: CompanyMapping[];
  depositorMappings?: DepositorMapping[];
  invoices?: InvoiceRecord[];
  deposits?: DepositRecord[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetNames = wb.SheetNames;
        const fileNameLower = file.name.toLowerCase();

        const result: {
          trainings?: TrainingRecord[];
          companyMappings?: CompanyMapping[];
          depositorMappings?: DepositorMapping[];
          invoices?: InvoiceRecord[];
          deposits?: DepositRecord[];
        } = {};

        sheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          let json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (!json || json.length === 0) return;

          // 만약 1행이 타이틀이라 실제 헤더가 2행에 있는 경우 처리
          const firstRow = json[0];
          const hasStandardKeys = Object.keys(firstRow).some((k) =>
            /훈련|사업장|거래처|계산서|발행|입금|금액|공급가|합계/i.test(k)
          );

          if (!hasStandardKeys && json.length > 1) {
            // 헤더가 포함된 행 탐색
            const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            const headerRowIdx = rawRows.findIndex((r) =>
              r.some((cell) => /훈련|사업장|거래처|계산서|발행일|입금|금액|공급가|합계/i.test(String(cell)))
            );
            if (headerRowIdx !== -1 && headerRowIdx < rawRows.length - 1) {
              const headers = rawRows[headerRowIdx].map((h) => String(h).trim());
              const bodyRows = rawRows.slice(headerRowIdx + 1);
              json = bodyRows.map((r) => {
                const obj: any = {};
                headers.forEach((h, i) => {
                  if (h) obj[h] = r[i] !== undefined ? r[i] : '';
                });
                return obj;
              });
            }
          }

          const cleanSheetName = sheetName.trim().toLowerCase();

          // 1. 훈련내역 or DATA 시트
          const isTrainingSheet =
            cleanSheetName.includes('훈련') ||
            cleanSheetName.includes('data') ||
            cleanSheetName.includes('과정') ||
            fileNameLower.includes('훈련') ||
            (sheetNames.length === 1 && getRowField(json[0], ['훈련실시사업장명', '과정명', '훈련기간', '훈련비총액']) !== '');

          if (isTrainingSheet && (!result.trainings || result.trainings.length === 0)) {
            const parsedTrainings = json
              .filter((row) => getRowField(row, ['훈련실시사업장명', '사업장명', '회사명', '과정명']) !== '')
              .map((row, idx) => {
                const totalCost = parseNumber(getRowField(row, ['훈련비총액', '총액', '총훈련비', '훈련비', '금액'], 0));
                const govSubsidy = parseNumber(getRowField(row, ['정부지원금', '지원금', '지원액', '국비지원'], 0));
                const rawExp = getRowField(row, ['비용신청여부', '비용신청', '신청여부'], 'FALSE');

                return {
                  id: `upload-tr-${idx + 1}`,
                  claimMonth: formatExcelMonth(getRowField(row, ['청구월', '월', '신고월', '기준월'], '08월')),
                  companyName: getRowField(row, ['훈련실시사업장명', '사업장명', '회사명', '기업명', '상호'], ''),
                  courseName: getRowField(row, ['과정명', '훈련과정명', '과정'], ''),
                  period: getRowField(row, ['훈련기간', '기간'], ''),
                  hrdRound: getRowField(row, ['HRD회차', '회차', 'hrd회차', '기수'], '1'),
                  headcount: parseNumber(getRowField(row, ['실시인원', '인원', '수강인원'], 1)) || 1,
                  totalCost,
                  govSubsidy,
                  expenseApplied: false, // 사용자 요구사항: 기본 전체 OFF
                  refundDate: formatExcelDate(getRowField(row, ['환급일자', '환급일', '입금일'], '')),
                };
              });

            if (parsedTrainings.length > 0) {
              result.trainings = parsedTrainings;
            }
          }

          // 2. 거래처매핑 시트
          const isCompanyMappingSheet =
            cleanSheetName.includes('거래처') ||
            cleanSheetName.includes('사업장매핑') ||
            cleanSheetName.includes('고객사') ||
            (fileNameLower.includes('거래처') && fileNameLower.includes('매핑'));

          if (isCompanyMappingSheet) {
            result.companyMappings = json
              .filter((row) => getRowField(row, ['훈련실시사업장명', '사업장명', '회사명', '거래처코드']) !== '')
              .map((row) => ({
                companyName: getRowField(row, ['훈련실시사업장명', '사업장명', '회사명', '기업명'], ''),
                customerCode: getRowField(row, ['거래처코드', '코드', '고객사코드'], ''),
                accountingName: getRowField(row, ['회계거래처명', '거래처명', '상호', '세무거래처명'], ''),
                businessNumber: getRowField(row, ['사업자번호', '사업자등록번호', '등록번호'], ''),
              }));
          }

          // 3. 입금자매핑 시트
          const isDepositorMappingSheet =
            cleanSheetName.includes('입금자') ||
            cleanSheetName.includes('통장적요') ||
            (fileNameLower.includes('입금자') && fileNameLower.includes('매핑'));

          if (isDepositorMappingSheet) {
            result.depositorMappings = json
              .filter((row) => getRowField(row, ['입금자명/적요', '적요', '입금자명', '거래처코드']) !== '')
              .map((row) => ({
                depositorName: getRowField(row, ['입금자명/적요', '적요', '입금자명', '입금자'], ''),
                customerCode: getRowField(row, ['거래처코드', '코드'], ''),
                accountingName: getRowField(row, ['회계거래처명', '거래처명', '상호'], ''),
                category: getRowField(row, ['구분', '유형'], '자동매칭'),
                note: getRowField(row, ['비고', '메모'], ''),
              }));
          }

          // 4. 계산서발행내역 시트
          const isInvoiceSheet =
            cleanSheetName.includes('계산서') ||
            cleanSheetName.includes('세금계산서') ||
            cleanSheetName.includes('매출') ||
            cleanSheetName.includes('invoice') ||
            cleanSheetName.includes('tax') ||
            fileNameLower.includes('계산서') ||
            fileNameLower.includes('세금계산서') ||
            (sheetNames.length === 1 && getRowField(json[0], ['발행일', '발행일자', '작성일자', '공급받는자', '공급가액']) !== '');

          if (isInvoiceSheet && (!result.invoices || result.invoices.length === 0)) {
            result.invoices = json
              .filter((row) => getRowField(row, ['발행일', '발행일자', '작성일자', '거래처명', '상호', '공급받는자', '합계', '공급가액']) !== '')
              .map((row) => {
                const supply = parseNumber(getRowField(row, ['공급가액', '공급가', '금액'], 0));
                const tax = parseNumber(getRowField(row, ['세액', '부가세', '세액(부가세)'], 0));
                let total = parseNumber(getRowField(row, ['합계', '합계금액', '총액', '총금액', '청구금액', '합계(공급가+세액)'], 0));
                if (total === 0 && supply > 0) {
                  total = supply + tax;
                }

                return {
                  issueDate: formatExcelDate(getRowField(row, ['발행일', '발행일자', '작성일자', '작성일', '발행일시', '일자', '전자(세금)계산서 작성일자', '전자세금계산서 작성일자', '승인일자', '발행일(작성일)'], '')),
                  standardMonth: formatExcelMonth(getRowField(row, ['신고기준월', '기준월', '청구월', '월'], ''), ''),
                  customerCode: getRowField(row, ['거래처코드', '공급받는자 거래처코드', '공급받는자거래처코드', '거래처 코드', '코드'], ''),
                  customerName: getRowField(row, ['거래처명', '공급받는자 상호', '공급받는자상호', '공급받는자 상호(법인명)', '공급받는자상호(법인명)', '공급받는자명', '공급받는자', '상호', '상호(법인명)', '사업장명', '거래처', '거래처(상호)'], ''),
                  businessNumber: getRowField(row, ['사업자번호', '공급받는자 사업자등록번호', '공급받는자 등록번호', '공급받는자사업자등록번호', '공급받는자등록번호', '사업자등록번호', '등록번호'], ''),
                  supplyValue: supply,
                  taxValue: tax,
                  totalAmount: total,
                  itemSummary: getRowField(row, ['적요/품목', '적요', '품목', '품목명', '품목/적요', '내역', '비고'], ''),
                  invoiceNumber: getRowField(row, ['전자계산서번호', '계산서번호', '승인번호', '국세청승인번호'], ''),
                  approvalNumber: getRowField(row, ['국세청승인번호', '승인번호', '전자계산서번호'], ''),
                };
              });
          }

          // 5. 입금내역 시트
          const isDepositSheet =
            cleanSheetName.includes('입금내역') ||
            cleanSheetName.includes('통장내역') ||
            cleanSheetName.includes('입금') ||
            cleanSheetName.includes('거래내역') ||
            fileNameLower.includes('입금') ||
            fileNameLower.includes('통장') ||
            (sheetNames.length === 1 && getRowField(json[0], ['거래일자', '입금액', '적요/입금자명']) !== '');

          if (isDepositSheet && (!result.deposits || result.deposits.length === 0)) {
            result.deposits = json
              .filter((row) => getRowField(row, ['거래일자', '입금일자', '일자', '입금액', '금액', '적요']) !== '')
              .map((row) => ({
                dealDate: formatExcelDate(getRowField(row, ['거래일자', '일자', '입금일자', '거래일', '거래년월일'], '')),
                dealTime: getRowField(row, ['거래시간', '시간'], ''),
                amount: parseNumber(getRowField(row, ['입금액', '금액', '거래금액', '입금'], 0)),
                depositorName: getRowField(row, ['적요/입금자명', '적요', '입금자명', '입금자', '내용', '거래기록사항', '보낸분/받는분'], ''),
              }));
          }
        });

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * File System Access API의 DirectoryHandle에서 엑셀 파일들을 읽어오는 헬퍼
 */
export async function readFilesFromDirectoryHandle(dirHandle: any): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const fileName = entry.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const file = await entry.getFile();
        files.push(file);
      }
    }
  }
  return files;
}

/**
 * 공용 폴더 내의 파일 리스트를 분석하고 파싱하여 통합 데이터 객체로 변환
 */
export async function scanAndParseFolderFiles(files: File[]): Promise<{
  data: {
    trainings?: TrainingRecord[];
    companyMappings?: CompanyMapping[];
    depositorMappings?: DepositorMapping[];
    invoices?: InvoiceRecord[];
    deposits?: DepositRecord[];
  };
  detectedFiles: {
    trainingFile?: { name: string; size: number; lastModified: number };
    invoiceFile?: { name: string; size: number; lastModified: number };
    depositFile?: { name: string; size: number; lastModified: number };
    mappingFile?: { name: string; size: number; lastModified: number };
  };
  summaryMessage: string;
}> {
  const merged: {
    trainings?: TrainingRecord[];
    companyMappings?: CompanyMapping[];
    depositorMappings?: DepositorMapping[];
    invoices?: InvoiceRecord[];
    deposits?: DepositRecord[];
  } = {};

  const detected: {
    trainingFile?: { name: string; size: number; lastModified: number };
    invoiceFile?: { name: string; size: number; lastModified: number };
    depositFile?: { name: string; size: number; lastModified: number };
    mappingFile?: { name: string; size: number; lastModified: number };
  } = {};

  for (const file of files) {
    const parsed = await parseExcelFile(file);
    const meta = { name: file.name, size: file.size, lastModified: file.lastModified };

    if (parsed.trainings && parsed.trainings.length > 0) {
      merged.trainings = parsed.trainings;
      detected.trainingFile = meta;
    }
    if (parsed.invoices && parsed.invoices.length > 0) {
      merged.invoices = parsed.invoices;
      detected.invoiceFile = meta;
    }
    if (parsed.deposits && parsed.deposits.length > 0) {
      merged.deposits = parsed.deposits;
      detected.depositFile = meta;
    }
    if (parsed.companyMappings && parsed.companyMappings.length > 0) {
      merged.companyMappings = parsed.companyMappings;
      detected.mappingFile = meta;
    }
    if (parsed.depositorMappings && parsed.depositorMappings.length > 0) {
      merged.depositorMappings = parsed.depositorMappings;
      if (!detected.mappingFile) detected.mappingFile = meta;
    }
  }

  const parts: string[] = [];
  if (detected.trainingFile) parts.push(`훈련내역(${merged.trainings?.length || 0}건)`);
  if (detected.invoiceFile) parts.push(`계산서발행(${merged.invoices?.length || 0}건)`);
  if (detected.depositFile) parts.push(`입금내역(${merged.deposits?.length || 0}건)`);

  const summaryMessage = parts.length > 0
    ? `공용폴더에서 최신 원본 [${parts.join(', ')}]을 감지하여 자동 반영했습니다.`
    : `엑셀 파일 ${files.length}개를 동기화했습니다.`;

  return {
    data: merged,
    detectedFiles: detected,
    summaryMessage,
  };
}
