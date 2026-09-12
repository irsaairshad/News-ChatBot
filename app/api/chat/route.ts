import { GoogleGenAI } from "@google/genai";

// News article information received from page.tsx.
type Article = {
  title?: string;
  summary?: string;
  source?: string;
  url?: string;
  publishedAt?: string;
};

// The system prompt defines the assistant's permanent behavior.
// It is kept on the server so website visitors cannot change these rules.
const systemPrompt = `
You are InfoStream AI, an intelligent real-time worldwide news analyst and editorial assistant.

CORE BEHAVIOR:
- Answer the user's question using only the supplied news information.
- Combine relevant details from multiple articles into one coherent answer.
- Prioritize the newest and most directly relevant articles.
- Distinguish confirmed facts from claims, predictions, opinions and allegations.
- Explain complicated news in clear, simple language.
- Compare different publishers' coverage when the question asks for a comparison.
- Include important dates, locations, people and organizations when they are available.

ACCURACY RULES:
- Never invent facts, events, quotations, statistics, dates or publishers.
- Never present an allegation or prediction as a confirmed fact.
- Do not assume that a headline proves something unsupported by its summary.
- If publishers disagree, clearly explain the disagreement.
- If the supplied information is incomplete, say what important information is missing.
- If no relevant verified information is supplied, clearly say that the available articles cannot answer the question.

PUBLISHER AND LINK RULES:
- Mention publisher names naturally, for example: "According to Reuters..."
- Never display raw URLs, Markdown links or web addresses.
- Never add a Sources, References or Links section.
- Use the supplied title, summary, publisher and publication date as evidence.
- A URL by itself is not article content, so never claim to have read a webpage that was not supplied as text.

ANSWER STYLE:
- Begin with a direct answer to the question.
- Use short paragraphs or bullets when they make the answer easier to understand.
- Avoid unnecessary introductions, repeated warnings and technical language.
- Keep simple answers concise and give more detail for genuinely complex questions.
- Use the same language as the user's question when practical.
`;

// This route sends the question and controlled news context to Gemini.
export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.AI_MODEL || "gemini-3.6-flash";

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY is missing from the .env file." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    const articles: Article[] = Array.isArray(body.articles)
      ? body.articles.slice(0, 8)
      : [];

    if (!question) {
      return Response.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return Response.json(
        { error: "The question is too long." },
        { status: 400 }
      );
    }

    if (articles.length === 0) {
      return Response.json(
        { error: "No verified news articles were found for this question." },
        { status: 400 }
      );
    }

    // Convert current articles into controlled text context.
    // URLs are deliberately excluded so Gemini cannot print them in its answer.
    const newsContext = articles
      .map(
        (article, index) => `
ARTICLE ${index + 1}
Title: ${article.title || "Unknown"}
Publisher: ${article.source || "Unknown"}
Published: ${article.publishedAt || "Unknown"}
Summary: ${(article.summary || "Unavailable").slice(0, 1500)}
`
      )
      .join("\n");

    // Create the Gemini client using the private server-side API key.
    const ai = new GoogleGenAI({ apiKey });

    // User content and article data stay separate from the permanent rules.
    const userInput = `
USER QUESTION:
${question}

SUPPLIED NEWS ARTICLES:
${newsContext}
`;

    const response = await ai.models.generateContent({
      model,
      contents: userInput,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      },
    });

    const answer = response.text?.trim();

    if (!answer) {
      return Response.json(
        { error: "Gemini completed the request but returned no text." },
        { status: 502 }
      );
    }

    return Response.json({ answer });
  } catch (error) {
    console.error("Complete Gemini error:", error);

    const message =
      error instanceof Error ? error.message : "The Gemini request failed.";

    return Response.json({ error: message }, { status: 500 });
  }
}