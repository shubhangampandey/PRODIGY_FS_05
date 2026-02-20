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
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Camera, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function EditProfileModal({ open, onClose, profile, onProfileUpdated }) {
  const { api } = useAuth();
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatar, setAvatar] = useState(profile.avatar || '');
  const [coverImage, setCoverImage] = useState(profile.cover_image || '');
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || '');
  const [coverPreview, setCoverPreview] = useState(profile.cover_image || '');
  const [loading, setLoading] = useState(false);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const handleFileSelect = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      if (type === 'avatar') {
        setAvatarPreview(dataUrl);
        setAvatar(dataUrl);
      } else {
        setCoverPreview(dataUrl);
        setCoverImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const updateData = {
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        avatar: avatar || null,
        cover_image: coverImage || null
      };

      const response = await api().put('/users/me', updateData);
      toast.success('Profile updated!');
      onProfileUpdated?.(response.data);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 gap-0" data-testid="edit-profile-modal">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-xl font-bold font-['Manrope']">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-6">
          {/* Cover Image */}
          <div className="relative">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Cover Image</Label>
            <div 
              className="h-32 rounded-2xl bg-muted overflow-hidden relative cursor-pointer group"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverPreview('');
                      setCoverImage('');
                    }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid="remove-cover-btn"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <input
              type="file"
              ref={coverInputRef}
              onChange={(e) => handleFileSelect(e, 'cover')}
              accept="image/*"
              className="hidden"
              data-testid="cover-input"
            />
          </div>

          {/* Avatar */}
          <div className="relative">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Profile Photo</Label>
            <div className="flex items-center gap-4">
              <div 
                className="relative cursor-pointer group"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Avatar className="w-20 h-20 ring-4 ring-white shadow">
                  <AvatarImage src={avatarPreview} />
                  <AvatarFallback className="bg-muted text-2xl font-semibold">
                    {fullName.charAt(0) || profile.username?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Click to change your profile photo</p>
                <p className="text-xs mt-1">JPG, PNG. Max 5MB</p>
              </div>
            </div>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={(e) => handleFileSelect(e, 'avatar')}
              accept="image/*"
              className="hidden"
              data-testid="avatar-input"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="rounded-2xl bg-muted/50 border-0 focus:ring-2 focus:ring-black"
              data-testid="fullname-edit-input"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself..."
              className="rounded-2xl bg-muted/50 border-0 focus:ring-2 focus:ring-black min-h-[100px] resize-none"
              maxLength={160}
              data-testid="bio-edit-input"
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex justify-end gap-3 border-t border-black/5 mt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-full"
            data-testid="cancel-edit-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !fullName.trim()}
            className="rounded-full bg-black text-white hover:bg-black/90 px-6 font-semibold"
            data-testid="save-profile-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
