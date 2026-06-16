const LEET = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a',
  '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't',
  '(': 'c', '<': 'c',
};

function normalizeLetters(str) {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split('')
    .map(c => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');
}

function normalizeCompact(str) {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '');
}

const BANNED = [
  // Racial / ethnic slurs
  'nigger', 'nigga', 'nigg', 'niger',
  'chink', 'chinaman',
  'gook',
  'spic', 'spick',
  'wetback',
  'kike',
  'beaner',
  'coon',
  'jigaboo',
  'darkie',
  'zipperhead',
  'raghead', 'towelhead',
  'sandnigger',
  'cameljockey',
  'junglebunny',
  'redskin', 'injun',
  'golliwog',
  'pikey',
  'gypsy',
  'wop',
  'dago',
  'kraut',
  'tarbaby',

  // Nazi / white-supremacy
  'hitler',
  'nazi',
  'nsdap',
  'kkk',
  'heilhitler',
  'siegheil',
  'fuhrer',
  'auschwitz',
  'whitepower',
  'whitepow',
  'aryan',
  'stormfront',
  'gasjews',

  // LGBT slurs
  'faggot', 'fagg', 'fagot',
  'tranny',
  'dyke',
  'shemale',

  // Ableist
  'retard',
  'retarded',
  'spastic',

  // Toxic / threatening
  'kys',
  'killyourself',
  'killurself',
  'kymself',
  'hangyourself',

  // General extreme profanity
  'cunt',
  'whore',
  'slut',
];

const BANNED_NUMERIC = [
  '1488',
  '88',
];

export function isBannedUsername(username) {
  const letters = normalizeLetters(username);
  const compact = normalizeCompact(username);

  const hasBannedWord = BANNED.some(word => {
    const normalizedWord = normalizeLetters(word);
    return normalizedWord.length > 0 && letters.includes(normalizedWord);
  });

  const hasBannedNumber = BANNED_NUMERIC.some(code => {
    return compact === code || compact.includes(code);
  });

  return hasBannedWord || hasBannedNumber;
}