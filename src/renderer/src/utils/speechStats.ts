/** Filler word detection and WPM calculation for spoken transcripts. */

export interface FillerStats {
  total: number
  breakdown: Record<string, number>
}

// Ordered: unambiguous hesitations first, contextual fillers last
const FILLER_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: 'um',        re: /\bum+\b/gi        },
  { key: 'uh',        re: /\buh+\b/gi        },
  { key: 'er',        re: /\ber+\b/gi        },
  { key: 'ah',        re: /\bah+\b/gi        },
  { key: 'you know',  re: /\byou know\b/gi   },
  { key: 'i mean',    re: /\bi mean\b/gi     },
  { key: 'basically', re: /\bbasically\b/gi  },
  { key: 'literally', re: /\bliterally\b/gi  },
  { key: 'like',      re: /\blike\b/gi       },
  { key: 'actually',  re: /\bactually\b/gi   },
  { key: 'right',     re: /\bright\b/gi      },
  { key: 'so',        re: /\bso\b/gi         },
  { key: 'just',      re: /\bjust\b/gi       },
  { key: 'kind of',   re: /\bkind of\b/gi    },
  { key: 'sort of',   re: /\bsort of\b/gi    },
]

export function countFillers(text: string): FillerStats {
  const breakdown: Record<string, number> = {}
  let total = 0
  for (const { key, re } of FILLER_PATTERNS) {
    const n = (text.match(re) ?? []).length
    if (n > 0) { breakdown[key] = n; total += n }
  }
  return { total, breakdown }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Returns 0 if duration is under 1 second (avoid garbage readings on very short clips). */
export function calcWpm(text: string, durationMs: number): number {
  if (durationMs < 1000) return 0
  return Math.round(countWords(text) / (durationMs / 60000))
}

/** Merge two FillerStats objects (used to accumulate session totals). */
export function mergeFillerStats(a: FillerStats, b: FillerStats): FillerStats {
  const breakdown = { ...a.breakdown }
  for (const [k, v] of Object.entries(b.breakdown)) {
    breakdown[k] = (breakdown[k] ?? 0) + v
  }
  return { total: a.total + b.total, breakdown }
}
