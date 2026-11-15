// Story auto-play and the orbit view's landing share one clock: the touchdown chapter must outlast the descent, so
// the "links come up at touchdown" moment is on screen before the next chapter.

/** Auto-play (demo video): each story chapter shows for this long */
export const STORY_CHAPTER_MS = 7000;
/** The orbit view's landing takes this long, from the moment the landing starts (not from when the textures load) */
export const DESCENT_S = STORY_CHAPTER_MS / 1000 - 2; // so the links show for the chapter's last 2 s
