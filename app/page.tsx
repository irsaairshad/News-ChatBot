"use client";

// Screen behavior lives here. Demo content and API settings stay in separate files.
// React tools used for forms, API loading, filtering and component state.
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
// Rename the demonstration data so live API results can use the normal names.
import {
  categories,
  newsItems as demoNewsItems,
  videoItems as demoVideoItems,
} from "../data/news";

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span aria-hidden="true" className="icon">
    {children}
  </span>
);

// Values use the two-letter codes expected by GNews.
const countries = [
  { label: "Worldwide", value: "" },
  { label: "Pakistan", value: "pk" },
  { label: "United States", value: "us" },
  { label: "United Kingdom", value: "gb" },
  { label: "India", value: "in" },
  { label: "Canada", value: "ca" },
  { label: "Australia", value: "au" },
] as const;

const languages = [
  { label: "English", value: "en" },
  { label: "Urdu", value: "ur" },
  { label: "Hindi", value: "hi" },
  { label: "Arabic", value: "ar" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Spanish", value: "es" },
] as const;

// Trending topics for the stream ticker
const trendingTopics = [
  "Artificial Intelligence",
  "Global Markets",
  "Clean Energy",
  "Space Exploration",
  "Tech Policy",
  "World Economics",
  "Biomedical Research",
];

// Browser storage key used to keep bookmarks after the page is refreshed.
const savedNewsStorageKey = "infostream-saved-articles";

// Safely read an optional URL from either a live API object or a demo object.
function getExternalUrl(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("url" in value)) {
    return null;
  }

  const possibleUrl = (value as { url?: unknown }).url;

  return typeof possibleUrl === "string" && possibleUrl.trim()
    ? possibleUrl
    : null;
}

// Replace blocked or missing third-party thumbnails with a local safe image.
function useFallbackImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/globe.svg";
}

// Turn a conversational question into a short GNews search phrase.
function createNewsSearchQuery(question: string) {
  const cleanedQuestion = question
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(
      /\b(tell|give|show|please|me|about|what|is|are|the|latest|today|current|breaking|news|update|updates)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  return cleanedQuestion || question.slice(0, 100);
}

export default function Home() {
  // Start with demonstration content.
  const [newsItems, setNewsItems] = useState(demoNewsItems);
  const [videoItems, setVideoItems] = useState(demoVideoItems);

  // These states control the filters, search box and chatbot.
  const [category, setCategory] = useState("Top stories");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("en");
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [videoError, setVideoError] = useState("");
  const [savedArticles, setSavedArticles] = useState<typeof demoNewsItems>([]);
  const [viewSaved, setViewSaved] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<(typeof demoNewsItems)[number] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreNews, setHasMoreNews] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello! I am InfoStream AI. Ask me to summarize, analyze, or compare any news story in real-time.",
    },
  ]);

  // Convert frontend category names into categories supported by GNews.
  const gnewsCategories: Record<string, string> = {
    "Top stories": "general",
    World: "world",
    Business: "business",
    Technology: "technology",
    Science: "science",
    Culture: "entertainment",
    Sports: "sports",
  };

  // Read saved articles once in the browser. Supports migration from old storage key.
  useEffect(() => {
    try {
      const storedArticles =
        localStorage.getItem(savedNewsStorageKey) ||
        localStorage.getItem("worldbrief-saved-articles");
      if (!storedArticles) return;

      const parsedArticles: unknown = JSON.parse(storedArticles);
      if (Array.isArray(parsedArticles)) {
        setSavedArticles(parsedArticles as typeof demoNewsItems);
      }
    } catch (error) {
      console.error("Unable to read saved articles:", error);
    }
  }, []);

  // Close the article panel with Escape and stop the page scrolling behind it.
  useEffect(() => {
    if (!selectedArticle) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedArticle(null);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [selectedArticle]);

  // Global hotkey (Cmd+K / Ctrl+K) to focus search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(".searchbox input");
        if (searchInput) searchInput.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load category news with debounce
  useEffect(() => {
    const controller = new AbortController();

    async function loadNews() {
      try {
        setIsLoadingNews(true);
        setNewsError("");

        const cleanSearch = search.trim();
        const apiCategory = gnewsCategories[category] || "general";
        const parameters = new URLSearchParams({
          category: apiCategory,
          lang: language,
          page: "1",
        });

        if (cleanSearch.length >= 2) parameters.set("q", cleanSearch);
        if (country) parameters.set("country", country);

        const endpoint = `/api/news?${parameters.toString()}`;
        const response = await fetch(endpoint, { signal: controller.signal });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to retrieve news.");
        }

        setNewsItems(Array.isArray(data.articles) ? data.articles : []);
        setCurrentPage(1);
        setHasMoreNews(Boolean(data.hasMore));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        console.error("Unable to load live news:", error);
        setNewsError(
          error instanceof Error ? error.message : "Unable to retrieve news."
        );

        setNewsItems(demoNewsItems);
        setHasMoreNews(false);
      } finally {
        if (!controller.signal.aborted) setIsLoadingNews(false);
      }
    }

    const delay = search.trim().length >= 2 ? 600 : 0;
    const timer = window.setTimeout(loadNews, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, search, country, language]);

  // Request the next GNews page and add it beneath existing cards.
  async function loadMoreNews() {
    if (isLoadingMore || !hasMoreNews) return;

    try {
      setIsLoadingMore(true);
      setNewsError("");

      const cleanSearch = search.trim();
      const apiCategory = gnewsCategories[category] || "general";
      const nextPage = currentPage + 1;
      const parameters = new URLSearchParams({
        category: apiCategory,
        lang: language,
        page: String(nextPage),
      });

      if (cleanSearch.length >= 2) parameters.set("q", cleanSearch);
      if (country) parameters.set("country", country);

      const response = await fetch(`/api/news?${parameters.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load more news.");
      }

      const newArticles = Array.isArray(data.articles) ? data.articles : [];

      setNewsItems((oldArticles) => {
        const existingUrls = new Set(oldArticles.map(getExternalUrl));
        const uniqueArticles = newArticles.filter((article: unknown) => {
          const articleUrl = getExternalUrl(article);
          return !articleUrl || !existingUrls.has(articleUrl);
        });

        return [...oldArticles, ...uniqueArticles];
      });

      setCurrentPage(nextPage);
      setHasMoreNews(Boolean(data.hasMore));
    } catch (error) {
      console.error("Unable to load more news:", error);
      setNewsError(
        error instanceof Error ? error.message : "Unable to load more news."
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Load YouTube videos
  useEffect(() => {
    const controller = new AbortController();

    async function loadVideos() {
      try {
        setIsLoadingVideos(true);
        setVideoError("");

        const cleanSearch = search.trim();
        const parameters = new URLSearchParams({ maxResults: "6" });
        if (cleanSearch.length >= 2) parameters.set("q", cleanSearch);

        const endpoint = `/api/youtube?${parameters.toString()}`;
        const response = await fetch(endpoint, { signal: controller.signal });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to retrieve videos.");
        }

        setVideoItems(Array.isArray(data.videos) ? data.videos : []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        console.error("Unable to load YouTube videos:", error);
        setVideoError(
          error instanceof Error ? error.message : "Unable to retrieve videos."
        );
        setVideoItems(demoVideoItems);
      } finally {
        if (!controller.signal.aborted) setIsLoadingVideos(false);
      }
    }

    const delay = search.trim().length >= 2 ? 600 : 0;
    const timer = window.setTimeout(loadVideos, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  // Filter news items
  const filteredNews = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (query.length >= 2) return newsItems;

    return newsItems.filter((item) => {
      const itemCategory = item.category.toLowerCase();
      const selectedCategory = category.toLowerCase();

      const matchesCategory =
        category === "Top stories" ||
        itemCategory === selectedCategory ||
        (category === "Culture" && itemCategory === "entertainment");
      return matchesCategory;
    });
  }, [category, search, newsItems]);

  const displayedNews = viewSaved ? savedArticles : filteredNews;

  function articleKey(article: unknown) {
    if (typeof article === "object" && article !== null && "title" in article) {
      return getExternalUrl(article) || String(article.title);
    }
    return "";
  }

  function isArticleSaved(article: unknown) {
    const key = articleKey(article);
    return savedArticles.some((savedArticle) => articleKey(savedArticle) === key);
  }

  function toggleSavedArticle(article: (typeof demoNewsItems)[number]) {
    setSavedArticles((oldArticles) => {
      const key = articleKey(article);
      const alreadySaved = oldArticles.some(
        (savedArticle) => articleKey(savedArticle) === key
      );
      const updatedArticles = alreadySaved
        ? oldArticles.filter((savedArticle) => articleKey(savedArticle) !== key)
        : [article, ...oldArticles];

      localStorage.setItem(savedNewsStorageKey, JSON.stringify(updatedArticles));
      return updatedArticles;
    });
  }

  const leadStory = newsItems[0] || demoNewsItems[0];

  async function sendQuestion(event: FormEvent) {
    event.preventDefault();

    const asked = question.trim();
    if (!asked) return;

    setQuestion("");

    setMessages((old) => [
      ...old,
      { role: "user", text: asked },
      { role: "assistant", text: "Analyzing live verified sources for InfoStream..." },
    ]);

    try {
      let chatArticles = displayedNews.slice(0, 8);
      const asksForFreshTopic =
        /\b(latest|today'?s|current|breaking|updates?)\b/i.test(asked) &&
        !/\b(summarize|compare|explain|these|this)\b/i.test(asked);

      if (!chatArticles.length || asksForFreshTopic) {
        const newsQuery = createNewsSearchQuery(asked);
        const parameters = new URLSearchParams({ q: newsQuery, lang: language });
        if (country) parameters.set("country", country);

        const newsResponse = await fetch(`/api/news?${parameters.toString()}`);
        const newsData = await newsResponse.json();

        if (!newsResponse.ok) {
          throw new Error(newsData.error || "Unable to search live news.");
        }

        chatArticles = Array.isArray(newsData.articles)
          ? newsData.articles.slice(0, 8)
          : [];

        if (chatArticles.length) {
          setSearch(newsQuery);
          setViewSaved(false);
        } else {
          setMessages((old) => [
            ...old.slice(0, -1),
            {
              role: "assistant",
              text: `No verified recent stories found for "${newsQuery}". Try refining your topic or keywords.`,
            },
          ]);
          return;
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: asked,
          articles: chatArticles,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Chat request failed.");
      }

      setMessages((old) => [
        ...old.slice(0, -1),
        { role: "assistant", text: data.answer },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "The InfoStream AI assistant is temporarily unavailable.";

      setMessages((old) => [
        ...old.slice(0, -1),
        { role: "assistant", text: `Error: ${errorMessage}` },
      ]);
    }
  }

  return (
    <main>
      {/* Sticky top navigation bar */}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="InfoStream AI home">
          <span className="brand-icon">⚡</span>
          <div className="brand-text">
            <span className="brand-title">
              INFOSTREAM <span className="brand-ai">AI</span>
            </span>
            <span className="brand-tagline">Real-Time Intelligence</span>
          </div>
        </a>

        <div className="live-stream-badge">
          <span className="live-dot" />
          <span>STREAM LIVE</span>
        </div>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="active" href="#top">Discover</a>
          <a href="#latest">Latest Wire</a>
          <a href="#video">Video Stream</a>
        </nav>

        <label className="searchbox">
          <Icon>⌕</Icon>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setViewSaved(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("");
            }}
            placeholder="Search live intelligence stream…"
            aria-label="Search live news"
          />
          <kbd>{isLoadingNews ? "…" : search ? "ESC" : "⌘ K"}</kbd>
        </label>

        <button
          className="ask-top"
          onClick={() => setChatOpen(true)}
          aria-label="Open AI Copilot"
        >
          <Icon>✦</Icon> Ask AI Copilot
        </button>
      </header>

      {/* Breaking / Trending Topics Ticker Bar */}
      <div className="stream-ticker" aria-label="Trending news stream">
        <div className="ticker-label">
          <Icon>⚡</Icon> TRENDING NOW
        </div>
        <div className="ticker-tag-list">
          {trendingTopics.map((topic) => (
            <span
              key={topic}
              className="ticker-item"
              onClick={() => {
                setSearch(topic);
                setViewSaved(false);
              }}
            >
              #{topic.replace(/\s+/g, "")}
            </span>
          ))}
        </div>
      </div>

      <div className="page" id="top">
        {/* Magazine Editorial Hero Banner */}
        <section className="hero">
          <img
            src={leadStory.image}
            onError={useFallbackImage}
            alt="Lead story cover image"
          />
          <div className="hero-shade" />

          <div className="hero-copy">
            <div className="eyebrow">
              <span /> LIVE BRIEFING · {leadStory.category.toUpperCase()}
            </div>
            <h1>{leadStory.title}</h1>
            <p>{leadStory.summary}</p>
            <div className="hero-actions">
              <button
                onClick={() => {
                  setQuestion(`Give me an in-depth analysis of: ${leadStory.title}`);
                  setChatOpen(true);
                }}
              >
                <Icon>✦</Icon> Deep Dive with AI
              </button>
              {getExternalUrl(leadStory) ? (
                <a
                  href={getExternalUrl(leadStory) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read full coverage <span>↗</span>
                </a>
              ) : (
                <a href="#latest">Explore wire coverage <span>↗</span></a>
              )}
            </div>
          </div>

          <aside className="hero-pulse">
            <span className="pulse-dot" />
            <div>
              <small>GLOBAL INTELLIGENCE FEED</small>
              <strong>140+ verified feeds indexed</strong>
            </div>
          </aside>
        </section>

        {/* Category Filter Pills */}
        <section className="category-row" aria-label="News categories">
          {categories.map((item) => (
            <button
              key={item}
              className={!viewSaved && category === item ? "selected" : ""}
              onClick={() => {
                setCategory(item);
                setViewSaved(false);
              }}
            >
              {item}
            </button>
          ))}
          <button
            className={viewSaved ? "selected" : ""}
            onClick={() => setViewSaved(true)}
          >
            ♥ Saved ({savedArticles.length})
          </button>
        </section>

        {/* Filter Toolbar for Country & Language */}
        <section className="news-filters" aria-label="Country and language filters">
          <label>
            <span>Region</span>
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setViewSaved(false);
              }}
            >
              {countries.map((item) => (
                <option key={item.value || "world"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Language</span>
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                setViewSaved(false);
              }}
            >
              {languages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setCountry("");
              setLanguage("en");
              setCategory("Top stories");
              setSearch("");
              setViewSaved(false);
            }}
          >
            Reset Filters
          </button>
        </section>

        {/* News Grid Section */}
        <section className="news-section" id="latest">
          <div className="section-heading">
            <div>
              <p>
                {viewSaved
                  ? "BOOKMARKED INTELLIGENCE"
                  : isLoadingNews
                  ? "INDEXING LIVE STREAMS…"
                  : search.trim().length >= 2
                  ? `RESULTS FOR "${search.trim()}"`
                  : "STREAMING CURATED STORIES"}
              </p>
              <h2>
                {viewSaved
                  ? "Saved Stories"
                  : search.trim().length >= 2
                  ? "Search Results"
                  : category}
              </h2>
            </div>
            <span>
              {displayedNews.length} DISPATCHES
              {!viewSaved && (
                <>
                  {" "}
                  · {countries.find((item) => item.value === country)?.label} ·{" "}
                  {languages.find((item) => item.value === language)?.label}
                </>
              )}
            </span>
          </div>

          {newsError && (
            <div className="empty" role="status">
              Live news update note: {newsError}. Displaying cached dispatches.
            </div>
          )}

          {displayedNews.length ? (
            <div className="news-grid">
              {displayedNews.map((item, index) => (
                <article
                  className={`news-card ${index === 0 ? "wide" : ""}`}
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedArticle(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedArticle(item);
                    }
                  }}
                >
                  <div className="thumb">
                    <img src={item.image} onError={useFallbackImage} alt="" />
                    {item.isVideo && <span className="play">▶</span>}
                    <span className="category-tag">{item.category}</span>
                  </div>
                  <div className="card-copy">
                    <div className="source-line">
                      <span>{item.source.slice(0, 1)}</span>
                      {item.source}
                      <i />
                      {item.age}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <footer>
                      <span>◎ {item.readTime} read</span>
                      <button
                        className={`bookmark-button ${
                          isArticleSaved(item) ? "saved" : ""
                        }`}
                        aria-label={
                          isArticleSaved(item)
                            ? `Remove ${item.title} from saved`
                            : `Save ${item.title}`
                        }
                        aria-pressed={isArticleSaved(item)}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSavedArticle(item);
                        }}
                      >
                        {isArticleSaved(item) ? "♥" : "♡"}
                      </button>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              {viewSaved
                ? "No saved stories yet. Select the heart icon on any article to save it for offline reading."
                : "No matching stories found. Try a different search term or category."}
            </div>
          )}

          {!viewSaved && displayedNews.length > 0 && hasMoreNews && (
            <div className="load-more-wrap">
              <button
                type="button"
                onClick={loadMoreNews}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Streaming more dispatches…" : "Load More Dispatches"}
              </button>
            </div>
          )}
        </section>

        {/* Video Coverage Section */}
        <section className="video-section" id="video">
          <div className="section-heading light">
            <div>
              <p>
                {isLoadingVideos
                  ? "FETCHING VIDEO WIRE…"
                  : search.trim().length >= 2
                  ? `VIDEOS MATCHING "${search.trim()}"`
                  : "MULTIMEDIA BROADCASTS"}
              </p>
              <h2>
                {search.trim().length >= 2
                  ? "Video Dispatches"
                  : "Watch the Wire"}
              </h2>
            </div>
            <a href="#video">{videoItems.length} STREAMS</a>
          </div>

          {videoError && (
            <div className="empty" role="status">
              Video stream notice: {videoError}. Displaying featured broadcasts.
            </div>
          )}

          {videoItems.length ? (
            <div className="video-grid">
              {videoItems.map((video) => (
                <article
                  className="video-card"
                  key={video.id}
                  role={getExternalUrl(video) ? "link" : undefined}
                  tabIndex={getExternalUrl(video) ? 0 : undefined}
                  onClick={() => {
                    const videoUrl = getExternalUrl(video);
                    if (videoUrl) {
                      window.open(videoUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  onKeyDown={(event) => {
                    const videoUrl = getExternalUrl(video);
                    if (event.key === "Enter" && videoUrl) {
                      window.open(videoUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  <div className="video-thumb">
                    <img src={video.image} onError={useFallbackImage} alt="" />
                    <span className="play">▶</span>
                    <b>{video.duration}</b>
                  </div>
                  <div className="video-info">
                    <span>{video.channel.slice(0, 1)}</span>
                    <div>
                      <h3>{video.title}</h3>
                      <p>
                        {video.channel} · {video.views} views · {video.age}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              No matching video broadcasts found. Try another search query.
            </div>
          )}
        </section>
      </div>

      {/* Editorial Footer */}
      <footer className="site-footer">
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <div className="brand-text">
            <span className="brand-title">
              INFOSTREAM <span className="brand-ai">AI</span>
            </span>
          </div>
        </div>
        <p>Real-time global dispatches, verified editorial context, powered by AI.</p>
        <div>
          <a href="#top">Editorial Standards</a>
          <a href="#top">Intelligence Sources</a>
          <a href="#top">Privacy & Terms</a>
        </div>
      </footer>

      {/* Interactive In-App Article Modal */}
      {selectedArticle && (
        <div
          className="article-modal"
          role="presentation"
          onClick={() => setSelectedArticle(null)}
        >
          <article
            className="article-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="article-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="detail-close"
              type="button"
              onClick={() => setSelectedArticle(null)}
              aria-label="Close article details"
            >
              ×
            </button>
            <div className="detail-image">
              <img
                src={selectedArticle.image}
                onError={useFallbackImage}
                alt=""
              />
              <span>{selectedArticle.category}</span>
            </div>
            <div className="detail-copy">
              <div className="source-line">
                <span>{selectedArticle.source.slice(0, 1)}</span>
                {selectedArticle.source}
                <i />
                {selectedArticle.age}
              </div>
              <h2 id="article-detail-title">{selectedArticle.title}</h2>
              <p>{selectedArticle.summary}</p>
              <div className="detail-actions">
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(`Explain this dispatch and its global context: ${selectedArticle.title}`);
                    setChatOpen(true);
                    setSelectedArticle(null);
                  }}
                >
                  <Icon>✦</Icon> Ask InfoStream AI
                </button>
                <button
                  className={isArticleSaved(selectedArticle) ? "saved" : ""}
                  type="button"
                  onClick={() => toggleSavedArticle(selectedArticle)}
                >
                  {isArticleSaved(selectedArticle) ? "♥ Saved Story" : "♡ Save for Later"}
                </button>
                {getExternalUrl(selectedArticle) && (
                  <a
                    href={getExternalUrl(selectedArticle) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read original source dispatches ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        </div>
      )}

      {/* Floating Action Button for AI Assistant */}
      <button
        className="chat-fab"
        onClick={() => setChatOpen(!chatOpen)}
        aria-label="Open InfoStream AI Assistant"
      >
        <Icon>✦</Icon>
        <span>Ask InfoStream AI</span>
      </button>

      {/* AI Copilot Panel */}
      {chatOpen && (
        <aside className="chat-panel" aria-label="InfoStream AI Copilot">
          <header>
            <div>
              <span className="ai-orb">✦</span>
              <div>
                <strong>InfoStream AI Copilot</strong>
                <small>
                  <i /> Live Intelligence Assistant
                </small>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Close AI chat"
            >
              ×
            </button>
          </header>
          <div className="chat-body">
            {messages.map((message, index) => (
              <p className={message.role} key={index}>
                {message.text}
              </p>
            ))}
            <div className="prompts">
              <button
                onClick={() => setQuestion("Summarize today's top global stories")}
              >
                Summarize top wire
              </button>
              <button
                onClick={() => setQuestion("What are the key tech breakthroughs today?")}
              >
                Tech breakthroughs
              </button>
              <button
                onClick={() => setQuestion("Compare perspectives on the lead story")}
              >
                Compare perspectives
              </button>
            </div>
          </div>
          <form onSubmit={sendQuestion}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask anything about current world news…"
            />
            <button aria-label="Send question">↑</button>
          </form>
          <small className="disclaimer">
            InfoStream AI provides verified news summaries based on active dispatches.
          </small>
        </aside>
      )}
    </main>
  );
}