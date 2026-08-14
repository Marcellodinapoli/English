# Installare Alinea su Android (APK)

Stesso flusso di **GitHub Actions → Artifacts** usato per CreditCalc su Windows.

Repo: [github.com/Marcellodinapoli/English](https://github.com/Marcellodinapoli/English)

## 1. Avvia la build

1. Apri **Actions** → workflow **Build Android**
2. Clicca **Run workflow** → **Run workflow** (oppure attendi il push su `main`)
3. Attendi la spunta verde (~5–10 min)

## 2. Scarica l’APK

1. Apri il run completato
2. In basso, sezione **Artifacts**
3. Scarica **`Alinea-Android`** (file `app-debug.apk`)
4. Copia sul telefono e installa (abilita **origini sconosciute**)

## 3. URL del server (importante)

L’APK è un guscio nativo: apre il backend Next.js nel telefono.

Prima di buildare, in **Settings → Secrets and variables → Actions** aggiungi:

| Secret | Esempio |
|--------|---------|
| `CAPACITOR_SERVER_URL` | `https://tuo-dominio.vercel.app` |

Test in casa (stessa Wi‑Fi):

```
http://192.168.1.20:3000
```

Poi rilancia **Build Android** così l’APK incorpora l’URL corretto.

## 4. Installazione sul telefono

1. Trasferisci l’APK (USB, Drive, email)
2. Apri il file → **Installa**
3. Avvia **Alinea**

Se vedi schermata bianca: il server in `CAPACITOR_SERVER_URL` non è raggiungibile dal telefono.

## Build locale (opzionale)

Con Android Studio + JDK 21:

```powershell
$env:CAPACITOR_SERVER_URL="http://192.168.1.20:3000"
npm run mobile:sync
cd android
.\gradlew.bat assembleDebug
```

APK: `android\app\build\outputs\apk\debug\app-debug.apk`
