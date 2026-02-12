import React, { useState, useEffect } from "react";

interface CRTOverlayProps {
  onClose: () => void;
}

export function CRTOverlay({ onClose }: CRTOverlayProps) {
  const [phase, setPhase] = useState<"boot" | "title" | "complete">("boot");
  const [bootText, setBootText] = useState("");
  const [titleText, setTitleText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const bootSequence = [
    // "SYSTEM INITIALIZING...",
    "LOADING HEALTH DIAGNOSTICS...",
    "ANALYZING CODEBASE VITALS...",
    // "DIAGNOSTICS COMPLETE.",
    // "",
    // "PRESENTING:",
  ];

  // Boot sequence typing
  useEffect(() => {
    if (phase !== "boot") return;

    let currentLine = 0;
    let currentChar = 0;
    let text = "";

    const typeNextChar = () => {
      if (currentLine >= bootSequence.length) {
        setTimeout(() => setPhase("title"), 200);
        return;
      }

      const line = bootSequence[currentLine];

      if (currentChar < line.length) {
        text += line[currentChar];
        setBootText(text);
        currentChar++;
        setTimeout(typeNextChar, 30 + Math.random() * 40);
      } else {
        text += "\n";
        setBootText(text);
        currentLine++;
        currentChar = 0;
        setTimeout(typeNextChar, 200);
      }
    };

    const startDelay = setTimeout(typeNextChar, 300);
    return () => clearTimeout(startDelay);
  }, [phase]);

  // Title reveal
  useEffect(() => {
    if (phase !== "title") return;

    const title = "VITALS";
    let currentChar = 0;

    const typeTitle = () => {
      if (currentChar <= title.length) {
        setTitleText(title.substring(0, currentChar));
        currentChar++;
        setTimeout(typeTitle, 150);
      } else {
        setTimeout(() => setPhase("complete"), 300);
      }
    };

    const startDelay = setTimeout(typeTitle, 400);
    return () => clearTimeout(startDelay);
  }, [phase]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // ESC or click to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black cursor-pointer"
      onClick={onClose}
      style={{
        animation: "crt-flicker 0.15s ease-in-out",
      }}
    >
      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0, 255, 0, 0.15) 0px, transparent 1px, transparent 2px, rgba(0, 255, 0, 0.15) 3px)",
          animation: "scanline 8s linear infinite",
        }}
      />

      {/* CRT curve effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.7) 100%)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            "inset 0 0 200px rgba(0, 0, 0, 0.9), inset 0 0 100px rgba(0, 0, 0, 0.8)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-4xl">
        {/* Boot sequence */}
        {phase === "boot" && (
          <pre
            className="text-green-400 text-left font-mono text-sm md:text-base whitespace-pre-wrap"
            style={{
              textShadow:
                "0 0 10px rgba(0, 255, 0, 0.8), 0 0 20px rgba(0, 255, 0, 0.5)",
              fontFamily: '"Jetbrains Mono", Courier, monospace',
            }}
          >
            {bootText}
            {showCursor && (
              <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse" />
            )}
          </pre>
        )}

        {/* Big title reveal */}
        {(phase === "title" || phase === "complete") && (
          <div className="space-y-8">
            <div
              className="text-green-400 font-bold tracking-[0.3em] leading-none"
              style={{
                fontSize: "clamp(4rem, 15vw, 12rem)",
                textShadow: `
                  0 0 10px rgba(0, 255, 0, 0.8),
                  0 0 20px rgba(0, 255, 0, 0.6),
                  0 0 30px rgba(0, 255, 0, 0.4),
                  0 0 40px rgba(0, 255, 0, 0.3),
                  2px 2px 0px rgba(255, 0, 255, 0.4),
                  -2px -2px 0px rgba(0, 255, 255, 0.4)
                `,
                fontFamily: '"Jetbrains Mono", Courier, monospace',
                letterSpacing: "0.15em",
                animation:
                  phase === "title"
                    ? "title-flicker"
                    : "title-glow ",
              }}
            >
              {titleText}
              {phase === "title" && showCursor && (
                <span className="inline-block w-8 md:w-16 h-16 md:h-32 bg-green-400 ml-4" />
              )}
            </div>

            {phase === "complete" && (
              <div
                className="text-green-400/60 text-lg md:text-2xl tracking-widest"
                style={{
                  textShadow: "0 0 10px rgba(0, 255, 0, 0.5)",
                  fontFamily: '"Jetbrains Mono", Courier, monospace',
                  animation: "fade-in 0.5s ease-in",
                }}
              >
                PROJECT HEALTH DASHBOARD
              </div>
            )}

            {phase === "complete" && (
              <div
                className="text-green-400/40 text-xs md:text-sm mt-16"
                style={{
                  textShadow: "0 0 5px rgba(0, 255, 0, 0.3)",
                  fontFamily: '"Jetbrains Mono", Courier, monospace',
                  animation: "fade-in 1s ease-in",
                }}
              >
                [ PRESS ANY KEY TO CONTINUE ]
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes crt-flicker {
          0% { opacity: 0; }
          10% { opacity: 1; }
          20% { opacity: 0.8; }
          30% { opacity: 1; }
          100% { opacity: 1; }
        }

        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }

        @keyframes title-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        @keyframes title-glow {
          0%, 100% { 
            filter: brightness(1);
            transform: scale(1);
          }
          50% { 
            filter: brightness(1.2);
            transform: scale(1.02);
          }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
