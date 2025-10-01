// src/data/boissons.ts

type Item = { name: string; desc?: string; price?: string };
type Section = { id: string; label: string; items: Item[] };

export const sections: Section[] = [
  {
    id: "cafe-the-chocolat",
    label: "Café, thé & chocolat",
    items: [
      { name: "Espresso", price: "" },
      { name: "Allongé", price: "" },
      { name: "Décaféiné", price: "" },
      { name: "Noisette", price: "" },
      { name: "Double espresso", price: "" },
      { name: "Cappuccino", price: "" },
      { name: "Latte macchiato", price: "" },
      { name: "Mocaccino", price: "" },
      { name: "Chocolat chaud", price: "" },
      { name: "Thé / Infusion", desc: "Sélection du moment", price: "" },
      { name: "Café frappé", price: "" },
      { name: "Café viennois", price: "" },
      { name: "Affogato", desc: "Espresso sur glace vanille", price: "" },
    ],
  },
  {
    id: "softs",
    label: "Softs",
    items: [
      { name: "Sodas", desc: "Coca, Coca Zéro, etc.", price: "" },
      { name: "Jus de fruits", desc: "Orange, pomme, ananas…", price: "" },
      { name: "Limonade / Tonic", price: "" },
      { name: "Ginger Beer", price: "" },
      { name: "Virgin cocktails", desc: "Sans alcool", price: "" },
    ],
  },
  {
    id: "eaux",
    label: "Eaux minérales",
    items: [
      { name: "Plate", desc: "Verre / Bouteille", price: "" },
      { name: "Gazeuse", desc: "Verre / Bouteille", price: "" },
    ],
  },
  {
    id: "bieres",
    label: "Bières Pression & bouteilles",
    items: [
      { name: "Pression — Blonde", price: "" },
      { name: "Pression — Ambrée", price: "" },
      { name: "Bouteille — IPA", price: "" },
      { name: "Bouteille — Blanche", price: "" },
      // complète selon la carte
    ],
  },
  {
    id: "cocktails",
    label: "Cocktails",
    items: [
      { name: "Caipirinha", desc: "Cachaça, citron vert, sirop simple", price: "" },
      { name: "Long Island", desc: "Vodka, gin, tequila, rhum, Cointreau, citron vert, sirop simple", price: "" },
      { name: "Basil Smash", desc: "Gin, basilic, citron, sirop simple", price: "" },
      { name: "Pisco Sour", desc: "Pisco, citron vert, blanc d’œuf, sirop simple, bitter", price: "" },
      { name: "Lemon Cheesecake Martini", desc: "Limoncello, Licor 43, citron vert, crème, glace", price: "" },
      { name: "Screaming Orgasm", desc: "Vodka, Baileys, Kahlua, Amaretto, lait, chantilly", price: "" },
      { name: "Espresso Martini brûlé", desc: "Vodka, espresso, Kahlua, Licor 43, crème, blanc d’œuf, sucre brun", price: "" },
      { name: "La Carioca", desc: "Rhum, citron vert, lait concentré, sirop simple", price: "" },
    ],
  },
  {
    id: "spiritueux",
    label: "Apéritifs & spiritueux",
    items: [
      { name: "Pastis / Anisé", price: "" },
      { name: "Porto / Vermouth", price: "" },
      { name: "Whisky / Bourbon", price: "" },
      { name: "Gin", price: "" },
      { name: "Rhum", price: "" },
      { name: "Tequila / Mezcal", price: "" },
      { name: "Cognac / Armagnac", price: "" },
      { name: "Liqueurs", price: "" },
    ],
  },
  {
    id: "vins",
    label: "Vins",
    items: [
      { name: "Au verre", desc: "Blanc / Rouge / Rosé", price: "" },
      { name: "Bouteilles — Blanc", price: "" },
      { name: "Bouteilles — Rouge", price: "" },
      { name: "Bouteilles — Rosé", price: "" },
      { name: "Effervescents", price: "" },
    ],
  },
];
