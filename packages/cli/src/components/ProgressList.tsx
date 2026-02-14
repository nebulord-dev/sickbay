import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const SPINNER_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

function Spinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, []);
  return <Text color="green">{SPINNER_FRAMES[frame]}</Text>;
}

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

interface ProgressListProps {
  items: ProgressItem[];
}

export function ProgressList({ items }: ProgressListProps) {
  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <Box key={item.name}>
          {item.status === "running" ? (
            <Spinner />
          ) : item.status === "done" ? (
            <Text color="green">✓</Text>
          ) : (
            <Text dimColor>○</Text>
          )}
          <Text> {item.name}</Text>
        </Box>
      ))}
    </Box>
  );
}
