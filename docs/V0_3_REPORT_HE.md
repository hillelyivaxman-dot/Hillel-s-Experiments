# דו"ח v0.3 — מצב אמיתי, בלי הגזמות

תאריך: 04.11.2026. ענף: `claude/new-session-5vk9qy`. גיבוי של v0.2: ה-commit `12bfdd2` (ואת `FlowFactory3D_v0.2.zip` שבשורש; הדחיפה של תג `v0.2-backup` נדחתה על ידי השרת).

## 1. חיבור ל-Unity — לא הצלחתי

| בדיקה | תוצאה |
|---|---|
| כלי Unity (תוסף רשמי / MCP) בסשן הזה | **לא קיימים**: אין אף כלי Unity ברשימת הכלים של הסשן |
| חיבור למחשב שלך (Remote Control) | **לא מחובר**: `list_computer_folders` החזיר רשימה ריקה |
| Unity בסביבת הענן | **לא מותקן**; שרתי ההורדה של Unity חסומים לסביבה הזו (וגם נדרש רישיון) |
| Android Build Support / SDK / מכשיר Samsung | **אין גישה** |

לכן **לא הורצו**: טעינת סצנות, Play Mode, בדיקת Console, מעבר מסכים אמיתי, שמירה לאחר סגירה, Build ל-Android, APK, צילומי מסך אמיתיים, FPS וזיכרון על מכשיר.
התמונות שבתיקיית `docs/preview_images` הן **הדמיה בדפדפן** ולא Unity.

### איך מחברים כדי שאוכל לבצע את הבדיקות האמיתיות
1. על המחשב שבו מותקן Unity: פתח את אפליקציית Claude לשולחן העבודה → Settings → Claude Code → Remote Control, והוסף את תיקיית הפרויקט (תיקייה שהיא שורש של Git). או בטרמינל, בתוך התיקייה: `claude remote-control`.
2. הפעל את Unity Editor עם הפרויקט פתוח (או וודא ש-Unity Hub מותקן).
3. אמור לי בצ'אט; אני אבקש גישה לתיקייה ואפעיל את Unity דרך שורת הפקודה (יש לי כלי `unity-cli` לעבודה מול עורך פעיל). הוסף אישור כשהמערכת תבקש.
תוסף Unity הרשמי (MCP) שהתקנת עובד מול Claude המקומי שלך; הוא אינו נגיש לסשן ענן. אם אתה מעדיף, אפשר גם להריץ בעצמך את הסקריפטים שלמטה ולהדביק לי את התוצאות.

### להריץ בעצמך עכשיו (מחשב עם Unity 6.3)
- בעורך: *Flow Factory > Setup Project*, אחר כך *Flow Factory > Environment Report* (הדבק לי את הטקסט מ-`Logs/flowfactory_environment.txt`).
- *Window > General > Test Runner*: **EditMode** ואז **PlayMode** → Run All. (PlayMode מריץ את המשחק האמיתי: 36 שלבים לפי הסדר, שמירה, חנות, רמז, פרס יומי, כישלון והמשך; נכשל על כל שגיאת Console.)
- *Flow Factory > Capture Screenshot Tour* (עם Game view על 1080x1920): נשמרים צילומים אמיתיים ב-`Logs/ScreenshotTour` יחד עם `tour_log.txt` שבו מספר שגיאות ה-Console.
- משורת פקודה: `Tools/UnityChecks/run_unity_checks.sh` (macOS/Linux) או `run_unity_checks.ps1` (Windows).

## 2. מה נוסף בקוד ב-v0.3 (לא הורץ ב-Unity)

| יכולת | פירוט | סטטוס אימות |
|---|---|---|
| מסועים נעים | גלילי המסוע גוללים לאורך המסלול בזמן הרצה, בכיוון תנועת החבילה (כיוון הטקסטורה נמדד מהמש של הקובייה כדי לא להתהפך) | קומפילציה בלבד |
| חבילה | צל רך עגול מתחת לחבילה (שיידר שקוף חדש) | קומפילציה בלבד |
| אפקט סיום | גל אור זהוב מתרחב ליד היעד, בנוסף לקונפטי | קומפילציה בלבד |
| ממשק | כפתורים מתכווצים בלחיצה ובקפיצה חזרה, מעברי מסך עם דהייה והקפצה של חלונות | קומפילציה בלבד |
| ביצועים | איחוד חלקים לרשת אחת לכל חומר בכל אריח (אם אפשר לקרוא את רשתות ה-primitive, אחרת מדלג בבטחה), ללא צללים וללא MSAA, מגבלת רזולוציה 1080 ברוחב על מסכים צפופים, 30FPS כברירת מחדל ואפשרות 60FPS בהגדרות | קומפילציה בלבד |
| Android | הגדרות בבנייה: IL2CPP, ARM64, API 26+, OpenGLES3 עם Vulkan, Stripping בינוני, גרסה 0.3.0 | לא הורכב (קוד Editor) |
| בדיקות | PlayMode (8 בדיקות), סיור צילומים, דוח סביבה, סקריפטי הרצה | PlayMode ו-EditMode עברו **קומפילציה** מול ספריות Unity 2021.3 עם stubs; לא הורצו |
| איזון כלכלי | **לא שונה** | — |

### סיכונים שרק Unity יפתור (בדוק קודם)
- **שיידרים חדשים** (`FlowFactoryToon`, `FlowFactoryGround`, `FlowFactoryBlob`): אם משהו ורוד, שלח לי את שגיאות ה-Console. ל-Blob יש גיבוי: בלי הצל המשחק ממשיך.
- **איחוד רשתות** יכול להיכשל אם רשתות ה-primitive אינן קריאות; יש בדיקה, אך רק הרצה תוכיח שהאריחים נראים נכון.
- **כיוון גלילת המסועים** נמדד אוטומטית, אך חייבים לראות בעין שהוא תואם לתנועת החבילה.
- מבנה ה-UI בנוי בקוד ונבדק רק בהדמיה; על Samsung אמיתי יש לבדוק Safe Area, גדלי כפתורים וטקסטים.
- קלט Input System החדש ו-`InputSystemUIInputModule` (ללא הרכבה כאן).
- מנגנון ה-Android Build (`BuildAndroidBatch`) לא נוסה.

## 3. APK
לא נבנה. נדרש להתקין ב-Unity Hub: *Installs → ⚙ → Add modules → Android Build Support*, ובתוכו **OpenJDK** ו-**Android SDK & NDK Tools**. אחר כך: *Flow Factory > Setup Project*, ואז *Flow Factory > Build Android APK (development)*; הקובץ ייווצר ב-`Builds/Android/FlowFactory3D-dev.apk`. התקנה ל-Samsung: הפעל Developer options ו-USB debugging, חבר כבל, `adb install -r Builds/Android/FlowFactory3D-dev.apk`. הבנייה כוללת רק פרסומות ורכישות מדומות (אין SDK של פרסום).
