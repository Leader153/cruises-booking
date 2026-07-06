
import { YachtDatabase, YachtPricingDatabase } from './types';

// YACHTS_DB and YACHT_PRICING_DB are now loaded dynamically from JSON files.

export const EXTRAS_MAP: Record<string, string> = {
  "champagne": "בקבוק שמפניה",
  "fishing": "דייג", // Reverted name here
  "breakfast": "ארוחת בוקר",
  "dinner": "ארוחת ערב",
  "none": "ללא"
};

export const EXTRAS_PRICES: Record<string, number> = {
  "champagne": 120,
  "fishing": 150,
  "breakfast": 220,
  "dinner": 280,
  "none": 0
};

export const PAYMENT_METHODS = [
  { value: 'credit_card', label: 'כרטיס אשראי (אצל הספק)' },
  { value: 'paybox_transfer', label: 'פייבוקס/העברה (אצלי)' }
];