import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";

// Labels the chat panel itself draws. What the site owner wrote (header, welcome
// message, starter questions, button label) is shown as written, except for the
// untouched defaults, which follow the visitor's language.

export const LANGS = ["en", "es", "fr", "de", "hi"] as const;
export type Lang = (typeof LANGS)[number];

export interface Strings {
  loading: string;
  unavailable: string;
  tryLater: string;
  conversation: string;
  newChat: string;
  close: string;
  talkToPerson: string;
  helpful: string;
  notHelpful: string;
  leaveEmail: string;
  handoffHint: string;
  leaveEmailHint: string;
  emailPlaceholder: string;
  namePlaceholder: string;
  phonePlaceholder: string;
  submitDetails: string;
  sending: string;
  dismissForm: string;
  thanks: string;
  errorGeneric: string;
  errorNetwork: string;
  errorLeadSave: string;
  errorLeadNetwork: string;
  typing: string;
  yourMessage: string;
  placeholder: string;
  send: string;
  storedBy: string;
  privacy: string;
  poweredBy: string;
  defaultHeader: string;
  defaultWelcome: string;
  defaultStarters: [string, string, string];
}

const en: Strings = {
  loading: "Loading chat",
  unavailable: "Chat is unavailable",
  tryLater: "Please try again later.",
  conversation: "Conversation",
  newChat: "New chat",
  close: "Close chat",
  talkToPerson: "Talk to a person",
  helpful: "This answer helped",
  notHelpful: "This answer did not help",
  leaveEmail: "Leave your email",
  handoffHint: "Leave your details and we'll send your question and transcript to the site owner.",
  leaveEmailHint: "Leave your email and someone from the team will follow up directly.",
  emailPlaceholder: "your@email.com (required)",
  namePlaceholder: "Name (optional)",
  phonePlaceholder: "Phone (optional)",
  submitDetails: "Submit details",
  sending: "Sending...",
  dismissForm: "Dismiss contact form",
  thanks: "Thank you! We've received your contact info and our team will follow up soon.",
  errorGeneric: "Something went wrong. Please try again.",
  errorNetwork: "Could not reach the server. Check your connection and try again.",
  errorLeadSave: "Could not save your contact info. Please try again.",
  errorLeadNetwork: "Network error. Please try again.",
  typing: "Typing",
  yourMessage: "Your message",
  placeholder: "Type your message",
  send: "Send",
  storedBy: "Chats are stored by the site owner.",
  privacy: "Privacy",
  poweredBy: "Powered by",
  defaultHeader: DEFAULT_WIDGET_CONFIG.headerText,
  defaultWelcome: DEFAULT_WIDGET_CONFIG.welcomeMessage,
  defaultStarters: DEFAULT_WIDGET_CONFIG.starterQuestions.slice(0, 3) as [string, string, string],
};

const es: Strings = {
  loading: "Cargando el chat",
  unavailable: "El chat no está disponible",
  tryLater: "Inténtalo de nuevo más tarde.",
  conversation: "Conversación",
  newChat: "Nuevo chat",
  close: "Cerrar el chat",
  talkToPerson: "Hablar con una persona",
  helpful: "Esta respuesta me ayudó",
  notHelpful: "Esta respuesta no me ayudó",
  leaveEmail: "Deja tu correo",
  handoffHint: "Deja tus datos y enviaremos tu pregunta y la conversación al propietario del sitio.",
  leaveEmailHint: "Deja tu correo y alguien del equipo te responderá directamente.",
  emailPlaceholder: "tu@correo.com (obligatorio)",
  namePlaceholder: "Nombre (opcional)",
  phonePlaceholder: "Teléfono (opcional)",
  submitDetails: "Enviar datos",
  sending: "Enviando...",
  dismissForm: "Cerrar el formulario de contacto",
  thanks: "¡Gracias! Hemos recibido tus datos y nuestro equipo te contactará pronto.",
  errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
  errorNetwork: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  errorLeadSave: "No se pudieron guardar tus datos. Inténtalo de nuevo.",
  errorLeadNetwork: "Error de red. Inténtalo de nuevo.",
  typing: "Escribiendo",
  yourMessage: "Tu mensaje",
  placeholder: "Escribe tu mensaje",
  send: "Enviar",
  storedBy: "El propietario del sitio guarda los chats.",
  privacy: "Privacidad",
  poweredBy: "Con tecnología de",
  defaultHeader: "¿Cómo podemos ayudarte?",
  defaultWelcome: "Haz una pregunta y te responderemos aquí mismo.",
  defaultStarters: ["¿Qué servicios ofrecen?", "¿Cómo empiezo?", "¿Cómo puedo contactarlos?"],
};

const fr: Strings = {
  loading: "Chargement du chat",
  unavailable: "Le chat est indisponible",
  tryLater: "Veuillez réessayer plus tard.",
  conversation: "Conversation",
  newChat: "Nouveau chat",
  close: "Fermer le chat",
  talkToPerson: "Parler à une personne",
  helpful: "Cette réponse m'a aidé",
  notHelpful: "Cette réponse ne m'a pas aidé",
  leaveEmail: "Laissez votre e-mail",
  handoffHint: "Laissez vos coordonnées et nous enverrons votre question et la conversation au propriétaire du site.",
  leaveEmailHint: "Laissez votre e-mail et quelqu'un de l'équipe vous répondra directement.",
  emailPlaceholder: "votre@email.com (obligatoire)",
  namePlaceholder: "Nom (facultatif)",
  phonePlaceholder: "Téléphone (facultatif)",
  submitDetails: "Envoyer",
  sending: "Envoi...",
  dismissForm: "Fermer le formulaire de contact",
  thanks: "Merci ! Nous avons bien reçu vos coordonnées et notre équipe vous répondra bientôt.",
  errorGeneric: "Une erreur s'est produite. Veuillez réessayer.",
  errorNetwork: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
  errorLeadSave: "Impossible d'enregistrer vos coordonnées. Veuillez réessayer.",
  errorLeadNetwork: "Erreur réseau. Veuillez réessayer.",
  typing: "En train d'écrire",
  yourMessage: "Votre message",
  placeholder: "Écrivez votre message",
  send: "Envoyer",
  storedBy: "Les chats sont conservés par le propriétaire du site.",
  privacy: "Confidentialité",
  poweredBy: "Propulsé par",
  defaultHeader: "Comment pouvons-nous vous aider ?",
  defaultWelcome: "Posez une question et nous vous répondrons ici même.",
  defaultStarters: ["Quels services proposez-vous ?", "Comment démarrer ?", "Comment vous contacter ?"],
};

const de: Strings = {
  loading: "Chat wird geladen",
  unavailable: "Der Chat ist nicht verfügbar",
  tryLater: "Bitte versuchen Sie es später erneut.",
  conversation: "Unterhaltung",
  newChat: "Neuer Chat",
  close: "Chat schließen",
  talkToPerson: "Mit einer Person sprechen",
  helpful: "Diese Antwort hat geholfen",
  notHelpful: "Diese Antwort hat nicht geholfen",
  leaveEmail: "E-Mail hinterlassen",
  handoffHint: "Hinterlassen Sie Ihre Daten, dann senden wir Ihre Frage und den Chatverlauf an den Betreiber der Website.",
  leaveEmailHint: "Hinterlassen Sie Ihre E-Mail-Adresse, dann meldet sich jemand aus dem Team direkt bei Ihnen.",
  emailPlaceholder: "ihre@email.de (erforderlich)",
  namePlaceholder: "Name (optional)",
  phonePlaceholder: "Telefon (optional)",
  submitDetails: "Absenden",
  sending: "Wird gesendet...",
  dismissForm: "Kontaktformular schließen",
  thanks: "Danke! Wir haben Ihre Daten erhalten und melden uns in Kürze.",
  errorGeneric: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  errorNetwork: "Der Server ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  errorLeadSave: "Ihre Daten konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  errorLeadNetwork: "Netzwerkfehler. Bitte versuchen Sie es erneut.",
  typing: "Schreibt",
  yourMessage: "Ihre Nachricht",
  placeholder: "Nachricht eingeben",
  send: "Senden",
  storedBy: "Chats werden vom Betreiber der Website gespeichert.",
  privacy: "Datenschutz",
  poweredBy: "Bereitgestellt von",
  defaultHeader: "Wie können wir helfen?",
  defaultWelcome: "Stellen Sie eine Frage, wir antworten gleich hier.",
  defaultStarters: ["Welche Leistungen bieten Sie an?", "Wie fange ich an?", "Wie kann ich Sie erreichen?"],
};

const hi: Strings = {
  loading: "चैट लोड हो रही है",
  unavailable: "चैट उपलब्ध नहीं है",
  tryLater: "कृपया बाद में पुनः प्रयास करें।",
  conversation: "बातचीत",
  newChat: "नई चैट",
  close: "चैट बंद करें",
  talkToPerson: "किसी व्यक्ति से बात करें",
  helpful: "इस जवाब से मदद मिली",
  notHelpful: "इस जवाब से मदद नहीं मिली",
  leaveEmail: "अपना ईमेल दें",
  handoffHint: "अपनी जानकारी दें, हम आपका सवाल और बातचीत साइट के मालिक को भेज देंगे।",
  leaveEmailHint: "अपना ईमेल दें, टीम का कोई सदस्य सीधे आपसे संपर्क करेगा।",
  emailPlaceholder: "आपका@ईमेल.com (ज़रूरी)",
  namePlaceholder: "नाम (वैकल्पिक)",
  phonePlaceholder: "फ़ोन (वैकल्पिक)",
  submitDetails: "जानकारी भेजें",
  sending: "भेजा जा रहा है...",
  dismissForm: "संपर्क फ़ॉर्म बंद करें",
  thanks: "धन्यवाद! हमें आपकी जानकारी मिल गई है, हमारी टीम जल्द ही संपर्क करेगी।",
  errorGeneric: "कुछ गड़बड़ हो गई। कृपया पुनः प्रयास करें।",
  errorNetwork: "सर्वर से संपर्क नहीं हो सका। अपना कनेक्शन जाँचें और पुनः प्रयास करें।",
  errorLeadSave: "आपकी जानकारी सहेजी नहीं जा सकी। कृपया पुनः प्रयास करें।",
  errorLeadNetwork: "नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।",
  typing: "लिख रहा है",
  yourMessage: "आपका संदेश",
  placeholder: "अपना संदेश लिखें",
  send: "भेजें",
  storedBy: "चैट साइट के मालिक के पास सहेजी जाती हैं।",
  privacy: "गोपनीयता",
  poweredBy: "संचालित:",
  defaultHeader: "हम कैसे मदद कर सकते हैं?",
  defaultWelcome: "कोई सवाल पूछें, हम यहीं जवाब देंगे।",
  defaultStarters: ["आप कौन-सी सेवाएँ देते हैं?", "मैं शुरुआत कैसे करूँ?", "मैं आपसे कैसे संपर्क करूँ?"],
};

const STRINGS: Record<Lang, Strings> = { en, es, fr, de, hi };

// "es-MX" and "ES" both give "es"; anything unsupported or unreadable gives English.
export function resolveLang(input: string | null | undefined): Lang {
  const primary = (input ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return (LANGS as readonly string[]).includes(primary) ? (primary as Lang) : "en";
}

export function getStrings(lang: Lang): Strings {
  return STRINGS[lang];
}

// Only the untouched English defaults are translated; an owner's own words never are.
export function localizeConfigText(
  config: { headerText: string; welcomeMessage: string; starterQuestions: string[] },
  t: Strings,
) {
  const sameStarters =
    config.starterQuestions.length === DEFAULT_WIDGET_CONFIG.starterQuestions.length &&
    config.starterQuestions.every((q, i) => q === DEFAULT_WIDGET_CONFIG.starterQuestions[i]);
  return {
    headerText: config.headerText === DEFAULT_WIDGET_CONFIG.headerText ? t.defaultHeader : config.headerText,
    welcomeMessage:
      config.welcomeMessage === DEFAULT_WIDGET_CONFIG.welcomeMessage ? t.defaultWelcome : config.welcomeMessage,
    starterQuestions: sameStarters ? [...t.defaultStarters] : config.starterQuestions,
  };
}
