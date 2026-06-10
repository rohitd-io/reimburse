import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const isAuthenticated = request.cookies.has("emertech_reimburse_session");

  if (!isAuthenticated) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!url) {
    return new NextResponse("Missing URL", { status: 400 });
  }

  try {
    const response = await get(url, { access: "private" });

    if (!response) {
      return new NextResponse("Failed to fetch file from Blob storage", {
        status: 404,
      });
    }

    if (response.statusCode === 304) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(response.stream, {
      headers: {
        "Content-Type": response.blob.contentType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching private blob:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
