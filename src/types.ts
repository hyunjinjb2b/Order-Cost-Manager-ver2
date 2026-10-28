export interface TrainingCenter {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface TrainingRecord {
  id: string;
  claimMonth: string; // 청구월 (예: '08월')
  companyName: string; // 훈련실시사업장명
  courseName: string; // 과정명
  period: string; // 훈련기간 (예: '2026-04-22~2026-05-21')
  hrdRound: number | string; // HRD회차
  headcount: number; // 실시인원
  totalCost: number; // 훈련비총액
  govSubsidy: number; // 정부지원금
  expenseApplied?: boolean | string; // 비용신청여부 (FALSE/TRUE)
  refundDate?: string; // 환급일자
}

export interface CompanyMapping {
  companyName: string; // 훈련실시사업장명
  customerCode: string; // 거래처코드
  accountingName: string; // 회계거래처명
  businessNumber: string; // 사업자번호
}

export interface DepositorMapping {
  depositorName: string; // 입금자명/적요
  customerCode: string; // 거래처코드
  accountingName: string; // 회계거래처명
  category: string; // 구분 (자동매칭 / 자동추정 등)
  note?: string; // 비고
}

export interface InvoiceRecord {
  issueDate: string; // 발행일자 (예: '2026-08-12')
  standardMonth: string; // 신고기준월
  customerCode: string; // 거래처코드
  customerName: string; // 거래처명
  businessNumber: string; // 사업자번호
  supplyValue: number; // 공급가액
  taxValue: number; // 세액
  totalAmount: number; // 합계
  itemSummary?: string; // 적요/품목
  invoiceNumber?: string; // 전자계산서번호
  approvalNumber?: string; // 국세청승인번호
}

export interface DepositRecord {
  dealDate: string; // 거래일자 (예: '2026-08-18')
  dealTime?: string; // 거래시간
  amount: number; // 입금액
  depositorName: string; // 적요/입금자명
}

export interface SharedFolderInfo {
  path: string;
  name: string;
  lastSyncTime: string | null;
  detectedFiles: {
    trainingFile?: { name: string; size: number; lastModified: number };
    invoiceFile?: { name: string; size: number; lastModified: number };
    depositFile?: { name: string; size: number; lastModified: number };
    mappingFile?: { name: string; size: number; lastModified: number };
  };
  totalFilesFound: number;
}

export interface IntegratedDataRow {
  id: string;
  claimMonth: string; // 청구월
  customerCode: string; // 거래처코드
  companyName: string; // 훈련실시사업장명
  courseName: string; // 과정명
  period: string; // 훈련기간
  hrdRound: number | string; // HRD회차
  headcount: number; // 실시인원
  totalCost: number; // 훈련비총액
  govSubsidy: number; // 정부지원금
  invoiceDate: string; // 계산서발행일자
  depositDate: string; // 수금일자
  receiptIssued: boolean; // 수납확인서 출력 여부
  expenseApplied: boolean; // 비용신청여부
  refundDate: string; // 환급일자
  note: string; // 비고 (부분입금 확인필요, 합산입금 확인필요 등)
  
  // 메타 정보 (상태 하이라이트용)
  status: 'normal' | 'partial_deposit' | 'combined_deposit' | 'unmapped_company' | 'unmapped_invoice' | 'unmapped_deposit';
  matchedDepositAmount: number;
}

export interface MatchedInvoiceDetail {
  invoice: InvoiceRecord;
  issueDate: string;
  customerName: string;
  businessNumber: string;
  totalAmount: number;
  supplyValue: number;
  taxValue: number;
  invoiceNumber?: string;
  approvalNumber?: string;
  itemSummary?: string;
  allocatedAmount: number;
  associatedCourses: string[];
}

export interface DepositInvoiceMatchItem {
  id: string;
  depositIndex: number;
  dealDate: string;
  dealTime?: string;
  depositorName: string;
  depositAmount: number;
  resolvedCustomerCode: string;
  resolvedCustomerName: string;
  matchedInvoices: MatchedInvoiceDetail[];
  totalAllocatedAmount: number;
  remainingDepositAmount: number;
  status: 'exact' | 'partial' | 'combined' | 'excess' | 'unmatched';
  matchType: string;
  explanation: string;
}

export interface InvoiceDepositMatchItem {
  id: string;
  invoiceIndex: number;
  issueDate: string;
  customerCode: string;
  customerName: string;
  businessNumber: string;
  totalAmount: number;
  supplyValue: number;
  taxValue: number;
  invoiceNumber?: string;
  approvalNumber?: string;
  itemSummary?: string;
  associatedCourses: string[];
  matchedDeposits: {
    dealDate: string;
    dealTime?: string;
    depositorName: string;
    depositAmount: number;
    allocatedAmount: number;
  }[];
  totalCollectedAmount: number;
  remainingAmount: number;
  status: 'collected' | 'partial_collected' | 'uncollected' | 'over_collected';
}
