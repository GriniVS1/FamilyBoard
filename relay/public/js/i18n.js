import { loadLocale, saveLocale } from "./api.js";

export const LOCALES = ["de", "en", "fr", "it"];

const dict = {
  en: {
    appTitle: "FamilyBoard",
    logout: "Log out",
    nav: { todos: "Todos", notes: "Notes", calendar: "Calendar" },
    pair: {
      title: "Pair this device",
      subtitle: "Enter the installation ID and code shown on your FamilyBoard.",
      installationId: "Installation ID",
      code: "Code",
      submit: "Pair",
      pairing: "Pairing…",
      autoPairing: "Pairing your device…",
      invalid: "Invalid or expired code. Please check and try again.",
      genericError: "Could not pair. Please try again.",
      missingFields: "Please fill in both fields.",
    },
    todos: {
      addPlaceholder: "Add a to-do…",
      add: "Add",
      open: "Open",
      done: "Done",
      empty: "No to-dos yet.",
      deleteConfirmTitle: "Delete this to-do?",
      deleteConfirmBody: "This cannot be undone.",
      due: "Due {date}",
      loadError: "Could not load to-dos.",
    },
    notes: {
      title: "Notes",
      add: "Add note",
      empty: "No notes yet.",
      edit: "Edit note",
      newNote: "New note",
      bodyLabel: "Note",
      bodyPlaceholder: "Write something…",
      colorLabel: "Color",
      pinned: "Pin this note",
      save: "Save",
      delete: "Delete",
      deleteConfirmTitle: "Delete this note?",
      deleteConfirmBody: "This cannot be undone.",
      noAuthor: "Unknown",
      loadError: "Could not load notes.",
      saveError: "Could not save note.",
      deleteError: "Could not delete note.",
    },
    calendar: {
      title: "Calendar",
      empty: "No events in this range.",
      allDay: "All day",
      loadMore: "Load more",
      loadError: "Could not load events.",
      maxRange: "Showing the maximum range (180 days).",
    },
    common: {
      cancel: "Cancel",
      confirm: "Delete",
      close: "Close",
      retry: "Retry",
      loading: "Loading…",
    },
  },
  de: {
    appTitle: "FamilyBoard",
    logout: "Abmelden",
    nav: { todos: "Aufgaben", notes: "Notizen", calendar: "Kalender" },
    pair: {
      title: "Gerät koppeln",
      subtitle: "Gib die Installations-ID und den Code von deinem FamilyBoard ein.",
      installationId: "Installations-ID",
      code: "Code",
      submit: "Koppeln",
      pairing: "Wird gekoppelt…",
      autoPairing: "Gerät wird gekoppelt…",
      invalid: "Ungültiger oder abgelaufener Code. Bitte prüfen und erneut versuchen.",
      genericError: "Koppeln fehlgeschlagen. Bitte erneut versuchen.",
      missingFields: "Bitte beide Felder ausfüllen.",
    },
    todos: {
      addPlaceholder: "Aufgabe hinzufügen…",
      add: "Hinzufügen",
      open: "Offen",
      done: "Erledigt",
      empty: "Noch keine Aufgaben.",
      deleteConfirmTitle: "Diese Aufgabe löschen?",
      deleteConfirmBody: "Das kann nicht widerrufen werden.",
      due: "Fällig {date}",
      loadError: "Aufgaben konnten nicht geladen werden.",
    },
    notes: {
      title: "Notizen",
      add: "Notiz hinzufügen",
      empty: "Noch keine Notizen.",
      edit: "Notiz bearbeiten",
      newNote: "Neue Notiz",
      bodyLabel: "Notiz",
      bodyPlaceholder: "Schreib etwas…",
      colorLabel: "Farbe",
      pinned: "Notiz anpinnen",
      save: "Speichern",
      delete: "Löschen",
      deleteConfirmTitle: "Diese Notiz löschen?",
      deleteConfirmBody: "Das kann nicht widerrufen werden.",
      noAuthor: "Unbekannt",
      loadError: "Notizen konnten nicht geladen werden.",
      saveError: "Notiz konnte nicht gespeichert werden.",
      deleteError: "Notiz konnte nicht gelöscht werden.",
    },
    calendar: {
      title: "Kalender",
      empty: "Keine Termine in diesem Zeitraum.",
      allDay: "Ganztägig",
      loadMore: "Mehr laden",
      loadError: "Termine konnten nicht geladen werden.",
      maxRange: "Maximaler Zeitraum erreicht (180 Tage).",
    },
    common: {
      cancel: "Abbrechen",
      confirm: "Löschen",
      close: "Schliessen",
      retry: "Erneut versuchen",
      loading: "Lädt…",
    },
  },
  fr: {
    appTitle: "FamilyBoard",
    logout: "Se déconnecter",
    nav: { todos: "Tâches", notes: "Notes", calendar: "Calendrier" },
    pair: {
      title: "Associer cet appareil",
      subtitle: "Saisis l'ID d'installation et le code affichés sur ton FamilyBoard.",
      installationId: "ID d'installation",
      code: "Code",
      submit: "Associer",
      pairing: "Association…",
      autoPairing: "Association de l'appareil…",
      invalid: "Code invalide ou expiré. Vérifie et réessaie.",
      genericError: "Impossible d'associer l'appareil. Réessaie.",
      missingFields: "Merci de remplir les deux champs.",
    },
    todos: {
      addPlaceholder: "Ajouter une tâche…",
      add: "Ajouter",
      open: "À faire",
      done: "Terminées",
      empty: "Aucune tâche pour le moment.",
      deleteConfirmTitle: "Supprimer cette tâche ?",
      deleteConfirmBody: "Cette action est irréversible.",
      due: "Échéance {date}",
      loadError: "Impossible de charger les tâches.",
    },
    notes: {
      title: "Notes",
      add: "Ajouter une note",
      empty: "Aucune note pour le moment.",
      edit: "Modifier la note",
      newNote: "Nouvelle note",
      bodyLabel: "Note",
      bodyPlaceholder: "Écris quelque chose…",
      colorLabel: "Couleur",
      pinned: "Épingler cette note",
      save: "Enregistrer",
      delete: "Supprimer",
      deleteConfirmTitle: "Supprimer cette note ?",
      deleteConfirmBody: "Cette action est irréversible.",
      noAuthor: "Inconnu",
      loadError: "Impossible de charger les notes.",
      saveError: "Impossible d'enregistrer la note.",
      deleteError: "Impossible de supprimer la note.",
    },
    calendar: {
      title: "Calendrier",
      empty: "Aucun événement sur cette période.",
      allDay: "Toute la journée",
      loadMore: "Charger plus",
      loadError: "Impossible de charger les événements.",
      maxRange: "Période maximale atteinte (180 jours).",
    },
    common: {
      cancel: "Annuler",
      confirm: "Supprimer",
      close: "Fermer",
      retry: "Réessayer",
      loading: "Chargement…",
    },
  },
  it: {
    appTitle: "FamilyBoard",
    logout: "Esci",
    nav: { todos: "Attività", notes: "Note", calendar: "Calendario" },
    pair: {
      title: "Associa questo dispositivo",
      subtitle: "Inserisci l'ID installazione e il codice mostrati sul tuo FamilyBoard.",
      installationId: "ID installazione",
      code: "Codice",
      submit: "Associa",
      pairing: "Associazione…",
      autoPairing: "Associazione del dispositivo…",
      invalid: "Codice non valido o scaduto. Controlla e riprova.",
      genericError: "Impossibile associare il dispositivo. Riprova.",
      missingFields: "Compila entrambi i campi.",
    },
    todos: {
      addPlaceholder: "Aggiungi un'attività…",
      add: "Aggiungi",
      open: "Da fare",
      done: "Completate",
      empty: "Ancora nessuna attività.",
      deleteConfirmTitle: "Eliminare questa attività?",
      deleteConfirmBody: "Questa azione non può essere annullata.",
      due: "Scade {date}",
      loadError: "Impossibile caricare le attività.",
    },
    notes: {
      title: "Note",
      add: "Aggiungi nota",
      empty: "Ancora nessuna nota.",
      edit: "Modifica nota",
      newNote: "Nuova nota",
      bodyLabel: "Nota",
      bodyPlaceholder: "Scrivi qualcosa…",
      colorLabel: "Colore",
      pinned: "Fissa questa nota",
      save: "Salva",
      delete: "Elimina",
      deleteConfirmTitle: "Eliminare questa nota?",
      deleteConfirmBody: "Questa azione non può essere annullata.",
      noAuthor: "Sconosciuto",
      loadError: "Impossibile caricare le note.",
      saveError: "Impossibile salvare la nota.",
      deleteError: "Impossibile eliminare la nota.",
    },
    calendar: {
      title: "Calendario",
      empty: "Nessun evento in questo periodo.",
      allDay: "Tutto il giorno",
      loadMore: "Carica altri",
      loadError: "Impossibile caricare gli eventi.",
      maxRange: "Intervallo massimo raggiunto (180 giorni).",
    },
    common: {
      cancel: "Annulla",
      confirm: "Elimina",
      close: "Chiudi",
      retry: "Riprova",
      loading: "Caricamento…",
    },
  },
};

let currentLocale = resolveInitialLocale();

function resolveInitialLocale() {
  const stored = loadLocale();
  if (stored && LOCALES.includes(stored)) return stored;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LOCALES.includes(nav) ? nav : "en";
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (!LOCALES.includes(locale)) return;
  currentLocale = locale;
  saveLocale(locale);
}

function lookup(path, locale) {
  const parts = path.split(".");
  let node = dict[locale];
  for (const p of parts) {
    if (node == null) return undefined;
    node = node[p];
  }
  return node;
}

/**
 * @param {string} key dot-path, e.g. "todos.addPlaceholder"
 * @param {Record<string, string | number>} [params]
 */
export function t(key, params) {
  let value = lookup(key, currentLocale);
  if (value === undefined) value = lookup(key, "en");
  if (value === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

export function dateTimeFormatter(opts) {
  return new Intl.DateTimeFormat(currentLocale, opts);
}
