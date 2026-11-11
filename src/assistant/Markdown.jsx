import { Fragment, useMemo } from 'react';
import { parseMarkdown } from './markdown.js';

function Inline({ nodes }) {
  return nodes.map((node, i) => {
    if (node.type === 'text') return <Fragment key={i}>{node.text}</Fragment>;
    if (node.type === 'code') return <code key={i}>{node.text}</code>;
    if (node.type === 'strong') return <strong key={i}><Inline nodes={node.children} /></strong>;
    if (node.type === 'em') return <em key={i}><Inline nodes={node.children} /></em>;
    if (node.type === 'link') {
      return <a key={i} href={node.href} target="_blank" rel="noopener noreferrer"><Inline nodes={node.children} /></a>;
    }
    return null;
  });
}

// Renders the safe Markdown subset as React elements. No dangerouslySetInnerHTML anywhere.
export default function Markdown({ text }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        if (block.type === 'pre') return <pre key={i}><code>{block.text}</code></pre>;
        if (block.type === 'h') return <p key={i} className="prose-h"><strong><Inline nodes={block.children} /></strong></p>;
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type;
          return <List key={i}>{block.items.map((item, j) => <li key={j}><Inline nodes={item} /></li>)}</List>;
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>{j > 0 && <br />}<Inline nodes={line} /></Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
