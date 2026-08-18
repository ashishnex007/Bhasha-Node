import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'hi' | 'mr';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext =
  createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'bhasha_ui_language';

/*
 * ============================================================
 * ENGLISH GLOSSARY
 * ============================================================
 */

const ENGLISH_TRANSLATIONS: Record<string, string> = {
  'app.translateNow': 'Translate Now',
  'app.working': 'Working…',
  'app.result': 'Result',
  'app.inputSub': 'Upload a file, record audio, or type text below.',
  'app.processingSub': 'Using local AI — no internet needed.',
  'app.resultSub': 'Translation complete — 100% offline.',

  'header.history': 'History',
  'header.stm': 'Dictionary',
  'header.offline': 'Offline',
  'header.pastWork': 'Past Work',
  'header.wordList': 'Word List',
  'header.lightMode': 'Light mode',
  'header.darkMode': 'Dark mode',

  'ingestion.text': 'Text',
  'ingestion.audio': 'Audio',
  'ingestion.video': 'Video',
  'ingestion.ocr': 'OCR',
  'ingestion.translate': 'Translate',
  'ingestion.targetLanguage': 'Target language',
  'ingestion.upload': 'Upload file',
  'ingestion.selectFile': 'Select a file',
  'ingestion.enterText': 'Enter text',
  'ingestion.dropFile': 'Drop a file here',
  'ingestion.pickDevice': 'or click to select from your device',
  'ingestion.pdfImage': 'PDF / Image',
  'ingestion.recordVoice': 'Record voice',
  'ingestion.recording': 'Recording',
  'ingestion.stopRecording': 'Stop recording',
  'ingestion.typePaste': 'TYPE OR PASTE TEXT',
  'ingestion.placeholder': 'Enter or paste text here...',
  'ingestion.characters': 'characters',
  'ingestion.translateTo': 'Translate to',
  'ingestion.detectedSource': 'Detected source:',
  'ingestion.start': 'Start Translation',
  'ingestion.startTranslation': 'Start Translation',
  'ingestion.translating': 'Translating…',

  'result.translation': 'Translation',
  'result.original': 'Original',
  'result.translated': 'Translated',
  'result.back': 'Back',
  'result.download': 'Download',

  'history.title': 'Translation History',
  'history.empty': 'No translation history yet.',
  'history.close': 'Close',
  'history.savedTranslations': 'Saved Translations',

  'stm.title': 'Smart Translation Memory',
  'stm.subtitle': 'Saved words for quick and consistent translations.',
  'stm.savedWords': 'saved words',
  'stm.addNew': 'ADD NEW',
  'stm.englishWord': 'English word',
  'stm.correctTranslation': 'Correct translation',
  'stm.language': 'Language',
  'stm.save': 'Save',
  'stm.all': 'All',
  'stm.marathi': 'Marathi',
  'stm.hindi': 'Hindi',
  'stm.english': 'English',
  'stm.close': 'Close',

  'popup.title': 'Choose your language',
  'popup.subtitle': 'Choose the language for the Bhasha Node interface.',
  'popup.english': 'English',
  'popup.hindi': 'हिन्दी',
  'popup.marathi': 'मराठी',
  'popup.englishSub': 'Continue in English',
  'popup.hindiSub': 'हिन्दी में जारी रखें',
  'popup.marathiSub': 'मराठीत सुरू ठेवा',
};

/*
 * ============================================================
 * HINDI GLOSSARY
 * ============================================================
 */

const HINDI_TRANSLATIONS: Record<string, string> = {
  'app.translateNow': 'अभी अनुवाद करें',
  'app.working': 'काम चल रहा है…',
  'app.result': 'परिणाम',
  'app.inputSub': 'एक फ़ाइल अपलोड करें, ऑडियो रिकॉर्ड करें, या नीचे पाठ टाइप करें।',
  'app.processingSub': 'स्थानीय AI का उपयोग — इंटरनेट की आवश्यकता नहीं।',
  'app.resultSub': 'अनुवाद पूर्ण — 100% ऑफ़लाइन।',

  'header.history': 'इतिहास',
  'header.stm': 'शब्दकोश',
  'header.offline': 'ऑफ़लाइन',
  'header.pastWork': 'पिछला काम',
  'header.wordList': 'शब्द सूची',
  'header.lightMode': 'हल्का मोड',
  'header.darkMode': 'अंधेरा मोड',

  'ingestion.text': 'पाठ',
  'ingestion.audio': 'ऑडियो',
  'ingestion.video': 'वीडियो',
  'ingestion.ocr': 'OCR',
  'ingestion.translate': 'अनुवाद करें',
  'ingestion.targetLanguage': 'लक्ष्य भाषा',
  'ingestion.upload': 'फ़ाइल अपलोड करें',
  'ingestion.selectFile': 'एक फ़ाइल चुनें',
  'ingestion.enterText': 'पाठ दर्ज करें',
  'ingestion.dropFile': 'यहाँ एक फ़ाइल छोड़ें',
  'ingestion.pickDevice': 'या अपने डिवाइस से चुनने के लिए क्लिक करें',
  'ingestion.pdfImage': 'PDF / छवि',
  'ingestion.recordVoice': 'आवाज़ रिकॉर्ड करें',
  'ingestion.recording': 'रिकॉर्डिंग',
  'ingestion.stopRecording': 'रिकॉर्डिंग रोकें',
  'ingestion.typePaste': 'पाठ टाइप या पेस्ट करें',
  'ingestion.placeholder': 'यहां पाठ दर्ज या पेस्ट करें...',
  'ingestion.characters': 'वर्ण',
  'ingestion.translateTo': 'अनुवाद करना',
  'ingestion.detectedSource': 'पता चला स्रोत:',
  'ingestion.start': 'अनुवाद शुरू करें',
  'ingestion.startTranslation': 'अनुवाद शुरू करें',
  'ingestion.translating': 'अनुवाद जारी है…',

  'result.translation': 'अनुवाद',
  'result.original': 'मूल',
  'result.translated': 'अनुवादित',
  'result.back': 'पीछे',
  'result.download': 'डाउनलोड करें',

  'history.title': 'अनुवाद इतिहास',
  'history.empty': 'अभी तक कोई अनुवाद इतिहास नहीं।',
  'history.close': 'बंद करें',
  'history.savedTranslations': 'सहेजे गए अनुवाद',

  'stm.title': 'स्मार्ट अनुवाद मेमोरी',
  'stm.subtitle': 'तेज़ और सुसंगत अनुवाद के लिए सहेजे गए शब्द।',
  'stm.savedWords': 'सहेजे गए शब्द',
  'stm.addNew': 'नया जोड़ें',
  'stm.englishWord': 'अंग्रेजी शब्द',
  'stm.correctTranslation': 'सही अनुवाद',
  'stm.language': 'भाषा',
  'stm.save': 'सहेजें',
  'stm.all': 'सभी',
  'stm.marathi': 'मराठी',
  'stm.hindi': 'हिंदी',
  'stm.english': 'अंग्रेजी',
  'stm.close': 'बंद करें',

  'popup.title': 'अपनी भाषा चुनें',
  'popup.subtitle': 'Bhasha Node इंटरफ़ेस के लिए भाषा चुनें।',
  'popup.english': 'English',
  'popup.hindi': 'हिन्दी',
  'popup.marathi': 'मराठी',
  'popup.englishSub': 'English में जारी रखें',
  'popup.hindiSub': 'हिन्दी में जारी रखें',
  'popup.marathiSub': 'मराठीत सुरू ठेवा',
};

/*
 * ============================================================
 * MARATHI GLOSSARY
 * ============================================================
 */

const MARATHI_TRANSLATIONS: Record<string, string> = {
  'app.translateNow': 'आता भाषांतर करा',
  'app.working': 'काम चल रहे आहे…',
  'app.result': 'परिणाम',
  'app.inputSub': 'एक फाइल अपलोड करा, ऑडियो रेकॉर्ड करा, किंवा खाली पाठ टाइप करा।',
  'app.processingSub': 'स्थानिक AI वापरणे — इंटरनेट आवश्यक नाही।',
  'app.resultSub': 'भाषांतर पूर्ण — 100% ऑफलाइन।',

  'header.history': 'इतिहास',
  'header.stm': 'शब्दकोश',
  'header.offline': 'ऑफलाइन',
  'header.pastWork': 'मागील काम',
  'header.wordList': 'शब्द यादी',
  'header.lightMode': 'हलका मोड',
  'header.darkMode': 'गोड मोड',

  'ingestion.text': 'मजकूर',
  'ingestion.audio': 'ऑडियो',
  'ingestion.video': 'व्हिडिओ',
  'ingestion.ocr': 'OCR',
  'ingestion.translate': 'भाषांतर करा',
  'ingestion.targetLanguage': 'लक्ष्य भाषा',
  'ingestion.upload': 'फाइल अपलोड करा',
  'ingestion.selectFile': 'एक फाइल निवडा',
  'ingestion.enterText': 'मजकूर प्रविष्ट करा',
  'ingestion.dropFile': 'येथे फाइल ड्रॉप करा',
  'ingestion.pickDevice': 'किंवा तुमच्या डिव्हाइसमधून निवडण्यासाठी क्लिक करा',
  'ingestion.pdfImage': 'PDF / प्रतिमा',
  'ingestion.recordVoice': 'आवाज रेकॉर्ड करा',
  'ingestion.recording': 'रेकॉर्डिंग',
  'ingestion.stopRecording': 'रेकॉर्डिंग थांबवा',
  'ingestion.typePaste': 'मजकूर टाइप किंवा पेस्ट करा',
  'ingestion.placeholder': 'येथे मजकूर प्रविष्ट किंवा पेस्ट करा...',
  'ingestion.characters': 'वर्ण',
  'ingestion.translateTo': 'भाषांतर करा',
  'ingestion.detectedSource': 'सापडलेल्या स्रोत:',
  'ingestion.start': 'भाषांतर सुरू करा',
  'ingestion.startTranslation': 'भाषांतर सुरू करा',
  'ingestion.translating': 'भाषांतर सुरू आहे…',

  'result.translation': 'भाषांतर',
  'result.original': 'मूळ',
  'result.translated': 'भाषांतरित',
  'result.back': 'परत',
  'result.download': 'डाउनलोड करा',

  'history.title': 'भाषांतर इतिहास',
  'history.empty': 'अजून भाषांतर इतिहास नाही।',
  'history.close': 'बंद करा',
  'history.savedTranslations': 'जतन केलेले भाषांतर',

  'stm.title': 'स्मार्ट भाषांतर मेमरी',
  'stm.subtitle': 'जलद आणि सुसंगत भाषांतरांसाठी जतन केलेले शब्द।',
  'stm.savedWords': 'जतन केलेले शब्द',
  'stm.addNew': 'नवीन जोडा',
  'stm.englishWord': 'इंग्रजी शब्द',
  'stm.correctTranslation': 'योग्य भाषांतर',
  'stm.language': 'भाषा',
  'stm.save': 'जतन करा',
  'stm.all': 'सर्व',
  'stm.marathi': 'मराठी',
  'stm.hindi': 'हिंदी',
  'stm.english': 'इंग्रजी',
  'stm.close': 'बंद करा',

  'popup.title': 'आपली भाषा निवडा',
  'popup.subtitle': 'Bhasha Node इंटरफेसकरिता भाषा निवडा।',
  'popup.english': 'English',
  'popup.hindi': 'हिन्दी',
  'popup.marathi': 'मराठी',
  'popup.englishSub': 'English मध्ये सुरू ठेवा',
  'popup.hindiSub': 'हिन्दी में जारी रखें',
  'popup.marathiSub': 'मराठीत सुरू ठेवा',
};

/*
 * ============================================================
 * GLOSSARY MAP
 * ============================================================
 */

const GLOSSARIES: Record<Language, Record<string, string>> = {
  en: ENGLISH_TRANSLATIONS,
  hi: HINDI_TRANSLATIONS,
  mr: MARATHI_TRANSLATIONS,
};

/*
 * ============================================================
 * UTILITY FUNCTIONS
 * ============================================================
 */

function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
      return saved;
    }
  } catch {
    console.warn('[LANGUAGE] localStorage not available');
  }
  return 'en';
}

function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    console.log('[LANGUAGE] Saved language preference:', lang);
  } catch {
    console.warn('[LANGUAGE] Failed to save language preference');
  }
}

/*
 * ============================================================
 * PROVIDER
 * ============================================================
 */

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>(() => {
    return getSavedLanguage();
  });

  const [translations, setTranslations] = useState<Record<string, string>>(
    GLOSSARIES[language]
  );

  // Sync translations when language changes
  useEffect(() => {
    setTranslations(GLOSSARIES[language]);
  }, [language]);

  /*
   * ============================================================
   * CHANGE LANGUAGE — INSTANT SWITCH
   * ============================================================
   */

  const setLanguage = (newLanguage: Language) => {
    console.log('[LANGUAGE] Switching to:', newLanguage);

    if (newLanguage === language) {
      console.log('[LANGUAGE] Already using this language.');
      return;
    }

    // Switch immediately to the hardcoded glossary
    setCurrentLanguage(newLanguage);

    // Save preference to localStorage
    saveLanguage(newLanguage);

    console.log('[LANGUAGE] Language changed to:', newLanguage);
  };

  /*
   * ============================================================
   * TRANSLATION FUNCTION
   * ============================================================
   */

  const t = (key: string): string => {
    return translations[key] ?? GLOSSARIES.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

/*
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
}
//new2