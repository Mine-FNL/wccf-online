/**
 * Fictional AI manager clubs — used to fill cabinet seats, chat feed,
 * tickers and leaderboards until the real backend lands.
 */

export interface AiClub {
  club: string
  manager: string
  avatar: string
}

export const AI_CLUBS: AiClub[] = [
  { club: 'CalcioNova', manager: 'Marco Bellini', avatar: '/avatar-3.png' },
  { club: 'FC Stellar', manager: 'Jonas Lindqvist', avatar: '/avatar-2.png' },
  { club: 'Albion Rovers 88', manager: 'Callum Fraser', avatar: '/avatar-1.png' },
  { club: 'Nordvik IF', manager: 'Eirik Halvorsen', avatar: '/avatar-4.png' },
  { club: 'Porto Azul', manager: 'Rui Tavares', avatar: '/avatar-6.png' },
  { club: 'Kaiserwald XI', manager: 'Dieter Koch', avatar: '/avatar-1.png' },
  { club: 'Lobos del Norte', manager: 'Sergio Vidal', avatar: '/avatar-8.png' },
  { club: 'Ember Athletic', manager: 'Tanya Osei', avatar: '/avatar-7.png' },
  { club: 'Torenstad FC', manager: 'Pieter van Dam', avatar: '/avatar-5.png' },
  { club: 'Real Costena', manager: 'Lucia Herrera', avatar: '/avatar-6.png' },
  { club: 'Dynamo Verge', manager: 'Anders Moe', avatar: '/avatar-4.png' },
  { club: 'Crescent City SC', manager: 'Deon Baptiste', avatar: '/avatar-2.png' },
  { club: 'Haruka FC', manager: 'Shun Takagi', avatar: '/avatar-2.png' },
  { club: 'Falkirk Steel', manager: 'Graeme Docherty', avatar: '/avatar-1.png' },
  { club: 'Onda Marina', manager: 'Giulia Ferretti', avatar: '/avatar-6.png' },
  { club: 'Vultur Negru', manager: 'Andrei Popa', avatar: '/avatar-4.png' },
  { club: 'AFC Kilmaine', manager: 'Padraig Nolan', avatar: '/avatar-1.png' },
  { club: 'Solar de Lima', manager: 'Renzo Quispe', avatar: '/avatar-7.png' },
  { club: 'Wolves of Kanto', manager: 'Daichi Mori', avatar: '/avatar-8.png' },
  { club: 'Union Vetra', manager: 'Petar Jovanovic', avatar: '/avatar-1.png' },
  { club: 'Flamma 1904', manager: 'Enzo Ricci', avatar: '/avatar-7.png' },
  { club: 'Astra Gdynia', manager: 'Kuba Wozniak', avatar: '/avatar-2.png' },
  { club: 'Mistral XI', manager: 'Camille Roche', avatar: '/avatar-6.png' },
  { club: 'Highvale Town', manager: 'Ethan Pryce', avatar: '/avatar-5.png' },
  { club: 'Samba Norte', manager: 'Caio Mendes', avatar: '/avatar-7.png' },
  { club: 'Ironbridge FC', manager: 'Nadia Whitfield', avatar: '/avatar-1.png' },
  { club: 'Leone Dorato', manager: 'Vittorio Sanna', avatar: '/avatar-3.png' },
  { club: 'Stormvogels', manager: 'Sanne de Vries', avatar: '/avatar-6.png' },
  { club: 'Athletic Kilo', manager: 'Mikko Rantanen', avatar: '/avatar-4.png' },
  { club: 'Cerro Unido', manager: 'Pablo Fuentes', avatar: '/avatar-5.png' },
  { club: 'Zorya Luhansk 2', manager: 'Olena Koval', avatar: '/avatar-2.png' },
  { club: 'Delta Parnaiba', manager: 'Italo Barros', avatar: '/avatar-6.png' },
  { club: 'Rovers Meridiani', manager: 'Aldo Conti', avatar: '/avatar-1.png' },
  { club: 'Kestrel Bay', manager: 'Maisie Thornton', avatar: '/avatar-4.png' },
  { club: 'Fuego Eterno', manager: 'Hector Luna', avatar: '/avatar-7.png' },
  { club: 'Bastion 03', manager: 'Theo Marchand', avatar: '/avatar-1.png' },
  { club: 'Ginga Osaka', manager: 'Riku Sato', avatar: '/avatar-2.png' },
  { club: 'Nordstern 09', manager: 'Lena Vogt', avatar: '/avatar-2.png' },
  { club: 'Vila Corvo', manager: 'Bruno Esteves', avatar: '/avatar-8.png' },
  { club: 'Cobalt Rovers', manager: 'Derek Malone', avatar: '/avatar-1.png' },
]

/** Deterministic pick: same index in → same club out. */
export function aiClubAt(index: number): AiClub {
  return AI_CLUBS[((index % AI_CLUBS.length) + AI_CLUBS.length) % AI_CLUBS.length]
}
