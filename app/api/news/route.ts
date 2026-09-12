import { NextRequest, NextResponse } from "next/server";

// Only supported values are accepted from the browser.
// This prevents unexpected values from being forwarded to GNews.
const allowedLanguages = new Set(["en", "ur", "hi", "ar", "fr", "de", "es"]);
const allowedCountries = new Set(["pk", "us", "gb", "in", "ca", "au"]);
const allowedCategories = new Set([
  "general", "world", "business", "technology", "science",
  "entertainment", "sports", "health",
]);

// This server route keeps the GNews API key hidden from website visitors.
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GNEWS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GNEWS_API_KEY is missing." },
        { status: 500 }
      );
    }

    // Read and validate filters supplied by app/page.tsx.
    const input = request.nextUrl.searchParams;
    const search = input.get("q")?.trim().slice(0, 200) || "";
    const requestedLanguage = input.get("lang") || "en";
    const requestedCountry = input.get("country") || "";
    const requestedCategory = input.get("category") || "general";
    const requestedPage = Number(input.get("page") || "1");

    // Keep pagination within a small safe range for this simple project.
    const page = Number.isInteger(requestedPage)
      ? Math.min(Math.max(requestedPage, 1), 10)
      : 1;

    const language = allowedLanguages.has(requestedLanguage)
      ? requestedLanguage
      : "en";
    const country = allowedCountries.has(requestedCountry)
      ? requestedCountry
      : "";
    const category = allowedCategories.has(requestedCategory)
      ? requestedCategory
      : "general";

    // Build the GNews request without exposing the key in frontend code.
    const endpointName = search ? "search" : "top-headlines";
    const parameters = new URLSearchParams({
      lang: language,
      max: "10",
      page: String(page),
      apikey: apiKey,
    });

    if (search) parameters.set("q", search);
    else parameters.set("category", category);
    if (country) parameters.set("country", country);

    const response = await fetch(
      `https://gnews.io/api/v4/${endpointName}?${parameters.toString()}`,
      { next: { revalidate: 300 } }
    );
    const data = await response.json();

    if (!response.ok) {
      console.error("GNews error:", data);
      return NextResponse.json(
        { error: data.errors?.[0] || "Unable to retrieve news." },
        { status: response.status }
      );
    }

    // Convert provider fields into the simple format used by the news cards.
    const articles = (data.articles || []).map(
      (article: {
        title?: string;
        description?: string;
        image?: string;
        url?: string;
        publishedAt?: string;
        source?: { name?: string; url?: string };
      }, index: number) => ({
        id: `${article.url || "article"}-${index}`,
        title: article.title || "Untitled article",
        summary: article.description || "No description is available.",
        image: article.image || "/globe.svg",
        source: article.source?.name || "Unknown source",
        sourceUrl: article.source?.url || "",
        url: article.url || "",
        publishedAt: article.publishedAt || "",
        age: "Recent",
        readTime: "4 min",
        category,
        isVideo: false,
      })
    );

    return NextResponse.json({
      articles,
      // Ten returned articles normally means another page may exist.
      hasMore: articles.length === 10 && page < 10,
      page,
      filters: { country: country || "worldwide", language, category },
    });
  } catch (error) {
    console.error("News route error:", error);
    return NextResponse.json(
      { error: "The news service is temporarily unavailable." },
      { status: 500 }
    );
  }
}