const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const vini = [
  {
    id: 'v1',
    nome: 'Primitivo Selvatico',
    cantina: 'Masseria Terre Rosse',
    annata: '2021',
    vitigno: 'Primitivo',
    territorio: "Valle d'Itria, Puglia",
    tipo: 'rosso',
    emoji: '🍷',
    desc: "Nasce su suoli argillosi rossi del tavoliere murgiano. Fermentazione spontanea in anfore di terracotta pugliese, nessuna aggiunta. Il frutto è generoso ma non stanca — c'è una tensione sotto, come un racconto che non ha ancora finito di parlarsi.",
    colore: '#5c1a28'
  },
  {
    id: 'v2',
    nome: 'Fiano Ambrato',
    cantina: 'Cantine del Fuoco',
    annata: '2020',
    vitigno: 'Fiano',
    territorio: 'Irpinia, Campania',
    tipo: 'arancio',
    emoji: '🧡',
    desc: "Macerazione sulle bucce per 40 giorni. Color ambra profondo, schiuma quasi assente. Sa di camomilla essiccata, cera d'api, e un finale salato che ti riporta al mare d'inverno. Per chi non ha paura dei vini che chiedono tempo.",
    colore: '#7a4a1a'
  },
  {
    id: 'v3',
    nome: 'Nerello delle Rocce',
    cantina: 'Etna Selvaggia',
    annata: '2019',
    vitigno: 'Nerello Mascalese',
    territorio: 'Etna Nord, Sicilia',
    tipo: 'rosso',
    emoji: '🌋',
    desc: "Da viti centenarie a 800 metri. Il suolo vulcanico si sente — c'è una mineralità quasi pietrosa che attraversa il frutto come una corrente. Leggero di corpo, pesante di personalità. Come una persona silenziosa in una stanza rumorosa.",
    colore: '#3d1a35'
  },
  {
    id: 'v4',
    nome: 'Vermentino dei Venti',
    cantina: 'Sa Defenza',
    annata: '2022',
    vitigno: 'Vermentino',
    territorio: 'Gallura, Sardegna',
    tipo: 'bianco',
    emoji: '🌿',
    desc: "Vendemmia notturna per preservare i profumi. Nessun legno, acciaio inox. Agrumi freschi, macchia mediterranea, e un'amaro finale che ricorda il rosmarino sotto il sole. Il vino dell'estate che non vuole finire.",
    colore: '#1a4a2e'
  },
  {
    id: 'v5',
    nome: 'Lambrusco Ancestrale',
    cantina: 'Podere Matto',
    annata: '2023',
    vitigno: 'Lambrusco di Sorbara',
    territorio: 'Modena, Emilia',
    tipo: 'frizzante',
    emoji: '✨',
    desc: 'Metodo ancestrale, rifermentazione in bottiglia. Schiuma violacea tenue, quasi impalpabile. Melograno, terra bagnata, e una bollicina che non aggredisce. Da bere freddo, in piedi, in un campo.',
    colore: '#4a1a5c'
  },
  {
    id: 'v6',
    nome: 'Coda di Volpe Vulcanica',
    cantina: 'Vigna del Vesuvio',
    annata: '2021',
    vitigno: 'Coda di Volpe',
    territorio: 'Vesuvio, Campania',
    tipo: 'bianco',
    emoji: '🌊',
    desc: "L'uva cresce letteralmente sulla lava del Vesuvio. Giallo paglierino brillante, naso di fiori bianchi e pietra focaia. Bocca verticale, quasi nervosa. Un vino che ti ricorda che la terra viva.",
    colore: '#1a3a5c'
  }
];

async function seed() {
  console.log('🌱 Seeding del database in corso...\n');

  for (const vino of vini) {
    const existing = await prisma.wine.findUnique({ where: { id: vino.id } });
    if (existing) {
      console.log(`  ⏭  "${vino.nome}" già presente, skip.`);
    } else {
      await prisma.wine.create({ data: vino });
      console.log(`  ✅ "${vino.nome}" inserito.`);
    }
  }

  const count = await prisma.wine.count();
  console.log(`\n🍷 Totale vini nel database: ${count}`);
  console.log('✅ Seed completato!\n');
}

seed()
  .catch(e => { console.error('❌ Errore seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
