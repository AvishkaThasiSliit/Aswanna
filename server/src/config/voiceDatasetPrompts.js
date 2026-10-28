/**
 * Standardized prompts for Aswanna Voice Dataset Collection (Phase 2).
 * Covers high-frequency agricultural expense categories, numbers, units, and code-switching.
 */

export const VOICE_DATASET_PROMPTS = [
  // ── Fertilizer Prompts ──
  {
    id: "VP-PRM-001",
    category: "fertilizer",
    language: "si",
    promptText: "යූරියා මිටි 2 ක් රුපියල් 14000 කට ගත්තා",
    englishMeaning: "Bought 2 bags of urea fertilizer for 14000 rupees",
    phoneticGuide: "Yuriya miti dekak rupiyal daahathardaahakata gattha"
  },
  {
    id: "VP-PRM-002",
    category: "fertilizer",
    language: "si",
    promptText: "ටි එස් පී පොහොර මිටියක් රුපියල් 8500 යි",
    englishMeaning: "One bag of TSP fertilizer was 8500 rupees",
    phoneticGuide: "TSP pohora mitiyak rupiyal ata dahas pansiyayi"
  },
  {
    id: "VP-PRM-003",
    category: "fertilizer",
    language: "en",
    promptText: "Bought two bags of urea fertilizer for 14000 rupees",
    englishMeaning: "Bought 2 bags of urea fertilizer for 14000 rupees"
  },

  // ── Pesticide & Agrochemical Prompts ──
  {
    id: "VP-PRM-004",
    category: "pesticide",
    language: "si",
    promptText: "කෘමිනාශක බෝතල් දෙකක් රුපියල් 4200 යි",
    englishMeaning: "Two bottles of pesticide cost 4200 rupees",
    phoneticGuide: "Kruminaashaka bothal dekak rupiyal haathardahas desiyayi"
  },
  {
    id: "VP-PRM-005",
    category: "pesticide",
    language: "si",
    promptText: "වල්නාශක ලීටර් 1 ක් රුපියල් 3500 කට මිලදී ගත්තා",
    englishMeaning: "Bought 1 liter of weedicide for 3500 rupees"
  },
  {
    id: "VP-PRM-006",
    category: "pesticide",
    language: "en",
    promptText: "Purchased 2 bottles of insecticide for 4200 rupees",
    englishMeaning: "Purchased 2 bottles of insecticide for 4200 rupees"
  },

  // ── Labor Prompts ──
  {
    id: "VP-PRM-007",
    category: "labor",
    language: "si",
    promptText: "කුලී වැඩට කුලීකරුවන් තිදෙනෙකුට රුපියල් 9000 ක් ගෙව්වා",
    englishMeaning: "Paid 9000 rupees to three laborers for hired work",
    phoneticGuide: "Kuli wedata kulikaruwan thidenekuta rupiyal namadhaahasak gewwa"
  },
  {
    id: "VP-PRM-008",
    category: "labor",
    language: "si",
    promptText: "අද දවසට කම්කරු කුලිය රුපියල් 3000 ක් ගෙව්වා",
    englishMeaning: "Paid 3000 rupees laborer fee for today"
  },
  {
    id: "VP-PRM-009",
    category: "labor",
    language: "en",
    promptText: "Paid 9000 rupees to three daily laborers for weeding",
    englishMeaning: "Paid 9000 rupees to three daily laborers for weeding"
  },

  // ── Machinery & Fuel Prompts ──
  {
    id: "VP-PRM-010",
    category: "machinery_fuel",
    language: "si",
    promptText: "ට්‍රැක්ටරයට ඩීසල් ලීටර් 10 ක් රුපියල් 3800 කට ගැහුවා",
    englishMeaning: "Filled 10 liters of diesel for tractor for 3800 rupees"
  },
  {
    id: "VP-PRM-011",
    category: "machinery_fuel",
    language: "si",
    promptText: "කුඹුර හෑමට ට්‍රැක්ටර් කුලිය රුපියල් 8500 ක් ගියා",
    englishMeaning: "Tractor plowing fee for the field was 8500 rupees"
  },
  {
    id: "VP-PRM-012",
    category: "machinery_fuel",
    language: "en",
    promptText: "Paid 8500 rupees for 2 hours of tractor plowing yesterday",
    englishMeaning: "Paid 8500 rupees for 2 hours of tractor plowing yesterday"
  },

  // ── Seeds & Plants Prompts ──
  {
    id: "VP-PRM-013",
    category: "seeds_plants",
    language: "si",
    promptText: "බීජ වී කිලෝ 30 ක් රුපියල් 7500 කට ගත්තා",
    englishMeaning: "Bought 30 kg of seed paddy for 7500 rupees"
  },
  {
    id: "VP-PRM-014",
    category: "seeds_plants",
    language: "en",
    promptText: "Bought 30 kilograms of seed paddy for 7500",
    englishMeaning: "Bought 30 kilograms of seed paddy for 7500"
  },

  // ── Transport & General Prompts ──
  {
    id: "VP-PRM-015",
    category: "transport",
    language: "si",
    promptText: "පොහොර ප්‍රවාහනය සඳහා ලොරි කුලිය රුපියල් 2500 ක් දුන්නා",
    englishMeaning: "Gave 2500 rupees lorry fare for fertilizer transportation"
  },
  {
    id: "VP-PRM-016",
    category: "general_expense",
    language: "si",
    promptText: "වතුර මෝටරය අලුත්වැඩියාවට රුපියල් 3200 ක් වියදම් වුනා",
    englishMeaning: "Spent 3200 rupees on water pump repair"
  }
];

export const PROMPT_CATEGORIES = [
  { id: "fertilizer", labelSi: "පොහොර", labelEn: "Fertilizer" },
  { id: "pesticide", labelSi: "කෘමිනාශක / බෙහෙත්", labelEn: "Pesticide & Agrochemicals" },
  { id: "labor", labelSi: "කම්කරු කුලී", labelEn: "Hired Labor" },
  { id: "machinery_fuel", labelSi: "යන්ත්‍ර සූත්‍ර හා ඉන්ධන", labelEn: "Machinery & Fuel" },
  { id: "seeds_plants", labelSi: "බීජ හා පැල", labelEn: "Seeds & Plants" },
  { id: "transport", labelSi: "ප්‍රවාහනය", labelEn: "Transport" },
  { id: "general_expense", labelSi: "සාමාන්‍ය නඩත්තු", labelEn: "General & Maintenance" }
];
