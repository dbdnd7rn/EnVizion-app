export const QUIET_MOMENT_MS = 60_000;

export function quietMomentElapsedMs(
  startedAtMs: number,
  nowMs: number,
  durationMs = QUIET_MOMENT_MS,
) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.min(durationMs, nowMs - startedAtMs));
}

export function quietMomentProgress(
  elapsedMs: number,
  durationMs = QUIET_MOMENT_MS,
) {
  if (!Number.isFinite(elapsedMs) || durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}

export function quietMomentRemainingSeconds(
  elapsedMs: number,
  durationMs = QUIET_MOMENT_MS,
) {
  const remainingMs = Math.max(0, durationMs - Math.max(0, elapsedMs));
  return Math.ceil(remainingMs / 1000);
}

export function formatQuietMomentClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const FAITH_VERSE_INTERVAL_MS = 12 * 60 * 60 * 1000;

// King James Version scripture, rotated by time rather than by visits.
// Adjacent windows always show different verses, including at the cycle boundary.
export const FAITH_VERSES = [
  { reference: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { reference: "Philippians 4:13", text: "I can do all things through Christ which strengtheneth me." },
  { reference: "Psalm 23:1", text: "The LORD is my shepherd; I shall not want." },
  { reference: "1 Peter 5:7", text: "Casting all your care upon him; for he careth for you." },
  { reference: "Psalm 56:3", text: "What time I am afraid, I will trust in thee." },
  { reference: "Matthew 11:28", text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { reference: "Psalm 119:105", text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { reference: "Proverbs 3:5", text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { reference: "Psalm 34:8", text: "O taste and see that the LORD is good: blessed is the man that trusteth in him." },
  { reference: "Isaiah 26:3", text: "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee." },
  { reference: "Psalm 118:24", text: "This is the day which the LORD hath made; we will rejoice and be glad in it." },
  { reference: "John 14:27", text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid." },
  { reference: "Psalm 147:3", text: "He healeth the broken in heart, and bindeth up their wounds." },
  { reference: "Philippians 4:4", text: "Rejoice in the Lord alway: and again I say, Rejoice." },
  { reference: "Psalm 121:2", text: "My help cometh from the LORD, which made heaven and earth." },
  { reference: "2 Corinthians 5:7", text: "For we walk by faith, not by sight:" },
  { reference: "Psalm 46:10", text: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth." },
  { reference: "1 Corinthians 16:14", text: "Let all your things be done with charity." },
  { reference: "Psalm 100:5", text: "For the LORD is good; his mercy is everlasting; and his truth endureth to all generations." },
  { reference: "Romans 12:12", text: "Rejoicing in hope; patient in tribulation; continuing instant in prayer;" },
  { reference: "Psalm 4:8", text: "I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety." },
  { reference: "Proverbs 16:3", text: "Commit thy works unto the LORD, and thy thoughts shall be established." },
  { reference: "Psalm 62:6", text: "He only is my rock and my salvation: he is my defence; I shall not be moved." },
  { reference: "1 Thessalonians 5:11", text: "Wherefore comfort yourselves together, and edify one another, even as also ye do." },
  { reference: "Psalm 27:14", text: "Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD." },
  { reference: "Matthew 5:9", text: "Blessed are the peacemakers: for they shall be called the children of God." },
  { reference: "Psalm 145:18", text: "The LORD is nigh unto all them that call upon him, to all that call upon him in truth." },
  { reference: "Hebrews 13:8", text: "Jesus Christ the same yesterday, and to day, and for ever." },
  { reference: "Psalm 31:24", text: "Be of good courage, and he shall strengthen your heart, all ye that hope in the LORD." },
  { reference: "Galatians 6:9", text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not." },
] as const;

export function faithVerseWindow(nowMs = Date.now()) {
  const safeNow = Number.isFinite(nowMs) ? nowMs : 0;
  return Math.floor(safeNow / FAITH_VERSE_INTERVAL_MS);
}

export function faithVerseAt(nowMs = Date.now()) {
  const window = faithVerseWindow(nowMs);
  const index = ((window % FAITH_VERSES.length) + FAITH_VERSES.length) % FAITH_VERSES.length;
  return FAITH_VERSES[index];
}

export function faithVerseNextUpdateMs(nowMs = Date.now()) {
  return (faithVerseWindow(nowMs) + 1) * FAITH_VERSE_INTERVAL_MS;
}
