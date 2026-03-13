type Props = {
  slot?: string;
  className?: string;
};

// NEXT_PUBLIC_ADSENSE_ENABLED=true に設定すると広告枠が表示されます。
// 審査中は未設定（または false）のままにしておくと広告枠は完全に非表示になります。
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";

export default function AdSenseWrapper({ slot = "default", className = "" }: Props) {
  if (!ADSENSE_ENABLED) return null;

  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 ${className}`}
      data-ad-slot={slot}
    >
      <span>広告枠（AdSense: {slot}）</span>
    </div>
  );
}
