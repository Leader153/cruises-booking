
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { BookingData, GenerationResult, ExtraOption, YachtDatabase, YachtPricingDatabase } from './types';
import { generateAllFiles } from './services/documentGenerator';
import { EXTRAS_MAP, EXTRAS_PRICES, PAYMENT_METHODS } from './constants';
import MultiSelectExtras from './components/MultiSelectExtras';
import TimePicker24h from './src/components/TimePicker24h';

import { 
  Clipboard, 
  Check, 
  FileText, 
  Table, 
  Anchor, 
  Settings, 
  RefreshCcw,
  User,
  Phone,
  Calendar,
  Clock,
  Ship,
  Users,
  CreditCard,
  PlusCircle,
  Loader2,
  UserCheck,
  Tag,
  Trash2,
  ChevronLeft, 
  ChevronRight, 
  FilePlus,
  AlertTriangle,
  Download,
  Wallet
} from 'lucide-react';

const LOCAL_STORAGE_SAVED_BOOKINGS_KEY = 'leaderCruises_savedBookings';
const LOCAL_STORAGE_ORDER_COUNTER_KEY = 'orderCounter';

// Helper to get today's date in yyyy-mm-dd (ISO format required for input type="date")
const getTodayISO = () => {
  return new Date().toISOString().split('T')[0];
};

const initialFormData: BookingData = {
  clientName: '',
  phone: '',
  date: getTodayISO(),
  startTime: '10:00',
  endTime: '12:00',
  yachtName: '',
  passengers: 0,
  price: 0,
  downPayment: 0,
  onSitePayment: 0,
  paymentMethod: 'credit_card',
  selectedExtras: ['none'],
  isLeader: false,
  isWeekendOrHoliday: false,
  orderNumber: null
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<BookingData>(initialFormData);
  const [yachtsDb, setYachtsDb] = useState<YachtDatabase | null>(null);
  const [yachtPricingDb, setYachtPricingDb] = useState<YachtPricingDatabase | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedConfirmation, setSavedConfirmation] = useState<boolean>(false);
  const [nextAvailableOrderNumber, setNextAvailableOrderNumber] = useState<number>(() => {
    const storedOrderCounter = localStorage.getItem(LOCAL_STORAGE_ORDER_COUNTER_KEY);
    return storedOrderCounter ? Math.max(parseInt(storedOrderCounter, 10), 30100) : 30100;
  });

  const [savedBookings, setSavedBookings] = useState<BookingData[]>([]);
  const [currentBookingIndex, setCurrentBookingIndex] = useState<number>(-1);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [passengerSelectionMode, setPassengerSelectionMode] = useState<'couple' | 'max' | null>('max');
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [yachtsResponse, pricingResponse] = await Promise.all([
          fetch(`/yachts.json?v=${new Date().getTime()}`),
          fetch(`/pricing.json?v=${new Date().getTime()}`)
        ]);
        if (!yachtsResponse.ok || !pricingResponse.ok) throw new Error("Failed to fetch data files.");
        const yachtsData = await yachtsResponse.json();
        const pricingData = await pricingResponse.json();
        setYachtsDb(yachtsData);
        setYachtPricingDb(pricingData);
        setIsLoadingData(false);

        const storedBookings = localStorage.getItem(LOCAL_STORAGE_SAVED_BOOKINGS_KEY);
        let highestOrderNumInSaved = 0;
        if (storedBookings) {
          const parsedBookings: BookingData[] = JSON.parse(storedBookings);
          const cleanedBookings: BookingData[] = parsedBookings.map(b => ({
            ...b,
            selectedExtras: (b.selectedExtras && b.selectedExtras.length > 0 ? b.selectedExtras : ['none']) as ExtraOption[],
            onSitePayment: b.onSitePayment ?? 0
          }));
          setSavedBookings(cleanedBookings);
          if (cleanedBookings.length > 0) {
            const lastIndex = cleanedBookings.length - 1;
            loadBookingByIndex(lastIndex, cleanedBookings, yachtsData); 
          }
        }
        setNextAvailableOrderNumber(prev => {
          const stored = localStorage.getItem(LOCAL_STORAGE_ORDER_COUNTER_KEY);
          return Math.max(stored ? parseInt(stored, 10) : 30100, highestOrderNumInSaved + 1, 30100);
        });
      } catch (error) {
        setDataError("Error loading yachts or pricing data.");
        setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_ORDER_COUNTER_KEY, nextAvailableOrderNumber.toString());
  }, [nextAvailableOrderNumber]);

  useEffect(() => {
    if (yachtsDb && yachtPricingDb && (formData.clientName || formData.yachtName || formData.orderNumber)) {
      setResults(generateAllFiles(formData, yachtsDb, yachtPricingDb));
    } else {
      setResults(null);
    }
  }, [formData, yachtsDb, yachtPricingDb]);
  
  const yachtInfo = formData.yachtName && yachtsDb ? yachtsDb[formData.yachtName.trim()] : null;
  const maxPassengersForYacht = yachtInfo ? yachtInfo.max : 0;

  useEffect(() => {
    if (passengerSelectionMode === 'max' && maxPassengersForYacht > 0) {
      if (formData.passengers !== maxPassengersForYacht) {
           setFormData(prev => ({ ...prev, passengers: maxPassengersForYacht }));
      }
    }
  }, [formData.yachtName, passengerSelectionMode, maxPassengersForYacht, formData.passengers]);

  useEffect(() => {
    if (isPriceManuallySet || !yachtPricingDb || !formData.yachtName) return;

    const startSplit = formData.startTime.split(':').map(Number);
    const endSplit = formData.endTime.split(':').map(Number);
    if(startSplit.length < 2 || endSplit.length < 2) return;

    const startDecimal = startSplit[0] + (startSplit[1] || 0) / 60;
    const endDecimal = endSplit[0] + (endSplit[1] || 0) / 60;
    let calcDuration = endDecimal - startDecimal;
    if (calcDuration < 0) calcDuration = 0;

    const currentYacht = formData.yachtName.trim();
    const pricing = yachtPricingDb[currentYacht];
    let newPrice = 0;
    
    const startHour = parseInt(formData.startTime.split(':')[0], 10);
    const nightSurcharge = startHour >= 20 ? 100 : 0;
    const weekendSurcharge = (formData.isWeekendOrHoliday && (currentYacht === 'ג׳וי' || currentYacht === 'לי-ים')) ? 100 : 0;

    if (pricing) {
        // Check for special couple rates first
        if (formData.passengers === 2 && pricing.coupleRates) {
            const couplePricing = pricing.coupleRates;
            if (calcDuration > 2 && couplePricing.extraHour && couplePricing['2']) {
                const extraHours = Math.ceil(calcDuration - 2);
                newPrice = couplePricing['2'] + (extraHours * couplePricing.extraHour);
            } else if (Math.abs(calcDuration - 1.5) < 0.01 && couplePricing['1.5']) {
                newPrice = couplePricing['1.5'];
            } else {
                const durationKey = Math.round(calcDuration);
                if (couplePricing[durationKey]) {
                    newPrice = couplePricing[durationKey];
                }
            }
        } else { // Fallback to standard pricing
            if (calcDuration > 2 && pricing.extraHour && pricing['2']) {
                const extraHours = Math.ceil(calcDuration - 2);
                newPrice = pricing['2'] + (extraHours * pricing.extraHour);
            } else if (Math.abs(calcDuration - 1.5) < 0.01 && pricing['1.5']) {
                newPrice = pricing['1.5'];
            } else {
                const durationKey = Math.round(calcDuration);
                if (pricing[durationKey]) {
                    newPrice = pricing[durationKey];
                }
            }
        }
    }
    
    newPrice += nightSurcharge;
    newPrice += weekendSurcharge;
    
    setFormData(prev => ({ ...prev, price: newPrice }));

  }, [formData.yachtName, formData.startTime, formData.endTime, formData.passengers, formData.isWeekendOrHoliday, isPriceManuallySet, yachtPricingDb]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'price') {
      setIsPriceManuallySet(true);
    } else if (['yachtName', 'startTime', 'endTime', 'passengers'].includes(name)) {
      setIsPriceManuallySet(false);
    }

    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'price' || name === 'downPayment' || name === 'onSitePayment') ? Number(val) : val
    }));
  };

  const handlePassengerSelection = (mode: 'couple' | 'max') => {
    setIsPriceManuallySet(false);
    setPassengerSelectionMode(mode);
    if (mode === 'couple') {
      setFormData(prev => ({ ...prev, passengers: 2 }));
    } else if (mode === 'max' && maxPassengersForYacht > 0) {
      setFormData(prev => ({ ...prev, passengers: maxPassengersForYacht }));
    }
  };

  const handleExtrasChange = (selected: ExtraOption[]) => {
    setFormData(prev => ({
      ...prev,
      selectedExtras: selected
    }));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAssignOrderNumber = () => {
    const newOrderNumber = nextAvailableOrderNumber.toString();
    const updatedFormData = { ...formData, orderNumber: newOrderNumber };
    const newSavedBookings = [...savedBookings, updatedFormData];
    setSavedBookings(newSavedBookings);
    localStorage.setItem(LOCAL_STORAGE_SAVED_BOOKINGS_KEY, JSON.stringify(newSavedBookings));
    setFormData(updatedFormData);
    setCurrentBookingIndex(newSavedBookings.length - 1);
    setNextAvailableOrderNumber(prev => prev + 1);
    setSavedConfirmation(true);
    setTimeout(() => setSavedConfirmation(false), 2000);

    // Автоматическая отправка в Google Таблицу
    try {
      if (yachtsDb && yachtPricingDb) {
        const results = generateAllFiles(updatedFormData, yachtsDb, yachtPricingDb);
        // Берем строки, убираем лишние пробелы/табы по краям и разбиваем на массив по табуляции
        const excel3Array = results.file3_ExcelDetailed.trim().split('\t');
        const excel4Array = results.file4_ExcelSummary.trim().split('\t');
        
        // Склеиваем два массива в один (одна длинная строка для таблицы)
        const combinedPayload = [...excel3Array, ...excel4Array];

        fetch("https://script.google.com/macros/s/AKfycbyuLDe37hHuKYFIcTt_ABJdObc0lp-lG-jt0yf4lg4Y37E6vR91G_w7dJ_Zv9E6AIfAvw/exec", {
          method: "POST",
          // Отправляем как текст, чтобы избежать проблем с CORS, но внутри JSON
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(combinedPayload)
        })
        .then(res => console.log("Отправлено в Google Sheets", res))
        .catch(err => console.error("Ошибка при отправке в Google Sheets:", err));
      }
    } catch (error) {
      console.error("Ошибка генерации файлов для отправки", error);
    }
  };

  const handleCreateNewBooking = () => {
    setFormData(initialFormData);
    setCurrentBookingIndex(-1);
    setPassengerSelectionMode('max');
    setIsPriceManuallySet(false);
  };

  const loadBookingByIndex = (index: number, bookingsSource?: BookingData[], yachtsDataSource?: YachtDatabase) => {
    const currentBookings = bookingsSource || savedBookings;
    const currentYachtsDb = yachtsDataSource || yachtsDb;
    if (index >= 0 && index < currentBookings.length) {
      const booking = currentBookings[index];
      setFormData(booking);
      setCurrentBookingIndex(index);
      setIsPriceManuallySet(true); // When loading, assume price is fixed until changed.

      const yachtInfo = booking.yachtName && currentYachtsDb ? currentYachtsDb[booking.yachtName.trim()] : null;
      const maxPassengers = yachtInfo ? yachtInfo.max : 0;

      if (booking.passengers === 2) {
          setPassengerSelectionMode('couple');
      } else if (maxPassengers > 0 && booking.passengers === maxPassengers) {
          setPassengerSelectionMode('max');
      } else {
          setPassengerSelectionMode(null);
      }
    }
  };


  const handleDownloadAndDeleteCurrentBooking = () => {
    if (currentBookingIndex === -1) return;
    setShowConfirmModal(true);
  };

  const executeDownloadAndDelete = async () => {
    const bookingToDelete = savedBookings[currentBookingIndex];
    const orderNum = bookingToDelete.orderNumber || 'без_номера';
    
    setIsZipping(true);
    try {
      if (yachtsDb && yachtPricingDb) {
        const currentResults = generateAllFiles(bookingToDelete, yachtsDb, yachtPricingDb);
        const zip = new JSZip();

        zip.file(`לידר_הזמנה_${orderNum}_לקוח.txt`, currentResults.file1_BlankClient);
        zip.file(`לידר_הזמנה_${orderNum}_סופרוויזר.txt`, currentResults.file2_BlankSupplier);
        zip.file(`לידר_הזמנה_${orderNum}_אקסל_מפורט.csv`, currentResults.file3_ExcelDetailed);
        zip.file(`לידר_הזמנה_${orderNum}_אקסל_סיכום.csv`, currentResults.file4_ExcelSummary);

        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `הזמנה_${orderNum}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }

      const updatedBookings = savedBookings.filter((_, index) => index !== currentBookingIndex);
      setSavedBookings(updatedBookings);
      localStorage.setItem(LOCAL_STORAGE_SAVED_BOOKINGS_KEY, JSON.stringify(updatedBookings));

      if (updatedBookings.length === 0) {
        handleCreateNewBooking();
      } else {
        const newIndex = currentBookingIndex >= updatedBookings.length ? updatedBookings.length - 1 : currentBookingIndex;
        loadBookingByIndex(newIndex, updatedBookings);
      }
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Zip error:", err);
      alert("Ошибка при создании архива.");
    } finally {
      setIsZipping(false);
    }
  };

  if (isLoadingData) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><Anchor size={24} /></div>
            <h1 className="text-xl font-bold tracking-tight">לידר הפלגות - ניהול הזמנות</h1>
          </div>
          <div className="text-sm text-slate-500 font-medium">Booking System v2.5</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="text-blue-600" size={20} />פרטי ההזמנה</h2>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" name="isLeader" checked={formData.isLeader} onChange={handleChange} className="hidden" />
                <div className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 ${formData.isLeader ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${formData.isLeader ? '-translate-x-4' : ''}`}></div>
                </div>
                <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600 flex items-center gap-1"><UserCheck size={14} /> סוכן לידר</span>
              </label>
            </div>

            <div className="space-y-4">
              <button onClick={handleCreateNewBooking} className="w-full py-2 bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-300 transition-colors font-semibold"><FilePlus size={16} />צור הזמנה חדשה</button>
              
              <div className="flex gap-2 items-end">
                <label className="block flex-grow">
                  <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Tag size={14} /> מספר הזמנה</span>
                  <input type="text" value={formData.orderNumber || ''} readOnly className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-500 cursor-not-allowed" placeholder="מספר הזמנה - הקצה מספר" />
                </label>
                <button onClick={handleAssignOrderNumber} disabled={!!formData.orderNumber} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 relative">
                  <PlusCircle size={16} />הקצה מספר
                  {savedConfirmation && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-bounce-fade-in-out">נשמר!</span>}
                </button>
              </div>

              {savedBookings.length > 0 && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-slate-100 rounded-lg">
                  <button onClick={() => loadBookingByIndex(currentBookingIndex - 1)} disabled={currentBookingIndex <= 0} className="p-1 rounded-full hover:bg-slate-200 disabled:opacity-50"><ChevronRight size={20} /></button>
                  <span className="text-sm font-semibold text-slate-700 flex-grow text-center text-xs">הזמנה {currentBookingIndex + 1} מתוך {savedBookings.length}</span>
                  <button onClick={() => loadBookingByIndex(currentBookingIndex + 1)} disabled={currentBookingIndex >= savedBookings.length - 1} className="p-1 rounded-full hover:bg-slate-200 disabled:opacity-50"><ChevronLeft size={20} /></button>
                  <button onClick={handleDownloadAndDeleteCurrentBooking} className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded-lg flex items-center gap-1 hover:bg-red-200 transition-colors"><Trash2 size={12} />מחק והורד</button>
                </div>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><User size={14} /> שם לקוח</span>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="ישראל ישראלי" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Phone size={14} /> טלפון</span>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="05X-XXXXXXX" />
              </label>

              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Calendar size={14} /> תאריך</span>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="flex-grow px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    <label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                      <input type="checkbox" name="isWeekendOrHoliday" checked={formData.isWeekendOrHoliday} onChange={handleChange} className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" />
                      <span className="text-sm font-bold text-amber-800 whitespace-nowrap">סופ״ש וחגים</span>
                    </label>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Clock size={14} /> התחלה</span>
                                        {isDesktop ? (
                      <TimePicker24h name="startTime" value={formData.startTime} onChange={handleChange} />
                    ) : (
                      <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    )}
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Clock size={14} /> סיום</span>
                                        {isDesktop ? (
                      <TimePicker24h name="endTime" value={formData.endTime} onChange={handleChange} />
                    ) : (
                      <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    )}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Ship size={14} /> שם יאכטה</span>
                  <input type="text" name="yachtName" list="yachts" value={formData.yachtName} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="חפש יאכטה..." />
                  <datalist id="yachts">{yachtsDb && Object.keys(yachtsDb).map(n => <option key={n} value={n} />)}</datalist>
                </label>
                <div>
                  <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Users size={14} /> כמות מפליגים</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePassengerSelection('couple')}
                      className={`h-10 px-3 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors ${
                        passengerSelectionMode === 'couple'
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      זוג (2)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePassengerSelection('max')}
                      className={`h-10 px-3 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors ${
                        passengerSelectionMode === 'max'
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                      disabled={!maxPassengersForYacht}
                    >
                      מקסימום ({maxPassengersForYacht > 0 ? maxPassengersForYacht : 'N/A'})
                    </button>
                  </div>
                   <p className="text-xs text-slate-400 mt-1 text-center">
                    נוכחי: <span className="font-bold">{formData.passengers}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="relative">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700 mb-1">₪ מחיר סופי (ללא דופים)</span>
                    <input 
                      type="number" 
                      name="price" 
                      value={formData.price} 
                      onChange={handleChange} 
                      className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none transition-colors ${!isPriceManuallySet && formData.price > 0 ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-200' : 'focus:ring-2 focus:ring-blue-500'}`} />
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setIsPriceManuallySet(false)} 
                    className="absolute top-[29px] left-2 p-1 text-slate-400 hover:text-blue-600 rounded-full hover:bg-slate-200 transition-colors"
                    aria-label="חשב מחיר אוטומטית"
                    title="חשב מחיר אוטומטית"
                  >
                    <RefreshCcw size={14} />
                  </button>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 mb-1">₪ מקדמה</span>
                  <input type="number" name="downPayment" value={formData.downPayment} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2"><Wallet size={14} className="text-emerald-600" />תשלום לקוח במקום (יתרה)</span>
                <input type="number" name="onSitePayment" value={formData.onSitePayment} onChange={handleChange} className="w-full px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800" />
                <p className="text-[10px] text-slate-400 mt-1">* ברירת מחדל: 0 (יעשה שימוש ביתרת תשלום בבלנקים).</p>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><CreditCard size={14} /> שיטת תשלום מקדמה</span>
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><PlusCircle size={14} /> תוספות</span>
                <MultiSelectExtras selectedExtras={formData.selectedExtras} onSelectionChange={handleExtrasChange} selectedYachtName={formData.yachtName} yachtsDb={yachtsDb} />
              </label>
            </div>
          </div>
        </section>

        <section className="lg:col-span-8 space-y-6">
          {!results ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
              <FileText size={48} /><p className="text-lg font-medium">הזן פרטים כדי לצפות בבלנקים</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3"><FileText className="text-blue-700" size={18} /><h3 className="font-bold">בלנק 1: לקוח</h3></div>
                  <button onClick={() => handleCopy(results.file1_BlankClient, 'f1')} className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${copiedKey === 'f1' ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {copiedKey === 'f1' ? <Check size={18} /> : <Clipboard size={18} />}העתק הכל
                  </button>
                </div>
                <div className="p-6"><div className="bg-slate-50 p-6 rounded-xl border border-slate-200 whitespace-pre-wrap text-sm font-mono max-h-96 overflow-y-auto leading-relaxed">{results.file1_BlankClient}</div></div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3"><Settings className="text-amber-700" size={18} /><h3 className="font-bold">בלנק 2: סופרוויזר</h3></div>
                  <button onClick={() => handleCopy(results.file2_BlankSupplier, 'f2')} className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${copiedKey === 'f2' ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>
                    {copiedKey === 'f2' ? <Check size={18} /> : <Clipboard size={18} />}העתק לספק
                  </button>
                </div>
                <div className="p-6"><div className="bg-slate-50 p-6 rounded-xl border border-slate-200 whitespace-pre-wrap text-sm font-mono leading-relaxed">{results.file2_BlankSupplier}</div></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-emerald-700 flex items-center gap-2"><Table size={18} />Excel Detailed</h3>
                    <button onClick={() => handleCopy(results.file3_ExcelDetailed, 'f3')} className="p-1 hover:bg-emerald-50 rounded transition-colors">{copiedKey === 'f3' ? <Check size={18} className="text-green-600" /> : <Clipboard size={18} />}</button>
                  </div>
                  <div className="text-xs font-mono bg-slate-50 p-2 overflow-x-auto truncate text-slate-500">{results.file3_ExcelDetailed}</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-emerald-800 flex items-center gap-2"><Table size={18} />Excel Summary</h3>
                    <button onClick={() => handleCopy(results.file4_ExcelSummary, 'f4')} className="p-1 hover:bg-emerald-200 rounded transition-colors bg-emerald-100">{copiedKey === 'f4' ? <Check size={18} className="text-emerald-600" /> : <Clipboard size={18} className="text-emerald-700" />}</button>
                  </div>
                  <div className="text-sm font-mono bg-white p-3 rounded-lg border border-emerald-100 overflow-x-auto text-emerald-900 text-center font-bold shadow-inner">{results.file4_ExcelSummary}</div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isZipping && setShowConfirmModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl z-10 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-100 p-3 rounded-full text-red-600"><AlertTriangle size={28} /></div>
                <h3 className="text-xl font-bold text-slate-900">מחיקת הזמנה והורדת ארכיון</h3>
              </div>
              <p className="text-slate-600 mb-6 leading-relaxed">
                האם אתה בטוח שברצונך למחוק את הזמנתו של <strong>{savedBookings[currentBookingIndex]?.clientName}</strong>? 
                <br /><br />
                ארכיון ZIP מכיל את <strong>כל 4 הקבצים</strong> ייווצר ויורד למחשב שלך באופן אוטומטי.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={executeDownloadAndDelete} 
                  disabled={isZipping}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isZipping ? <RefreshCcw className="animate-spin" size={18} /> : <Download size={18} />}
                  הורד ומחק (ZIP)
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  disabled={isZipping}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setShowSuccessModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl z-10 max-sm w-full p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
              <Check size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">הפעולה הושלמה!</h3>
            <p className="text-slate-600 mb-6">ארכיון הקבצים הורד בהצלחה וההזמנה הוסרה מהרשימה.</p>
            <button onClick={() => setShowSuccessModal(false)} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors">
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
