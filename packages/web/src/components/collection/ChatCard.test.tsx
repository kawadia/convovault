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
  favoriteCount: 5,
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
    vi.clearAllMocks();
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
    });

    it('renders correct state based on isFavorite prop', () => {
      mockAuthAsOwner();
      const { rerender } = render(
        <BrowserRouter>
          <ChatCard chat={mockChat} isFavorite={false} />
        </BrowserRouter>
      );
      expect(screen.getByTitle('Add to favorites')).toBeInTheDocument();

      rerender(
        <BrowserRouter>
          <ChatCard chat={mockChat} isFavorite={true} />
        </BrowserRouter>
      );
      expect(screen.getByTitle('Remove from favorites')).toBeInTheDocument();
    });

    it('calls onToggleFavorite when clicked', async () => {
      mockAuthAsOwner();
      const onToggleFavorite = vi.fn();
      renderWithRouter(
        <ChatCard chat={mockChat} isFavorite={false} onToggleFavorite={onToggleFavorite} />
      );

      const heartBtn = screen.getByTitle('Add to favorites');
      await fireEvent.click(heartBtn);

      expect(onToggleFavorite).toHaveBeenCalledWith('test-chat-123');
    });

    it('renders the favorite count when provided', () => {
      renderWithRouter(<ChatCard chat={mockChat} favoriteCount={12} />);
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('does not render favorite count when it is 0', () => {
      renderWithRouter(<ChatCard chat={mockChat} favoriteCount={0} />);
      expect(screen.queryByText('0')).not.toBeInTheDocument();
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
