
export type PaymentMethod = 'credit_card' | 'paybox_transfer';
export type ExtraOption = 'champagne' | 'fishing' | 'breakfast' | 'dinner' | 'none';

export interface BookingData {
  clientName: string;
  phone: string;
  date: string;
  startTime: string;
  endTime: string;
  yachtName: string;
  passengers: number;
  price: number;
  downPayment: number;
  onSitePayment: number; // New field for (מג) logic
  paymentMethod: PaymentMethod;
  selectedExtras: ExtraOption[];
  isLeader: boolean;
  orderNumber: string | null;
}

export interface GenerationResult {
  file1_BlankClient: string;
  file2_BlankSupplier: string;
  file3_ExcelDetailed: string;
  file4_ExcelSummary: string;
}

export interface YachtInfo {
  max: number;
  city: 'Haifa' | 'Herzliya';
}

export interface YachtDatabase {
  [key: string]: YachtInfo;
}

export type YachtPricing = Partial<Record<string, number>> & {
  note?: string;
  extraHour?: number;
  coupleRates?: Partial<Record<string, number>> & {
    extraHour?: number;
  };
};

export interface YachtPricingDatabase {
  [yachtName: string]: YachtPricing;
}
