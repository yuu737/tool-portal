export const CATEGORIES = [
  "GAMING_STATS",
  "TEXT_PROCESS",
  "DEV_SYSTEM",
  "LIFE_UTILITY",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Tool = {
  id: string;
  href: string;
  icon: string; // Lucide React icon name
  category: Category;
  tags: string[];
};

export const tools: Tool[] = [
  {
    id: "word-count",
    href: "/tools/word-count",
    icon: "FileText",
    category: "TEXT_PROCESS",
    tags: ["Text", "Writing", "Counter"],
  },
  {
    id: "password-generator",
    href: "/tools/password-generator",
    icon: "KeyRound",
    category: "DEV_SYSTEM",
    tags: ["Security", "Privacy", "Generator"],
  },
  {
    id: "qr-code",
    href: "/tools/qr-code",
    icon: "QrCode",
    category: "LIFE_UTILITY",
    tags: ["QR", "Generator", "Scanner"],
  },
  {
    id: "images-to-pdf",
    href: "/tools/images-to-pdf",
    icon: "Images",
    category: "TEXT_PROCESS",
    tags: ["PDF", "Image", "Converter"],
  },
  {
    id: "json-formatter",
    href: "/tools/json-formatter",
    icon: "Braces",
    category: "DEV_SYSTEM",
    tags: ["JSON", "Formatter", "Developer"],
  },
  {
    id: "unit-converter",
    href: "/tools/unit-converter",
    icon: "ArrowLeftRight",
    category: "LIFE_UTILITY",
    tags: ["Converter", "Math", "Units"],
  },
  {
    id: "base64",
    href: "/tools/base64",
    icon: "Binary",
    category: "DEV_SYSTEM",
    tags: ["Encoder", "Decoder", "Developer"],
  },
  {
    id: "timer-counter",
    href: "/tools/timer-counter",
    icon: "Timer",
    category: "LIFE_UTILITY",
    tags: ["Timer", "Stopwatch", "Counter", "Pomodoro"],
  },
  {
    id: "grinding-companion",
    href: "/tools/grinding-companion",
    icon: "Target",
    category: "GAMING_STATS",
    tags: ["Gaming", "Probability", "Counter", "Timer"],
  },
];
