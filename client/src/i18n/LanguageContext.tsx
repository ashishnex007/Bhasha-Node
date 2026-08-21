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
  hasSelectedLanguage: boolean;
}

const LanguageContext =
  createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'bhasha_ui_language';
const SELECTED_KEY = 'bhasha_language_selected';
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

  'job.somethingWrong': 'Something went wrong',
  'job.done': 'Done',
  'job.working': 'Working',
  'job.translationReady': 'Your translation is ready.',
  'job.tryAgain': 'Try Again',
  'job.thisMayTake': 'This may take a moment...',
  'job.waiting': 'Waiting',
  'job.preparingAudio': 'Preparing audio',
  'job.listening': 'Listening',
  'job.changingLanguage': 'Changing language',
  'job.creatingVoice': 'Creating voice',
  'job.readingDocument': 'Reading document',
  'job.gettingAudio': 'Getting audio',
  'job.combiningVideo': 'Combining video',
  'job.allDone': 'All done',

  'result.translateAgain': 'Translate Again',
  'result.doneOffline': 'Done · 100% Offline',
  'result.translatedVideo': 'Translated Video',
  'result.originalText': 'Original Text',
  'result.yourTranslation': 'Your Translation',
  'result.voiceOutput': 'Voice Output',
  'result.saveDownload': 'Save / Download',
  'result.text': 'Text',
  'result.pdf': 'PDF',
  'result.audio': 'Audio',
  'result.video': 'Video',

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
  'ingestion.ocr': 'ओसीआर',
  'ingestion.translate': 'अनुवाद करें',
  'ingestion.targetLanguage': 'लक्ष्य भाषा',
  'ingestion.upload': 'फ़ाइल अपलोड करें',
  'ingestion.selectFile': 'एक फ़ाइल चुनें',
  'ingestion.enterText': 'पाठ दर्ज करें',
  'ingestion.dropFile': 'यहाँ एक फ़ाइल छोड़ें',
  'ingestion.pickDevice': 'या अपने डिवाइस से चुनने के लिए क्लिक करें',
  'ingestion.pdfImage': 'पीडीएफ / छवि',
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

  'job.somethingWrong': 'कुछ गलत हो गया',
  'job.done': 'पूर्ण',
  'job.working': 'काम चल रहा है',
  'job.translationReady': 'आपका अनुवाद तैयार है।',
  'job.tryAgain': 'फिर से प्रयास करें',
  'job.thisMayTake': 'इसमें कुछ समय लग सकता है...',
  'job.waiting': 'प्रतीक्षा हो रही है',
  'job.preparingAudio': 'ऑडियो तैयार किया जा रहा है',
  'job.listening': 'सुना जा रहा है',
  'job.changingLanguage': 'भाषा बदली जा रही है',
  'job.creatingVoice': 'आवाज़ बनाई जा रही है',
  'job.readingDocument': 'दस्तावेज़ पढ़ा जा रहा है',
  'job.gettingAudio': 'ऑडियो प्राप्त किया जा रहा है',
  'job.combiningVideo': 'वीडियो जोड़ा जा रहा है',
  'job.allDone': 'सब कुछ पूर्ण',

  'result.translateAgain': 'फिर से अनुवाद करें',
  'result.doneOffline': 'पूर्ण · 100% ऑफ़लाइन',
  'result.translatedVideo': 'अनुवादित वीडियो',
  'result.originalText': 'मूल पाठ',
  'result.yourTranslation': 'आपका अनुवाद',
  'result.voiceOutput': 'आवाज़ आउटपुट',
  'result.saveDownload': 'सहेजें / डाउनलोड करें',
  'result.text': 'पाठ',
  'result.pdf': 'पीडीएफ',
  'result.audio': 'ऑडियो',
  'result.video': 'वीडियो',

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
  'ingestion.ocr': 'ओसीआर',
  'ingestion.translate': 'भाषांतर करा',
  'ingestion.targetLanguage': 'लक्ष्य भाषा',
  'ingestion.upload': 'फाइल अपलोड करा',
  'ingestion.selectFile': 'एक फाइल निवडा',
  'ingestion.enterText': 'मजकूर प्रविष्ट करा',
  'ingestion.dropFile': 'येथे फाइल ड्रॉप करा',
  'ingestion.pickDevice': 'किंवा तुमच्या डिव्हाइसमधून निवडण्यासाठी क्लिक करा',
  'ingestion.pdfImage': 'पीडीएफ / प्रतिमा',
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

  'job.somethingWrong': 'काहीतरी चूक झाली',
  'job.done': 'पूर्ण झाले',
  'job.working': 'काम सुरू आहे',
  'job.translationReady': 'तुमचे भाषांतर तयार आहे.',
  'job.tryAgain': 'पुन्हा प्रयत्न करा',
  'job.thisMayTake': 'यासाठी थोडा वेळ लागू शकतो...',
  'job.waiting': 'प्रतीक्षा करत आहे',
  'job.preparingAudio': 'ऑडिओ तयार करत आहे',
  'job.listening': 'ऐकत आहे',
  'job.changingLanguage': 'भाषा बदलत आहे',
  'job.creatingVoice': 'आवाज तयार करत आहे',
  'job.readingDocument': 'दस्तऐवज वाचत आहे',
  'job.gettingAudio': 'ऑडिओ मिळवत आहे',
  'job.combiningVideo': 'व्हिडिओ एकत्र करत आहे',
  'job.allDone': 'सर्व पूर्ण झाले',

  'result.translateAgain': 'पुन्हा भाषांतर करा',
  'result.doneOffline': 'पूर्ण · 100% ऑफलाइन',
  'result.translatedVideo': 'भाषांतरित व्हिडिओ',
  'result.originalText': 'मूळ मजकूर',
  'result.yourTranslation': 'तुमचे भाषांतर',
  'result.voiceOutput': 'आवाज आउटपुट',
  'result.saveDownload': 'जतन करा / डाउनलोड करा',
  'result.text': 'मजकूर',
  'result.pdf': 'पीडीएफ',
  'result.audio': 'ऑडिओ',
  'result.video': 'व्हिडिओ',

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

const GLOSSARIES: Record<
  Language,
  Record<string, string>
> = {
  en: ENGLISH_TRANSLATIONS,
  hi: HINDI_TRANSLATIONS,
  mr: MARATHI_TRANSLATIONS,
};

/*
 * ============================================================
 * STORAGE
 * ============================================================
 */

function getSavedLanguage(): Language {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (
      saved === 'en' ||
      saved === 'hi' ||
      saved === 'mr'
    ) {
      return saved;
    }
  } catch {
    console.warn(
      '[LANGUAGE] localStorage unavailable'
    );
  }

  return 'en';
}

function hasSavedLanguage(): boolean {
  try {
    return (
      localStorage.getItem(
        SELECTED_KEY
      ) === 'true'
    );
  } catch {
    return false;
  }
}

function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      lang
    );

    localStorage.setItem(
      SELECTED_KEY,
      'true'
    );

    console.log(
      '[LANGUAGE] Saved:',
      lang
    );
  } catch {
    console.warn(
      '[LANGUAGE] Could not save language'
    );
  }
}

/*
 * ============================================================
 * PROVIDER
 * ============================================================
 */

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setCurrentLanguage] =
    useState<Language>(() =>
      getSavedLanguage()
    );

  const [hasSelectedLanguage, setHasSelectedLanguage] =
    useState<boolean>(() =>
      hasSavedLanguage()
    );

  const [translations, setTranslations] =
    useState<Record<string, string>>(
      GLOSSARIES[language]
    );

  useEffect(() => {
    setTranslations(
      GLOSSARIES[language]
    );
  }, [language]);

  const setLanguage = (
    newLanguage: Language
  ) => {
    console.log(
      '[LANGUAGE] Switching to:',
      newLanguage
    );

    // Update UI immediately
    setCurrentLanguage(newLanguage);

    // Mark onboarding as completed
    setHasSelectedLanguage(true);

    // Persist both language + onboarding state
    saveLanguage(newLanguage);
  };

  const t = (key: string): string => {
    return (
      translations[key] ??
      GLOSSARIES.en[key] ??
      key
    );
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        hasSelectedLanguage,
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
  const context =
    useContext(LanguageContext);

  if (!context) {
    throw new Error(
      'useLanguage must be used inside LanguageProvider'
    );
  }

  return context;
}