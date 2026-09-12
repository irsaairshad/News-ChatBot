import { NextRequest, NextResponse } from "next/server";

// This route retrieves YouTube videos without exposing the API key.
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY is missing." },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("q")?.trim() || "world news today";

    const endpoint = new URL(
      "https://www.googleapis.com/youtube/v3/search"
    );

    endpoint.searchParams.set("part", "snippet");
    endpoint.searchParams.set("type", "video");
    endpoint.searchParams.set("videoEmbeddable", "true");
    endpoint.searchParams.set("safeSearch", "moderate");
    endpoint.searchParams.set("order", "date");
    endpoint.searchParams.set("maxResults", "9");
    endpoint.searchParams.set("q", search);
    endpoint.searchParams.set("key", apiKey);

    const response = await fetch(endpoint.toString(), {
      next: { revalidate: 600 },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("YouTube error:", data);

      return NextResponse.json(
        { error: data.error?.message || "Unable to retrieve videos." },
        { status: response.status }
      );
    }

    // Convert the YouTube response to the frontend video format.
    const videos = (data.items || []).map(
      (
        item: {
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            description?: string;
            channelTitle?: string;
            publishedAt?: string;
            thumbnails?: {
              high?: { url?: string };
              medium?: { url?: string };
            };
          };
        },
        index: number
      ) => {
        const videoId = item.id?.videoId || "";

        return {
  id: index + 1,
  videoId,
  title: item.snippet?.title || "Untitled video",
  description: item.snippet?.description || "",
  channel: item.snippet?.channelTitle || "Unknown channel",
  image:
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.medium?.url ||
    "/globe.svg",
  url: `https://www.youtube.com/watch?v=${videoId}`,
  publishedAt: item.snippet?.publishedAt || "",
  views: "YouTube",
  age: "Recently published",
  duration: "Video",
};
      }
    );

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("YouTube route error:", error);

    return NextResponse.json(
      { error: "The YouTube service is temporarily unavailable." },
      { status: 500 }
    );
  }
}