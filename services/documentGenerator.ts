
import { BookingData, GenerationResult, YachtDatabase, YachtPricingDatabase } from '../types';
import { EXTRAS_MAP, EXTRAS_PRICES } from '../constants';

export function generateAllFiles(
    data: BookingData,
    yachtsDb: YachtDatabase,
    yachtPricingDb: YachtPricingDatabase
): GenerationResult {
    // --- 0. PRE-PROCESSING ---
    const isLeader = data.isLeader;
    
    // Robust date formatting: handle yyyy-mm-dd and dd/mm/yyyy
    let formattedDate = '';
    if (data.date) {
        if (data.date.includes('-')) {
            // Probably YYYY-MM-DD (standard HTML5 date value or legacy)
            formattedDate = data.date.split('-').reverse().join('/');
        } else {
            // Probably DD/MM/YYYY or DD.MM.YYYY
            formattedDate = data.date.replace(/\./g, '/');
        }
    }

    let b2_Name = data.clientName;
    let b2_Phone = data.phone;

    if (isLeader) {
        b2_Name = "פרטי ##";
        b2_Phone = "0533403449";
    }

    // --- 1. CALCULATE DURATION ---
    const startSplit = data.startTime.split(':').map(Number);
    const endSplit = data.endTime.split(':').map(Number);
    const startDecimal = startSplit[0] + (startSplit[1] || 0) / 60;
    const endDecimal = endSplit[0] + (endSplit[1] || 0) / 60;
    let calcDuration = endDecimal - startDecimal;
    if (calcDuration < 0) calcDuration = 0;

    // --- 2. CALCULATE CLIENT PRICE ---
    let clientBasePrice = data.price;
    const priceNoteParts: string[] = [];
    const currentYacht = data.yachtName?.trim();

    const startHour = parseInt(data.startTime.split(':')[0], 10);
    const nightSurcharge = startHour >= 20 ? 150 : 0;
    if (nightSurcharge > 0) {
        priceNoteParts.push("תוספת לילה");
    }

    if (!clientBasePrice || clientBasePrice === 0) {
        if (data.yachtName && yachtPricingDb[currentYacht]) {
            const pricing = yachtPricingDb[currentYacht];

            // Determine which pricing rates to use
            if (data.passengers === 2 && pricing.coupleRates) {
                const couplePricing = pricing.coupleRates;
                priceNoteParts.push("מבצע זוגי");
                
                if (calcDuration > 2 && couplePricing.extraHour && couplePricing['2']) {
                    const extraHours = Math.ceil(calcDuration - 2);
                    clientBasePrice = couplePricing['2'] + (extraHours * couplePricing.extraHour);
                } else if (Math.abs(calcDuration - 1.5) < 0.01 && couplePricing['1.5']) {
                    clientBasePrice = couplePricing['1.5'];
                } else {
                    const durationKey = Math.round(calcDuration);
                    if (couplePricing[durationKey]) {
                        clientBasePrice = couplePricing[durationKey];
                    }
                }
            } else { // Use standard pricing
                if (calcDuration > 2 && pricing.extraHour && pricing['2']) {
                    const extraHours = Math.ceil(calcDuration - 2);
                    clientBasePrice = pricing['2'] + (extraHours * pricing.extraHour);
                } else if (Math.abs(calcDuration - 1.5) < 0.01 && pricing['1.5']) {
                    clientBasePrice = pricing['1.5'];
                } else {
                    const durationKey = Math.round(calcDuration);
                    if (pricing[durationKey]) {
                        clientBasePrice = pricing[durationKey];
                    }
                }

                if (pricing.note) {
                    priceNoteParts.push(pricing.note);
                }
            }
        }
    }

    let extraPrice = 0;
    const actualSelectedExtras = data.selectedExtras.filter(extra => extra !== 'none');
    if (actualSelectedExtras.length > 0) {
        actualSelectedExtras.forEach(extra => {
            extraPrice += EXTRAS_PRICES[extra] || 0;
        });
    }

    const finalClientPrice = clientBasePrice + extraPrice + nightSurcharge;
    const finalRemainingClient = finalClientPrice - data.downPayment;
    const priceNote = priceNoteParts.length > 0 ? ` (${priceNoteParts.join(', ')})` : "";


    // --- 3. CALCULATE NET COST AND COMMISSION ---
    let netCost = 0;
    let commission = 0;

    const group350Yachts = ["לי-ים", "ליים", "ג׳וי", "ג'וי", "גוי"];
    const group300Yachts = ["לואיז", "לויז", "בגירה"];
    const yachtsWithSpecialAgentRates = [...group350Yachts, ...group300Yachts];

    if (isLeader) {
        if (group350Yachts.includes(currentYacht)) {
            netCost = Math.round(calcDuration * 350) + extraPrice;
        } else if (group300Yachts.includes(currentYacht)) {
            netCost = Math.round(calcDuration * 300) + extraPrice;
        } else {
            netCost = finalClientPrice;
        }
        commission = 0;
    } else {
        if (yachtsWithSpecialAgentRates.includes(currentYacht)) {
            commission = finalClientPrice * 0.2;
            netCost = finalClientPrice - commission;
        } else {
            commission = 0;
            netCost = finalClientPrice;
        }
    }

    // --- 4. PREPARE GENERAL DATA ---
    let locationName = "הרצליה";
    let address = "כתובת שלנו : רחוב יורדי ים 1, הרצליה";
    let finalPassengers = data.passengers;

    if (data.yachtName) {
        const cleanName = data.yachtName.trim();
        const yachtInfo = yachtsDb[cleanName];
        if (yachtInfo) {
            if (yachtInfo.city === "Haifa") {
                locationName = "חיפה";
                address = "כתובת שלנו : רחוב הדייגים , חיפה";
            } else {
                locationName = "הרצליה";
                address = "כתובת שלנו : רחוב יורדי ים 1, הרצליה";
            }
            if (!finalPassengers || finalPassengers === 0) {
                finalPassengers = yachtInfo.max;
            }
        }
    }

    let blank1DetailedExtraList = "";
    if (actualSelectedExtras.length > 0) {
        blank1DetailedExtraList += "תוספות נבחרות:\n";
        actualSelectedExtras.forEach(extra => {
            let extraDisplayName = EXTRAS_MAP[extra] || extra;
            if (extra === 'fishing') {
                extraDisplayName = 'דייג, עד 8 דייגים,כולל חכות , פטיונות, רישיון דייג ליום אחד. נבקש למסור לנו מס\'תעודת זהות, שם ושם משפחה של כל אדם שרוצה להחזיק חקה. לצורך פתיחת רישיון דייג ליום אחד , במשרד חקלאות.';
            }
            const currentExtraPrice = EXTRAS_PRICES[extra] || 0;
            blank1DetailedExtraList += `* ${extraDisplayName} - ${currentExtraPrice} ₪\n`;
        });
    } else {
        blank1DetailedExtraList = `* ללא תוספות מיוחדות. \n`;
    }

    let bbqInstructions = "";
    const isTyphoonOrKing = (currentYacht === "טייפון" || currentYacht === "קינג");
    const isHaifa = locationName === "חיפה";

    if (isTyphoonOrKing && isHaifa && Math.abs(calcDuration - 3) < 0.01) {
        bbqInstructions = `
אפשרות לעשות על האש (גריל) ושירות גרילמן ללא תוספת תשלום - רק בהזמנה של 3 שעות .

*הנחיות*
 וציוד נדרש (במידה ועושים "על האש")
במידה והנכם מעוניינים להשתמש במנגל, יש להצטייד מראש ב:
  2-3 שקיות פחמים ומדליק פחמים.
 מפה חד-פעמית, כלים חד-פעמיים, קערות ומגשים.
 מומלץ מאוד להביא בשר ומוצרים נלווים כשהם כבר מופשרים ומוכנים לצלייה.
`;
    }

    let priceIncludesContent = "";
    const isDolphin = currentYacht === "דולפין";

    if (isDolphin) {
        priceIncludesContent = `
מחיר הזמנה כולל:
* קישוט היאכטה עם
* שלט "מזל טוב"
* מערכת מוזיקה מוגברת
* עם מיקרופון (רק לדיבור)
* שלושה אנשי צוות המלווים אתכם ונותנים שירות.
* מזרן ים גדול.
* גלגלי הצלה וחגורות ציפה לירידה למים.
`;
    } else if (isTyphoonOrKing) {
        priceIncludesContent = `
מחיר ההזמנה כולל:
* בלונים בתוך היאכטה.
* שלט "מזל טוב".
`;
    } else {
        priceIncludesContent = `
מחיר ההזמנה כולל:
* בקבוק שמפניה
* בלונים בתוך היאכטה.
* שלט "מזל טוב".
* מים
`;
    }

    const prefixedOrderNumber = data.orderNumber ? `לידר הזמנות:${data.orderNumber}` : '';
    const orderNumberLineBlank1 = data.orderNumber ? `${prefixedOrderNumber}\n` : '';

    // --- 5. GENERATE FILE 1 (CLIENT) ---
    const blank1 = `לכבוד:
${data.clientName}
 מספר טלפון:
${data.phone}
הנדון:
 אישור הזמנת שייט ביאכטה
${orderNumberLineBlank1}אנו שמחים לאשר את הזמנת השייט שלך עם " לידר הפלגות ". פרטי הזמנתך הם כדלקמן:
* תאריך ההפלגה: ${formattedDate}
* שעת התחלה: ${data.startTime}
* שעת סיום: ${data.endTime}
    זמן  נטו:
מהשעה רשומה עד לשעה רשומה .
לא תנתן זמן נוסף.
* היאכטה תשוב לרציף כ-15 דקות לפני תום הזמן.
 שם יאכטה :
*  "   ${data.yachtName} "
 עד ${finalPassengers} מפליגים!
(נחשב כל נושם , גם תינוקות)
* או כל יאכטה אחרת בצי החברה המתאימה לכמות המפליגים שצוינה בהזמנה.

* נקודת יציאה:
* מרינה ${locationName} .
* ${address}
* ---------------------------------
פרטי תשלום:
* מחיר הזמנה הכולל:
 סה"כ ${finalClientPrice} ₪${priceNote}.
* מקדמה נדרשת: ${data.downPayment} ₪
 את המקדמה ניתן להעביר
כרטיס אשראי (עסקה טלפונית או קישור לתשלום מאובטח)
באמצעות אפליקציית PayBox,
 או העברה בנקאית ,
 הערה: ההזמנה תיכנס לתוקף רק לאחר קבלת המקדמה ואישור הלקוח/ה על פרטי ההזמנה.
 יתרת תשלום: ${finalRemainingClient} ₪
* יתרת התשלום תשולם במועד ההפלגה במזומן,
או באמצעות כרטיס אשראי (עסקה טלפונית או קישור לתשלום מאובטח).
${priceIncludesContent}
${blank1DetailedExtraList}${bbqInstructions}
המחיר אינו כולל שירות/טיפ לסקיפר.
-----------------------------
מומלץ להשתמש בכדורים נגד בחילה ללא מרשם כשעה לפני תחילת השייט!
1.  הגעה בזמן: יש להגיע בשעה הנקובה על מנת לקבל תדריך בטיחותי ולסיים את כל סידורי הניהול לפני היציאה.
2.  רחצה בים: הרחצה בים היא באחריות המתרחץ/ת בלבד.
* הירידה למים תתאפשר אך ורק על פי החלטתו הבלעדית של הסקיפר ובמידה ותנאי הים מאפשרים זאת.
* לא תתאפשר רחצה בשעות החשיכה.
* אין גרירת אבוב .
3.  איחור לקוח: כל איחור של הלקוח/ה ייגרע מזמן השייט הכולל שנקבע מראש. אין החזר כספי בגין איחור.
4.  ביטוח: היאכטות מבוטחות בביטוח צד ג'.
5.  ניקיון ואחריות לציוד אישי:
* במידה ואתם מביאים איתכם אוכל ושתייה, אנא דאגו לפנות את האשפה ולהשאיר את היאכטה נקייה לפני סיום ההפלגה.
* במקרה והיאכטה לא תישאר נקייה, או אם פינוי היאכטה יתבצע לאחר המועד הנקוב, תחויבו בסך השווה לעלות שעת הפלגה אחת.

* אחריות במקרה של אובדן או נזק לטלפון סלולרי או כל פריט אחר הנופל למים תחול על המפליג/ה באופן בלעדי.
6.  ליווי: חובה נוכחות של מלווה מעл גיל 16 (מטעם הלקוח/ה) בכל הפלגה.
7.  אלכוהול ואיסורים:
*  שתיית אלכוהול מתחת לגיל 18 אסורה בהחלט.
* אין להגיע להפלגה עם נרגילה או לעלות ליאכטה עם נרגילה.
* אסור בהחלט להפיץ קונפטי ביאכטה.
* אין אפשרות להגיע להפלגה עם מנגל או לעשות ברביקיו על היאכטה.
8.  אחריות אישית: על המזמין/ה חלה האחריות הבלעדית להבהיר את כל תנאי ההסכם המפורטים בחוזה זה לכל המוזמנים/ות מטעמו/ה.
--------------------------------------
 מדיניות ביטולים ושינויים
9.  מזג אוויר ותנאי ים:
* האירוע עשוי להידחות במידה ומזג האוויר אינו מאפשר את קיומו בצורה בטוחה.
במקרה כזה, ההפלגה תתואם למועד חלופי קרוב ביותר האפשרי.
לא יינתן החזר כספי או פיצוי בגין שינוי מועד עקב מזג אוויר.
* "לידר הפלגות" אינה אחראית למצב הים ואינה אחראית למצב הים ומזג האוויר.
10. ביטול הזמנה מול החזר כספי:
* ביטול הזמנה כנגד החזר כספי  (למעט דמי טיפול) יתאפשר רק עד 14 ימים ממועד הפעילות. בכל מקרה, ינוכו דמי טיפול בסך 400 ₪.
* במידה ויתבצע ביטול הזמנה בין 14 ימים ל-48 שעות ממועד הפעילות, ייגבו 50% מעלות האירוע.
* במקרה של ביטול הזמנה בתוך 48 שעות ממועד האירוע, יחויב המזמין/ה במחיר המלא של ההזמנה.
11. כוח עליון: במקרה של נסיבות בלתי צפויות שאינן בשליטת הספק, כגון פרוץ מלחמה, אסון טבע או כל אירוע המוגדר כ"כוח עליון", תינתן למזמין/ה אפשרות לדחות את מועד האירוע למועד חלופי בלבד, ללא החזר כספי.
---------------------------------------
  הוראות הגעה
יש להגיע למרינה , כ-10 דקות לפני המועד שנקבע.
סקיפר יקבל את פניכם ויוביל אתכם ליאכטה.
מספר טלפון של סקיפר
וקישור לוייז - ישלח לכם יום אחד לפני מועד שייט .
-------------------------------
אישור הלקוח/ה:
אני מאשר/ת  שקראתי והבנתי את כל פרטי ההזמנה ואת תנאי החוזה המפורטים לעיל, ומסכים להם.
נא לאשר את פרטי ההזמנה ואת תנאי החוזה על ידי כתיבה מילת
 מאשר / מאשרת.
מאשר/ת פרטים בהזמנה : ???`;

    // --- 6. GENERATE FILE 2 (SUPPLIER) ---
    let blank2DetailedExtraList = "";
    if (actualSelectedExtras.length > 0) {
        blank2DetailedExtraList += "תוספות נבחרות:\n";
        actualSelectedExtras.forEach(extra => {
            const extraDisplayName = EXTRAS_MAP[extra] || extra;
            const currentExtraPrice = EXTRAS_PRICES[extra] || 0;
            blank2DetailedExtraList += `* ${extraDisplayName} - ${currentExtraPrice} ₪\n`;
        });
    } else {
        blank2DetailedExtraList = `* ללא תוספות מיוחדות. \n`;
    }

    // (מג) Logic Recalculation
    const effectiveOnSitePayment = isLeader ? 0 : (data.onSitePayment !== 0 ? data.onSitePayment : finalRemainingClient);
    const paidAtSupplierInitial = data.paymentMethod === "credit_card" ? data.downPayment : 0;
    
    // Amount due from agent to supplier = Net Cost - (What they already have) - (What they will get from client on site)
    const calculatedDueAmount = netCost - paidAtSupplierInitial - effectiveOnSitePayment;
    const dueFromAgentToSupplier = Math.max(0, calculatedDueAmount);

    let lineNumOffset = data.orderNumber ? 1 : 0;
    let b2_line_1_orderNumber = data.orderNumber ? `1. ${prefixedOrderNumber}\n` : '';

    let b2_line_2_ref = `2. מפנה : דניאל סוכן`;
    let b2_line_3_date = `${3 + lineNumOffset}. הזמנה לתאריך ${formattedDate}`;
    let b2_line_4_time = `${4 + lineNumOffset}. משעה ${data.startTime} עד ${data.endTime}`;
    let b2_line_5_client = `${5 + lineNumOffset}. לקוח: ${b2_Name}`;
    let b2_line_6_phone = `${6 + lineNumOffset}. טלפון : ${b2_Phone}`;
    let b2_line_7_yacht = `${7 + lineNumOffset}. יאכטה ${data.yachtName} :`;
    let b2_line_8_passengers = `${8 + lineNumOffset}. עד ${finalPassengers} מפליגים`;
    let b2_line_9_extras = `${9 + lineNumOffset}. ${blank2DetailedExtraList.trim()}`;
    
    // Blank 2 logic: 
    // Line 10 (עלות לקוח) is 0 if isLeader.
    // Line 11 (עלות ספק) is netCost.
    const b2_ClientPriceDisplay = isLeader ? 0 : finalClientPrice;
    let b2_line_10_clientPrice = `${10 + lineNumOffset}. עלות לקוח: ${b2_ClientPriceDisplay} ₪ ${isLeader ? "" : priceNote}`;
    let b2_line_11_price = `${11 + lineNumOffset}. עלות ספק: ${netCost} ₪`;

    let b2_line_12_payment = "";
    if (data.paymentMethod === "credit_card") {
        b2_line_12_payment = `${12 + lineNumOffset}. שולם אצלכם (מקדמה): ${data.downPayment} ₪`;
    } else {
        b2_line_12_payment = `${12 + lineNumOffset}. שולם אצלי (מקדמה): ${data.downPayment} ₪`;
    }

    let b2_line_13_due = `${13 + lineNumOffset}. מגיע לכם ממני: ${dueFromAgentToSupplier} ₪`;
    let b2_line_14_onSite = `${14 + lineNumOffset}. תשלום לקוח במקום: ${effectiveOnSitePayment} ₪`;

    const commissionText = commission > 0 ? ` (20 אחוז)` : '';
    const b2_line_15_commission = `${15 + lineNumOffset}. עמלת מפנה${commissionText}: ${commission} ₪`;
    const b2_line_16_request = `${16 + lineNumOffset}. נא להחזיר / לרשום לי מספר הזמנה`;

    const blank2 = `${b2_line_1_orderNumber}${b2_line_2_ref}
${b2_line_3_date}
${b2_line_4_time}
${b2_line_5_client}
${b2_line_6_phone}
${b2_line_7_yacht}
${b2_line_8_passengers}
${b2_line_9_extras}
${b2_line_10_clientPrice}
${b2_line_11_price}
${b2_line_12_payment}
${b2_line_13_due}
${b2_line_14_onSite}
${b2_line_15_commission}
${b2_line_16_request}
---------------------------------------------`;

    // --- 7. GENERATE EXCEL FILES ---
    // Rule for "Cost" in Excel (עלות): Match Blank 2's "Supplier Cost" (netCost in leader mode)
    const excelCostToDisplay = isLeader ? netCost : finalClientPrice;
    
    const paidAtAgent = data.paymentMethod === "paybox_transfer" ? data.downPayment : 0;
    const b2_dueToAgent = Math.max(0, commission - paidAtAgent);

    // Clean phone number for Excel output: remove +972 prefix
    const excelPhone = data.phone.replace(/^\+972-? ?/, '');

    // Rule for Excel Detailed: 
    // - "סכום ההזמנה" (Column 8) must be the Blank 1 price (finalClientPrice)
    // - "עלות" (Column 10) must be the Blank 2 supplier cost (excelCostToDisplay)
    const excel3 = `${formattedDate}\t?\t${data.clientName}\t${data.clientName}\t${excelPhone}\t${data.yachtName}\t${data.startTime}-${data.endTime}\t${finalClientPrice}\t${calcDuration.toFixed(1)}\t${excelCostToDisplay}\t${netCost}\t${effectiveOnSitePayment}\t${paidAtSupplierInitial}\t${paidAtAgent}\t${dueFromAgentToSupplier}\t${b2_dueToAgent}\t${commission}\t${data.orderNumber || ''}\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t`;
    
    // Rule for Excel Summary: Column 4 must be the Blank 2 supplier cost (excelCostToDisplay)
    const excel4 = `${formattedDate}\t?\t${calcDuration.toFixed(1)}\t${excelCostToDisplay}\t${netCost}\t${effectiveOnSitePayment}\t${paidAtSupplierInitial}\t${paidAtAgent}\t${dueFromAgentToSupplier}\t${b2_dueToAgent}\t${commission}\t${data.orderNumber || ''}\t`;

    return {
        file1_BlankClient: blank1,
        file2_BlankSupplier: blank2,
        file3_ExcelDetailed: excel3,
        file4_ExcelSummary: excel4
    };
}
