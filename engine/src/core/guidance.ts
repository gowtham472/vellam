import type { Level } from './types.ts';

export type Language = 'en' | 'ta';

export interface Guidance {
  readonly headline: string;
  readonly actions: readonly string[];
}

/** Helplines from the Tamil Nadu State Disaster Management Authority's telephone directory. */
export const HELPLINES = [
  { number: '1913', en: 'Greater Chennai Corporation', ta: 'பெருநகர சென்னை மாநகராட்சி' },
  { number: '1070', en: 'State emergency control room', ta: 'மாநில அவசரகால கட்டுப்பாட்டு அறை' },
  { number: '112', en: 'Emergency', ta: 'அவசர உதவி' },
] as const;

export const HELPLINE_SOURCE = 'https://www.tnsdma.tn.gov.in/app/webroot/img/2022/DisasterTelephoneBook_2023.pdf';

/**
 * What to do at each level. The steps follow the National Disaster Management Authority's
 * flood guidance, ordered so the ones that take longest come first: a vehicle has to be
 * moved before the street floods, a phone can be charged later.
 */
const GUIDANCE: Record<Level, Record<Language, Guidance>> = {
  LOW: {
    en: {
      headline: 'No flooding expected here in the next 48 hours',
      actions: ['Nothing to do now. Check again when the forecast changes.'],
    },
    ta: {
      headline: 'அடுத்த 48 மணி நேரத்தில் இங்கு வெள்ளம் எதிர்பார்க்கப்படவில்லை',
      actions: ['இப்போது எதுவும் செய்ய வேண்டியதில்லை. முன்னறிவிப்பு மாறும்போது மீண்டும் பாருங்கள்.'],
    },
  },
  WATCH: {
    en: {
      headline: 'Water may collect on low streets here',
      actions: [
        'Move vehicles out of basements and low parking spots.',
        'Clear the drain outside your home if it is safe to do so.',
        'Charge phones and power banks.',
        'Check on elderly neighbours and anyone living on a ground floor.',
      ],
    },
    ta: {
      headline: 'இங்கு தாழ்வான தெருக்களில் தண்ணீர் தேங்கலாம்',
      actions: [
        'அடித்தளம் மற்றும் தாழ்வான இடங்களில் நிறுத்தியுள்ள வாகனங்களை வேறு இடத்திற்கு மாற்றுங்கள்.',
        'பாதுகாப்பாக இருந்தால், உங்கள் வீட்டு முன் உள்ள வடிகாலை சுத்தம் செய்யுங்கள்.',
        'கைபேசி மற்றும் பவர் பேங்க்கை சார்ஜ் செய்து வையுங்கள்.',
        'முதியவர்களையும் தரைத்தளத்தில் வசிப்பவர்களையும் விசாரித்துக் கொள்ளுங்கள்.',
      ],
    },
  },
  HIGH: {
    en: {
      headline: 'Flooding is likely here',
      actions: [
        'Move vehicles, documents and valuables to higher ground or an upper floor now.',
        'Store drinking water and food for two days, and keep medicines within reach.',
        'Stay out of basements, subways and underpasses.',
        'Do not walk or ride through moving water.',
        'Switch off the mains if water enters the house.',
      ],
    },
    ta: {
      headline: 'இங்கு வெள்ளம் ஏற்பட வாய்ப்பு அதிகம்',
      actions: [
        'வாகனங்கள், ஆவணங்கள், மதிப்புமிக்க பொருட்களை இப்போதே உயரமான இடத்திற்கு அல்லது மேல் தளத்திற்கு மாற்றுங்கள்.',
        'இரண்டு நாட்களுக்கு தேவையான குடிநீர், உணவு சேமித்து வையுங்கள்; மருந்துகளை கைக்கு எட்டும் இடத்தில் வையுங்கள்.',
        'அடித்தளம், சுரங்கப்பாதை ஆகியவற்றை தவிர்க்கவும்.',
        'ஓடும் தண்ணீரில் நடக்கவோ வாகனம் ஓட்டவோ வேண்டாம்.',
        'வீட்டிற்குள் தண்ணீர் வந்தால் மின் இணைப்பை (மெயின்) அணைக்கவும்.',
      ],
    },
  },
  SEVERE: {
    en: {
      headline: 'Serious flooding is likely here',
      actions: [
        'Be ready to leave. Pack documents, medicines, drinking water, a torch and a charged phone.',
        'Move to an upper floor, or to a relief centre if water starts rising.',
        'Switch off electricity and gas before water reaches the sockets.',
        'Stay away from fallen power lines and electric poles.',
        'Call 1913 or 112 if you or a neighbour need help.',
      ],
    },
    ta: {
      headline: 'இங்கு கடுமையான வெள்ளம் ஏற்பட வாய்ப்பு உள்ளது',
      actions: [
        'வெளியேற தயாராக இருங்கள். ஆவணங்கள், மருந்துகள், குடிநீர், டார்ச், சார்ஜ் செய்த கைபேசி ஆகியவற்றை எடுத்து வையுங்கள்.',
        'தண்ணீர் உயர ஆரம்பித்தால் மேல் தளத்திற்கு அல்லது நிவாரண முகாமிற்கு செல்லுங்கள்.',
        'தண்ணீர் மின் இணைப்புகளை எட்டும் முன் மின்சாரம் மற்றும் எரிவாயுவை அணைக்கவும்.',
        'அறுந்து விழுந்த மின் கம்பிகள், மின் கம்பங்களிலிருந்து விலகி இருங்கள்.',
        'உங்களுக்கோ அண்டை வீட்டாருக்கோ உதவி தேவைப்பட்டால் 1913 அல்லது 112-ஐ அழைக்கவும்.',
      ],
    },
  },
};

export const GUIDANCE_SOURCE = 'https://ndma.gov.in/Natural-Hazards/Floods/Dos-Donts';

export function guidanceFor(level: Level, language: Language): Guidance {
  return GUIDANCE[level][language];
}
