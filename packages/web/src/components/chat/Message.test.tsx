import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
