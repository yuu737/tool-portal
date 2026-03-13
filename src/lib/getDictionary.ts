import "server-only";

export type Locale = "ja" | "en";

export type ToolContent = {
  howTo: { heading: string; steps: string[] };
  features: { heading: string; items: string[] };
  faq: { heading: string; items: Array<{ q: string; a: string }> };
  deepDive: { heading: string; paragraphs: string[] };
  security: { heading: string; paragraphs: string[] };
};

export type ToolMeta = {
  title: string;
  description: string;
  keywords: string[];
};

export type Dictionary = {
  header: {
    home: string;
    tools: string;
  };
  hero: {
    heading: string;
    headingHighlight: string;
    headingSuffix: string;
    description: string;
    cta: string;
  };
  toolsSection: {
    heading: string;
    description: string;
    searchPlaceholder: string;
    noResults: string;
    allCategory: string;
    categories: Record<string, string>;
  };
  toolCard: {
    cta: string;
  };
  about: {
    title: string;
    description: string;
    operatorLabel: string;
    operatorName: string;
    profile: { heading: string; text: string };
    mission: { heading: string; text: string };
    safety: { heading: string; text: string };
    i18n: { heading: string; text: string };
    techStack: { heading: string };
  };
  privacy: {
    title: string;
    description: string;
    lastUpdated: string;
    lastUpdatedDate: string;
    sections: {
      basic: { heading: string; text: string };
      adsense: { heading: string; text: string };
      analytics: { heading: string; text: string };
      personalInfo: { heading: string; text: string };
      cookies: { heading: string; text: string };
      disclaimer: { heading: string; text: string };
      changes: { heading: string; text: string };
    };
  };
  contact: {
    title: string;
    description: string;
    emailLabel: string;
    inquiryTypesHeading: string;
    inquiryTypes: string[];
    note: string;
  };
  wordCount: {
    title: string;
    description: string;
    placeholder: string;
    stats: {
      charsWithSpaces: string;
      charsWithoutSpaces: string;
      words: string;
      lines: string;
    };
    buttons: { clear: string; copyResult: string; copied: string };
    meta: ToolMeta;
    content: ToolContent;
  };
  passwordGenerator: {
    title: string;
    description: string;
    sections: { generator: string; checker: string };
    presets: { label: string; simple: string; standard: string; strong: string };
    options: {
      length: string;
      uppercase: string;
      lowercase: string;
      numbers: string;
      symbols: string;
    };
    buttons: { copy: string; copied: string; regenerate: string };
    checker: {
      label: string;
      placeholder: string;
      strength: {
        label: string;
        veryWeak: string;
        weak: string;
        fair: string;
        strong: string;
        veryStrong: string;
      };
      advice: {
        tooShort: string;
        addLength: string;
        addUppercase: string;
        addLowercase: string;
        addNumbers: string;
        addSymbols: string;
        great: string;
      };
    };
    meta: ToolMeta;
    content: ToolContent;
  };
  qrCode: {
    title: string;
    description: string;
    tabs: { url: string; text: string; wifi: string; scan: string };
    input: {
      url: { label: string; placeholder: string };
      text: { label: string; placeholder: string };
      wifi: {
        ssid: string;
        ssidPlaceholder: string;
        password: string;
        passwordPlaceholder: string;
        security: string;
        securityTypes: { WPA: string; WEP: string; nopass: string };
      };
    };
    scan: {
      cameraLabel: string;
      stopLabel: string;
      orUpload: string;
      imageLabel: string;
      result: string;
      noResult: string;
      error: string;
      empty: string;
      copy: string;
      copied: string;
      openUrl: string;
      clear: string;
      history: string;
    };
    customize: {
      heading: string;
      fgColor: string;
      bgColor: string;
      margin: string;
      errorLevel: string;
      errorLevels: { L: string; M: string; Q: string; H: string };
    };
    preview: {
      heading: string;
      empty: string;
      downloadPNG: string;
      downloadSVG: string;
      downloaded: string;
    };
    meta: ToolMeta;
    content: ToolContent;
  };
  imagesToPdf: {
    title: string;
    description: string;
    dropZone: { heading: string; sub: string };
    buttons: {
      addMore: string;
      generate: string;
      generating: string;
      clear: string;
      remove: string;
    };
    info: { safety: string; dragHint: string };
    errors: { noImages: string };
    meta: ToolMeta;
    content: ToolContent;
  };
  jsonFormatter: {
    title: string;
    description: string;
    inputLabel: string;
    outputLabel: string;
    placeholder: string;
    indent: { label: string; two: string; four: string; tab: string };
    buttons: {
      format: string;
      minify: string;
      copy: string;
      copied: string;
      clear: string;
      sample: string;
    };
    status: { valid: string; invalid: string; empty: string };
    meta: ToolMeta;
    content: ToolContent;
  };
  unitConverter: {
    title: string;
    description: string;
    categories: {
      length: string;
      weight: string;
      temperature: string;
      data: string;
    };
    labels: { from: string; to: string };
    placeholder: string;
    swap: string;
    meta: ToolMeta;
    content: ToolContent;
  };
  base64: {
    title: string;
    description: string;
    tabs: { encode: string; decode: string };
    labels: {
      input: string;
      output: string;
      inputDecode: string;
      outputDecode: string;
    };
    placeholders: { encode: string; decode: string };
    buttons: { copy: string; copied: string; clear: string; swap: string };
    errors: { invalidBase64: string };
    meta: ToolMeta;
    content: ToolContent;
  };
  timerCounter: {
    title: string;
    description: string;
    tabs: { timer: string; stopwatch: string; counter: string; probability: string };
    timer: {
      hours: string;
      minutes: string;
      seconds: string;
      start: string;
      pause: string;
      reset: string;
      complete: string;
    };
    stopwatch: {
      start: string;
      pause: string;
      reset: string;
      lap: string;
      lapLabel: string;
    };
    counter: {
      reset: string;
      goalPlaceholder: string;
      setGoal: string;
      goalReached: string;
      storageNote: string;
    };
    probability: {
      drops: string;
      attempts: string;
      targetRate: string;
      observedRate: string;
      expectedPerDrop: string;
      trialsFor95: string;
      trialsFor99: string;
      noData: string;
      addDrop: string;
      addAttempt: string;
      dropsPlaceholder: string;
      attemptsPlaceholder: string;
      targetPlaceholder: string;
      reset: string;
      storageNote: string;
      trialsSuffix: string;
      timesLabel: string;
      hint: string;
      calcTrials: string;
      calcRate: string;
      pAtLeastOne: string;
      distribution: string;
      distributionDrops: string;
      distributionProb: string;
      atLeastN: string;
      tracking: string;
      trackingDesc: string;
    };
    settings: {
      heading: string;
      description: string;
      show: string;
      timer: string;
      stopwatch: string;
      counter: string;
      probability: string;
    };
    pip: {
      title: string;
      description: string;
      unsupported: string;
      open: string;
      close: string;
      miniMode: string;
    };
    meta: ToolMeta;
    content: ToolContent;
  };
  grindingCompanion: {
    title: string;
    description: string;
    modules: {
      heading: string;
      counter: string;
      dropCalc: string;
      pip: string;
      emptyHint: string;
    };
    counter: {
      title: string;
      cycles: string;
      goalPlaceholder: string;
      setGoal: string;
      goalReached: string;
      startCycle: string;
      pauseCycle: string;
      finishCycle: string;
      resetSession: string;
      currentTime: string;
      avgTime: string;
      bestTime: string;
      lapHistory: string;
    };
    dropCalc: {
      title: string;
      drops: string;
      attempts: string;
      nominalRate: string;
      observedRate: string;
      expectedDrops: string;
      expectedPerDrop: string;
      luckRatio: string;
      pSuccess: string;
      unlucky: string;
      normal: string;
      lucky: string;
      dryStreak: string;
      dryStreakNote: string;
      hint: string;
      dropsPlaceholder: string;
      attemptsPlaceholder: string;
      nominalPlaceholder: string;
    };
    pip: {
      title: string;
      description: string;
      unsupported: string;
      open: string;
      close: string;
      miniMode: string;
    };
    meta: ToolMeta;
    content: ToolContent;
  };
  footer: {
    home: string;
    about: string;
    privacy: string;
    contact: string;
  };
  tools: {
    [id: string]: {
      name: string;
      description: string;
    };
  };
};

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ja: () =>
    import("@/dictionaries/ja.json").then((m) => m.default as unknown as Dictionary),
  en: () =>
    import("@/dictionaries/en.json").then((m) => m.default as unknown as Dictionary),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
