import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Send, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

export default function PostCard({ post, onDelete, onUpdate, showFullComments }) {
  const { user: currentUser, api } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(showFullComments);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const isOwner = currentUser?.id === post.user_id;

  const handleLike = async () => {
    try {
      if (liked) {
        await api().delete(`/posts/${post.id}/like`);
        setLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        await api().post(`/posts/${post.id}/like`);
        setLiked(true);
        setLikesCount(prev => prev + 1);
      }
      onUpdate?.({ ...post, is_liked: !liked, likes_count: liked ? likesCount - 1 : likesCount + 1 });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const handleShare = async () => {
    try {
      await api().post(`/posts/${post.id}/share`);
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this post on Lumina',
          url: `${window.location.origin}/post/${post.id}`
        });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  const handleDelete = async () => {
    try {
      await api().delete(`/posts/${post.id}`);
      toast.success('Post deleted');
      onDelete?.(post.id);
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const loadComments = async () => {
    if (comments.length > 0) {
      setShowComments(!showComments);
      return;
    }
    
    setLoadingComments(true);
    try {
      const response = await api().get(`/posts/${post.id}/comments`);
      setComments(response.data);
      setShowComments(true);
    } catch (error) {
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await api().post(`/posts/${post.id}/comments`, {
        content: newComment.trim()
      });
      setComments(prev => [response.data, ...prev]);
      setCommentsCount(prev => prev + 1);
      setNewComment('');
      onUpdate?.({ ...post, comments_count: commentsCount + 1 });
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api().delete(`/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentsCount(prev => prev - 1);
      onUpdate?.({ ...post, comments_count: commentsCount - 1 });
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString();
  };

  const renderContent = (content) => {
    // Parse hashtags and mentions
    const parts = content.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <span 
            key={i} 
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/search?q=${encodeURIComponent(part)}`);
            }}
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('@')) {
        return (
          <span 
            key={i} 
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${part.slice(1)}`);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden post-card" data-testid={`post-${post.id}`}>
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(`/profile/${post.user?.username}`)}
          >
            <Avatar className="w-11 h-11 ring-2 ring-black/5">
              <AvatarImage src={post.user?.avatar} alt={post.user?.full_name} />
              <AvatarFallback className="bg-muted font-semibold">
                {post.user?.full_name?.charAt(0) || post.user?.username?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold hover:underline">{post.user?.full_name}</p>
              <p className="text-sm text-muted-foreground">
                @{post.user?.username} · {formatTime(post.created_at)}
              </p>
            </div>
          </div>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" data-testid="post-menu-btn">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-red-600 focus:text-red-600 cursor-pointer rounded-xl"
                  data-testid="delete-post-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        <div 
          className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap cursor-pointer"
          onClick={() => navigate(`/post/${post.id}`)}
        >
          {renderContent(post.content)}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((tag) => (
              <span
                key={tag}
                onClick={() => navigate(`/search?q=%23${tag}`)}
                className="text-sm text-blue-600 hover:underline cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="mt-4 px-5">
          <div className={`grid gap-2 ${post.media_urls.length > 1 ? 'grid-cols-2' : ''}`}>
            {post.media_urls.map((url, index) => (
              <div 
                key={index} 
                className="rounded-2xl overflow-hidden bg-muted aspect-video"
              >
                {post.media_type === 'video' ? (
                  <video 
                    src={url} 
                    controls 
                    className="w-full h-full object-cover"
                    data-testid={`post-video-${index}`}
                  />
                ) : (
                  <img 
                    src={url} 
                    alt={`Post media ${index + 1}`}
                    className="w-full h-full object-cover"
                    data-testid={`post-image-${index}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`rounded-full gap-2 hover:bg-red-50 hover:text-red-600 ${liked ? 'text-red-600' : 'text-muted-foreground'}`}
              data-testid="like-btn"
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{likesCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadComments}
              className="rounded-full gap-2 text-muted-foreground hover:bg-blue-50 hover:text-blue-600"
              data-testid="comment-btn"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{commentsCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="rounded-full gap-2 text-muted-foreground hover:bg-green-50 hover:text-green-600"
              data-testid="share-btn"
            >
              <Share2 className="w-5 h-5" />
              <span className="text-sm font-medium">{post.shares_count || 0}</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
            data-testid="bookmark-btn"
          >
            <Bookmark className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-black/5" data-testid="comments-section">
            {/* Comment Input */}
            <form onSubmit={handleSubmitComment} className="flex gap-2 mb-4">
              <Avatar className="w-8 h-8">
                <AvatarImage src={currentUser?.avatar} />
                <AvatarFallback className="bg-muted text-xs font-semibold">
                  {currentUser?.full_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-full bg-muted/50 border-0 h-9 text-sm"
                  data-testid="comment-input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newComment.trim() || submittingComment}
                  className="rounded-full h-9 w-9 bg-black text-white hover:bg-black/90"
                  data-testid="submit-comment-btn"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>

            {/* Comments List */}
            {loadingComments ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Loading comments...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No comments yet. Be the first!
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2" data-testid={`comment-${comment.id}`}>
                    <Avatar 
                      className="w-8 h-8 cursor-pointer"
                      onClick={() => navigate(`/profile/${comment.user?.username}`)}
                    >
                      <AvatarImage src={comment.user?.avatar} />
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {comment.user?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-muted/50 rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="font-semibold text-sm cursor-pointer hover:underline"
                            onClick={() => navigate(`/profile/${comment.user?.username}`)}
                          >
                            {comment.user?.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                      {comment.user_id === currentUser?.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-muted-foreground hover:text-red-600 mt-1 ml-3"
                          data-testid={`delete-comment-${comment.id}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
