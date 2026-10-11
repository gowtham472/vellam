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

  // Landing
  heroKicker: { en: 'Street-level flood risk for Chennai', ta: 'சென்னைக்கான தெரு அளவிலான வெள்ள அபாயம்' },
  tagline: { en: 'Will my street flood?', ta: 'என் தெருவில் வெள்ளம் வருமா?' },
  intro: {
    en: 'Warnings are issued for a district. Floods happen street by street. Vellam reads the rain forecast, the ground, and the streets that flooded in 2015, and tells you what to expect, why, and what to do.',
    ta: 'எச்சரிக்கைகள் மாவட்டத்திற்கு வழங்கப்படுகின்றன. வெள்ளம் தெரு தெருவாக வருகிறது. மழை முன்னறிவிப்பு, நில அமைப்பு, 2015-ல் வெள்ளம் வந்த தெருக்கள் ஆகியவற்றை வைத்து என்ன எதிர்பார்க்கலாம், ஏன், என்ன செய்ய வேண்டும் என்று வெள்ளம் சொல்லும்.',
  },
  ctaCheck: { en: 'Check my street', ta: 'என் தெருவைப் பார்' },
  ctaReplay: { en: 'Replay Cyclone Michaung', ta: 'மிக்ஜாம் புயலை மீண்டும் பார்' },
  mascotLoading: { en: 'Reading the sky over Chennai', ta: 'சென்னை வானத்தைப் படிக்கிறேன்' },
  mascotCalm: { en: 'Chennai looks dry for the next 48 hours. All {n} localities are low.', ta: 'அடுத்த 48 மணி நேரம் சென்னை வறண்டிருக்கும். {n} பகுதிகளும் குறைந்த அபாயத்தில் உள்ளன.' },
  mascotWatch: { en: 'Some rain ahead. {n} localities to keep an eye on.', ta: 'மழை வரவுள்ளது. {n} பகுதிகளைக் கவனியுங்கள்.' },
  mascotRisk: { en: 'Flooding is likely in {n} localities. Check your street now.', ta: '{n} பகுதிகளில் வெள்ளம் வர வாய்ப்புள்ளது. இப்போதே உங்கள் தெருவைப் பாருங்கள்.' },
  statStreets: { en: 'streets remembered from the 2015 flood', ta: '2015 வெள்ளத்தில் பதிவான தெருக்கள்' },
  statLocalities: { en: 'localities assessed every three hours', ta: 'மூன்று மணி நேரத்திற்கு ஒருமுறை மதிப்பிடப்படும் பகுதிகள்' },
  statHours: { en: 'hours of forecast, six at a time', ta: 'மணி நேர முன்னறிவிப்பு' },
  statDays: { en: 'days of forecasts checked against the rain', ta: 'நாட்களின் முன்னறிவிப்பு சரிபார்ப்பு' },
  howTitle: { en: 'Three questions, one answer', ta: 'மூன்று கேள்விகள், ஒரு பதில்' },
  step1Title: { en: 'How much rain?', ta: 'எவ்வளவு மழை?' },
  step1Text: { en: 'The hourly forecast for your exact spot, named with the India Meteorological Department\'s own classes.', ta: 'உங்கள் இடத்திற்கான மணிநேர முன்னறிவிப்பு, இந்திய வானிலை ஆய்வு மையத்தின் வகைப்பாட்டில்.' },
  step2Title: { en: 'What kind of place?', ta: 'எப்படிப்பட்ட இடம்?' },
  step2Text: { en: 'Did this street flood in 2015? Is a lake or canal close? Is the ground low, or already soaked?', ta: '2015-ல் இந்தத் தெருவில் வெள்ளம் வந்ததா? அருகில் ஏரி அல்லது கால்வாய் உள்ளதா? நிலம் தாழ்வானதா?' },
  step3Title: { en: 'So what do I do?', ta: 'நான் என்ன செய்ய வேண்டும்?' },
  step3Text: { en: 'One of four levels, the reasons behind it, and plain steps to take before the water arrives.', ta: 'நான்கு நிலைகளில் ஒன்று, அதற்கான காரணங்கள், தண்ணீர் வரும் முன் செய்ய வேண்டியவை.' },
  featuresTitle: { en: 'Built for the night before the rain', ta: 'மழைக்கு முந்தைய இரவுக்காக உருவாக்கப்பட்டது' },
  featWhyTitle: { en: 'It shows its reasons', ta: 'காரணங்களைக் காட்டுகிறது' },
  featWhyText: { en: 'Every fact is marked as a forecast, a measurement, a map, the 2015 record, or a judgement.', ta: 'ஒவ்வொரு தகவலும் முன்னறிவிப்பா, அளவீடா, வரைபடமா, 2015 பதிவா என்று குறிக்கப்படுகிறது.' },
  featMemoryTitle: { en: 'It remembers 2015', ta: '2015-ஐ நினைவில் வைத்திருக்கிறது' },
  featMemoryText: { en: 'Residents mapped 7,851 flooded streets that December. Vellam checks yours against them.', ta: 'அந்த டிசம்பரில் மக்கள் 7,851 வெள்ளத் தெருக்களைப் பதிவு செய்தனர். உங்கள் தெருவை அதனுடன் ஒப்பிடுகிறது.' },
  featNeighbourTitle: { en: 'Neighbours report water', ta: 'அண்டை வீட்டார் தகவல் தருகிறார்கள்' },
  featNeighbourText: { en: 'Ankle, knee or waist deep, on the map for 48 hours. Nothing about the person is stored.', ta: 'கணுக்கால், முழங்கால், இடுப்பளவு என 48 மணி நேரம் வரைபடத்தில். தனிநபர் தகவல் எதுவும் சேமிக்கப்படாது.' },
  featCheckTitle: { en: 'It checks itself', ta: 'தன்னைத்தானே சரிபார்க்கிறது' },
  featCheckText: { en: 'Thirty days of day-ahead forecasts beside the rain that actually fell, for any spot.', ta: 'எந்த இடத்திற்கும், 30 நாட்களின் முன்னறிவிப்பும் உண்மையில் பெய்த மழையும்.' },
  featShareTitle: { en: 'One tap to the street group', ta: 'ஒரே தொடுதலில் தெரு குழுவிற்கு' },
  featShareText: { en: 'Send the warning to WhatsApp, and call 1913, 1070 or 112 straight from the page.', ta: 'எச்சரிக்கையை வாட்ஸ்அப்பில் அனுப்புங்கள்; 1913, 1070, 112 எண்களை நேரடியாக அழையுங்கள்.' },
  featTamilTitle: { en: 'English and Tamil', ta: 'ஆங்கிலமும் தமிழும்' },
  featTamilText: { en: 'Made to be read on a phone, in bad light, by someone in a hurry.', ta: 'அவசரத்தில், குறைந்த வெளிச்சத்தில், கைபேசியில் படிக்க ஏற்றது.' },
  replayTeaserTitle: { en: 'What would Vellam have said in 2023?', ta: '2023-ல் வெள்ளம் என்ன சொல்லியிருக்கும்?' },
  replayTeaserText: { en: 'Replay Cyclone Michaung through the same rules, locality by locality.', ta: 'மிக்ஜாம் புயலை அதே விதிகளில், பகுதி வாரியாக மீண்டும் பாருங்கள்.' },
  honestTitle: { en: 'Where not to trust it', ta: 'எங்கே நம்பக்கூடாது' },
  honestText: {
    en: 'Vellam is a rule of thumb, not a model of how water flows. Its backtest missed one documented locality, and three of its thresholds were wrong the first time. We wrote all of it down.',
    ta: 'வெள்ளம் ஒரு எளிய கணிப்பு முறை; தண்ணீர் ஓட்டத்தின் மாதிரி அல்ல. அதன் சோதனையில் ஒரு பகுதி தவறியது; மூன்று வரம்புகள் முதலில் தவறாக இருந்தன. அனைத்தையும் பதிவு செய்துள்ளோம்.',
  },
  readMethod: { en: 'Read the method', ta: 'முறையைப் படியுங்கள்' },
  finalTitle: { en: 'The monsoon starts in October.', ta: 'பருவமழை அக்டோபரில் தொடங்குகிறது.' },
  finalText: { en: 'Know your street before the first heavy night.', ta: 'முதல் கனமழை இரவுக்கு முன் உங்கள் தெருவை அறிந்து கொள்ளுங்கள்.' },

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
