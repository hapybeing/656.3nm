import React from 'react';

export interface KineticTextProps {
  text: string;
  font?: 'bricolage' | 'roboto-flex';
  as?: 'span' | 'div' | 'h1' | 'h2' | 'p';
  className?: string;
  charStartIndex?: number;
  ariaLabel?: string;
}

/**
 * Pass-2-ready kinetic typography primitive.
 * Splits text declaratively in React JSX into non-breaking word wrappers and
 * individual character spans bound to CSS custom properties (--opsz, --wdth, --wght, --slnt).
 * Pass 1 holds static poster defaults; Passes 2–4 drive numeric CSS variables directly.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  text,
  font = 'bricolage',
  as: Tag = 'span',
  className = '',
  charStartIndex = 0,
  ariaLabel,
}) => {
  const fontClass = font === 'roboto-flex' ? 'k-font-roboto-flex' : 'k-font-bricolage';
  const words = text.split(' ');
  let runningIndex = charStartIndex;

  return (
    <Tag
      className={`${fontClass} ${className}`.trim()}
      aria-label={ariaLabel ?? text}
    >
      {words.map((word, wordIdx) => {
        const chars = Array.from(word);
        return (
          <React.Fragment key={`w-${wordIdx}-${word}`}>
            <span className="k-word" aria-hidden="true">
              {chars.map((char, cIdx) => {
                const globalIndex = runningIndex++;
                return (
                  <span
                    key={`c-${wordIdx}-${cIdx}`}
                    className="k-char"
                    data-char-index={globalIndex}
                  >
                    {char}
                  </span>
                );
              })}
            </span>
            {wordIdx < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </Tag>
  );
};
