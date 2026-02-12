export type YouTubeCategoryOption = {
  id: string;
  name: string;
};

export const DEFAULT_YOUTUBE_CATEGORY_ID = '22';

export const YOUTUBE_VIDEO_CATEGORIES: YouTubeCategoryOption[] = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' },
  { id: '29', name: 'Nonprofits & Activism' },
];

const CATEGORY_BY_ID = new Map(YOUTUBE_VIDEO_CATEGORIES.map((item) => [item.id, item]));
const CATEGORY_BY_NAME = new Map(
  YOUTUBE_VIDEO_CATEGORIES.map((item) => [item.name.trim().toLowerCase(), item])
);

export function resolveYouTubeCategoryId(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;

  const byId = CATEGORY_BY_ID.get(raw);
  if (byId) return byId.id;

  const byName = CATEGORY_BY_NAME.get(raw.toLowerCase());
  if (byName) return byName.id;

  const idMatch = raw.match(/\b(\d{1,3})\b/);
  if (idMatch && CATEGORY_BY_ID.has(idMatch[1])) {
    return idMatch[1];
  }

  return undefined;
}

export function getYouTubeCategoryName(value: unknown): string {
  const id = resolveYouTubeCategoryId(value) || DEFAULT_YOUTUBE_CATEGORY_ID;
  return CATEGORY_BY_ID.get(id)?.name || 'People & Blogs';
}
