import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import PostCard from '../components/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { TrendingUp, Hash, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function ExplorePage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trending');

  const fetchExploreData = useCallback(async () => {
    try {
      setLoading(true);
      const [postsRes, tagsRes, usersRes] = await Promise.all([
        api().get('/trending/posts'),
        api().get('/trending/tags'),
        api().get('/suggested-users')
      ]);
      setPosts(postsRes.data);
      setTags(tagsRes.data);
      setSuggestedUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching explore data:', error);
      toast.error('Failed to load explore page');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchExploreData();
  }, [fetchExploreData]);

  const handleFollow = async (userId) => {
    try {
      await api().post(`/follow/${userId}`);
      setSuggestedUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_following: true } : u
      ));
      toast.success('Following!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to follow');
    }
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <MainLayout>
      <div className="max-w-[900px] mx-auto" data-testid="explore-page">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 -mx-4 px-4 py-4">
          <h1 className="text-2xl font-bold tracking-tight font-['Manrope'] mb-4">Explore</h1>
          
          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-full">
            <button
              onClick={() => setActiveTab('trending')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'trending' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="explore-trending-tab"
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'tags' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="explore-tags-tab"
            >
              <Hash className="w-4 h-4" />
              Tags
            </button>
            <button
              onClick={() => setActiveTab('people')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'people' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="explore-people-tab"
            >
              <Users className="w-4 h-4" />
              People
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="py-6">
          {loading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-3xl" />
              ))}
            </div>
          ) : (
            <>
              {/* Trending Posts */}
              {activeTab === 'trending' && (
                <div className="space-y-4">
                  {posts.length === 0 ? (
                    <div className="text-center py-20">
                      <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No trending posts yet</p>
                    </div>
                  ) : (
                    posts.map((post, index) => (
                      <div 
                        key={post.id}
                        className="animate-fadeIn"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <PostCard 
                          post={post}
                          onUpdate={handlePostUpdated}
                          onDelete={handlePostDeleted}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Trending Tags */}
              {activeTab === 'tags' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {tags.length === 0 ? (
                    <div className="col-span-full text-center py-20">
                      <Hash className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No trending tags yet</p>
                    </div>
                  ) : (
                    tags.map((tag, index) => (
                      <button
                        key={tag.tag}
                        onClick={() => navigate(`/search?q=%23${tag.tag}`)}
                        className="bg-white rounded-3xl p-6 text-left shadow-sm hover:shadow-md transition-shadow animate-fadeIn"
                        style={{ animationDelay: `${index * 0.05}s` }}
                        data-testid={`tag-${tag.tag}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Hash className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold">{tag.tag}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{tag.count} posts</p>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Suggested People */}
              {activeTab === 'people' && (
                <div className="space-y-3">
                  {suggestedUsers.length === 0 ? (
                    <div className="text-center py-20">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No suggestions available</p>
                    </div>
                  ) : (
                    suggestedUsers.map((user, index) => (
                      <div
                        key={user.id}
                        className="bg-white rounded-3xl p-5 shadow-sm flex items-center justify-between animate-fadeIn"
                        style={{ animationDelay: `${index * 0.05}s` }}
                        data-testid={`suggested-user-${user.id}`}
                      >
                        <div 
                          className="flex items-center gap-4 cursor-pointer flex-1"
                          onClick={() => navigate(`/profile/${user.username}`)}
                        >
                          <Avatar className="w-14 h-14 ring-2 ring-black/5">
                            <AvatarImage src={user.avatar} alt={user.full_name} />
                            <AvatarFallback className="bg-muted text-lg font-semibold">
                              {user.full_name?.charAt(0) || user.username?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {user.followers_count} followers
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleFollow(user.id)}
                          disabled={user.is_following}
                          className={`rounded-full font-medium ${
                            user.is_following 
                              ? 'bg-muted text-muted-foreground' 
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          data-testid={`follow-btn-${user.id}`}
                        >
                          {user.is_following ? 'Following' : 'Follow'}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
