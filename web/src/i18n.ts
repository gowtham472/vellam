import { createContext, useContext } from 'react';
import type { Level, WaterDepth } from '../../engine/src/core/types.ts';

export type Language = 'en' | 'ta';

/**
 * Interface text in English and Tamil. The reasons behind an assessment come from the
 * engine in English only; the interface says so in Tamil, so nobody takes untranslated
 * text for a fault.
 */
const TEXT = {
  tagline: { en: 'Will my street flood?', ta: 'என் தெருவில் வெள்ளம் வருமா?' },
  intro: {
    en: 'Pick your area or tap your street on the map. Vellam reads the rain forecast, the ground, and the streets that flooded in 2015, and tells you what to expect and why.',
    ta: 'உங்கள் பகுதியைத் தேர்ந்தெடுங்கள் அல்லது வரைபடத்தில் உங்கள் தெருவைத் தொடுங்கள். மழை முன்னறிவிப்பு, நில அமைப்பு, 2015-ல் வெள்ளம் வந்த தெருக்கள் ஆகியவற்றை வைத்து என்ன எதிர்பார்க்கலாம், ஏன் என்று வெள்ளம் சொல்லும்.',
  },
  chooseArea: { en: 'Choose your area', ta: 'உங்கள் பகுதியைத் தேர்ந்தெடுங்கள்' },
  searchArea: { en: 'Search 65 Chennai localities', ta: '65 சென்னை பகுதிகளில் தேடுங்கள்' },
  useLocation: { en: 'Use my location', ta: 'என் இருப்பிடத்தைப் பயன்படுத்து' },
  locating: { en: 'Finding you', ta: 'இருப்பிடம் கண்டறியப்படுகிறது' },
  locationDenied: { en: 'Location is not available. Pick your area or tap the map.', ta: 'இருப்பிடம் கிடைக்கவில்லை. பகுதியைத் தேர்ந்தெடுங்கள் அல்லது வரைபடத்தைத் தொடுங்கள்.' },
  cityNow: { en: 'Chennai, next 48 hours', ta: 'சென்னை, அடுத்த 48 மணி நேரம்' },
  updated: { en: 'Updated', ta: 'புதுப்பிக்கப்பட்டது' },
  tapMap: { en: 'Tap anywhere on the map to check that exact spot', ta: 'குறிப்பிட்ட இடத்தைப் பார்க்க வரைபடத்தில் எங்கும் தொடுங்கள்' },
  next48: { en: 'Next 48 hours', ta: 'அடுத்த 48 மணி நேரம்' },
  why: { en: 'Why', ta: 'ஏன்' },
  whyNote: { en: '', ta: 'காரணங்கள் தற்போது ஆங்கிலத்தில் மட்டுமே உள்ளன.' },
  whatToDo: { en: 'What to do', ta: 'என்ன செய்ய வேண்டும்' },
  helplines: { en: 'Helplines', ta: 'உதவி எண்கள்' },
  share: { en: 'Send to my street group', ta: 'என் தெரு குழுவிற்கு அனுப்பு' },
  reportTitle: { en: 'Is there water on your street now?', ta: 'இப்போது உங்கள் தெருவில் தண்ணீர் உள்ளதா?' },
  reportNote: {
    en: 'Your report shows on the map for 48 hours. It stores the spot and the depth, nothing about you.',
    ta: 'உங்கள் தகவல் 48 மணி நேரம் வரைபடத்தில் காட்டப்படும். இடமும் ஆழமும் மட்டுமே சேமிக்கப்படும்; உங்களைப் பற்றி எதுவும் இல்லை.',
  },
  reportThanks: { en: 'Thank you. Your neighbours can see it now.', ta: 'நன்றி. உங்கள் அண்டை வீட்டார் இப்போது இதைப் பார்க்கலாம்.' },
  reportsNearby: { en: 'Reported by neighbours within 1.5 km', ta: '1.5 கி.மீ.க்குள் அண்டை வீட்டார் தெரிவித்தவை' },
  noReports: { en: 'No reports near here in the last 48 hours.', ta: 'கடந்த 48 மணி நேரத்தில் இங்கு அருகில் எந்தத் தகவலும் இல்லை.' },
  trackTitle: { en: 'How good has the forecast been here?', ta: 'இங்கு முன்னறிவிப்பு எவ்வளவு சரியாக இருந்தது?' },
  trackIntro: {
    en: 'Each day, the rain forecast a day ahead for this spot against the rain that fell.',
    ta: 'ஒவ்வொரு நாளும், இந்த இடத்திற்கு ஒரு நாள் முன்பு கணிக்கப்பட்ட மழையும் உண்மையில் பெய்த மழையும்.',
  },
  matched: { en: 'matched', ta: 'சரியாக இருந்தது' },
  under: { en: 'more rain than forecast', ta: 'கணிப்பை விட அதிக மழை' },
  over: { en: 'less rain than forecast', ta: 'கணிப்பை விட குறைவான மழை' },
  days: { en: 'days', ta: 'நாட்கள்' },
  heavyDays: { en: 'Days of heavy rain or more', ta: 'கனமழை அல்லது அதற்கு மேல் பெய்த நாட்கள்' },
  heavyNone: { en: 'No heavy rain fell here in this period, so the forecast has not been tested on the days that matter most.', ta: 'இந்தக் காலத்தில் இங்கு கனமழை பெய்யவில்லை; எனவே மிக முக்கியமான நாட்களில் முன்னறிவிப்பு இன்னும் சோதிக்கப்படவில்லை.' },
  forecastCol: { en: 'Forecast', ta: 'கணிப்பு' },
  fellCol: { en: 'Fell', ta: 'பெய்தது' },
  back: { en: 'All of Chennai', ta: 'சென்னை முழுவதும்' },
  replay: { en: 'Replay a past storm', ta: 'கடந்த புயலை மீண்டும் பார்' },
  replayIntro: {
    en: 'What Vellam would have said, given the rain that fell that day. This tests how it judges a place, not the forecast.',
    ta: 'அன்று பெய்த மழையை வைத்து வெள்ளம் என்ன சொல்லியிருக்கும். இது இடத்தை மதிப்பிடும் முறையைச் சோதிக்கிறது; முன்னறிவிப்பை அல்ல.',
  },
  live: { en: 'Live forecast', ta: 'நேரடி முன்னறிவிப்பு' },
  replayBadge: { en: 'Replay', ta: 'மறுபார்வை' },
  about: { en: 'How it works', ta: 'இது எப்படி வேலை செய்கிறது' },
  alertsTitle: { en: 'Get an email when flooding becomes likely', ta: 'வெள்ள அபாயம் ஏற்படும்போது மின்னஞ்சல் பெறுங்கள்' },
  alertsButton: { en: 'Alert me', ta: 'எனக்குத் தெரிவி' },
  email: { en: 'Email address', ta: 'மின்னஞ்சல் முகவரி' },
  loading: { en: 'Checking', ta: 'சரிபார்க்கிறது' },
  thisSpot: { en: 'This spot', ta: 'இந்த இடம்' },
  rain24: { en: 'mm in 24 h', ta: 'மி.மீ. / 24 மணி' },
  groundHeight: { en: 'Ground height', ta: 'நில உயரம்' },
  nearestWater: { en: 'Nearest water', ta: 'அருகிலுள்ள நீர்நிலை' },
  flooded2015: { en: 'Nearest street flooded in 2015', ta: '2015-ல் வெள்ளம் வந்த அருகிலுள்ள தெரு' },
  noneWithinKm: { en: 'none within 1 km', ta: '1 கி.மீ.க்குள் இல்லை' },
  notMapped: { en: 'not mapped here', ta: 'இங்கு வரைபடம் இல்லை' },
  language: { en: 'தமிழ்', ta: 'English' },
} as const;

export type TextKey = keyof typeof TEXT;

export const LEVEL_NAME: Record<Level, Record<Language, string>> = {
  LOW: { en: 'Low', ta: 'குறைவு' },
  WATCH: { en: 'Watch', ta: 'கவனம்' },
  HIGH: { en: 'High', ta: 'அதிகம்' },
  SEVERE: { en: 'Severe', ta: 'கடுமை' },
};

export const DEPTH_NAME: Record<WaterDepth, Record<Language, string>> = {
  NONE: { en: 'No water', ta: 'தண்ணீர் இல்லை' },
  ANKLE: { en: 'Ankle deep', ta: 'கணுக்கால் அளவு' },
  KNEE: { en: 'Knee deep', ta: 'முழங்கால் அளவு' },
  WAIST: { en: 'Waist deep or more', ta: 'இடுப்பளவு அல்லது அதிகம்' },
};

export const LanguageContext = createContext<Language>('en');

export function useText(): { language: Language; t: (key: TextKey) => string } {
  const language = useContext(LanguageContext);
  return { language, t: (key) => TEXT[key][language] };
}
