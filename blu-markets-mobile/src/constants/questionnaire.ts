// Questionnaire Data
// Based on PRD Section 17.8 - Complete Questionnaire Reference (Farsi + English)

export interface QuestionOption {
  label: string;
  labelEn: string;
  score: number;
  flag?: string;
}

export interface Question {
  id: string;
  question: string;
  questionEn: string;
  weight: number;
  dimension: 'CAPACITY' | 'WILLINGNESS' | 'HORIZON' | 'GOAL';
  options: QuestionOption[];
}

export const QUESTIONS: Question[] = [
  // Block 1: وضعیت مالی شما (Your Financial Situation)
  {
    id: 'q_income',
    question: 'درآمدت چقدر قابل پیش‌بینیه؟',
    questionEn: 'How predictable is your income?',
    weight: 1.0,
    dimension: 'CAPACITY',
    options: [
      { label: 'ثابت و مطمئن (حقوق، مستمری)', labelEn: 'Fixed and reliable (salary, pension)', score: 8 },
      { label: 'تقریباً ثابت با کمی نوسان', labelEn: 'Mostly stable with some variation', score: 6 },
      { label: 'متغیر (فریلنس، کسب‌وکار)', labelEn: 'Variable (freelance, business)', score: 4 },
      { label: 'نامشخص یا بی‌کار', labelEn: 'Uncertain or unemployed', score: 1 },
    ],
  },
  {
    id: 'q_buffer',
    question: 'بدون این پول، چند ماه می‌تونی خرج زندگیت رو بدی؟',
    questionEn: 'Without this money, how many months can you cover expenses?',
    weight: 1.2,
    dimension: 'CAPACITY',
    options: [
      { label: 'بیش از ۱۲ ماه', labelEn: 'More than 12 months', score: 10 },
      { label: '۶ تا ۱۲ ماه', labelEn: '6 to 12 months', score: 7 },
      { label: '۳ تا ۶ ماه', labelEn: '3 to 6 months', score: 4 },
      { label: 'کمتر از ۳ ماه', labelEn: 'Less than 3 months', score: 1 },
    ],
  },
  {
    id: 'q_proportion',
    question: 'این پول چند درصد از کل دارایی‌هاته؟',
    questionEn: 'What percentage of your total wealth is this?',
    weight: 1.3,
    dimension: 'CAPACITY',
    options: [
      { label: 'کمتر از ۲۵٪', labelEn: 'Less than 25%', score: 10 },
      { label: '۲۵٪ تا ۵۰٪', labelEn: '25% to 50%', score: 6 },
      { label: '۵۰٪ تا ۷۵٪', labelEn: '50% to 75%', score: 3 },
      { label: 'بیشتر از ۷۵٪', labelEn: 'More than 75%', score: 1, flag: 'high_proportion' },
    ],
  },

  // Block 2: اهداف شما (Your Goals)
  {
    id: 'q_goal',
    question: 'هدف اصلیت از این سرمایه‌گذاری چیه؟',
    questionEn: "What's your main goal for this investment?",
    weight: 1.0,
    dimension: 'GOAL',
    options: [
      { label: 'حفظ ارزش پول در برابر تورم', labelEn: 'Preserve value against inflation', score: 2 },
      { label: 'درآمد ثابت (سود منظم)', labelEn: 'Steady income (regular returns)', score: 4 },
      { label: 'رشد سرمایه در بلندمدت', labelEn: 'Long-term wealth growth', score: 7 },
      { label: 'حداکثر بازدهی (ریسک بالا قبوله)', labelEn: 'Maximum returns (high risk OK)', score: 10 },
    ],
  },
  {
    id: 'q_horizon',
    question: 'کِی ممکنه بخوای این پول رو برداری؟',
    questionEn: 'When might you need to withdraw this money?',
    weight: 1.0,
    dimension: 'HORIZON',
    options: [
      { label: 'کمتر از ۱ سال', labelEn: 'Less than 1 year', score: 1 },
      { label: '۱ تا ۳ سال', labelEn: '1 to 3 years', score: 4 },
      { label: '۳ تا ۷ سال', labelEn: '3 to 7 years', score: 7 },
      { label: 'بیش از ۷ سال', labelEn: 'More than 7 years', score: 10 },
    ],
  },

  // Block 3: واکنش شما (How You React)
  {
    id: 'q_crash_20',
    question: 'فرض کن ۳ ماه بعد از سرمایه‌گذاری، ارزش پورتفوت ۲۰٪ کم شده. چیکار می‌کنی؟',
    questionEn: 'Imagine 3 months after investing, your portfolio is down 20%. What do you do?',
    weight: 2.0,
    dimension: 'WILLINGNESS',
    options: [
      { label: 'همه رو می‌فروشم که بیشتر ضرر نکنم', labelEn: 'Sell everything to avoid more loss', score: 1, flag: 'panic_seller' },
      { label: 'یه مقدار می‌فروشم، بقیه رو نگه می‌دارم', labelEn: 'Sell some, keep the rest', score: 3 },
      { label: 'صبر می‌کنم تا بازار برگرده', labelEn: 'Wait for the market to recover', score: 6 },
      { label: 'بیشتر می‌خرم چون ارزون شده', labelEn: "Buy more because it's cheaper", score: 9 },
    ],
  },
  {
    id: 'q_tradeoff',
    question: 'کدوم رو ترجیح میدی؟',
    questionEn: 'Which do you prefer?',
    weight: 1.5,
    dimension: 'WILLINGNESS',
    options: [
      { label: 'سود تضمینی ۲۰٪ در سال', labelEn: 'Guaranteed 20% annual return', score: 2 },
      { label: '۵۰٪ شانس سود ۴۰٪ یا ضرر ۱۰٪', labelEn: '50% chance of +40% or -10%', score: 5 },
      { label: '۵۰٪ شانس سود ۸۰٪ یا ضرر ۲۵٪', labelEn: '50% chance of +80% or -25%', score: 8 },
      { label: '۵۰٪ شانس سود ۱۵۰٪ یا ضرر ۵۰٪', labelEn: '50% chance of +150% or -50%', score: 10, flag: 'gambler' },
    ],
  },
  {
    id: 'q_past_behavior',
    question: 'آخرین باری که یه سرمایه‌گذاریت افت کرد، چه حسی داشتی؟',
    questionEn: 'Last time an investment dropped, how did you feel?',
    weight: 1.0,
    dimension: 'WILLINGNESS',
    options: [
      { label: 'خیلی استرس داشتم، شب‌ها خوابم نمی‌برد', labelEn: "Very stressed, couldn't sleep", score: 1 },
      { label: 'نگران بودم ولی دووم آوردم', labelEn: 'Worried but managed', score: 4 },
      { label: 'نسبتاً آروم بودم', labelEn: 'Relatively calm', score: 7 },
      { label: 'تجربه‌ای ندارم', labelEn: 'No experience', score: 5, flag: 'inexperienced' },
    ],
  },
  {
    id: 'q_max_loss',
    question: 'حداکثر چند درصد افت رو می‌تونی تحمل کنی بدون اینکه بفروشی؟',
    questionEn: "What's the maximum drop you can tolerate without selling?",
    weight: 1.5,
    dimension: 'WILLINGNESS',
    options: [
      { label: '۵٪ — بیشتر از این نه', labelEn: '5% — no more than this', score: 1 },
      { label: '۱۵٪ — یه کم درد داره ولی اوکیه', labelEn: '15% — hurts but OK', score: 4 },
      { label: '۳۰٪ — سخته ولی صبر می‌کنم', labelEn: "30% — tough but I'll wait", score: 7 },
      { label: '۵۰٪ یا بیشتر — بلندمدت فکر می‌کنم', labelEn: '50%+ — I think long-term', score: 10 },
    ],
  },
];

// Block headers
export const BLOCK_HEADERS = {
  CAPACITY: {
    farsi: 'وضعیت مالی شما',
    english: 'Your Financial Situation',
  },
  GOAL: {
    farsi: 'اهداف شما',
    english: 'Your Goals',
  },
  HORIZON: {
    farsi: 'اهداف شما',
    english: 'Your Goals',
  },
  WILLINGNESS: {
    farsi: 'واکنش شما',
    english: 'How You React',
  },
};
