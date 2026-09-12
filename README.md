# InfoStream AI — Real-Time News & Intelligence
<img width="1600" height="787" alt="image" src="https://github.com/user-attachments/assets/7c2f90ec-ccb8-4578-945d-ca536e80c075" />
<img width="1600" height="745" alt="image" src="https://github.com/user-attachments/assets/ecf50879-2f1b-4c0a-ab6b-79ac3b4277d5" />
<img width="1600" height="748" alt="image" src="https://github.com/user-attachments/assets/f4ff9718-963a-45a9-b245-760f9005f825" />



A modern editorial & clean tech worldwide news platform with live article feeds, YouTube-style video stream, smart filtering, and an intelligent InfoStream AI news copilot.

## Run in VS Code

1. Install Node.js 22 or newer from https://nodejs.org/.
2. Extract this ZIP and open the `infostream-ai-news` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Install packages:

   ```bash
   npm install
   ```

5. Start the development website:

   ```bash
   npm run dev
   ```

6. Open the local address printed in the terminal (normally
   `http://localhost:5173`).

## Where to add APIs later

- `.env.example` lists the required variable names. Copy it to `.env.local`.
- `lib/integrations.ts` contains blank provider and model settings.
- `data/news.ts` contains the current demonstration news and video items.

Do not put secret keys directly inside browser components. Create server-side
API routes for GNews/NewsAPI, YouTube Data API, and OpenAI/Gemini calls.

## Main files

- `app/page.tsx` — page layout and simple interactions.
- `app/globals.css` — complete responsive visual design.
- `app/layout.tsx` — website title and metadata.
- `data/news.ts` — demonstration content.
- `lib/integrations.ts` — intentionally blank API/model configuration.

All major sections include comments so a beginner can follow the structure.
