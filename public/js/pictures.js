export const PICTURES = [
  {
    id: 'heart',
    title: 'Heart',
    key: '.X',
    palette: ['#BEE3F8', '#E8456B'],
    diff: 2,
    rows: ['.XX..XX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'],
  },
  {
    id: 'smiley',
    title: 'Smiley',
    key: '.YK',
    palette: ['#D9EEF7', '#FFCF33', '#2E2A36'],
    diff: 2,
    rows: ['..YYYY..', '.YYYYYY.', 'YYKYYKYY', 'YYKYYKYY', 'YYYYYYYY', 'YKYYYYKY', '.YKKKKY.', '..YYYY..'],
  },
  {
    id: 'mushroom',
    title: 'Mushroom',
    key: '.RW',
    palette: ['#BFE6F5', '#E5484D', '#FFF6E6'],
    diff: 2,
    rows: ['..RRRR..', '.RWRRWR.', 'RRRRRRRR', 'RWRRRRWR', 'RRRRRRRR', '..WWWW..', '..WWWW..', '..WWWW..'],
  },
  {
    id: 'tree',
    title: 'Pine',
    key: '.GB',
    palette: ['#DDF1FF', '#3FA34D', '#8B5A2B'],
    diff: 2,
    rows: ['...G...', '..GGG..', '.GGGGG.', '..GGG..', '.GGGGG.', 'GGGGGGG', '...B...', '...B...', '..BBB..'],
  },
  {
    id: 'star',
    title: 'Star',
    key: '.Y',
    palette: ['#243B6B', '#FFD23F'],
    diff: 3,
    rows: ['....Y....', '....Y....', '...YYY...', 'YYYYYYYYY', '.YYYYYYY.', '..YYYYY..', '..YYYYY..', '.YY...YY.', '.Y.....Y.'],
  },
  {
    id: 'apple',
    title: 'Apple',
    key: '.RGB',
    palette: ['#CDEAC0', '#D7263D', '#3E9B4F', '#7A4B2A'],
    diff: 2,
    rows: ['....B...', '...BGG..', '.RRBRRR.', 'RRRRRRRR', 'RRRRRRRR', 'RRRRRRRR', '.RRRRRR.', '..RR.RR.'],
  },
  {
    id: 'cat',
    title: 'Cat',
    key: '.XGP',
    palette: ['#A8DADC', '#F4A259', '#2F6B4A', '#E86A92'],
    diff: 3,
    rows: ['X.......X', 'XX.....XX', 'XXXXXXXXX', 'XXGXXXGXX', 'XXXXXXXXX', 'XXXXPXXXX', '.XXXXXXX.', '..XXXXX..'],
  },
  {
    id: 'ghost',
    title: 'Ghost',
    key: '.RWB',
    palette: ['#1F2440', '#FF5D73', '#FFFFFF', '#3A6BFF'],
    diff: 3,
    rows: ['..RRRR..', '.RRRRRR.', 'RWWRRWWR', 'RBWRRBWR', 'RRRRRRRR', 'RRRRRRRR', 'RRRRRRRR', 'RR.RR.RR'],
  },
  {
    id: 'fish',
    title: 'Fish',
    key: '.OK',
    palette: ['#9ED8F0', '#FF8C42', '#1E2A38'],
    diff: 3,
    rows: ['....OOO...', '..OOOOOO.O', '.OKOOOOOOO', 'OOOOOOOOO.', '.OOOOOOOOO', '..OOOOOO.O', '....OOO...'],
  },
  {
    id: 'house',
    title: 'House',
    key: '.RWB',
    palette: ['#CDEBFF', '#C8453C', '#FFD27A', '#3C6E9E'],
    diff: 3,
    rows: ['....R....', '...RRR...', '..RRRRR..', '.RRRRRRR.', 'RRRRRRRRR', '.WWWWWWW.', '.WBWWWBW.', '.WWWBWWW.', '.WWWBWWW.'],
  },
  {
    id: 'boat',
    title: 'Sailboat',
    key: '.WBS',
    palette: ['#9FD8FF', '#FFFFFF', '#9C5B34', '#2F6FDB'],
    diff: 3,
    rows: ['....W....', '....WW...', '....WWW..', '...WWWW..', '..WWWWWW.', '....B....', 'BBBBBBBBB', '.BBBBBBB.', 'SSSSSSSSS'],
  },
  {
    id: 'invader',
    title: 'Invader',
    key: '.X',
    palette: ['#1D2340', '#7CF29A'],
    diff: 3,
    rows: ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
  },
];

export function pictureSolution(pic) {
  const out = [];
  for (const row of pic.rows) for (const ch of row) out.push(pic.key.indexOf(ch));
  return out;
}
