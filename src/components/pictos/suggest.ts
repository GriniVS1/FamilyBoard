import { PICTO_META, type PictoCategory, type PictoName } from "./registry";

/*
 * Keyword → motif for chore / event / to-do titles (de, de-CH, en, fr, it).
 * Keywords are pre-normalised (lower-case ASCII, umlauts folded: ä→a, ß→ss).
 *
 * Matching rule, chosen so German compounds work without false positives:
 *   "=wort"      exact word only           ("=bad" hits "Bad", not "Badminton")
 *   ≤ 4 letters  must start a word         ("zahn" hits "Zahnbürste")
 *   ≥ 5 letters  anywhere, incl. mid-word  ("geburtstag" hits "Kindergeburtstag")
 *   "~wort"      weak: only wins if nothing specific matched
 *                ("Katze füttern" → cat, not the generic "füttern" → dog)
 * The LONGEST matching keyword wins ("Zahnarzt" → doctor, not teeth); on a
 * tie the one that appears first in the title wins.
 */
const KEYWORDS: Array<[PictoName, string[]]> = [
  ["water", [
    "wasser trinken", "trink", "=wasser", "wasserglas",
    "drink", "water", "=eau", "boire", "verre d eau", "bere", "acqua",
    "trinke", "wasserli",
  ]],
  ["teeth", [
    "zahn", "zahne", "zaehne", "zahneputzen", "zahnbursten",
    "teeth", "tooth", "brush teeth", "dents", "brosser les dents", "denti", "lavare i denti",
    "zahnli",
  ]],
  ["tidy-toys", [
    "spielzeug", "spielsachen", "aufraum", "legos", "=lego", "bauklotz",
    "toys", "tidy up", "clean up", "pick up",
    "ranger", "jouets", "giocattoli", "riordin", "mettere in ordine",
    "ufruume", "ufrume", "gspielzug", "spielzug",
  ]],
  ["pajamas", [
    "pyjama anzieh", "pijama anzieh", "schlafanzug", "pyjama alegge", "pyjama aalegge",
    "put on pyjamas", "put on pajamas", "mettre son pyjama", "mettre le pyjama", "mettere il pigiama",
  ]],
  ["get-dressed", [
    "anzieh", "anziehen", "kleid", "kleidung", "umzieh", "jacke", "socken anzieh", "handschuh",
    "get dressed", "dress", "clothes", "put on",
    "habill", "vetements", "vestir", "vestiti", "vestire",
    "alegge", "aalegge", "chleider", "aaziehe",
  ]],
  ["make-bed", [
    "bett mach", "bettmach", "bett mache", "=bett", "betten", "bettdecke", "bettli",
    "make bed", "make the bed", "make your bed", "=bed",
    "faire le lit", "faire son lit", "=lit", "letto", "rifare il letto",
  ]],
  ["set-table", [
    "tisch deck", "tischdeck", "tisch decke", "=tisch", "abraum", "tisch abraum",
    "set the table", "set table", "lay the table", "clear the table", "=table",
    "mettre la table", "mettre le couvert", "couvert", "debarrasser",
    "apparecchia", "sparecchia", "tavola",
  ]],
  ["feed-dog", [
    "=hund", "hunde", "hundli", "hundefutter", "gassi",
    "=dog", "dogs", "puppy", "walk the dog", "feed the dog",
    "chien", "promener le chien", "=cane", "cagnolino",
    "~tiere futter", "~tier futter", "~=futter", "~futtern", "~fuettern", "~=futtere",
  ]],
  ["feed-cat", [
    "katze", "katzen", "=busi", "busi futter", "chatz", "=mieze",
    "=cat", "cats", "kitty", "=chat", "minou", "gatto", "gatta", "micio",
    "fisch futter", "fische futter",
  ]],
  ["trash", [
    "mull", "abfall", "kehricht", "ghuder", "grungut", "altpapier", "karton", "recycl",
    "trash", "garbage", "rubbish", "=bin", "bins",
    "poubelle", "ordures", "dechets", "spazzatura", "immondizia", "rifiuti", "pattumiera",
  ]],
  ["water-plants", [
    "pflanz", "blume", "giess", "wassern", "garten",
    "plants", "water the plants", "watering", "garden", "flowers",
    "arroser", "plantes", "fleurs", "jardin", "annaffia", "piante", "fiori", "giardino",
    "giesse", "bluemli", "pflanze",
  ]],
  ["homework", [
    "hausaufgab", "hausi", "ufzgi", "hausufgab", "lernen", "schreib", "rechnen",
    "homework", "study", "=write", "writing", "=math",
    "devoirs", "ecrire", "compiti", "studia", "scrivere",
  ]],
  ["read", [
    "lesen", "vorlesen", "=buch", "bucher", "bilderbuch", "geschichte",
    "=read", "reading", "=book", "books", "story", "stories",
    "=lire", "=livre", "livres", "histoire", "legger", "=libro", "libri", "storia",
    "=lase", "buech", "gschicht", "vorlase",
  ]],
  ["laundry", [
    "=wasche", "zusammenleg", "wasche versorg", "=falten", "socken", "kleider versorg", "zamelege", "zammelege",
    "=fold", "folding", "fold laundry", "fold clothes", "put away laundry",
    "=linge", "plier", "ranger le linge", "piegare", "=panni",
  ]],
  ["wash-clothes", [
    "wasche wasch", "=waschen", "waschmaschine", "aufhang", "wosch", "=wasch", "wasche mache",
    "laundry", "do the washing", "washing machine", "wash clothes", "hang up",
    "lessive", "lave linge", "etendre", "bucato", "lavatrice", "stendere",
  ]],
  ["dishes", [
    "abwasch", "geschirr", "spul", "spuelmaschine", "abtrock",
    "dishes", "dishwasher", "wash up",
    "vaisselle", "lave vaisselle", "=piatti", "lavastoviglie",
    "abwasche", "gschirr", "abtrochne",
  ]],
  ["wash-hands", [
    "hande wasch", "hande", "handewasch", "handwasch", "seife",
    "wash hands", "wash your hands", "hands", "=soap",
    "laver les mains", "=mains", "savon", "lavare le mani", "=mani", "sapone",
    "hand wasche", "hand wasch", "=hand",
  ]],
  ["bath", [
    "baden", "=bad", "badewanne", "dusch", "haare wasch", "haarwasch",
    "=bath", "bathtime", "bath time", "shower",
    "=bain", "douche", "bagno", "doccia", "=bade", "badle",
  ]],
  ["pajamas", [
    "schlaf", "ins bett", "zu bett", "pyjama", "pijama", "gute nacht", "nachtruhe",
    "=sleep", "sleeping", "bedtime", "go to bed", "pajama", "=nap", "=pj",
    "dormir", "=coucher", "au lit", "=dodo", "dormire", "=nanna", "a letto", "pigiama",
    "is bett", "gueti nacht", "=pfuse", "=schlafe",
  ]],
  ["backpack", [
    "schultasche", "schulsack", "rucksack", "ranzen", "turnsack", "turnbeutel", "=thek",
    "backpack", "school bag", "schoolbag", "pack bag", "pack your bag",
    "cartable", "sac a dos", "sac d ecole", "zaino", "cartella",
  ]],
  ["sweep", [
    "=wischen", "abwisch", "aufwisch", "boden wisch", "=fegen", "besen", "kehren",
    "sweep", "broom", "=mop", "mopp",
    "balayer", "=balai", "spazzare", "=scopa", "wusche",
  ]],
  ["vacuum", [
    "staubsaug", "=saugen", "=staub",
    "vacuum", "hoover",
    "aspirateur", "aspirapolvere", "staubsuge", "=suge",
  ]],
  ["breakfast", [
    "fruhstuck", "fruehstueck", "zmorge", "zmittag", "zvieri", "znuni", "=essen", "mittagessen",
    "breakfast", "lunch", "=eat", "snack", "cereal",
    "petit dej", "dejeuner", "manger", "gouter", "colazione", "pranzo", "mangiare", "merenda",
    "muesli", "musli", "birchermues",
  ]],
  ["medicine", [
    "medikament", "medizin", "=medi", "tablette", "pille", "vitamin", "tropfen", "hustensaft",
    "medicine", "medication", "=pill", "pills",
    "medicament", "pilule", "medicina", "pillola", "=gocce",
  ]],
  ["music", [
    "=uben", "=ueben", "=uebe", "=musik", "musizier", "instrument", "klavier", "flote", "blockflot", "geige", "gitarre", "trommel", "=floti",
    "~practice", "~practise", "music", "piano", "flute", "violin", "guitar", "drums", "recorder",
    "musique", "jouer du", "violon", "guitare", "musica", "suonare", "flauto", "violino", "chitarra",
  ]],
  ["tidy-room", [
    "=zimmer", "zimmer aufraum", "kinderzimmer", "zimmer ufruume", "schublade", "kommode", "schrank", "chaschte",
    "tidy room", "clean room", "clean your room", "bedroom", "my room",
    "chambre", "ranger la chambre", "=camera", "stanza", "cameretta",
    "=amtli", "hausarbeit", "haushalt", "~=chores", "~=chore",
  ]],
  ["shoes", [
    "schuhe", "=schuh", "schuhe versorg", "stiefel", "finken", "hausschuh", "=schue",
    "shoes", "sneakers", "boots", "slippers",
    "chaussures", "baskets", "chaussons", "scarpe", "pantofole",
  ]],
  ["shopping", [
    "einkauf", "kaufen", "poschte", "=posch", "migros", "=coop", "=denner", "=aldi", "=lidl", "supermarkt",
    "shopping", "groceries", "=shop", "=buy",
    "courses", "faire les courses", "acheter", "=spesa", "fare la spesa", "supermercato", "comprare",
  ]],
  ["event-school", [
    "schule", "=schul", "unterricht", "schulstunde", "=schuel", "schuelreis",
    "school", "=class", "classes",
    "ecole", "=classe", "=cours", "scuola", "lezione",
  ]],
  ["event-kindergarten", [
    "kindergarten", "=kita", "krippe", "spielgruppe", "chindsgi", "chindergarte", "=kiga",
    "kindergarden", "preschool", "nursery", "daycare",
    "creche", "maternelle", "garderie", "=asilo", "scuola materna", "=materna", "=nido",
  ]],
  ["event-soccer", [
    "fussball", "tschutte", "tschutti", "=fuessball",
    "soccer", "football", "=foot", "calcio", "futbol",
  ]],
  ["event-swim", [
    "schwimm", "hallenbad", "freibad", "=badi", "badi", "seebad",
    "=swim", "swimming", "=pool",
    "piscine", "=nager", "natation", "nuoto", "piscina", "nuotare",
  ]],
  ["event-doctor", [
    "arzt", "zahnarzt", "kinderarzt", "doktor", "=praxis", "spital", "impfung", "=dokter",
    "doctor", "dentist", "checkup", "check up", "hospital", "vaccin",
    "medecin", "docteur", "dentiste", "pediatre", "hopital",
    "medico", "dottore", "dentista", "pediatra", "ospedale", "vaccino",
  ]],
  ["event-birthday", [
    "geburtstag", "geburi", "geschenk", "=party", "=fest", "=feier",
    "birthday", "=bday", "=gift",
    "anniversaire", "=fete", "cadeau", "compleanno", "=festa", "regalo",
  ]],
  ["event-dinner", [
    "abendessen", "znacht", "nachtessen", "=grill", "grillier", "=grillen", "restaurant", "essen gehen", "pizza",
    "dinner", "supper", "=bbq", "barbecue", "zmittag", "zmorge", "mittagessen", "=essen", "lunch", "brunch", "fruhstuck",
    "=diner", "souper", "=cena", "ristorante", "pizzeria",
  ]],
  ["event-music", [
    "musikschule", "musikstunde", "konzert", "=chor", "chorprob", "klavierstund", "gitarrenstund", "geigenstund",
    "flotenstund", "orchester", "=chorli",
    "concert", "choir", "music lesson", "piano lesson", "guitar lesson",
    "klavier", "gitarre", "geige", "flote", "blockflot", "trommel", "=musik", "piano", "guitar", "violin", "violon", "guitare", "chitarra",
    "chorale", "cours de musique", "conservatoire", "concerto", "=coro", "lezione di musica",
  ]],
  ["event-play", [
    "spielen", "spielplatz", "spieltreff", "spielnachmittag", "sandkasten", "=spile", "spieli", "sandele",
    "=play", "playdate", "play date", "playground",
    "jouer", "=parc", "aire de jeux", "giocare", "parco giochi", "=parco",
  ]],
  ["event-trip", [
    "ausflug", "reise", "ferien", "urlaub", "wander", "=zoo", "=berg", "=fahrt", "zugfahrt",
    "=trip", "outing", "excursion", "holiday", "vacation", "=hike", "hiking", "travel",
    "=sortie", "vacances", "voyage", "randonnee", "=gita", "vacanze", "viaggio", "escursion",
    "usflug", "reisli", "=zolli",
  ]],
  ["event-bike", [
    "=velo", "velofahr", "velotour", "fahrrad", "rad fahr", "radfahr", "trottinett", "=trotti",
    "=bike", "bicycle", "cycling", "scooter",
    "=bici", "bicicletta",
  ]],
];

type Entry = { name: PictoName; kw: string; exact: boolean; weak: boolean; weight: number };

const ENTRIES: Entry[] = KEYWORDS.flatMap(([name, list]) =>
  list.map((raw) => {
    const weak = raw.startsWith("~");
    const rest = weak ? raw.slice(1) : raw;
    const exact = rest.startsWith("=");
    const kw = exact ? rest.slice(1) : rest;
    const letters = kw.replace(/ /g, "").length;
    return { name, kw, exact, weak, weight: weak ? 1 : letters };
  }),
);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchIndex(padded: string, words: readonly string[], entry: Entry): number {
  if (entry.exact) {
    if (entry.kw.includes(" ")) return padded.indexOf(` ${entry.kw} `);
    const i = words.indexOf(entry.kw);
    return i === -1 ? -1 : padded.indexOf(` ${entry.kw} `);
  }
  if (entry.kw.replace(/ /g, "").length <= 4 || entry.kw.includes(" ")) return padded.indexOf(` ${entry.kw}`);
  return padded.indexOf(entry.kw);
}

export type TitleMatch = { name: PictoName; weak: boolean };

/** Best keyword match, optionally restricted to motif categories. */
export function matchTitle(
  title: string | null | undefined,
  categories?: readonly PictoCategory[],
): TitleMatch | null {
  if (!title) return null;
  const norm = normalizeTitle(title);
  if (!norm) return null;
  const padded = ` ${norm} `;
  const words = norm.split(" ");

  let best: { entry: Entry; index: number } | null = null;
  for (const entry of ENTRIES) {
    if (categories && !categories.includes(PICTO_META[entry.name].category)) continue;
    const index = matchIndex(padded, words, entry);
    if (index === -1) continue;
    if (
      !best ||
      entry.weight > best.entry.weight ||
      (entry.weight === best.entry.weight && index < best.index)
    ) {
      best = { entry, index };
    }
  }
  return best ? { name: best.entry.name, weak: best.entry.weak } : null;
}

/** Best motif for a free-text title, or null when nothing fits well enough. */
export function suggestPicto(title: string | null | undefined): PictoName | null {
  return matchTitle(title)?.name ?? null;
}
