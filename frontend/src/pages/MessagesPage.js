import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { ArrowLeft, Send, Search, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, api } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api().get('/conversations');
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [api]);

  const fetchMessages = useCallback(async (convId) => {
    try {
      const response = await api().get(`/conversations/${convId}/messages`);
      setMessages(response.data);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [api]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchConversations();
      setLoading(false);
    };
    init();
  }, [fetchConversations]);

  useEffect(() => {
    if (conversationId) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
        fetchMessages(conversationId);
      } else if (conversations.length > 0) {
        // Try to fetch the conversation directly
        api().get(`/conversations/${conversationId}/messages`)
          .then(res => {
            setMessages(res.data);
            const matchingConv = conversations.find(c => c.id === conversationId);
            if (matchingConv) setSelectedConversation(matchingConv);
          })
          .catch(() => navigate('/messages'));
      }
    } else {
      setSelectedConversation(null);
      setMessages([]);
    }
  }, [conversationId, conversations, fetchMessages, navigate, api]);

  // Poll for new messages
  useEffect(() => {
    if (selectedConversation) {
      pollInterval.current = setInterval(() => {
        fetchMessages(selectedConversation.id);
      }, 3000);
    }
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [selectedConversation, fetchMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      const response = await api().post(`/conversations/${selectedConversation.id}/messages`, {
        content: newMessage.trim()
      });
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      setTimeout(scrollToBottom, 100);
      
      // Update conversation list
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id 
          ? { ...c, last_message: newMessage.trim(), last_message_at: new Date().toISOString() }
          : c
      ));
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv => 
    conv.other_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout hideRightSidebar>
      <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] flex bg-white rounded-3xl overflow-hidden shadow-sm" data-testid="messages-page">
        {/* Conversations List */}
        <div className={`w-full md:w-80 border-r border-black/5 flex flex-col ${selectedConversation && 'hidden md:flex'}`}>
          <div className="p-4 border-b border-black/5">
            <h2 className="text-xl font-bold font-['Manrope'] mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-full bg-muted/50 border-0"
                data-testid="search-conversations"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Start chatting with someone!</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className={`w-full p-3 flex items-center gap-3 rounded-2xl transition-colors ${
                      selectedConversation?.id === conv.id 
                        ? 'bg-muted' 
                        : 'hover:bg-muted/50'
                    }`}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conv.other_user?.avatar} />
                        <AvatarFallback className="bg-muted font-semibold">
                          {conv.other_user?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate">{conv.other_user?.full_name}</p>
                        <span className="text-xs text-muted-foreground">
                          {conv.last_message_at && formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message || 'Start a conversation'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${!selectedConversation && 'hidden md:flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-black/5 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden rounded-full"
                  onClick={() => navigate('/messages')}
                  data-testid="back-to-conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar 
                  className="w-10 h-10 cursor-pointer"
                  onClick={() => navigate(`/profile/${selectedConversation.other_user?.username}`)}
                >
                  <AvatarImage src={selectedConversation.other_user?.avatar} />
                  <AvatarFallback className="bg-muted font-semibold">
                    {selectedConversation.other_user?.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div 
                  className="cursor-pointer"
                  onClick={() => navigate(`/profile/${selectedConversation.other_user?.username}`)}
                >
                  <p className="font-semibold">{selectedConversation.other_user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">@{selectedConversation.other_user?.username}</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const isOwn = message.sender_id === currentUser?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                        style={{ animationDelay: `${index * 0.02}s` }}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`message-bubble px-4 py-3 rounded-3xl ${
                            isOwn 
                              ? 'bg-black text-white rounded-br-lg' 
                              : 'bg-muted text-foreground rounded-bl-lg'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-black/5">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-full bg-muted/50 border-0 focus:ring-2 focus:ring-black"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="rounded-full bg-black text-white hover:bg-black/90 w-12 h-12 p-0"
                    data-testid="send-message-btn"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold font-['Manrope'] mb-2">Your Messages</h3>
                <p className="text-muted-foreground max-w-sm">
                  Select a conversation or start a new one by visiting someone's profile
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
