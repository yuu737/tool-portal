export type Tool = {
  id: string;
  href: string;
  icon: string; // Lucide React icon name
};

export const tools: Tool[] = [
  { id: "word-count",         href: "/tools/word-count",         icon: "FileText" },
  { id: "password-generator", href: "/tools/password-generator", icon: "KeyRound" },
  { id: "qr-code",            href: "/tools/qr-code",            icon: "QrCode" },
  { id: "images-to-pdf",      href: "/tools/images-to-pdf",      icon: "Images" },
  { id: "json-formatter",     href: "/tools/json-formatter",     icon: "Braces" },
  { id: "unit-converter",     href: "/tools/unit-converter",     icon: "ArrowLeftRight" },
  { id: "base64",             href: "/tools/base64",             icon: "Binary" },
];
