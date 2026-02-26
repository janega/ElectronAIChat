/**
 * Utilities for parsing LLM message content.
 * Handles XML-style reasoning tags and markdown normalization.
 */

/** Tags treated as "thinking / reasoning" sections (hidden by default). */
const THINKING_TAGS = ['thinking', 'analysis', 'reasoning'] as const;

/** Tags treated as final-answer wrappers (stripped, content kept). */
const FINAL_TAGS = ['final'] as const;

export interface ThinkingBlock {
  tag: string;
  content: string;
  /** True when the closing tag has not yet arrived (stream still open). */
  isOpen: boolean;
}

export interface ParsedMessage {
  /** Zero or more reasoning / thinking blocks extracted from the text. */
  thinkingBlocks: ThinkingBlock[];
  /** The text that remains after removing thinking sections. */
  finalContent: string;
  hasThinking: boolean;
}

/**
 * Extracts thinking/reasoning sections from XML-style tags and returns the
 * remaining final content plus the extracted blocks.
 *
 * Safe to call on partial / streaming text – unclosed tags are captured as
 * open blocks and the partial content is removed from `finalContent`.
 */
export function parseMessageContent(text: string): ParsedMessage {
  const thinkingBlocks: ThinkingBlock[] = [];
  let remaining = text;

  // 1. Extract fully-closed thinking tags
  for (const tag of THINKING_TAGS) {
    const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
    remaining = remaining.replace(regex, (match) => {
      const inner = match.slice(tag.length + 2, -(tag.length + 3)).trim();
      thinkingBlocks.push({ tag, content: inner, isOpen: false });
      return '';
    });
  }

  // 2. Strip fully-closed <final> tags (keep inner content)
  for (const tag of FINAL_TAGS) {
    const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
    remaining = remaining.replace(regex, (match) => {
      return match.slice(tag.length + 2, -(tag.length + 3)).trim();
    });
  }

  // 3. Handle unclosed thinking tags at end of stream (partial streaming)
  for (const tag of THINKING_TAGS) {
    const openRegex = new RegExp(`<${tag}>([\\s\\S]*)$`, 'i');
    const match = remaining.match(openRegex);
    if (match) {
      thinkingBlocks.push({ tag, content: match[1].trim(), isOpen: true });
      remaining = remaining.replace(openRegex, '');
    }
  }

  // 4. Handle unclosed <final> at end of stream
  for (const tag of FINAL_TAGS) {
    const openRegex = new RegExp(`<${tag}>([\\s\\S]*)$`, 'i');
    const match = remaining.match(openRegex);
    if (match) {
      remaining = remaining.replace(openRegex, match[1]);
    }
  }

  return {
    thinkingBlocks,
    finalContent: remaining.trim(),
    hasThinking: thinkingBlocks.length > 0,
  };
}

/**
 * Ensures code fences are balanced so a streaming partial response can be
 * passed to a markdown renderer without breaking the fence state.
 */
export function normalizeMarkdown(text: string): string {
  const fenceMatches = text.match(/^```/gm) ?? [];
  if (fenceMatches.length % 2 !== 0) {
    // Odd number of fences → the last one is unclosed; close it.
    return text + '\n```';
  }
  return text;
}
