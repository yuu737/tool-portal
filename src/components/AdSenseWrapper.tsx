type Props = {
  slot?: string;
  className?: string;
};

export default function AdSenseWrapper({ slot = "default", className = "" }: Props) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 ${className}`}
      data-ad-slot={slot}
    >
      <span>広告枠（AdSense: {slot}）</span>
    </div>
  );
}
