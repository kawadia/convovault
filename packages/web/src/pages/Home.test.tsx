/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './Home';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

// Mock dependencies
vi.mock('../api/client', () => ({
    api: {
        listChats: vi.fn(),
        getSocialCounts: vi.fn(),
        deleteChat: vi.fn(),
        search: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleBookmark: vi.fn(),
    },
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Setup QueryClient
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const renderWithProviders = (component: React.ReactNode) => {
    const queryClient = createTestQueryClient();
    return {
        ...render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>{component}</BrowserRouter>
            </QueryClientProvider>
        ),
        queryClient,
    };
};

describe('Home Page', () => {
    const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        picture: 'pic.jpg',
        role: 'user',
    };

    const mockChats = [
        {
            id: 'chat-1',
            title: 'Chat 1',
            fetchedAt: Date.now(),
            messageCount: 10,
            wordCount: 100,
            userId: 'user-123', // Owned by mockUser
        },
        {
            id: 'chat-2',
            title: 'Chat 2',
            fetchedAt: Date.now() - 1000,
            messageCount: 5,
            wordCount: 50,
            userId: 'other-user',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as any).mockReturnValue({
            user: mockUser,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        });
        (api.listChats as any).mockResolvedValue({ chats: mockChats });
        (api.getSocialCounts as any).mockResolvedValue({ counts: {} });
    });

    it('renders list of chats', async () => {
        renderWithProviders(<Home />);

        await waitFor(() => {
            expect(screen.getByText('Chat 1')).toBeInTheDocument();
            expect(screen.getByText('Chat 2')).toBeInTheDocument();
        });
    });

    it('deletes a chat and refreshes the list', async () => {
        let currentChats = [...mockChats];
        (api.listChats as any).mockImplementation(() => Promise.resolve({ chats: currentChats }));

        (api.deleteChat as any).mockImplementation((id: string) => {
            currentChats = currentChats.filter(c => c.id !== id);
            return Promise.resolve({ deleted: true });
        });

        renderWithProviders(<Home />);

        // Wait for chats to load
        await waitFor(() => {
            expect(screen.getByText('Chat 1')).toBeInTheDocument();
        });

        // Mock confirm dialog
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        // Find and click delete button for Chat 1
        // Note: The delete button is only visible on hover in the real UI, 
        // but in tests checking for the button presence is often enough if logic allows rendering.
        // However, ChatCard implementation renders it conditionally: {canDelete && onDelete && (...)}
        // It has opacity-0 group-hover:opacity-100 logic but it is IN the DOM.
        const deleteButtons = screen.getAllByTitle('Delete chat');
        expect(deleteButtons).toHaveLength(1); // Only one owned chat

        // Click delete
        fireEvent.click(deleteButtons[0]);

        // Verify api call
        await waitFor(() => {
            expect(api.deleteChat).toHaveBeenCalledWith('chat-1');
        });

        // Verify list refresh (invalidation)
        // The query key in Home is ['chats', user.id]
        // The mutation invalidates ['chats']
        // Verify that api.listChats was called a second time
        // Verify list refresh (invalidation) happened
        // Logic: Should be called initial + refetch. Might be more due to lifecycle.
        await waitFor(() => {
            expect((api.listChats as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        // Verify Chat 1 is gone from UI
        await waitFor(() => {
            expect(screen.queryByText('Chat 1')).not.toBeInTheDocument();
        });
    });
});
