import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { ActivityPanel } from './ActivityPanel.js';

import type { ActivityEntry } from './ActivityPanel.js';

const makeEntry = (
  type: ActivityEntry['type'],
  message: string,
  timestamp?: Date,
): ActivityEntry => ({
  timestamp: timestamp ?? new Date('2024-01-01T12:00:00'),
  type,
  message,
});

describe('ActivityPanel', () => {
  it('shows empty state when no entries', () => {
    const { lastFrame } = render(<ActivityPanel entries={[]} availableHeight={10} />);
    expect(lastFrame()).toContain('No activity yet.');
  });

  it('shows message for a single entry', () => {
    const entries = [makeEntry('scan-start', 'Scan started')];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={10} />);
    expect(lastFrame()).toContain('Scan started');
  });

  it('shows timestamp for an entry', () => {
    const date = new Date('2024-01-01T14:30:45');
    const entries = [makeEntry('scan-complete', 'Done', date)];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={10} />);
    // The timestamp should appear in some formatted form
    expect(lastFrame()).toContain('30:45');
  });

  it('limits visible entries to availableHeight', () => {
    const entries = [
      makeEntry('info', 'Entry 1'),
      makeEntry('info', 'Entry 2'),
      makeEntry('info', 'Entry 3'),
      makeEntry('info', 'Entry 4'),
      makeEntry('info', 'Entry 5'),
    ];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={2} />);
    const output = lastFrame() ?? '';
    // With availableHeight=2, shows last 2 entries only
    expect(output).toContain('Entry 4');
    expect(output).toContain('Entry 5');
    expect(output).not.toContain('Entry 1');
    expect(output).not.toContain('Entry 2');
    expect(output).not.toContain('Entry 3');
  });

  it('shows all entries when count is within availableHeight', () => {
    const entries = [makeEntry('scan-start', 'Started'), makeEntry('scan-complete', 'Completed')];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={5} />);
    const output = lastFrame() ?? '';
    expect(output).toContain('Started');
    expect(output).toContain('Completed');
  });

  it('handles regression entry type', () => {
    const entries = [makeEntry('regression', 'Score dropped 10 points')];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={5} />);
    expect(lastFrame()).toContain('Score dropped 10 points');
  });

  it('handles file-change entry type', () => {
    const entries = [makeEntry('file-change', 'src/index.ts changed')];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={5} />);
    expect(lastFrame()).toContain('src/index.ts changed');
  });

  it('handles git-change entry type', () => {
    const entries = [makeEntry('git-change', 'New commits detected')];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={5} />);
    expect(lastFrame()).toContain('New commits detected');
  });

  it('shows the most recent entries when height-limited', () => {
    const entries = Array.from({ length: 10 }, (_, i) => makeEntry('info', `Message ${i + 1}`));
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={3} />);
    const output = lastFrame() ?? '';
    // Should show last 3: Message 8, 9, 10
    expect(output).toContain('Message 8');
    expect(output).toContain('Message 9');
    expect(output).toContain('Message 10');
    expect(output).not.toContain('Message 7');
  });

  it('availableHeight=1 shows only the last entry', () => {
    const entries = [makeEntry('info', 'First'), makeEntry('scan-complete', 'Last')];
    const { lastFrame } = render(<ActivityPanel entries={entries} availableHeight={1} />);
    const output = lastFrame() ?? '';
    expect(output).toContain('Last');
    expect(output).not.toContain('First');
  });
});
