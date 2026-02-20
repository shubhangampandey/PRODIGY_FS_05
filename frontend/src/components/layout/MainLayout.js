import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Home, Search, Compass, Bell, MessageCircle, 
  User, Settings, LogOut, Sparkles, Plus 
} from 'lucide-react';

export default function MainLayout({ children, hideRightSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/explore', icon: Compass, label: 'Explore' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/messages', icon: MessageCircle, label: 'Messages' },
    { path: `/profile/${user?.username}`, icon: User, label: 'Profile' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop Layout */}
      <div className="max-w-7xl mx-auto flex">
        {/* Left Sidebar - Desktop */}
        <aside className="hidden lg:flex w-72 flex-col fixed h-screen border-r border-black/5 bg-white p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight font-['Manrope']">Lumina</span>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3 text-lg font-medium rounded-2xl transition-colors ${
                  isActive(item.path)
                    ? 'bg-muted text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'stroke-[2.5]' : ''}`} />
                {item.label}
              </Link>
            ))}
          </nav>

          <Button
            onClick={() => navigate('/')}
            className="w-full h-14 rounded-full bg-black text-white hover:bg-black/90 font-semibold text-lg mb-6 btn-scale"
            data-testid="sidebar-post-btn"
          >
            <Plus className="w-5 h-5 mr-2" />
            Post
          </Button>

          {/* User Menu */}
          <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/profile/${user?.username}`)}>
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-muted font-semibold">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold truncate">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">@{user?.username}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                logout();
                navigate('/auth');
              }}
              className="p-2 hover:bg-muted rounded-full"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 lg:mr-80 min-h-screen">
          <div className="px-4 pb-24 lg:pb-8">
            {children}
          </div>
        </main>

        {/* Right Sidebar - Desktop */}
        {!hideRightSidebar && (
          <aside className="hidden lg:block w-80 fixed right-0 h-screen border-l border-black/5 bg-white p-6 overflow-y-auto">
            <RightSidebarContent />
          </aside>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-black/5 z-50 safe-bottom">
        <div className="flex justify-around py-2">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-2 ${
                isActive(item.path) ? 'text-foreground' : 'text-muted-foreground'
              }`}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'stroke-[2.5]' : ''}`} />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function RightSidebarContent() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [suggestedUsers, setSuggestedUsers] = React.useState([]);
  const [trendingTags, setTrendingTags] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, tagsRes] = await Promise.all([
          api().get('/suggested-users'),
          api().get('/trending/tags')
        ]);
        setSuggestedUsers(usersRes.data.slice(0, 5));
        setTrendingTags(tagsRes.data.slice(0, 5));
      } catch (error) {
        console.error('Error fetching sidebar data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [api]);

  const handleFollow = async (userId) => {
    try {
      await api().post(`/follow/${userId}`);
      setSuggestedUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_following: true } : u
      ));
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-muted rounded w-32 animate-pulse" />
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-24 animate-pulse" />
              <div className="h-3 bg-muted rounded w-16 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-4 font-['Manrope']">Trending</h3>
          <div className="space-y-3">
            {trendingTags.map((tag) => (
              <button
                key={tag.tag}
                onClick={() => navigate(`/search?q=%23${tag.tag}`)}
                className="w-full text-left p-3 rounded-2xl hover:bg-muted/50 transition-colors"
                data-testid={`trending-tag-${tag.tag}`}
              >
                <p className="font-medium">#{tag.tag}</p>
                <p className="text-sm text-muted-foreground">{tag.count} posts</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Who to Follow */}
      {suggestedUsers.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-4 font-['Manrope']">Who to follow</h3>
          <div className="space-y-3">
            {suggestedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3"
                data-testid={`sidebar-user-${user.id}`}
              >
                <Avatar 
                  className="w-10 h-10 cursor-pointer"
                  onClick={() => navigate(`/profile/${user.username}`)}
                >
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className="bg-muted text-sm font-semibold">
                    {user.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div 
                  className="flex-1 overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/profile/${user.username}`)}
                >
                  <p className="font-medium text-sm truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                </div>
                <Button
                  onClick={() => handleFollow(user.id)}
                  disabled={user.is_following}
                  size="sm"
                  className={`rounded-full text-xs ${
                    user.is_following
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-black text-white hover:bg-black/90'
                  }`}
                  data-testid={`sidebar-follow-${user.id}`}
                >
                  {user.is_following ? 'Following' : 'Follow'}
                </Button>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="w-full text-center mt-4 text-sm text-blue-600 hover:underline"
          >
            Show more
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground pt-4 border-t border-black/5">
        <p>&copy; 2024 Lumina. All rights reserved.</p>
      </div>
    </div>
  );
}
