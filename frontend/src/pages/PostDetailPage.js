import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import PostCard from '../components/PostCard';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function PostDetailPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api().get(`/posts/${postId}`);
      setPost(response.data);
    } catch (error) {
      console.error('Error fetching post:', error);
      if (error.response?.status === 404) {
        toast.error('Post not found');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  }, [api, postId, navigate]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handlePostDeleted = () => {
    navigate('/');
  };

  const handlePostUpdated = (updatedPost) => {
    setPost(updatedPost);
  };

  return (
    <MainLayout>
      <div className="max-w-[600px] mx-auto" data-testid="post-detail-page">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 -mx-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold tracking-tight font-['Manrope']">Post</h1>
          </div>
        </div>

        {/* Post */}
        <div className="py-6">
          {loading ? (
            <div className="bg-white rounded-3xl p-6 shadow-sm animate-pulse">
              <div className="flex gap-3 mb-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-24 w-full mb-4" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : post ? (
            <PostCard 
              post={post}
              onDelete={handlePostDeleted}
              onUpdate={handlePostUpdated}
              showFullComments
            />
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              Post not found
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
