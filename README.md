# Quoting on your phone

A six-question survey for estate agents (PRO-16156, go/no-go questions G1–G5).
A static page on GitHub Pages posts each response to a Google Sheet owned by
Vikas, through a Google Apps Script web app. The script also emails each
response to the sheet's owner.

## Files

| File | What |
| --- | --- |
| `index.html` | The page |
| `survey.js` | Questions, validation, sending |
| `config.js` | `SURVEY_ENDPOINT`: the Apps Script web app URL |
| `apps-script/Code.gs` | Paste into the Sheet's Apps Script editor |

## Set up the Sheet (once)

1. Signed in as your Homey Google account, open <https://sheets.new> and name the sheet.
2. **Extensions → Apps Script.** Replace the code with `apps-script/Code.gs`, then save.
3. Choose `setup` in the function menu and press **Run**. Allow the permissions it asks for.
   It creates a **Responses** tab and a **Results** tab that counts G1–G4 against 5 of 8.
4. **Deploy → New deployment → Web app.** Execute as **Me**, who has access **Anyone**. Deploy.
5. Copy the web app URL (ends in `/exec`) into `config.js` and push.

Changing `Code.gs` later needs **Deploy → Manage deployments → Edit → New version**,
or the old code keeps running.

## Run locally

```bash
python3 -m http.server 8765
```
