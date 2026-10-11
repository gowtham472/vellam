import { createContext, useContext } from 'react';
import type { Level, WaterDepth } from '../../engine/src/core/types.ts';

export type Language = 'en' | 'ta';

/**
 * Interface text in English and Tamil. The reasons behind an assessment and the method
 * page come from the engine and the documentation in English only; the interface says so
 * in Tamil, so nobody takes untranslated text for a fault.
 */
const TEXT = {
  // Navigation
  navHome: { en: 'Home', ta: 'முகப்பு' },
  navCheck: { en: 'Check', ta: 'பார்' },
  navReplay: { en: 'Replay', ta: 'மறுபார்வை' },
  navPrepare: { en: 'Prepare', ta: 'தயாராகு' },
  navHow: { en: 'How it works', ta: 'எப்படி?' },
  language: { en: 'தமிழ்', ta: 'English' },
  themeDark: { en: 'Dark theme', ta: 'இருள் நிறம்' },
  themeLight: { en: 'Light theme', ta: 'ஒளி நிறம்' },

  // Check
  chooseArea: { en: 'Choose your area', ta: 'உங்கள் பகுதியைத் தேர்ந்தெடுங்கள்' },
  searchArea: { en: 'Search 65 Chennai localities', ta: '65 சென்னை பகுதிகளில் தேடுங்கள்' },
  useLocation: { en: 'Use my location', ta: 'என் இருப்பிடம்' },
  locating: { en: 'Finding you', ta: 'கண்டறிகிறது' },
  locationDenied: { en: 'Location is not available. Pick your area or tap the map.', ta: 'இருப்பிடம் கிடைக்கவில்லை. பகுதியைத் தேர்ந்தெடுங்கள் அல்லது வரைபடத்தைத் தொடுங்கள்.' },
  checkTitle: { en: 'Check a street', ta: 'ஒரு தெருவைப் பாருங்கள்' },
  checkIntro: { en: 'Pick a locality, use your location, or tap the exact spot on the map.', ta: 'பகுதியைத் தேர்ந்தெடுங்கள், உங்கள் இருப்பிடத்தைப் பயன்படுத்துங்கள், அல்லது வரைபடத்தில் இடத்தைத் தொடுங்கள்.' },
  cityNow: { en: 'Chennai, next 48 hours', ta: 'சென்னை, அடுத்த 48 மணி நேரம்' },
  updated: { en: 'Updated', ta: 'புதுப்பிக்கப்பட்டது' },
  tapMap: { en: 'Tap anywhere on the map to check that exact spot', ta: 'குறிப்பிட்ட இடத்தைப் பார்க்க வரைபடத்தில் எங்கும் தொடுங்கள்' },
  atRiskTitle: { en: 'Localities at risk', ta: 'அபாயத்தில் உள்ள பகுதிகள்' },
  allClear: { en: 'No locality is at high risk right now.', ta: 'தற்போது எந்தப் பகுதியும் அதிக அபாயத்தில் இல்லை.' },

  // Place
  next48: { en: 'Next 48 hours', ta: 'அடுத்த 48 மணி நேரம்' },
  worstAround: { en: 'Worst around', ta: 'அதிக அபாய நேரம்:' },
  hoursFrom: { en: '48 h from', ta: '48 மணி நேரம்:' },
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
  heavyNone: {
    en: 'No heavy rain fell here in this period, so the forecast has not been tested on the days that matter most.',
    ta: 'இந்தக் காலத்தில் இங்கு கனமழை பெய்யவில்லை; எனவே மிக முக்கியமான நாட்களில் முன்னறிவிப்பு இன்னும் சோதிக்கப்படவில்லை.',
  },
  forecastCol: { en: 'Forecast', ta: 'கணிப்பு' },
  fellCol: { en: 'Fell', ta: 'பெய்தது' },
  dateCol: { en: 'Date', ta: 'தேதி' },
  back: { en: 'All of Chennai', ta: 'சென்னை முழுவதும்' },
  thisSpot: { en: 'About this spot', ta: 'இந்த இடம் பற்றி' },
  rain24: { en: 'mm in 24 h', ta: 'மி.மீ. / 24 மணி' },
  groundHeight: { en: 'Ground height', ta: 'நில உயரம்' },
  nearestWater: { en: 'Nearest water', ta: 'அருகிலுள்ள நீர்நிலை' },
  flooded2015: { en: 'Nearest street flooded in 2015', ta: '2015-ல் வெள்ளம் வந்த அருகிலுள்ள தெரு' },
  noneWithinKm: { en: 'none within 1 km', ta: '1 கி.மீ.க்குள் இல்லை' },
  notMapped: { en: 'not mapped here', ta: 'இங்கு வரைபடம் இல்லை' },
  loading: { en: 'Checking', ta: 'சரிபார்க்கிறது' },

  // Reports, reservoirs and alerts
  raisedByReports: { en: "Raised by neighbours' reports", ta: 'அண்டை வீட்டார் தகவலால் உயர்த்தப்பட்டது' },
  reservoirsTitle: { en: 'Reservoirs upstream', ta: 'மேல்நிலை நீர்த்தேக்கங்கள்' },
  reservoirsIntro: {
    en: 'A release raises the river whether or not it is raining. Chennai Metro Water, as on',
    ta: 'மழை இல்லாவிட்டாலும் நீர் திறப்பு ஆற்றை உயர்த்தும். சென்னை குடிநீர் வாரியம், நாள்:',
  },
  full: { en: 'full', ta: 'நிரம்பியுள்ளது' },
  releasing: { en: 'releasing', ta: 'வெளியேற்றம்' },
  cusecs: { en: 'cusecs', ta: 'கன அடி/வினாடி' },
  streetAlertTitle: { en: 'Tell me when this street is at risk', ta: 'இந்தத் தெரு அபாயத்தில் இருக்கும்போது தெரிவி' },
  streetAlertText: {
    en: 'One email when this street reaches High, and when risk appears anywhere in Chennai. The street is stored without your address.',
    ta: 'இந்தத் தெரு அதிக அபாயத்தை அடையும்போது ஒரு மின்னஞ்சல். தெரு உங்கள் முகவரியின்றி சேமிக்கப்படும்.',
  },
  play: { en: 'Play the 48 hours', ta: '48 மணி நேரத்தை இயக்கு' },
  pause: { en: 'Pause', ta: 'நிறுத்து' },
  worstOf48: { en: 'Worst of the 48 hours', ta: '48 மணி நேரத்தில் மிக மோசம்' },

  // 3D view
  see3d: { en: 'Open the 3D street full width', ta: '3D தெருவை முழு அகலத்தில் திற' },
  backToAnswer: { en: 'Back to the answer', ta: 'பதிலுக்குத் திரும்பு' },
  terrainTitle: { en: 'This street in 3D', ta: 'இந்தத் தெரு முப்பரிமாணத்தில்' },
  terrainIntro: {
    en: 'Real ground heights and buildings. Blue dots are streets residents marked as flooded in December 2015.',
    ta: 'உண்மையான நில உயரங்களும் கட்டடங்களும். நீலப் புள்ளிகள் 2015 டிசம்பரில் வெள்ளம் வந்ததாக மக்கள் குறித்த தெருக்கள்.',
  },
  keyHome: { en: 'This spot', ta: 'இந்த இடம்' },
  keyFlooded: { en: 'Flooded in 2015', ta: '2015-ல் வெள்ளம்' },
  keyWater: { en: 'Below the chosen water height', ta: 'தேர்ந்தெடுத்த நீர்மட்டத்திற்குக் கீழ்' },
  raiseWater: { en: 'Raise the water', ta: 'நீர்மட்டத்தை உயர்த்து' },
  waterOff: { en: 'off', ta: 'இல்லை' },
  spotDry: { en: 'This spot would stay above the water by', ta: 'இந்த இடம் நீர்மட்டத்திற்கு மேல் இருக்கும்:' },
  spotUnder: { en: 'This spot would be under water by', ta: 'இந்த இடம் நீருக்குக் கீழ் இருக்கும்:' },
  shareUnder: { en: 'of this view would be under.', ta: 'பகுதி நீருக்குக் கீழ் இருக்கும்.' },
  waterCaveat: {
    en: 'This shows the shape of the ground. It is not a forecast. It floods everything below one height, as if the area were a bathtub; real floods follow drains, walls and rivers. Heights come from a satellite survey about 30 m across that includes rooftops.',
    ta: 'இது நிலத்தின் வடிவத்தைக் காட்டுகிறது; இது முன்னறிவிப்பு அல்ல. ஒரே உயரத்திற்குக் கீழ் உள்ள அனைத்தையும் நீரில் மூழ்கியதாகக் காட்டுகிறது. உண்மையான வெள்ளம் வடிகால், சுவர், ஆறுகளைப் பின்பற்றும்.',
  },
  stretch: { en: 'Heights are stretched', ta: 'உயரங்கள் பெரிதாக்கப்பட்டுள்ளன' },
  higherTitle: { en: 'Where to move a vehicle', ta: 'வாகனத்தை எங்கு நகர்த்துவது' },
  higherIntro: {
    en: 'Roads within 1.2 km that are at least 2 m higher than this spot and clear of streets that flooded in 2015.',
    ta: '1.2 கி.மீ.க்குள், இந்த இடத்தை விட குறைந்தது 2 மீ உயரமான, 2015-ல் வெள்ளம் வராத சாலைகள்.',
  },
  higherNone: { en: 'No clearly higher road was found within 1.2 km.', ta: '1.2 கி.மீ.க்குள் தெளிவாக உயரமான சாலை கிடைக்கவில்லை.' },
  higherCaveat: {
    en: 'These come from satellite height data, which can mistake a flyover or a rooftop for ground. Look at the place before you rely on it.',
    ta: 'இவை செயற்கைக்கோள் உயரத் தரவிலிருந்து வந்தவை; மேம்பாலம் அல்லது கூரையை நிலம் என்று தவறாகக் கொள்ளலாம். நம்புவதற்கு முன் நேரில் பாருங்கள்.',
  },
  away: { en: 'away', ta: 'தொலைவில்' },
  higher: { en: 'higher', ta: 'உயரம் அதிகம்' },
  directions: { en: 'Directions', ta: 'வழி' },

  // Replay
  replay: { en: 'Replay a past storm', ta: 'கடந்த புயலை மீண்டும் பார்' },
  replayIntro: {
    en: 'What Vellam would have said, given the rain that fell that day. This tests how it judges a place, not the forecast.',
    ta: 'அன்று பெய்த மழையை வைத்து வெள்ளம் என்ன சொல்லியிருக்கும். இது இடத்தை மதிப்பிடும் முறையைச் சோதிக்கிறது; முன்னறிவிப்பை அல்ல.',
  },
  live: { en: 'Live forecast', ta: 'நேரடி முன்னறிவிப்பு' },
  replayBadge: { en: 'Replay', ta: 'மறுபார்வை' },
  openReplay: { en: 'Open the map', ta: 'வரைபடத்தைத் திற' },
  replayResultTitle: { en: 'What the Michaung replay proves, and what it does not', ta: 'மிக்ஜாம் மறுபார்வை எதை நிரூபிக்கிறது, எதை இல்லை' },

  // Prepare
  prepareTitle: { en: 'Be ready before the water', ta: 'தண்ணீர் வரும் முன் தயாராகுங்கள்' },
  prepareIntro: { en: 'What each level means and what to do when your street reaches it.', ta: 'ஒவ்வொரு நிலையும் என்ன, உங்கள் தெரு அந்த நிலையை அடையும்போது என்ன செய்ய வேண்டும்.' },
  alertsTitle: { en: 'Get an email when flooding becomes likely', ta: 'வெள்ள அபாயம் ஏற்படும்போது மின்னஞ்சல் பெறுங்கள்' },
  alertsText: { en: 'One message when risk appears in Chennai. Not one every three hours while it lasts.', ta: 'சென்னையில் அபாயம் தோன்றும்போது ஒரு செய்தி மட்டும்.' },
  alertsButton: { en: 'Alert me', ta: 'எனக்குத் தெரிவி' },
  email: { en: 'Email address', ta: 'மின்னஞ்சல் முகவரி' },
  helplinesIntro: { en: 'Tap to call. Save them now, while the network works.', ta: 'அழைக்க தொடுங்கள். நெட்வொர்க் இருக்கும்போதே சேமித்து வையுங்கள்.' },

  // How
  about: { en: 'How it works', ta: 'இது எப்படி வேலை செய்கிறது' },
  howNote: { en: '', ta: 'இந்தப் பக்கம் தற்போது ஆங்கிலத்தில் மட்டுமே உள்ளது.' },

  footer: {
    en: 'Vellam is a guide, not an official warning. Follow IMD and Greater Chennai Corporation advisories.',
    ta: 'வெள்ளம் ஒரு வழிகாட்டி மட்டுமே; அதிகாரப்பூர்வ எச்சரிக்கை அல்ல. IMD மற்றும் சென்னை மாநகராட்சி அறிவிப்புகளைப் பின்பற்றுங்கள்.',
  },
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

export function useText(): { language: Language; t: (key: TextKey, values?: Record<string, string | number>) => string } {
  const language = useContext(LanguageContext);
  return {
    language,
    t: (key, values) => {
      let text: string = TEXT[key][language];
      for (const [name, value] of Object.entries(values ?? {})) text = text.replace(`{${name}}`, String(value));
      return text;
    },
  };
}
