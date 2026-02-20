import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import PostCard from '../components/PostCard';
import EditProfileModal from '../components/EditProfileModal';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar, MapPin, Link as LinkIcon, Settings, MessageCircle, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, api } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  const isOwnProfile = currentUser?.username === username;

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const profileRes = await api().get(`/users/username/${username}`);
      setProfile(profileRes.data);

      const postsRes = await api().get(`/users/${profileRes.data.id}/posts`);
      setPosts(postsRes.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 404) {
        toast.error('User not found');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  }, [api, username, navigate]);

  const fetchConnections = useCallback(async () => {
    if (!profile) return;
    try {
      const [followersRes, followingRes] = await Promise.all([
        api().get(`/users/${profile.id}/followers`),
        api().get(`/users/${profile.id}/following`)
      ]);
      setFollowers(followersRes.data);
      setFollowing(followingRes.data);
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  }, [api, profile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (activeTab === 'followers' || activeTab === 'following') {
      fetchConnections();
    }
  }, [activeTab, fetchConnections]);

  const handleFollow = async () => {
    try {
      if (profile.is_following) {
        await api().delete(`/follow/${profile.id}`);
        setProfile(prev => ({
          ...prev,
          is_following: false,
          followers_count: prev.followers_count - 1
        }));
        toast.success('Unfollowed');
      } else {
        await api().post(`/follow/${profile.id}`);
        setProfile(prev => ({
          ...prev,
          is_following: true,
          followers_count: prev.followers_count + 1
        }));
        toast.success('Following!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const handleMessage = async () => {
    try {
      const response = await api().post(`/conversations/${profile.id}`);
      navigate(`/messages/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to start conversation');
    }
  };

  const handleProfileUpdated = (updatedProfile) => {
    setProfile(prev => ({ ...prev, ...updatedProfile }));
    setShowEditProfile(false);
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-[800px] mx-auto">
          <Skeleton className="h-48 w-full rounded-3xl mb-4" />
          <div className="flex items-end gap-4 -mt-16 ml-6">
            <Skeleton className="w-32 h-32 rounded-full" />
            <div className="space-y-2 mb-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!profile) return null;

  return (
    <MainLayout>
      <div className="max-w-[800px] mx-auto" data-testid="profile-page">
        {/* Cover Image */}
        <div className="relative h-48 md:h-64 rounded-3xl overflow-hidden bg-muted">
          {profile.cover_image ? (
            <img 
              src={profile.cover_image} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4 md:px-6 -mt-16 md:-mt-20 relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="w-28 h-28 md:w-36 md:h-36 ring-4 ring-white shadow-lg">
                <AvatarImage src={profile.avatar} alt={profile.full_name} />
                <AvatarFallback className="bg-black text-white text-3xl font-bold">
                  {profile.full_name?.charAt(0) || profile.username?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="mb-2">
                <h1 className="text-2xl md:text-3xl font-bold font-['Manrope']" data-testid="profile-name">
                  {profile.full_name}
                </h1>
                <p className="text-muted-foreground" data-testid="profile-username">@{profile.username}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Button
                  onClick={() => setShowEditProfile(true)}
                  variant="outline"
                  className="rounded-full font-medium"
                  data-testid="edit-profile-btn"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleMessage}
                    variant="outline"
                    className="rounded-full"
                    data-testid="message-btn"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleFollow}
                    className={`rounded-full font-medium ${
                      profile.is_following
                        ? 'bg-muted text-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    data-testid="follow-btn"
                  >
                    {profile.is_following ? (
                      <>
                        <UserMinus className="w-4 h-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-foreground max-w-xl" data-testid="profile-bio">
              {profile.bio}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Joined {formatDate(profile.created_at)}
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4">
            <button 
              onClick={() => setActiveTab('posts')}
              className="hover:underline"
              data-testid="posts-count"
            >
              <span className="font-bold">{profile.posts_count}</span>
              <span className="text-muted-foreground ml-1">posts</span>
            </button>
            <button 
              onClick={() => setActiveTab('followers')}
              className="hover:underline"
              data-testid="followers-count"
            >
              <span className="font-bold">{profile.followers_count}</span>
              <span className="text-muted-foreground ml-1">followers</span>
            </button>
            <button 
              onClick={() => setActiveTab('following')}
              className="hover:underline"
              data-testid="following-count"
            >
              <span className="font-bold">{profile.following_count}</span>
              <span className="text-muted-foreground ml-1">following</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="w-full bg-muted/50 p-1 rounded-full">
            <TabsTrigger 
              value="posts" 
              className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid="profile-posts-tab"
            >
              Posts
            </TabsTrigger>
            <TabsTrigger 
              value="followers"
              className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid="profile-followers-tab"
            >
              Followers
            </TabsTrigger>
            <TabsTrigger 
              value="following"
              className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid="profile-following-tab"
            >
              Following
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6 space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No posts yet
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
          </TabsContent>

          <TabsContent value="followers" className="mt-6 space-y-3">
            {followers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No followers yet
              </div>
            ) : (
              followers.map((user) => (
                <UserCard key={user.id} user={user} navigate={navigate} api={api} />
              ))
            )}
          </TabsContent>

          <TabsContent value="following" className="mt-6 space-y-3">
            {following.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Not following anyone
              </div>
            ) : (
              following.map((user) => (
                <UserCard key={user.id} user={user} navigate={navigate} api={api} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal
          open={showEditProfile}
          onClose={() => setShowEditProfile(false)}
          profile={profile}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </MainLayout>
  );
}

function UserCard({ user, navigate, api }) {
  const [isFollowing, setIsFollowing] = useState(user.is_following);

  const handleFollow = async (e) => {
    e.stopPropagation();
    try {
      if (isFollowing) {
        await api().delete(`/follow/${user.id}`);
        setIsFollowing(false);
        toast.success('Unfollowed');
      } else {
        await api().post(`/follow/${user.id}`);
        setIsFollowing(true);
        toast.success('Following!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  return (
    <div
      className="bg-white rounded-3xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/profile/${user.username}`)}
      data-testid={`user-card-${user.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar} alt={user.full_name} />
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
        onClick={handleFollow}
        size="sm"
        className={`rounded-full ${
          isFollowing
            ? 'bg-muted text-foreground hover:bg-red-50 hover:text-red-600'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        data-testid={`user-follow-btn-${user.id}`}
      >
        {isFollowing ? 'Unfollow' : 'Follow'}
      </Button>
    </div>
  );
}
