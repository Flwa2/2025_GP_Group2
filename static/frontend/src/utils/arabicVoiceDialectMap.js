const getVoiceId = (voice) =>
  String(voice?.providerVoiceId || voice?.voiceId || voice?.voice_id || voice?.id || voice?.docId || "").trim();

const CURATED_ARABIC_DIALECT_BY_VOICE_ID = {
  "2bnoa3wtrtcUW41TrSJM": "arabic-saudi",
  "3nav5pHC1EYvWOd5LmnA": "arabic-saudi",
  "5REPlS2Ja1VZ7zNA0ykn": "arabic-egyptian",
  "7DwruJn2XVUNMherEcad": "arabic-levantine",
  "8KMBeKnOSHXjLqGuWsAE": "arabic-saudi",
  "E4GutuQ39akNBbiYuhh2": "arabic-saudi",
  "H48IdiQwyf50CXpP0dy0": "arabic-saudi",
  "HRaipzPqzrU15BUS5ypU": "arabic-levantine",
  "IK7YYZcSpmlkjKrQxbSn": "arabic-saudi",
  "JbTItPM48g6ErYIsuhRs": "arabic-standard",
  "JoySr0ZYKEotnyhsN3Fi": "arabic-standard",
  "LCDnCIYLTaVg7otERNkl": "arabic-saudi",
  "MI88rOZjXbH22N8KHXUo": "arabic-saudi",
  "MLELiE1ybdYoTtlmFf5r": "arabic-egyptian",
  "NMWQDQipWXm8HlCLKapi": "arabic-moroccan",
  "QvNF0qyyt1Tuy1YAmnzH": "arabic-egyptian",
  "QsV9PCczMIklRM6xLPAS": "arabic-saudi",
  "RjFuvnufLX42TYe37ekK": "arabic-saudi",
  "TfevL8tqOhb9PBTrfU9u": "arabic-gulf",
  "UgBBYS2sOqTuMpoF3BR0": "arabic-standard",
  "Wim44P0dU9HtjyzNnFsv": "arabic-levantine",
  "gKeccbJ6jkUi4aYA91nS": "arabic-moroccan",
  "hYqZq4J77gUOQZK4uSvg": "arabic-egyptian",
  "oOucsh1OZElozgDVjcfe": "arabic-levantine",
  "pO3ZuaXj0mFWxTrn1tPt": "arabic-standard",
  "tUXHogBOJVTxEBz7fSle": "arabic-levantine",
  "ulJ49j1YlxrYnPoj5o12": "arabic-gulf",
  "usjDi9nBY6UHvtKrL4ba": "arabic-saudi",
  "v7UCHHCrHj1KBa4E41gb": "arabic-saudi",
  "wP7SrmVwSNoN8P6v8OTO": "arabic-levantine",
  "yXEnnEln9armDCyhkXcA": "arabic-saudi",
  "zAHOVUiYXuxggpSljiCQ": "arabic-levantine",
};

export const curatedArabicDialectTokenForVoice = (voice) =>
  CURATED_ARABIC_DIALECT_BY_VOICE_ID[getVoiceId(voice)] || "";

