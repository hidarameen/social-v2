export type PlatformType =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "google_business"
  | "threads"
  | "snapchat"
  | "telegram"
  | "whatsapp";

export interface PlatformInfo {
  id: PlatformType;
  name: string;
  color: string;
  gradient: string;
  bgGlow: string;
  description: string;
  profileUrl?: string;
}

export const platforms: PlatformInfo[] = [
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    gradient: "from-blue-500 to-blue-700",
    bgGlow: "rgba(24, 119, 242, 0.18)",
    description: "صفحات الأعمال والمجموعات",
    profileUrl: "https://facebook.com",
  },
  {
    id: "instagram",
    name: "Instagram",
    color: "#E4405F",
    gradient: "from-pink-500 via-purple-500 to-orange-400",
    bgGlow: "rgba(228, 64, 95, 0.18)",
    description: "حسابات الأعمال والمبدعين",
    profileUrl: "https://instagram.com",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    color: "#14171A",
    gradient: "from-gray-600 to-gray-800",
    bgGlow: "rgba(20, 23, 26, 0.12)",
    description: "التغريدات والتفاعلات",
    profileUrl: "https://x.com",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "#0A66C2",
    gradient: "from-blue-600 to-blue-800",
    bgGlow: "rgba(10, 102, 194, 0.18)",
    description: "صفحات الشركات والملفات",
    profileUrl: "https://linkedin.com",
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "#EE1D52",
    gradient: "from-pink-500 via-rose-600 to-cyan-400",
    bgGlow: "rgba(238, 29, 82, 0.18)",
    description: "حسابات الأعمال والمبدعين",
    profileUrl: "https://tiktok.com",
  },
  {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    gradient: "from-red-500 to-red-700",
    bgGlow: "rgba(255, 0, 0, 0.15)",
    description: "القنوات وإدارة الفيديو",
    profileUrl: "https://youtube.com",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    color: "#BD081C",
    gradient: "from-red-600 to-red-800",
    bgGlow: "rgba(189, 8, 28, 0.15)",
    description: "لوحات ودبابيس الأعمال",
    profileUrl: "https://pinterest.com",
  },
  {
    id: "google_business",
    name: "Google Business",
    color: "#4285F4",
    gradient: "from-blue-500 via-green-400 to-yellow-400",
    bgGlow: "rgba(66, 133, 244, 0.18)",
    description: "ملف النشاط التجاري",
    profileUrl: "https://business.google.com",
  },
  {
    id: "threads",
    name: "Threads",
    color: "#14171A",
    gradient: "from-gray-600 to-gray-800",
    bgGlow: "rgba(20, 23, 26, 0.12)",
    description: "المحادثات والنصوص",
    profileUrl: "https://threads.net",
  },
  {
    id: "snapchat",
    name: "Snapchat",
    color: "#FFFC00",
    gradient: "from-yellow-300 to-yellow-500",
    bgGlow: "rgba(255, 252, 0, 0.18)",
    description: "حسابات الأعمال",
    profileUrl: "https://snapchat.com",
  },
  {
    id: "telegram",
    name: "Telegram",
    color: "#0088cc",
    gradient: "from-sky-400 to-blue-600",
    bgGlow: "rgba(0, 136, 204, 0.18)",
    description: "القنوات والمجموعات والبوتات",
    profileUrl: "https://t.me",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    color: "#25D366",
    gradient: "from-green-400 to-green-600",
    bgGlow: "rgba(37, 211, 102, 0.18)",
    description: "WhatsApp Business API",
    profileUrl: "https://wa.me",
  },
];

export function FacebookIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
        fill="#1877F2"
      />
    </svg>
  );
}

export function InstagramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="25%" stopColor="#F77737" />
          <stop offset="50%" stopColor="#E1306C" />
          <stop offset="75%" stopColor="#C13584" />
          <stop offset="100%" stopColor="#833AB4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function TwitterIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#14171A" />
      <path
        d="M13.544 10.456L18.308 5H17.063L12.998 9.68L9.756 5H6L10.983 12.588L6 18.28H7.246L11.528 13.364L14.947 18.28H18.703L13.544 10.456ZM12.15 12.647L11.6 11.878L7.69 5.896H9.167L12.642 10.416L13.192 11.186L17.064 17.424H15.587L12.15 12.647Z"
        fill="white"
      />
    </svg>
  );
}

export function LinkedInIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0A66C2" />
      <path d="M7.5 10V17H5V10H7.5ZM6.25 5.5C7.08 5.5 7.75 6.17 7.75 7S7.08 8.5 6.25 8.5 4.75 7.83 4.75 7 5.42 5.5 6.25 5.5ZM9.5 10H12V11.1C12.44 10.4 13.39 9.8 14.75 9.8C17.32 9.8 17.75 11.45 17.75 13.6V17H15.25V14.1C15.25 13.2 15.23 12.05 14 12.05C12.75 12.05 12.5 13.02 12.5 14V17H10V10H9.5Z" fill="white" />
    </svg>
  );
}

export function TikTokIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#14171A" />
      <path d="M16.5 4.5C16.5 4.5 16.5 7.5 19.5 7.5V10.5C19.5 10.5 17.25 10.5 16.5 9.75V15C16.5 18 14.25 19.5 12 19.5C9.75 19.5 7.5 18 7.5 15C7.5 12 9.75 10.5 12 10.5V13.5C10.5 13.5 10.5 14.25 10.5 15C10.5 15.75 11.25 16.5 12 16.5C12.75 16.5 13.5 15.75 13.5 15V4.5H16.5Z" fill="white" />
      <path d="M16.5 4.5C16.5 4.5 16.5 7.5 19.5 7.5V10.5C19.5 10.5 17.25 10.5 16.5 9.75V15" stroke="#25F4EE" strokeWidth="0.5" fill="none" />
      <path d="M13.5 15V4.5H16.5" stroke="#FE2C55" strokeWidth="0.5" fill="none" />
    </svg>
  );
}

export function YouTubeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path d="M10 15.5V8.5L16 12L10 15.5Z" fill="white" />
    </svg>
  );
}

export function PinterestIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#BD081C" />
      <path d="M12 4C8.13 4 5 7.13 5 11C5 13.74 6.58 16.09 8.91 17.21C8.86 16.58 8.82 15.58 8.94 14.87L9.68 11.57C9.68 11.57 9.46 11.02 9.46 10.2C9.46 8.93 10.19 7.99 11.1 7.99C11.87 7.99 12.25 8.57 12.25 9.26C12.25 10.03 11.75 11.16 11.5 12.21C11.29 13.08 11.93 13.78 12.79 13.78C14.33 13.78 15.51 12.15 15.51 9.82C15.51 7.77 14.04 6.34 11.95 6.34C9.53 6.34 8.11 8.15 8.11 10.02C8.11 10.8 8.41 11.63 8.79 12.08L8.69 12.49C8.65 12.67 8.56 13.01 8.54 13.1C8.51 13.23 8.44 13.26 8.3 13.19C7.22 12.69 6.54 11.13 6.54 9.98C6.54 7.32 8.48 4.89 12.18 4.89C15.14 4.89 17.45 6.99 17.45 9.77C17.45 12.72 15.58 15.08 13.01 15.08C12.09 15.08 11.23 14.61 10.94 14.05L10.41 16.15C10.2 16.96 9.64 17.98 9.27 18.6C10.13 18.86 11.05 19 12 19C15.87 19 19 15.87 19 12C19 8.13 15.87 5 12 5V4Z" fill="white" />
    </svg>
  );
}

export function GoogleBusinessIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#fff" stroke="#e5e7eb" strokeWidth="0.5" />
      <path d="M5.26 9.66L6.19 6.09L9.36 5.64C7.95 6.86 7.1 8.65 7.1 10.63H5.07C5.07 10.29 5.14 9.97 5.26 9.66Z" fill="#FBBC05" />
      <path d="M7.1 10.63C7.1 12.62 7.95 14.4 9.36 15.63L6.19 15.18L5.26 11.61C5.14 11.3 5.07 10.97 5.07 10.63H7.1Z" fill="#34A853" />
      <path d="M12 16.5C10.85 16.5 9.82 16.16 8.97 15.58L9.36 15.63L12 17.93L14.64 15.63L15.03 15.58C14.18 16.16 13.15 16.5 12 16.5Z" fill="#34A853" />
      <path d="M16.9 10.63H18.93C18.93 10.97 18.86 11.3 18.74 11.61L17.81 15.18L14.64 15.63C16.05 14.4 16.9 12.62 16.9 10.63Z" fill="#4285F4" />
      <path d="M12 4.77C13.15 4.77 14.18 5.11 15.03 5.69L14.64 5.64L12 3.33L9.36 5.64L8.97 5.69C9.82 5.11 10.85 4.77 12 4.77Z" fill="#EA4335" />
      <path d="M16.9 10.63C16.9 8.65 16.05 6.86 14.64 5.64L17.81 6.09L18.74 9.66C18.86 9.97 18.93 10.29 18.93 10.63H16.9Z" fill="#4285F4" />
      <circle cx="12" cy="10.63" r="3" fill="#EA4335" />
    </svg>
  );
}

export function ThreadsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#14171A" />
      <path
        d="M15.3 11.13C15.22 11.09 15.14 11.06 15.06 11.02C14.91 9.35 13.97 8.38 12.48 8.37H12.45C11.59 8.37 10.88 8.72 10.44 9.34L11.35 9.96C11.66 9.53 12.13 9.41 12.46 9.41C12.47 9.41 12.48 9.41 12.49 9.41C13.02 9.41 13.42 9.58 13.67 9.9C13.85 10.13 13.97 10.46 14.03 10.87C13.56 10.79 13.05 10.77 12.5 10.82C11.13 10.93 10.28 11.68 10.34 12.76C10.37 13.31 10.64 13.79 11.1 14.1C11.48 14.37 11.98 14.5 12.49 14.48C13.17 14.44 13.7 14.18 14.07 13.71C14.35 13.35 14.52 12.89 14.58 12.31C14.92 12.52 15.17 12.81 15.31 13.17C15.54 13.76 15.56 14.91 14.62 15.85C13.8 16.67 12.83 17.02 11.52 17.03C10.06 17.02 8.96 16.56 8.27 15.68C7.63 14.86 7.3 13.69 7.28 12.2C7.3 10.71 7.63 9.55 8.27 8.72C8.96 7.84 10.06 7.38 11.52 7.37C13 7.38 14.12 7.85 14.83 8.74C15.17 9.17 15.43 9.71 15.6 10.35L16.64 10.06C16.43 9.26 16.1 8.58 15.64 8.01C14.76 6.9 13.37 6.33 11.53 6.32H11.51C9.69 6.33 8.3 6.91 7.41 8.04C6.62 9.05 6.22 10.44 6.2 12.19V12.21C6.22 13.96 6.62 15.36 7.41 16.36C8.3 17.49 9.69 18.07 11.51 18.08H11.53C13.13 18.07 14.34 17.61 15.35 16.6C16.62 15.33 16.59 13.72 16.2 12.73C15.93 12.05 15.4 11.5 14.68 11.13H15.3ZM12.43 13.43C11.88 13.46 11.39 13.22 11.37 12.82C11.35 12.51 11.58 12.15 12.56 12.07C12.72 12.06 12.87 12.05 13.02 12.05C13.37 12.05 13.7 12.09 14 12.16C13.89 13.23 13.22 13.39 12.43 13.43Z"
        fill="white"
      />
    </svg>
  );
}

export function SnapchatIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#FFFC00" />
      <path
        d="M12 4C10.08 4 8.74 4.92 8.02 6.42C7.73 7.02 7.6 7.68 7.53 8.4L7.5 9C7.5 9 6.96 8.88 6.58 9.02C6.18 9.17 5.93 9.55 5.96 9.92C6 10.36 6.38 10.66 6.7 10.78C6.8 10.82 7 10.88 7 10.88C7 10.88 6.88 11.56 6.24 12.42C5.77 13.06 5.14 13.5 4.73 13.66C4.4 13.79 4.2 14.1 4.24 14.44C4.3 14.86 4.65 15.1 5 15.18C5.57 15.32 6.11 15.38 6.42 15.78C6.56 15.96 6.58 16.2 6.64 16.42C6.72 16.72 6.97 16.92 7.28 16.95C7.69 16.99 8.18 16.78 8.89 16.86C9.48 16.93 10.07 17.38 12 17.38C13.93 17.38 14.52 16.93 15.11 16.86C15.82 16.78 16.31 16.99 16.72 16.95C17.03 16.92 17.28 16.72 17.36 16.42C17.42 16.2 17.44 15.96 17.58 15.78C17.89 15.38 18.43 15.32 19 15.18C19.35 15.1 19.7 14.86 19.76 14.44C19.8 14.1 19.6 13.79 19.27 13.66C18.86 13.5 18.23 13.06 17.76 12.42C17.12 11.56 17 10.88 17 10.88C17 10.88 17.2 10.82 17.3 10.78C17.62 10.66 18 10.36 18.04 9.92C18.07 9.55 17.82 9.17 17.42 9.02C17.04 8.88 16.5 9 16.5 9L16.47 8.4C16.4 7.68 16.27 7.02 15.98 6.42C15.26 4.92 13.92 4 12 4Z"
        fill="#333"
      />
    </svg>
  );
}

export function TelegramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0088cc" />
      <path
        d="M5.5 11.5L17.5 6.5C17.5 6.5 18.5 6 18.5 7L16.5 17C16.5 17 16.35 17.65 15.65 17.35L11 14L9 16C9 16 8.8 16.15 8.65 15.85L9.2 12.4L16.5 7.5C16.5 7.5 16.15 7.35 15.85 7.5L7.5 11.65L4.5 10.65C4.5 10.65 4 10.45 4 9.95C4 9.45 4.5 9.25 4.5 9.25L5.5 11.5Z"
        fill="white"
      />
      <path
        d="M5 11.2L7.8 12.2L16 7.6L9.5 13L9.2 16L8.7 15.7L9.1 12.5L5 11.2Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  );
}

export function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="white"
      />
      <path
        d="M12 3C7.038 3 3 7.038 3 12c0 1.59.413 3.09 1.14 4.393L3 21l4.759-1.12A8.944 8.944 0 0012 21c4.962 0 9-4.038 9-9s-4.038-9-9-9zm0 16.5c-1.436 0-2.795-.39-3.962-1.076l-.284-.169-2.942.693.725-2.855-.186-.296A7.432 7.432 0 014.5 12c0-4.136 3.364-7.5 7.5-7.5S19.5 7.864 19.5 12s-3.364 7.5-7.5 7.5z"
        fill="white"
        fillOpacity="0.15"
      />
    </svg>
  );
}

export function getPlatformIcon(id: PlatformType, size = 24) {
  switch (id) {
    case "facebook":
      return <FacebookIcon size={size} />;
    case "instagram":
      return <InstagramIcon size={size} />;
    case "twitter":
      return <TwitterIcon size={size} />;
    case "linkedin":
      return <LinkedInIcon size={size} />;
    case "tiktok":
      return <TikTokIcon size={size} />;
    case "youtube":
      return <YouTubeIcon size={size} />;
    case "pinterest":
      return <PinterestIcon size={size} />;
    case "google_business":
      return <GoogleBusinessIcon size={size} />;
    case "threads":
      return <ThreadsIcon size={size} />;
    case "snapchat":
      return <SnapchatIcon size={size} />;
    case "telegram":
      return <TelegramIcon size={size} />;
    case "whatsapp":
      return <WhatsAppIcon size={size} />;
    default:
      return null;
  }
}
