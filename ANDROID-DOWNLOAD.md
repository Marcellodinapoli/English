# Installare Alinea su Android (APK)

L’app Android è un **shell Capacitor** che apre il backend Next.js nel telefono. Il file `.apk` si scarica da GitHub dopo il push del codice.

## 1. Carica il progetto su GitHub

Se il repo remoto non è ancora collegato:

```bash
git remote add origin https://github.com/TUO-UTENTE/English.git
git push -u origin main
```

## 2. Configura l’URL del server (importante)

L’APK deve sapere **dove** trovare l’app (Vercel, PC in LAN, ecc.).

Su GitHub → **Settings → Secrets and variables → Actions**:

| Nome | Esempio |
|------|---------|
| `CAPACITOR_SERVER_URL` | `https://tuo-dominio.vercel.app` |

Per test in casa (telefono e PC sulla stessa Wi‑Fi):

```
http://192.168.1.20:3000
```

Poi su GitHub → **Actions → Android APK → Run workflow** (oppure attendi il run automatico su `main`).

## 3. Scarica l’APK

1. Apri **Actions** nel repo GitHub  
2. Seleziona l’ultimo workflow **Android APK** completato  
3. In **Artifacts** scarica **`alinea-english-debug-apk`**  
4. Estrai `alinea-english-debug.apk` sul PC e copialo sul telefono (USB, Drive, email)

In alternativa, crea un tag per una release permanente:

```bash
git tag v0.1.0
git push origin v0.1.0
```

L’APK compare negli **Assets** della Release su GitHub.

## 4. Installa sul telefono

1. **Impostazioni → Sicurezza** → abilita installazione da origini sconosciute (o “Installa app sconosciute” per Chrome/Drive)  
2. Apri il file `.apk` e conferma **Installa**  
3. Avvia **Alinea**

Se vedi schermata bianca o errore di rete, controlla che `CAPACITOR_SERVER_URL` punti a un server raggiungibile dal telefono e che il backend sia online.

## Build locale (opzionale)

Con **Android Studio** + JDK 21 installati:

```powershell
$env:CAPACITOR_SERVER_URL="http://192.168.1.20:3000"
npm run mobile:sync
cd android
.\gradlew.bat assembleDebug
```

APK: `android\app\build\outputs\apk\debug\app-debug.apk`
