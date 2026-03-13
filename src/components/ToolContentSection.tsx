import type { ToolContent } from "@/lib/getDictionary";

type Props = {
  content: ToolContent;
};

export default function ToolContentSection({ content }: Props) {
  return (
    <div className="space-y-10 border-t border-gray-100 pt-10">
      {/* How to use */}
      <section aria-labelledby="how-to-heading">
        <h2
          id="how-to-heading"
          className="mb-5 text-lg font-bold text-gray-900 sm:text-xl"
        >
          {content.howTo.heading}
        </h2>
        <ol className="space-y-3">
          {content.howTo.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading">
        <h2
          id="features-heading"
          className="mb-5 text-lg font-bold text-gray-900 sm:text-xl"
        >
          {content.features.heading}
        </h2>
        <ul className="space-y-2">
          {content.features.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm leading-relaxed text-gray-600 sm:text-base"
            >
              <span className="mt-0.5 shrink-0 text-blue-500">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading">
        <h2
          id="faq-heading"
          className="mb-5 text-lg font-bold text-gray-900 sm:text-xl"
        >
          {content.faq.heading}
        </h2>
        <div className="space-y-4">
          {content.faq.items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-gray-800 sm:text-base">
                Q. {item.q}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                A. {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Deep Dive */}
      <section aria-labelledby="deep-dive-heading">
        <h2
          id="deep-dive-heading"
          className="mb-5 text-lg font-bold text-gray-900 sm:text-xl"
        >
          {content.deepDive.heading}
        </h2>
        <div className="space-y-4 rounded-xl border border-blue-50 bg-blue-50/40 p-5">
          {content.deepDive.paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-gray-700 sm:text-base"
            >
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Security & Privacy */}
      <section aria-labelledby="security-heading">
        <h2
          id="security-heading"
          className="mb-5 text-lg font-bold text-gray-900 sm:text-xl"
        >
          {content.security.heading}
        </h2>
        <div className="space-y-4 rounded-xl border border-green-100 bg-green-50/40 p-5">
          {content.security.paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-gray-700 sm:text-base"
            >
              {para}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
