import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Message from './Message';
import type { Message as MessageType } from '@convovault/shared';

describe('Message', () => {
  const userMessage: MessageType = {
    id: 'msg-0',
    index: 0,
    role: 'user',
    content: [{ type: 'text', content: 'Hello, Claude!' }],
  };

  const assistantMessage: MessageType = {
    id: 'msg-1',
    index: 1,
    role: 'assistant',
    content: [{ type: 'text', content: 'Hello! How can I help you today?' }],
  };

  // Long message (> 500 chars) for testing fold behavior
  const longMessage: MessageType = {
    id: 'msg-long',
    index: 3,
    role: 'assistant',
    content: [{ type: 'text', content: 'A'.repeat(600) }],
  };

  const messageWithCode: MessageType = {
    id: 'msg-2',
    index: 2,
    role: 'assistant',
    content: [
      { type: 'text', content: 'Here is some code:' },
      { type: 'code', content: 'const x = 1;', language: 'typescript' },
    ],
  };

  it('renders user message with correct styling', () => {
    render(<Message message={userMessage} />);

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Hello, Claude!')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('renders assistant message with correct styling', () => {
    render(<Message message={assistantMessage} />);

    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders code blocks with syntax highlighting indicator', () => {
    render(<Message message={messageWithCode} />);

    expect(screen.getByText('Here is some code:')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('sets correct message ID for deep linking', () => {
    const { container } = render(<Message message={userMessage} />);

    const messageElement = container.querySelector('#msg-0');
    expect(messageElement).toBeInTheDocument();
  });

  it('shows fold button for long messages', () => {
    render(<Message message={longMessage} />);

    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });

  it('does not show fold button for short messages', () => {
    render(<Message message={userMessage} />);

    expect(screen.queryByRole('button', { name: /fold|expand/i })).not.toBeInTheDocument();
  });

  it('long messages are collapsed by default', () => {
    render(<Message message={longMessage} />);

    // Should show preview with "(click to expand)"
    expect(screen.getByText(/click to expand/i)).toBeInTheDocument();
  });

  it('clicking expand button shows full content', () => {
    render(<Message message={longMessage} />);

    // Click expand
    fireEvent.click(screen.getByRole('button', { name: /expand/i }));

    // Should show full content (600 A's)
    expect(screen.getByText('A'.repeat(600))).toBeInTheDocument();
    // Button should now say "Fold"
    expect(screen.getByRole('button', { name: /fold/i })).toBeInTheDocument();
  });

  it('responds to globalFoldState all-unfolded', () => {
    const { rerender } = render(<Message message={longMessage} globalFoldState={null} />);

    // Initially collapsed
    expect(screen.getByText(/click to expand/i)).toBeInTheDocument();

    // Set global unfold
    rerender(<Message message={longMessage} globalFoldState="all-unfolded" />);

    // Should now be expanded
    expect(screen.getByText('A'.repeat(600))).toBeInTheDocument();
  });
});
