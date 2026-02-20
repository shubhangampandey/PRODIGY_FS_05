import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import PostCard from '../components/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Search, Users, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setUsers([]);
      setPosts([]);
      return;
    }

    setLoading(true);
    try {
      // Check if searching by hashtag
      if (searchQuery.startsWith('#')) {
        const tag = searchQuery.slice(1);
        const postsRes = await api().get(`/search/tags/${tag}`);
        setPosts(postsRes.data);
        setUsers([]);
      } else {
        const [usersRes, postsRes] = await Promise.all([
          api().get(`/search/users?q=${encodeURIComponent(searchQuery)}`),
          api().get(`/search/posts?q=${encodeURIComponent(searchQuery)}`)
        ]);
        setUsers(usersRes.data);
        setPosts(postsRes.data);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams, performSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  const handleFollow = async (userId) => {
    try {
      const user = users.find(u => u.id === userId);
      if (user?.is_following) {
        await api().delete(`/follow/${userId}`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_following: false } : u));
        toast.success('Unfollowed');
      } else {
        await api().post(`/follow/${userId}`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_following: true } : u));
        toast.success('Following!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const clearSearch = () => {
    setQuery('');
    setSearchParams({});
    setUsers([]);
    setPosts([]);
  };

  return (
    <MainLayout>
      <div className="max-w-[700px] mx-auto" data-testid="search-page">
        {/* Search Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 -mx-4 px-4 py-4">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, posts, or #tags..."
              className="w-full pl-12 pr-12 h-12 rounded-full bg-muted/50 border-0 focus:ring-2 focus:ring-black text-base"
              data-testid="search-input"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="clear-search-btn"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>

        {/* Results */}
        <div className="py-6">
          {!searchParams.get('q') ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2 font-['Manrope']">Search Lumina</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Find people, posts, and topics. Use # to search for tags.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-4">
              {Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full bg-muted/50 p-1 rounded-full mb-6">
                <TabsTrigger 
                  value="all"
                  className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  data-testid="search-all-tab"
                >
                  All
                </TabsTrigger>
                <TabsTrigger 
                  value="people"
                  className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  data-testid="search-people-tab"
                >
                  <Users className="w-4 h-4 mr-2" />
                  People ({users.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="posts"
                  className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  data-testid="search-posts-tab"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Posts ({posts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                {users.length === 0 && posts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No results found for "{searchParams.get('q')}"
                  </div>
                ) : (
                  <>
                    {users.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          People
                        </h3>
                        <div className="space-y-2">
                          {users.slice(0, 3).map((user) => (
                            <UserResultCard 
                              key={user.id} 
                              user={user} 
                              navigate={navigate}
                              onFollow={handleFollow}
                            />
                          ))}
                          {users.length > 3 && (
                            <button
                              onClick={() => setActiveTab('people')}
                              className="w-full text-center py-2 text-sm text-blue-600 hover:underline"
                            >
                              See all {users.length} people
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {posts.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Posts
                        </h3>
                        <div className="space-y-4">
                          {posts.slice(0, 3).map((post) => (
                            <PostCard 
                              key={post.id} 
                              post={post}
                              onUpdate={handlePostUpdated}
                              onDelete={handlePostDeleted}
                            />
                          ))}
                          {posts.length > 3 && (
                            <button
                              onClick={() => setActiveTab('posts')}
                              className="w-full text-center py-2 text-sm text-blue-600 hover:underline"
                            >
                              See all {posts.length} posts
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="people" className="space-y-2">
                {users.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No people found
                  </div>
                ) : (
                  users.map((user, index) => (
                    <div 
                      key={user.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <UserResultCard 
                        user={user} 
                        navigate={navigate}
                        onFollow={handleFollow}
                      />
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="posts" className="space-y-4">
                {posts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No posts found
                  </div>
                ) : (
                  posts.map((post, index) => (
                    <div 
                      key={post.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <PostCard 
                        post={post}
                        onUpdate={handlePostUpdated}
                        onDelete={handlePostDeleted}
                      />
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function UserResultCard({ user, navigate, onFollow }) {
  return (
    <div
      className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
      data-testid={`search-user-${user.id}`}
    >
      <div 
        className="flex items-center gap-3 cursor-pointer flex-1"
        onClick={() => navigate(`/profile/${user.username}`)}
      >
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar} />
          <AvatarFallback className="bg-muted font-semibold">
            {user.full_name?.charAt(0) || user.username?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{user.full_name}</p>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        </div>
      </div>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          onFollow(user.id);
        }}
        size="sm"
        className={`rounded-full ${
          user.is_following
            ? 'bg-muted text-foreground hover:bg-red-50 hover:text-red-600'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        data-testid={`search-follow-btn-${user.id}`}
      >
        {user.is_following ? 'Unfollow' : 'Follow'}
      </Button>
    </div>
  );
}
