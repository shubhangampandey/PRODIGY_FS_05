import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { X, Image, Video, Hash, AtSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CreatePostModal({ open, onClose, onPostCreated }) {
  const { user, api } = useAuth();
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [mediaType, setMediaType] = useState(null);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const file = files[0];
    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');

    if (!isVideo && !isImage) {
      toast.error('Please select an image or video file');
      return;
    }

    // Limit file size (10MB for images, 50MB for videos)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Max ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    // Clear existing media if switching types
    if (mediaType && ((isVideo && mediaType !== 'video') || (isImage && mediaType !== 'image'))) {
      setMediaFiles([]);
      setMediaPreviews([]);
    }

    setMediaType(isVideo ? 'video' : 'image');
    setMediaFiles(prev => [...prev, file]);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreviews(prev => [...prev, e.target.result]);
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
    if (mediaFiles.length === 1) {
      setMediaType(null);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error('Please add some content or media');
      return;
    }

    setLoading(true);
    try {
      // Upload media files
      const mediaUrls = [];
      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api().post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrls.push(uploadRes.data.url);
      }

      // Parse tags
      const tagList = tags
        .split(/[,\s]+/)
        .map(t => t.replace(/^#/, '').toLowerCase().trim())
        .filter(t => t.length > 0);

      // Parse mentioned users from content
      const mentionedUsers = [];
      const mentionRegex = /@(\w+)/g;
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        mentionedUsers.push(match[1]);
      }

      // Create post
      const postData = {
        content: content.trim(),
        media_urls: mediaUrls,
        media_type: mediaType,
        tags: tagList,
        mentioned_users: mentionedUsers
      };

      const response = await api().post('/posts', postData);
      toast.success('Post created!');
      onPostCreated?.(response.data);
      
      // Reset form
      setContent('');
      setMediaFiles([]);
      setMediaPreviews([]);
      setMediaType(null);
      setTags('');
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error(error.response?.data?.detail || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (content.trim() || mediaFiles.length > 0) {
      if (window.confirm('Discard this post?')) {
        setContent('');
        setMediaFiles([]);
        setMediaPreviews([]);
        setMediaType(null);
        setTags('');
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] rounded-3xl p-0 gap-0" data-testid="create-post-modal">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-xl font-bold font-['Manrope']">Create Post</DialogTitle>
        </DialogHeader>

        <div className="p-5">
          {/* User Avatar & Textarea */}
          <div className="flex gap-3">
            <Avatar className="w-11 h-11 ring-2 ring-black/5">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-muted font-semibold">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening?"
                className="min-h-[120px] border-0 resize-none text-lg focus-visible:ring-0 p-0 placeholder:text-muted-foreground"
                data-testid="post-content-input"
              />
            </div>
          </div>

          {/* Media Previews */}
          {mediaPreviews.length > 0 && (
            <div className={`mt-4 grid gap-2 ${mediaPreviews.length > 1 ? 'grid-cols-2' : ''}`}>
              {mediaPreviews.map((preview, index) => (
                <div key={index} className="relative rounded-2xl overflow-hidden bg-muted">
                  {mediaType === 'video' ? (
                    <video src={preview} controls className="w-full max-h-64 object-cover" />
                  ) : (
                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full max-h-64 object-cover" />
                  )}
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 text-white rounded-full flex items-center justify-center hover:bg-black"
                    data-testid={`remove-media-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tags Input */}
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Hash className="w-4 h-4" />
              <span>Add tags (separated by commas or spaces)</span>
            </div>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tech, lifestyle, photography"
              className="rounded-2xl bg-muted/50 border-0"
              data-testid="post-tags-input"
            />
          </div>

          {/* Mention hint */}
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <AtSign className="w-3 h-3" />
            Use @username to mention someone
          </p>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex items-center justify-between border-t border-black/5 mt-2">
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/*"
              className="hidden"
              data-testid="file-input"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
              disabled={mediaPreviews.length >= 4}
              data-testid="add-media-btn"
            >
              <Image className="w-5 h-5" />
            </Button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || (!content.trim() && mediaFiles.length === 0)}
            className="rounded-full bg-black text-white hover:bg-black/90 h-10 px-6 font-semibold"
            data-testid="submit-post-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Posting...
              </span>
            ) : (
              'Post'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
