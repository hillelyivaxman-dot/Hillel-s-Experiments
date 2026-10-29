# FLOW FACTORY 3D — גרסה 0.1

משחק חידות תלת־ממדי (Unity 6.3 LTS, C#). מסובבים אריחי מסוע, לוחצים **RUN**, וחבילה נעה לפי חיבורי המסועים עד היעד.
ממשק המשחק באנגלית פשוטה; כל הקוד כתוב מפרימיטיבים של Unity, בלי נכסים בתשלום, בלי SDK, בלי מודעות ובלי רכיבי ענן.

> **סטטוס אימות (חשוב):** הקוד נכתב בסביבה ללא Unity Editor. לוגיקת המשחק נבדקה ורצה באמת (28 בדיקות עוברות), וקוד ה-Runtime עבר קומפילציה מול ספריות Unity 2021.3. **לא** בוצעו הרצה ב-Play Mode, בדיקת מגע, Build ל-Android או בדיקת FPS. פירוט בסוף המסמך.

## מבנה התיקייה

```
FlowFactory3D/
  Assets/
    Scripts/Core/      לוגיקה טהורה, ללא Unity: Direction, TileKind, LevelData, RouteValidator,
                       LevelManager (מצבי Idle/Running/Success/Failure), SaveService, LevelCatalog (12 שלבים)
    Scripts/Runtime/   תצוגה וקלט: GridManager, ConveyorTile, ParcelController, GameUIController,
                       FlowFactoryApp, AudioService, LocalTelemetry, FpsCounter, SafeAreaFitter ...
    Scripts/Editor/    תפריט Flow Factory (יצירת שלבים, אימות, הגדרת פרויקט, Build ל-APK)
    Resources/Shaders/ שיידר שטוח פשוט שעובד גם ב-URP וגם ב-Built-in
    Tests/EditMode/    בדיקות NUnit ל-Unity Test Runner
  Tools/CoreTests/     הרצת אותן בדיקות לוגיקה עם dotnet בלבד (בלי Unity)
  Packages/manifest.json
```

הארכיטקטורה: אימות המסלול (`RouteValidator`) הוא פונקציה טהורה על נתונים ואינו תלוי בתצוגה או באנימציה.
`ConveyorTile`/`ParcelController` רק מציגים. השלבים הם **נתונים** (`LevelDefinition` ScriptableObject או `LevelCatalog` מובנה),
ויש סצנת משחק גנרית אחת שנבנית בזמן ריצה — אין 12 סצנות.

## התקנה והרצה

1. התקן **Unity Hub** ואת **Unity 6.3 LTS** (6000.3.x) עם מודולים: *Android Build Support*, *OpenJDK*, *Android SDK & NDK Tools*.
2. ב-Unity Hub צור פרויקט חדש מהתבנית **Universal 3D (URP)**, למשל `FlowFactory3D`.
3. סגור את העורך והעתק לפרויקט החדש את התיקייה `Assets/Scripts`, `Assets/Resources`, `Assets/Tests` (ואם רוצה גם `Tools`).
   **אל תדרוס** את `Packages/manifest.json` של הפרויקט; רק ודא שהחבילות **Input System** ו-**Test Framework** מותקנות
   (ב-*Window > Package Manager*; אם Unity שואל על החלפת מערכת הקלט, אשר). אפשר גם להשתמש בקובץ `Packages/manifest.json` שבתיקייה כנקודת התחלה.
4. פתח את הפרויקט וחכה לקומפילציה. ב-Console לא אמורות להופיע שגיאות.
5. הרץ מהתפריט **Flow Factory > Setup Project (portrait, Android, Main scene)** — מגדיר מצב אנכי, Android (IL2CPP, ARM64),
   יוצר את 12 נתוני השלבים ב-`Assets/Resources/Levels`, יוצר את `Assets/Scenes/Main.unity` ומוסיף אותה ל-Build Settings.
6. פתח את Game View, בחר יחס **9:16** (למשל 1080x1920) ולחץ **Play**. אפשר גם ללחוץ Play בכל סצנה אחרת: `GameBootstrap` מפעיל את המשחק לבד.

**משחק בעכבר:** קליק על אריח כחול (עם כפתור כתום) מסובב אותו 90°; **RUN** משגר חבילה; **RESET** מחזיר את כל הסיבובים; `<` חזרה לבחירת שלב; `Esc` = כפתור Back.

### בדיקות
- **בעורך:** *Window > General > Test Runner > EditMode > Run All* (בדיקות ה-Core + `UnityLevelAssetTests`).
- **אימות פתרונות הידועים:** *Flow Factory > Validate All Levels (known solutions)*.
- **בלי Unity** (בדיקות הלוגיקה בלבד): `cd Tools/CoreTests && dotnet test` (דורש .NET SDK 8).

## בניית APK ל-Android

1. *File > Build Profiles* (או Build Settings) — ודא שפלטפורמת Android מותקנת ונבחרה (*Switch Platform*).
2. *Flow Factory > Build Android APK (development, FPS display)* — נוצר `Builds/Android/FlowFactory3D-dev.apk` עם תצוגת FPS.
   גרסת `release` נבנית מהתפריט המקביל (חתימת debug כברירת מחדל; לפרסום יש להגדיר Keystore משלך).
   משורת פקודה: `Unity -batchmode -quit -projectPath <path> -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.BuildAndroidBatch`.
3. במכשיר: הפעל *Developer options > USB debugging*, חבר כבל, ואז `adb install -r Builds/Android/FlowFactory3D-dev.apk`
   (או העתק את ה-APK למכשיר ופתח אותו; יש לאשר התקנה ממקור לא מוכר).
4. יומן אירועי הבדיקה: `adb shell run-as com.flowfactory.prototype3d cat files/telemetry.log` (בגרסת Development).

## מה יש בגרסה 0.1

- 12 שלבים ידניים (4x4 בשלבים 1–4, 5x5 מ-5), כולם עם פתרון ידוע שנבדק אוטומטית; שלבים 1–2 הם הדרכה חזותית (נקודה צהובה מעל האריח הבא ללחיצה, ואז כפתור RUN פועם).
- אריחים: ישר, פינה, מקור, יעד, וארגז דקורטיבי חוסם. אריחים ניתנים לסיבוב מסומנים בכחול עם כפתור כתום.
- RUN פעיל גם כשהמסלול שגוי: החבילה נעצרת/נופלת, האריח הבעייתי מהבהב באדום, מופיעה הודעה קצרה, וחוזרים לעריכה בלי קנס.
- מסך הצלחה, פתיחת השלב הבא, שמירה מקומית (`PlayerPrefs`, עם גרסת סכימה, עמיד בפני נתונים פגומים), המשך מהשלב הפתוח.
- תפריט ראשי, בחירת שלב (עם כיתוב DONE/PLAY/LOCKED ולא רק צבע), הגדרות צליל (מופעל/כבוי, עוצמה), איפוס התקדמות בשני לחיצות.
- צלילים מיוצרים בקוד; Safe Area; ממשק לפי 1080x1920 עם `CanvasScaler`; כפתורים גדולים.
- תצוגת FPS רק בעורך/Development build. `LocalTelemetry` כותב לקובץ מקומי בלבד, בלי מזהים אישיים:
  `session_start, tutorial_start, tutorial_complete, level_start, level_success, level_retry, session_end`.

## מה חסר / נדחה (במכוון)

- **שלבים 9–10 ממפרט המוצר** (שני סוגי חבילות) נדחו לגרסה 0.2 כי המודל תומך כרגע במקור ויעד יחידים; במקומם שלבי חבילה יחידה מורכבים יותר.
  כיוון שיש חבילה אחת בלבד, אין עדיין הבחנה בין צבעי חבילות; בממשק, מצב שלב מופיע גם בכיתוב ולא רק בצבע.
- זיהוי **לולאה** קיים (מצב חוזר + מגבלת צעדים), אך עם סוגי האריחים הנוכחיים לולאה אמיתית **אי אפשר לבנות** (המסלול הפיך, ולכן תמיד יגיע לכישלון אחר קודם). הבדיקה מכסה את מגבלת הצעדים בלבד.
- אין אנימציית "מפעל מתעורר" מלאה — רק אנימציה קצרה וניתנת לדילוג בשלב 12. אין גרסת 0.2 (משאבים, הרחבת מפעל), מודעות, רכישות או ענן.
- קובץ `IRewardedAdService` הוא ממשק תכנון בלבד, בלי מימוש.

## מה אומת ומה לא

| נושא | סטטוס |
|---|---|
| לוגיקה (מסלול תקין/חסום/חיבור חסר/חיבור שגוי/יציאה מהלוח/מגבלת צעדים, reset, נעילה ופתיחת שלבים, save/load, 12 שלבים פתירים) | **הורצה**: 28 בדיקות עוברות עם `dotnet test` (net8.0, C# 9 כמו Unity) |
| קוד Runtime (UI/תצוגה/קלט) | **עבר קומפילציה** מול `UnityEngine.Modules` 2021.3.33 ו-stubs ל-uGUI. ענף ה-Input System החדש, קוד ה-Editor והשיידר **לא הורכבו** |
| Play Mode, מראה ויזואלי, מסגור המצלמה, מגע, צלילים | **לא הורצו** |
| Build ל-Android, התקנה, FPS 30 יציב, חימום | **לא בוצעו** (דורש Unity + Android SDK ומכשיר) |
| 1080x2400 / 720x1600, Safe Area על מכשיר | **לא נבדק** (נבנה לפי Safe Area ו-CanvasScaler) |

## שיפור משחקיות מוצע לשלב הבא (לפני מונטיזציה)

1. אריח "מתג" או מסוע דו־כיווני כדי שיהיו מסלולים אמיתיים עם מספר פתרונות, ואז ללכת על חבילות בשני סוגים (שלבים 9–10 המקוריים).
2. דירוג כוכבים לפי מספר הנגיעות (לא זמן), עם הסבר ברור על "פתרון אופטימלי" — בלי לחץ זמן.
3. אחרי כל שלב להוסיף חלק קטן למפעל (גרסה 0.2), כדי שההתקדמות תיראה לעין.
4. מבחן איכותני עם 10–20 שחקנים (בהסכמה מתאימה לפי גיל ומקום) לפני כל החלטה על מונטיזציה.
