import { useState, useEffect, useRef } from "react";
import type { VitalsReport } from "@vitals/core";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatDrawerProps {
  report: VitalsReport;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      className="prose prose-invert prose-sm max-w-none"
      components={{
        code({
          inline,
          className,
          children,
          ...props
        }: {
          inline?: boolean;
          className?: string;
          children?: React.ReactNode;
        }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="rounded-md !bg-black/30 !mt-2 !mb-2"
              customStyle={{ margin: 0, padding: "0.75rem" }}
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code
              className="bg-black/30 px-1.5 py-0.5 rounded text-accent font-mono text-xs"
              {...props}
            >
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return (
            <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          );
        },
        ol({ children }) {
          return (
            <ol className="list-decimal list-inside mb-2 space-y-1">
              {children}
            </ol>
          );
        },
        li({ children }) {
          return <li className="text-sm">{children}</li>;
        },
        strong({ children }) {
          return (
            <strong className="font-semibold text-white">{children}</strong>
          );
        },
        em({ children }) {
          return <em className="italic text-gray-200">{children}</em>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ChatDrawer({ report: _report }: ChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if AI is available
    fetch("/ai/summary", { method: "HEAD" })
      .then((res) => setIsAvailable(res.ok))
      .catch(() => setIsAvailable(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: messages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (isAvailable === false) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-accent text-black rounded shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center text-2xl z-50"
          title="AI Assistant"
        >
          VAI
        </button>
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[35rem] h-[50rem]  bg-surface border border-border rounded-lg shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    d="M9.6 6.112c.322-.816 1.478-.816 1.8 0l.91 2.31a5.8 5.8 0 0 0 3.268 3.268l2.31.91c.816.322.816 1.478 0 1.8l-2.31.91a5.8 5.8 0 0 0-3.268 3.268l-.91 2.31c-.322.816-1.478.816-1.8 0l-.91-2.31a5.8 5.8 0 0 0-3.268-3.268l-2.31-.91c-.816-.322-.816-1.478 0-1.8l2.31-.91A5.8 5.8 0 0 0 8.69 8.422zm8.563-3.382a.363.363 0 0 1 .674 0l.342.866c.221.56.665 1.004 1.225 1.225l.866.342a.363.363 0 0 1 0 .674l-.866.342a2.18 2.18 0 0 0-1.225 1.225l-.342.866a.363.363 0 0 1-.674 0l-.342-.866a2.18 2.18 0 0 0-1.225-1.225l-.867-.342a.363.363 0 0 1 0-.674l.867-.342a2.18 2.18 0 0 0 1.225-1.225z"
                  />
                </svg>
              </span>
              <span className="font-semibold text-sm">AI Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-8">
                Ask me anything about your project health!
                <div className="mt-2 text-xs text-gray-600">
                  Try: "What should I fix first?" or "Explain the security
                  issues"
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-accent text-black font-medium"
                      : "bg-card text-gray-300"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card text-gray-500 px-3 py-2 rounded-lg text-sm">
                  <span className="animate-pulse">⠋ thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your project..."
                disabled={loading}
                className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2 bg-accent text-black rounded text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
