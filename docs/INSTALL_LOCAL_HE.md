# התקנה מקומית של FlowFactory3D (v0.3.1)

## מה קרה כשביקשת התקנה דרך התוסף
בסשן הזה **אין חיבור למחשב שלך ואין כלי Unity** (`list_computer_folders` ריק, ואין כלי Unity בסשן). לכן **לא הרצתי כלום על המחשב שלך**: לא חיפשתי את ה-ZIP שם, לא יצרתי פרויקט ולא הפעלתי Unity.
במקום זה בניתי מתקין שמבצע את תשעת הצעדים שביקשת במחשב שלך ומדווח מה הורץ בפועל ומה נכשל.

## הרצה (דקות ספורות + זמן ייבוא ראשון של Unity)
1. שים את `FlowFactory3D_v0.3.1.zip` ב-Downloads (או כל תיקייה, ואז ציין `-Zip`).
2. **Windows (PowerShell):** `powershell -ExecutionPolicy Bypass -File Tools\Install\install_flowfactory.ps1`
   **macOS/Linux:** `bash Tools/Install/install_flowfactory.sh`
   (את הסקריפט אפשר להוציא מתוך ה-ZIP או לקחת את הקובץ שנשלח בנפרד.)
3. אפשרויות: `-Zip`/`--zip` נתיב ל-ZIP, `-Unity`/`--unity` נתיב לעורך, `-Project`/`--project` תיקיית היעד (ברירת מחדל `UnityProjects\FlowFactory3D` בתיקיית הבית), `-Update`/`--update`, `-SkipTests`, `-SkipApk`.
4. בסוף נוצר קובץ דוח ליד הפרויקט: `<project>.install_report.txt`, ובו לכל צעד: PASSED / FAILED / SKIPPED. **שלח לי את הקובץ הזה.**

## מה המתקין עושה
1. מחפש את ה-ZIP (הכי חדש ב-Downloads/Desktop/Documents). אם לא נמצא, עוצר ומבקש `-Zip`.
2. מחפש Unity (מעדיף 6000.3.x) בתיקיות של Unity Hub.
3. בודק אם הפרויקט קיים. **לא דורס**: פרויקט Unity אחר או תיקייה לא ריקה — עוצר. פרויקט FlowFactory קיים — לא נוגע (עם `-Update` מגבה את Scripts/Resources/Tests ל-`Backups\` ואז מעדכן).
4. יוצר פרויקט Universal 3D מתבנית ה-Universal 3D שבתוך העורך עצמו. אם התבנית חסרה, יוצר פרויקט ריק (Built-in) ומדווח על כך.
5. מעתיק `Assets/Scripts`, `Assets/Resources`, `Assets/Tests` (+`Tools`), ומוסיף ל-`manifest.json` רק חבילות חסרות: Input System, Test Framework, uGUI.
6. מריץ Unity ב-batch: ייבוא, קומפילציה ו-**Flow Factory > Setup Project** (יוצר `Assets/Scenes/Main.unity`, 36 נכסי שלבים, הגדרות Android). בודק: קוד יציאה, אפס `error CS`, קיום הסצנה, 36 קבצי שלב.
7. מריץ בדיקות EditMode ו-PlayMode (PlayMode מפעיל את המשחק האמיתי ומשחק את 36 השלבים) ומפרסר את תוצאות ה-XML.
8. אם מותקן Android Build Support — בונה `Builds/Android/FlowFactory3D-dev.apk`; אחרת מדווח מה להתקין (Unity Hub › Installs › ⚙ › Add modules › Android Build Support + OpenJDK + Android SDK & NDK Tools).
9. לא מכוסה אוטומטית: סיור צילומי המסך (צריך חלון גרפי: בתפריט Unity `Flow Factory > Capture Screenshot Tour`), מגע ו-FPS בטלפון.

## מה נבדק כאן ומה לא
- **נבדק כאן:** התסריט של macOS/Linux הורץ מול עורך **מדומה** (סקריפט שמזייף את Unity): איתור ZIP ו-Unity, יצירת פרויקט מתבנית, העתקת קבצים, עריכת manifest, סירוב לדרוס, חיבור הצעדים ופירוש תוצאות. תוצאות "10/10" שם הן של הסימולציה ולא של Unity.
- **לא נבדק:** גרסת ה-PowerShell (אין כאן PowerShell), ושום דבר מול Unity אמיתי: ייבוא, קומפילציה, Setup Project, בדיקות, Play Mode, APK.
- **התקנה ידנית, אם המתקין נכשל:** Unity Hub › New project › Universal 3D (6000.3.x) › סגור את העורך › העתק Assets/Scripts, Assets/Resources, Assets/Tests מה-ZIP › פתח › Window > Package Manager (Input System, Test Framework) › `Flow Factory > Setup Project` › Test Runner (EditMode, PlayMode) › Play.
