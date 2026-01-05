import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import ChatCard from './ChatCard';
import type { ChatSummary } from '../../api/client';

const mockChat: ChatSummary = {
  id: 'test-chat-123',
  source: 'claude-web',
  sourceUrl: 'https://claude.ai/share/abc123',
  title: 'Test Conversation Title',
  messageCount: 42,
  wordCount: 1500,
  fetchedAt: Date.now(),
};

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ChatCard', () => {
  it('renders chat title', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    expect(screen.getByText('Test Conversation Title')).toBeInTheDocument();
  });

  it('renders message count', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    expect(screen.getByText('42 messages')).toBeInTheDocument();
  });

  it('renders word count', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    expect(screen.getByText('1,500 words')).toBeInTheDocument();
  });

  it('renders source badge', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    expect(screen.getByText('claude-web')).toBeInTheDocument();
  });

  it('links to chat page', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/chat/test-chat-123');
  });
});
