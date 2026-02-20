import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedPage() {
  const { api } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [feedType, setFeedType] = useState('following'); // 'following' | 'all' | 'recommended'

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      let endpoint = '/posts';
      if (feedType === 'all') endpoint = '/posts/all';
      if (feedType === 'recommended') endpoint = '/recommendations/feed';
      
      const response = await api().get(endpoint);
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [api, feedType]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    setShowCreatePost(false);
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  return (
    <MainLayout>
      <div className="max-w-[600px] mx-auto" data-testid="feed-page">
        {/* Feed Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 -mx-4 px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight font-['Manrope']">Feed</h1>
            <Button
              onClick={() => setShowCreatePost(true)}
              className="rounded-full bg-black text-white hover:bg-black/90 h-10 px-5 font-medium btn-scale"
              data-testid="create-post-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post
            </Button>
          </div>
          
          {/* Feed Type Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-full">
            <button
              onClick={() => setFeedType('following')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${
                feedType === 'following' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="feed-following-tab"
            >
              Following
            </button>
            <button
              onClick={() => setFeedType('all')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${
                feedType === 'all' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="feed-all-tab"
            >
              Discover
            </button>
            <button
              onClick={() => setFeedType('recommended')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                feedType === 'recommended' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="feed-recommended-tab"
            >
              <Sparkles className="w-3 h-3" />
              For You
            </button>
          </div>
        </div>

        {/* Posts */}
        <div className="py-4 space-y-4">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 shadow-sm animate-pulse">
                <div className="flex gap-3 mb-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full mb-4" />
                <Skeleton className="h-48 w-full rounded-2xl" />
              </div>
            ))
          ) : posts.length === 0 ? (
            <div className="text-center py-20 animate-fadeIn">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2 font-['Manrope']">
                {feedType === 'following' ? 'Your feed is empty' : 'No posts yet'}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {feedType === 'following' 
                  ? 'Follow some users to see their posts here, or create your first post!' 
                  : 'Be the first to share something amazing.'}
              </p>
              <Button
                onClick={() => setShowCreatePost(true)}
                className="mt-6 rounded-full bg-black text-white hover:bg-black/90"
                data-testid="empty-create-post-btn"
              >
                Create Post
              </Button>
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
                  onDelete={handlePostDeleted}
                  onUpdate={handlePostUpdated}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPostCreated={handlePostCreated}
      />
    </MainLayout>
  );
}
