import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import ChatCard from './ChatCard';
import type { ChatSummary } from '../../api/client';
import * as client from '../../api/client';

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

  describe('delete functionality', () => {
    it('does not show delete button when not admin', () => {
      vi.spyOn(client, 'isAdmin').mockReturnValue(false);
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);
      expect(screen.queryByTitle('Delete chat')).not.toBeInTheDocument();
    });

    it('shows delete button for admin users', () => {
      vi.spyOn(client, 'isAdmin').mockReturnValue(true);
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);
      expect(screen.getByTitle('Delete chat')).toBeInTheDocument();
    });

    it('calls onDelete with chat id when delete is confirmed', () => {
      vi.spyOn(client, 'isAdmin').mockReturnValue(true);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);

      const deleteButton = screen.getByTitle('Delete chat');
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('test-chat-123');
    });

    it('does not call onDelete when delete is cancelled', () => {
      vi.spyOn(client, 'isAdmin').mockReturnValue(true);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);

      const deleteButton = screen.getByTitle('Delete chat');
      fireEvent.click(deleteButton);

      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
