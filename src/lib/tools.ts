export type Tool = {
  id: string;
  href: string;
  icon: string;
};

export const tools: Tool[] = [
  { id: "word-count",        href: "/tools/word-count",        icon: "📝" },
  { id: "password-generator",href: "/tools/password-generator",icon: "🔐" },
  { id: "qr-code",           href: "/tools/qr-code",           icon: "📱" },
  { id: "images-to-pdf",     href: "/tools/images-to-pdf",     icon: "🖼️" },
  { id: "json-formatter",    href: "/tools/json-formatter",    icon: "📋" },
  { id: "unit-converter",    href: "/tools/unit-converter",    icon: "📐" },
  { id: "base64",            href: "/tools/base64",            icon: "🔤" },
];
