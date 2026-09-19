import { ImageResponse } from "next/og";
import sharp from "sharp";

import { db } from "@/lib/db";
import { getSiteSettings, readSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";

/**
 * Default social-sharing image for every page that does not set its own.
 *
 * Generated rather than a static PNG so the school name, tagline and motto
 * come from settings — a change in the dashboard reaches Facebook and
 * WhatsApp previews without a designer. Drawn in the site's navy and gold
 * with no photograph, so it never depends on a media asset existing.
 *
 * ImageResponse supports flexbox and a CSS subset only; no grid.
 */
export const alt = "Bugema Adventist Secondary School";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The crest as a PNG data URL, or null when none is configured or it cannot
 * be read. Satori (behind ImageResponse) does not decode WebP, which is how
 * the media pipeline stores images, so it is transcoded here. A failure falls
 * back to the typographic monogram rather than failing the whole image.
 */
async function crestDataUrl(logoId: string | null): Promise<string | null> {
  if (!logoId) return null;
  try {
    const asset = await db.mediaAsset.findUnique({ where: { id: logoId }, select: { storageKey: true } });
    if (!asset) return null;
    const png = await sharp(await storage.get(asset.storageKey)).resize({ height: 160 }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const settings = await getSiteSettings();
  const name = readSetting(settings, "school.name") ?? "Bugema Adventist Secondary School";
  const tagline = readSetting(settings, "school.tagline");
  const motto = readSetting(settings, "school.motto");
  const crest = await crestDataUrl(readSetting(settings, "school.logo"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #061733 0%, #0a2447 60%, #123a6b 100%)",
          color: "white",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {crest ? (
            // The crest is drawn for light backgrounds, so it sits on a white
            // plate here exactly as it does in the site footer.
            <div style={{ display: "flex", background: "white", padding: "10px 16px", borderRadius: 4 }}>
              <img src={crest} alt="" height={80} style={{ height: 80, objectFit: "contain" }} />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                border: "4px solid #d4ae41",
                background: "#0e2f57",
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              B
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, lineHeight: 1.05, fontWeight: 700, maxWidth: 1000 }}>
            {name}
          </div>
          {tagline ? (
            <div style={{ fontSize: 30, color: "#c2d6ee", fontFamily: "Arial, sans-serif" }}>{tagline}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 120, height: 6, background: "#d4ae41" }} />
          {motto ? (
            <div style={{ fontSize: 24, letterSpacing: 3, color: "#e3c465", textTransform: "uppercase" }}>
              {motto}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
