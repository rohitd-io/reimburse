import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { verifySession } from "@/lib/session";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const sessionToken = request.cookies.get("emertech_reimburse_session")?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!url) {
    return new NextResponse("Missing URL", { status: 400 });
  }

  // Verify database record ownership: check if this file URL is stored in expense_items
  try {
    const existsResult = await db.execute({
      sql: "SELECT 1 FROM expense_items WHERE proof_path LIKE ?",
      args: [`%${url}%`]
    });

    if (existsResult.rows.length === 0) {
      return new NextResponse("Forbidden - Resource not linked to any expense item", { status: 403 });
    }
  } catch (dbError) {
    console.error("Database query failed during file proxy check:", dbError);
    return new NextResponse("Internal Server Error", { status: 500 });
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
