import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import ChatCard from './ChatCard';
import type { ChatSummary } from '../../api/client';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(),
}));

// Mock the api client
vi.mock('../../api/client', () => ({
  api: {
    toggleFavorite: vi.fn(),
  },
}));

import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';

const mockUseAuth = vi.mocked(useAuth);
const mockApi = vi.mocked(api);

const mockChat: ChatSummary = {
  id: 'test-chat-123',
  source: 'claude-web',
  sourceUrl: 'https://claude.ai/share/abc123',
  title: 'Test Conversation Title',
  messageCount: 42,
  wordCount: 1500,
  fetchedAt: Date.now(),
  userId: 'owner-user-123',
};

const mockChatWithParticipants: ChatSummary = {
  ...mockChat,
  participants: {
    user: 'Shreyas',
    assistant: 'Claude',
  },
};

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const mockAuthNotLoggedIn = () => {
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: false,
  });
};

const mockAuthAsOwner = () => {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'owner-user-123',
      email: 'owner@example.com',
      name: 'Owner',
      picture: 'https://example.com/pic.jpg',
      role: 'user',
    },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: false,
  });
};

const mockAuthAsAdmin = () => {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'admin-user-456',
      email: 'admin@example.com',
      name: 'Admin',
      picture: 'https://example.com/pic.jpg',
      role: 'admin',
    },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: true,
  });
};

const mockAuthAsOtherUser = () => {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'other-user-789',
      email: 'other@example.com',
      name: 'Other',
      picture: 'https://example.com/pic.jpg',
      role: 'user',
    },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: false,
  });
};

describe('ChatCard', () => {
  beforeEach(() => {
    mockAuthNotLoggedIn();
  });

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

  it('renders participants when available', () => {
    renderWithRouter(<ChatCard chat={mockChatWithParticipants} />);
    expect(screen.getByText('Shreyas & Claude')).toBeInTheDocument();
  });

  it('does not render participants when not available', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    expect(screen.queryByText(/&/)).not.toBeInTheDocument();
  });

  it('renders import date', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    expect(screen.getByText(/Imported/)).toBeInTheDocument();
  });

  it('links to chat page', () => {
    renderWithRouter(<ChatCard chat={mockChat} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/chat/test-chat-123');
  });

  describe('delete functionality', () => {
    it('does not show delete button when not logged in', () => {
      mockAuthNotLoggedIn();
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);
      expect(screen.queryByTitle('Delete chat')).not.toBeInTheDocument();
    });

    it('shows delete button for chat owner', () => {
      mockAuthAsOwner();
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);
      expect(screen.getByTitle('Delete chat')).toBeInTheDocument();
    });

    it('shows delete button for admin users', () => {
      mockAuthAsAdmin();
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);
      expect(screen.getByTitle('Delete chat')).toBeInTheDocument();
    });

    it('does not show delete button for non-owner non-admin users', () => {
      mockAuthAsOtherUser();
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);
      expect(screen.queryByTitle('Delete chat')).not.toBeInTheDocument();
    });

    it('calls onDelete with chat id when delete is confirmed', () => {
      mockAuthAsOwner();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);

      const deleteButton = screen.getByTitle('Delete chat');
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('test-chat-123');
    });

    it('does not call onDelete when delete is cancelled', () => {
      mockAuthAsOwner();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onDelete = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onDelete={onDelete} />);

      const deleteButton = screen.getByTitle('Delete chat');
      fireEvent.click(deleteButton);

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('favorite functionality', () => {
    it('shows heart icon even when not logged in', () => {
      mockAuthNotLoggedIn();
      renderWithRouter(<ChatCard chat={mockChat} />);
      expect(screen.getByTitle(/favorites/i)).toBeInTheDocument();
    });

    it('shows heart icon when logged in', () => {
      mockAuthAsOwner();
      renderWithRouter(<ChatCard chat={mockChat} />);
      expect(screen.getByTitle(/favorites/i)).toBeInTheDocument();
    });

    it('calls onLoginRequired when heart clicked while not logged in', async () => {
      mockAuthNotLoggedIn();
      const onLoginRequired = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onLoginRequired={onLoginRequired} />);

      const heartBtn = screen.getByTitle(/favorites/i);
      await fireEvent.click(heartBtn);

      expect(onLoginRequired).toHaveBeenCalled();
      expect(mockApi.toggleFavorite).not.toHaveBeenCalled();
    });

    it('renders filled heart when isFavorite is true', () => {
      mockAuthAsOwner();
      const favoriteChat = { ...mockChat, isFavorite: true };
      renderWithRouter(<ChatCard chat={favoriteChat} />);

      const heartBtn = screen.getByTitle('Remove from favorites');
      const svg = heartBtn.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'currentColor');
    });

    it('renders outline heart when isFavorite is false', () => {
      mockAuthAsOwner();
      renderWithRouter(<ChatCard chat={mockChat} />);

      const heartBtn = screen.getByTitle('Add to favorites');
      const svg = heartBtn.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('calls api.toggleFavorite when clicked', async () => {
      mockAuthAsOwner();
      mockApi.toggleFavorite.mockResolvedValue({ favorite: true });

      renderWithRouter(<ChatCard chat={mockChat} />);
      const heartBtn = screen.getByTitle('Add to favorites');

      await fireEvent.click(heartBtn);

      expect(mockApi.toggleFavorite).toHaveBeenCalledWith('test-chat-123', true);
      expect(screen.getByTitle('Remove from favorites')).toBeInTheDocument();
    });

    it('rolls back state on api failure', async () => {
      mockAuthAsOwner();
      mockApi.toggleFavorite.mockRejectedValue(new Error('API Error'));

      // Spy on console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      renderWithRouter(<ChatCard chat={mockChat} />);
      const heartBtn = screen.getByTitle('Add to favorites');

      await fireEvent.click(heartBtn);

      expect(mockApi.toggleFavorite).toHaveBeenCalled();
      // Should revert back to "Add to favorites" after failure
      await waitFor(() => {
        expect(screen.getByTitle('Add to favorites')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('bookmark functionality', () => {
    it('shows bookmark icon even when not logged in', () => {
      mockAuthNotLoggedIn();
      renderWithRouter(<ChatCard chat={mockChat} />);
      expect(screen.getByTitle(/bookmark/i)).toBeInTheDocument();
    });

    it('shows bookmark icon when logged in', () => {
      mockAuthAsOwner();
      renderWithRouter(<ChatCard chat={mockChat} />);
      expect(screen.getByTitle(/bookmark/i)).toBeInTheDocument();
    });

    it('calls onLoginRequired when bookmark clicked while not logged in', async () => {
      mockAuthNotLoggedIn();
      const onLoginRequired = vi.fn();
      renderWithRouter(<ChatCard chat={mockChat} onLoginRequired={onLoginRequired} />);

      const bookmarkBtn = screen.getByTitle(/bookmark/i);
      await fireEvent.click(bookmarkBtn);

      expect(onLoginRequired).toHaveBeenCalled();
    });

    it('calls onToggleBookmark when clicked', async () => {
      mockAuthAsOwner();
      const onToggleBookmark = vi.fn();
      renderWithRouter(
        <ChatCard
          chat={mockChat}
          isBookmarked={false}
          onToggleBookmark={onToggleBookmark}
        />
      );

      const bookmarkBtn = screen.getByTitle('Bookmark chat');
      fireEvent.click(bookmarkBtn);

      expect(onToggleBookmark).toHaveBeenCalledWith('test-chat-123');
    });

    it('renders correct state based on isBookmarked prop', () => {
      mockAuthAsOwner();
      const { rerender } = render(
        <BrowserRouter>
          <ChatCard chat={mockChat} isBookmarked={false} />
        </BrowserRouter>
      );
      expect(screen.getByTitle('Bookmark chat')).toBeInTheDocument();

      rerender(
        <BrowserRouter>
          <ChatCard chat={mockChat} isBookmarked={true} />
        </BrowserRouter>
      );
      expect(screen.getByTitle('Remove bookmark')).toBeInTheDocument();
    });
  });
});
