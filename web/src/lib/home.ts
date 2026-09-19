import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";

import { MEDIA_SELECT } from "./content";
import { getSiteSettings, readSetting, type SettingKey } from "./settings";

/**
 * Content for the homepage.
 *
 * The homepage LAYOUT is fixed in code — see the page component. This module
 * supplies only what goes inside it, which is why everything here is a typed
 * query rather than an ordered list of arbitrary section rows.
 */

export const getHomeFeatures = cache(async () =>
  db.homeFeature.findMany({
    where: { isVisible: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      body: true,
      media: { select: MEDIA_SELECT },
    },
  }),
);

export const getHomeHighlights = cache(async () =>
  db.homeHighlight.findMany({
    where: { isVisible: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      value: true,
      label: true,
      caption: true,
      media: { select: MEDIA_SELECT },
    },
  }),
);

export type HomeImages = {
  hero: Awaited<ReturnType<typeof resolveImages>>[string] | null;
  collage: NonNullable<Awaited<ReturnType<typeof resolveImages>>[string]>[];
  about: Awaited<ReturnType<typeof resolveImages>>[string] | null;
};

async function resolveImages(ids: string[]) {
  if (ids.length === 0) return {};

  const assets = await db.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true, ...MEDIA_SELECT },
  });

  return Object.fromEntries(assets.map((asset) => [asset.id, asset]));
}

/**
 * Resolves the photographs the homepage uses.
 *
 * They are chosen through site settings rather than hard-coded, so the school
 * can refresh the front page without a deployment — but which slots exist is
 * fixed by the layout.
 */
export const getHomeImages = cache(async (): Promise<HomeImages> => {
  const settings = await getSiteSettings();

  const keys: SettingKey[] = [
    "home.heroImage",
    "home.heroCollageOne",
    "home.heroCollageTwo",
    "home.heroCollageThree",
    "home.aboutImage",
  ];

  const ids = keys
    .map((key) => readSetting(settings, key))
    .filter((id): id is string => Boolean(id));

  const byId = await resolveImages(ids);
  const pick = (key: SettingKey) => {
    const id = readSetting(settings, key);
    return id ? (byId[id] ?? null) : null;
  };

  return {
    hero: pick("home.heroImage"),
    collage: [
      pick("home.heroCollageOne"),
      pick("home.heroCollageTwo"),
      pick("home.heroCollageThree"),
    ].filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)),
    about: pick("home.aboutImage"),
  };
});
