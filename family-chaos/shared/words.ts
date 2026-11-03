// Word and question banks (original, family friendly).
export interface L2 { he: string; en: string }
export const DRAW_WORDS: L2[] = [
  { he: 'חתול', en: 'cat' }, { he: 'כלב', en: 'dog' }, { he: 'שמש', en: 'sun' }, { he: 'בית', en: 'house' }, { he: 'עץ', en: 'tree' }, { he: 'מכונית', en: 'car' },
  { he: 'פיל', en: 'elephant' }, { he: 'פיצה', en: 'pizza' }, { he: 'גיטרה', en: 'guitar' }, { he: 'דג', en: 'fish' }, { he: 'פרח', en: 'flower' }, { he: 'מטוס', en: 'airplane' },
  { he: 'גלידה', en: 'ice cream' }, { he: 'ירח', en: 'moon' }, { he: 'ספינה', en: 'ship' }, { he: 'אופניים', en: 'bicycle' }, { he: 'טלפון', en: 'phone' }, { he: 'כובע', en: 'hat' },
  { he: 'נחש', en: 'snake' }, { he: 'לב', en: 'heart' }, { he: 'רקטה', en: 'rocket' }, { he: 'מטרייה', en: 'umbrella' }, { he: 'תפוח', en: 'apple' }, { he: 'משקפיים', en: 'glasses' },
];
export interface Q { q: L2; a: L2[]; c: number }
const q = (qh: string, qe: string, c: number, ...opts: [string, string][]): Q => ({ q: { he: qh, en: qe }, a: opts.map(([he, en]) => ({ he, en })), c });
export const TRIVIA: Q[] = [
  q('כמה רגליים יש לעכביש?', 'How many legs does a spider have?', 2, ['6', '6'], ['10', '10'], ['8', '8'], ['4', '4']),
  q('מהו כוכב הלכת הקרוב ביותר לשמש?', 'Which planet is closest to the Sun?', 0, ['חמה', 'Mercury'], ['נוגה', 'Venus'], ['מאדים', 'Mars'], ['צדק', 'Jupiter']),
  q('איזו חיה היא הגבוהה ביותר בעולם?', 'Which animal is the tallest in the world?', 1, ['פיל', 'Elephant'], ['ג׳ירפה', 'Giraffe'], ['סוס', 'Horse'], ['דוב', 'Bear']),
  q('מה צבע השמיים ביום בהיר?', 'What colour is the sky on a clear day?', 3, ['ירוק', 'Green'], ['אדום', 'Red'], ['צהוב', 'Yellow'], ['כחול', 'Blue']),
  q('כמה ימים יש בשבוע?', 'How many days are in a week?', 2, ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8']),
  q('איזה בעל חיים אומר "מיאו"?', 'Which animal says "meow"?', 0, ['חתול', 'Cat'], ['כלב', 'Dog'], ['פרה', 'Cow'], ['ברווז', 'Duck']),
  q('כמה זה 7 כפול 8?', 'What is 7 times 8?', 1, ['54', '54'], ['56', '56'], ['48', '48'], ['64', '64']),
  q('באיזה אוקיינוס נמצאת אוסטרליה לידה?', 'Which ocean is next to the west of Australia?', 3, ['האטלנטי', 'Atlantic'], ['הארקטי', 'Arctic'], ['השקט', 'Pacific'], ['ההודי', 'Indian']),
  q('מהו המים בצורה מוצקה?', 'What is water in solid form?', 2, ['אדים', 'Steam'], ['ענן', 'Cloud'], ['קרח', 'Ice'], ['גשם', 'Rain']),
  q('כמה צבעים יש בקשת?', 'How many colours are in a rainbow?', 1, ['5', '5'], ['7', '7'], ['9', '9'], ['12', '12']),
  q('איזה איבר שואב דם בגוף?', 'Which organ pumps blood?', 0, ['לב', 'Heart'], ['כבד', 'Liver'], ['ריאה', 'Lung'], ['קיבה', 'Stomach']),
  q('מי הצייר של "מונה ליזה"?', 'Who painted the "Mona Lisa"?', 2, ['פיקאסו', 'Picasso'], ['ואן גוך', 'Van Gogh'], ['דה וינצ׳י', 'Da Vinci'], ['מונה', 'Monet']),
  q('איזו יבשת היא הגדולה ביותר?', 'Which continent is the largest?', 1, ['אפריקה', 'Africa'], ['אסיה', 'Asia'], ['אירופה', 'Europe'], ['אמריקה', 'America']),
  q('מה הצבע שמתקבל מכחול וצהוב?', 'What colour do blue and yellow make?', 3, ['סגול', 'Purple'], ['כתום', 'Orange'], ['חום', 'Brown'], ['ירוק', 'Green']),
  q('כמה שעות יש ביממה?', 'How many hours are in a day?', 2, ['12', '12'], ['20', '20'], ['24', '24'], ['48', '48']),
  q('איזה חיה היא מלך החיות?', 'Which animal is called the king of the jungle?', 0, ['אריה', 'Lion'], ['נמר', 'Tiger'], ['פיל', 'Elephant'], ['זאב', 'Wolf']),
  q('איזה גז אנחנו נושמים כדי לחיות?', 'Which gas do we breathe to live?', 1, ['פחמן דו־חמצני', 'Carbon dioxide'], ['חמצן', 'Oxygen'], ['מימן', 'Hydrogen'], ['הליום', 'Helium']),
  q('כמה אותיות יש באלפבית העברי?', 'How many letters are in the Hebrew alphabet?', 3, ['20', '20'], ['24', '24'], ['26', '26'], ['22', '22']),
  q('איזו מדינה ידועה במגדל אייפל?', 'Which country is the Eiffel Tower in?', 2, ['איטליה', 'Italy'], ['ספרד', 'Spain'], ['צרפת', 'France'], ['גרמניה', 'Germany']),
  q('מה בא אחרי הלילה?', 'What comes after the night?', 0, ['בוקר', 'Morning'], ['חורף', 'Winter'], ['שבת', 'Sunday'], ['ערב', 'Evening']),
  q('איזה פרי הוא צהוב ומתעקם?', 'Which fruit is yellow and curved?', 1, ['תפוח', 'Apple'], ['בננה', 'Banana'], ['ענבים', 'Grapes'], ['אבטיח', 'Watermelon']),
  q('כמה זה 100 פחות 37?', 'What is 100 minus 37?', 2, ['73', '73'], ['67', '67'], ['63', '63'], ['57', '57']),
  q('איזה בעל חיים ישן בחורף (תרדמת)?', 'Which animal hibernates in winter?', 3, ['נמר', 'Tiger'], ['דג', 'Fish'], ['ציפור', 'Bird'], ['דוב', 'Bear']),
  q('מהי בירת ישראל?', 'What is the capital of Israel?', 0, ['ירושלים', 'Jerusalem'], ['חיפה', 'Haifa'], ['אילת', 'Eilat'], ['תל אביב', 'Tel Aviv']),
  q('כמה כוכבים יש בדגל ארצות הברית?', 'How many stars are on the US flag?', 2, ['13', '13'], ['48', '48'], ['50', '50'], ['52', '52']),
  q('באיזה כלי נגינה יש מקשים שחורים ולבנים?', 'Which instrument has black and white keys?', 1, ['גיטרה', 'Guitar'], ['פסנתר', 'Piano'], ['חליל', 'Flute'], ['תוף', 'Drum']),
];
