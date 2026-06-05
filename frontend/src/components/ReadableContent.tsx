"use client";

import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReadableContentProps {
  content: string;
  className?: string;
}

const sectionPattern = /^([一二三四五六七八九十]+、)\s*(.+)$/;
const subsectionPattern = /^(\d+[.、])\s*(.+)$/;
const courseTitlePattern = /^(【.+?】系列课程.+)$/;
const recordingTitlePattern = /^(录制[：:].+)$/;

function improveStructure(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || /^#{1,6}\s/.test(trimmed) || /^```/.test(trimmed)) {
        return line;
      }

      const section = trimmed.match(sectionPattern);
      if (section) return `## ${section[1]}${section[2]}`;

      const subsection = trimmed.match(subsectionPattern);
      if (subsection) return `### ${subsection[1]} ${subsection[2]}`;

      if (courseTitlePattern.test(trimmed) || recordingTitlePattern.test(trimmed)) {
        return `## ${trimmed}`;
      }

      return line;
    })
    .join("\n")
    .replace(/\n(#{2,3}\s)/g, "\n\n$1")
    .replace(/(#{2,3}\s[^\n]+)\n/g, "$1\n\n");
}

export default function ReadableContent({ content, className = "" }: ReadableContentProps) {
  return (
    <article
      className={`prose prose-neutral max-w-none text-[17px] leading-8
        prose-headings:text-foreground prose-headings:font-semibold
        prose-h2:mt-12 prose-h2:mb-5 prose-h2:border-b prose-h2:border-border prose-h2:pb-3 prose-h2:text-xl
        prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-lg
        prose-p:my-4 prose-p:text-foreground/90
        prose-strong:text-foreground prose-a:text-primary
        prose-li:my-1 prose-li:text-foreground/90
        prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
        prose-img:my-8 prose-img:max-h-[70vh] prose-img:rounded-lg prose-img:object-contain prose-img:shadow-sm
        ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-4 whitespace-pre-line break-words leading-8 text-foreground/90">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 break-all font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
            >
              {children}
              <ExternalLink className="inline size-3.5 shrink-0" aria-hidden="true" />
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || "正文插图"}
              loading="lazy"
              className="my-8 max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
            />
          ),
          hr: () => <hr className="my-10 border-border" />,
        }}
      >
        {improveStructure(content)}
      </ReactMarkdown>
    </article>
  );
}
