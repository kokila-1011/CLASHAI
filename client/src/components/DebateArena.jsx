/**
 * DebateArena.jsx
 *
 * Scrolling list of ChatBubbles.  The last bubble in `messages` may still be
 * accumulating chunks (isStreaming flag).
 *
 * Props:
 *   messages  : Array<{
 *                 id         : string,
 *                 agentId    : string,
 *                 text       : string,
 *                 isStreaming: boolean,
 *                 sources?   : Array<{ title: string, url: string }>
 *               }>
 *   bottomRef : React ref to scroll-anchor div
 */

import ChatBubble from "./ChatBubble";

export default function DebateArena({ messages, bottomRef }) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          agentId={msg.agentId}
          text={msg.text}
          isStreaming={msg.isStreaming}
          sources={msg.sources}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
