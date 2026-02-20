from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============= MODELS =============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    cover_image: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    full_name: str
    bio: Optional[str] = None
    avatar: Optional[str] = None
    cover_image: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    created_at: str
    is_following: Optional[bool] = None

class PostCreate(BaseModel):
    content: str
    media_urls: Optional[List[str]] = []
    media_type: Optional[str] = None  # 'image' or 'video'
    tags: Optional[List[str]] = []
    mentioned_users: Optional[List[str]] = []

class PostResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    content: str
    media_urls: List[str] = []
    media_type: Optional[str] = None
    tags: List[str] = []
    mentioned_users: List[str] = []
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: str
    user: Optional[dict] = None
    is_liked: Optional[bool] = None

class CommentCreate(BaseModel):
    content: str
    mentioned_users: Optional[List[str]] = []

class CommentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    post_id: str
    user_id: str
    content: str
    mentioned_users: List[str] = []
    likes_count: int = 0
    created_at: str
    user: Optional[dict] = None

class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str  # 'like', 'comment', 'follow', 'mention'
    from_user_id: str
    post_id: Optional[str] = None
    message: str
    is_read: bool = False
    created_at: str
    from_user: Optional[dict] = None

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    conversation_id: str
    sender_id: str
    content: str
    created_at: str
    is_read: bool = False

class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    participants: List[str]
    last_message: Optional[str] = None
    last_message_at: Optional[str] = None
    unread_count: int = 0
    other_user: Optional[dict] = None

# ============= HELPERS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_brief(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1, "full_name": 1, "avatar": 1})
    return user or {}

async def create_notification(user_id: str, notification_type: str, from_user_id: str, post_id: str = None, message: str = ""):
    if user_id == from_user_id:
        return
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "from_user_id": from_user_id,
        "post_id": post_id,
        "message": message,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)

# ============= AUTH ROUTES =============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"username": data.username}]})
    if existing:
        if existing.get("email") == data.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "username": data.username,
        "full_name": data.full_name,
        "password": hash_password(data.password),
        "bio": None,
        "avatar": None,
        "cover_image": None,
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user["id"])
    user_response = {k: v for k, v in user.items() if k not in ["password", "_id"]}
    return {"token": token, "user": user_response}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"])
    user_response = {k: v for k, v in user.items() if k not in ["password", "_id"]}
    return {"token": token, "user": user_response}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ============= USER ROUTES =============

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_following = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user_id})
    user["is_following"] = bool(is_following)
    return user

@api_router.get("/users/username/{username}", response_model=UserResponse)
async def get_user_by_username(username: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_following = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user["id"]})
    user["is_following"] = bool(is_following)
    return user

@api_router.put("/users/me", response_model=UserResponse)
async def update_profile(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return user

@api_router.get("/users/{user_id}/followers")
async def get_followers(user_id: str, current_user: dict = Depends(get_current_user)):
    follows = await db.follows.find({"following_id": user_id}, {"_id": 0}).to_list(1000)
    follower_ids = [f["follower_id"] for f in follows]
    followers = await db.users.find({"id": {"$in": follower_ids}}, {"_id": 0, "password": 0}).to_list(1000)
    
    for follower in followers:
        is_following = await db.follows.find_one({"follower_id": current_user["id"], "following_id": follower["id"]})
        follower["is_following"] = bool(is_following)
    
    return followers

@api_router.get("/users/{user_id}/following")
async def get_following(user_id: str, current_user: dict = Depends(get_current_user)):
    follows = await db.follows.find({"follower_id": user_id}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in follows]
    following = await db.users.find({"id": {"$in": following_ids}}, {"_id": 0, "password": 0}).to_list(1000)
    
    for user in following:
        is_following = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user["id"]})
        user["is_following"] = bool(is_following)
    
    return following

# ============= FOLLOW ROUTES =============

@api_router.post("/follow/{user_id}")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already following")
    
    follow = {
        "id": str(uuid.uuid4()),
        "follower_id": current_user["id"],
        "following_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.follows.insert_one(follow)
    
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
    
    await create_notification(user_id, "follow", current_user["id"], message=f"{current_user['username']} started following you")
    
    return {"message": "Followed successfully"}

@api_router.delete("/follow/{user_id}")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.follows.delete_one({"follower_id": current_user["id"], "following_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this user")
    
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
    
    return {"message": "Unfollowed successfully"}

# ============= POST ROUTES =============

@api_router.post("/posts", response_model=PostResponse)
async def create_post(data: PostCreate, current_user: dict = Depends(get_current_user)):
    post = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "content": data.content,
        "media_urls": data.media_urls or [],
        "media_type": data.media_type,
        "tags": data.tags or [],
        "mentioned_users": data.mentioned_users or [],
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.posts.insert_one(post)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": 1}})
    
    # Notify mentioned users
    for username in data.mentioned_users or []:
        mentioned_user = await db.users.find_one({"username": username})
        if mentioned_user:
            await create_notification(mentioned_user["id"], "mention", current_user["id"], post["id"], f"{current_user['username']} mentioned you in a post")
    
    post["user"] = await get_user_brief(current_user["id"])
    if "_id" in post:
        del post["_id"]
    return post

@api_router.get("/posts", response_model=List[PostResponse])
async def get_feed(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    # Get posts from followed users and own posts
    follows = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in follows]
    following_ids.append(current_user["id"])
    
    posts = await db.posts.find(
        {"user_id": {"$in": following_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
        post["is_liked"] = bool(is_liked)
    
    return posts

@api_router.get("/posts/all", response_model=List[PostResponse])
async def get_all_posts(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
        post["is_liked"] = bool(is_liked)
    
    return posts

@api_router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post["user"] = await get_user_brief(post["user_id"])
    is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
    post["is_liked"] = bool(is_liked)
    return post

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.posts.delete_one({"id": post_id})
    await db.likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": -1}})
    
    return {"message": "Post deleted"}

@api_router.get("/users/{user_id}/posts", response_model=List[PostResponse])
async def get_user_posts(user_id: str, skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
        post["is_liked"] = bool(is_liked)
    
    return posts

# ============= LIKE ROUTES =============

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.likes.find_one({"user_id": current_user["id"], "post_id": post_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already liked")
    
    like = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "post_id": post_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.likes.insert_one(like)
    await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
    
    await create_notification(post["user_id"], "like", current_user["id"], post_id, f"{current_user['username']} liked your post")
    
    return {"message": "Liked"}

@api_router.delete("/posts/{post_id}/like")
async def unlike_post(post_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.likes.delete_one({"user_id": current_user["id"], "post_id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
    return {"message": "Unliked"}

# ============= COMMENT ROUTES =============

@api_router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(post_id: str, data: CommentCreate, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": current_user["id"],
        "content": data.content,
        "mentioned_users": data.mentioned_users or [],
        "likes_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.comments.insert_one(comment)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    await create_notification(post["user_id"], "comment", current_user["id"], post_id, f"{current_user['username']} commented on your post")
    
    comment["user"] = await get_user_brief(current_user["id"])
    if "_id" in comment:
        del comment["_id"]
    return comment

@api_router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for comment in comments:
        comment["user"] = await get_user_brief(comment["user_id"])
    
    return comments

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.comments.delete_one({"id": comment_id})
    await db.posts.update_one({"id": comment["post_id"]}, {"$inc": {"comments_count": -1}})
    
    return {"message": "Comment deleted"}

# ============= NOTIFICATION ROUTES =============

@api_router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for notif in notifications:
        notif["from_user"] = await get_user_brief(notif["from_user_id"])
    
    return notifications

@api_router.put("/notifications/read")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user["id"], "is_read": False})
    return {"count": count}

# ============= SEARCH ROUTES =============

@api_router.get("/search/users")
async def search_users(q: str, current_user: dict = Depends(get_current_user)):
    users = await db.users.find(
        {"$or": [
            {"username": {"$regex": q, "$options": "i"}},
            {"full_name": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0, "password": 0}
    ).limit(20).to_list(20)
    
    for user in users:
        is_following = await db.follows.find_one({"follower_id": current_user["id"], "following_id": user["id"]})
        user["is_following"] = bool(is_following)
    
    return users

@api_router.get("/search/posts")
async def search_posts(q: str, current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find(
        {"$or": [
            {"content": {"$regex": q, "$options": "i"}},
            {"tags": {"$in": [q.lower()]}}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
        post["is_liked"] = bool(is_liked)
    
    return posts

@api_router.get("/search/tags/{tag}")
async def search_by_tag(tag: str, current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find(
        {"tags": {"$in": [tag.lower()]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
        post["is_liked"] = bool(is_liked)
    
    return posts

# ============= TRENDING ROUTES =============

@api_router.get("/trending/posts")
async def get_trending_posts(current_user: dict = Depends(get_current_user)):
    # Get posts sorted by engagement (likes + comments)
    posts = await db.posts.find({}, {"_id": 0}).to_list(1000)
    posts.sort(key=lambda x: x.get("likes_count", 0) + x.get("comments_count", 0) * 2, reverse=True)
    posts = posts[:20]
    
    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({"user_id": current_user["id"], "post_id": post["id"]})
        post["is_liked"] = bool(is_liked)
    
    return posts

@api_router.get("/trending/tags")
async def get_trending_tags(current_user: dict = Depends(get_current_user)):
    # Aggregate tags from recent posts
    posts = await db.posts.find({}, {"_id": 0, "tags": 1}).to_list(500)
    tag_counts = {}
    for post in posts:
        for tag in post.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    trending = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    return [{"tag": t[0], "count": t[1]} for t in trending]

@api_router.get("/suggested-users")
async def get_suggested_users(current_user: dict = Depends(get_current_user)):
    # Get users not followed
    follows = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in follows]
    following_ids.append(current_user["id"])
    
    users = await db.users.find(
        {"id": {"$nin": following_ids}},
        {"_id": 0, "password": 0}
    ).sort("followers_count", -1).limit(10).to_list(10)
    
    for user in users:
        user["is_following"] = False
    
    return users

# ============= MESSAGING ROUTES =============

@api_router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    conversations = await db.conversations.find(
        {"participants": current_user["id"]},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)
    
    for conv in conversations:
        other_id = [p for p in conv["participants"] if p != current_user["id"]][0]
        conv["other_user"] = await get_user_brief(other_id)
        unread = await db.messages.count_documents({
            "conversation_id": conv["id"],
            "sender_id": {"$ne": current_user["id"]},
            "is_read": False
        })
        conv["unread_count"] = unread
    
    return conversations

@api_router.post("/conversations/{user_id}")
async def create_or_get_conversation(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check existing conversation
    existing = await db.conversations.find_one({
        "participants": {"$all": [current_user["id"], user_id]}
    }, {"_id": 0})
    
    if existing:
        existing["other_user"] = await get_user_brief(user_id)
        return existing
    
    conversation = {
        "id": str(uuid.uuid4()),
        "participants": [current_user["id"], user_id],
        "last_message": None,
        "last_message_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conversations.insert_one(conversation)
    
    conv_response = {k: v for k, v in conversation.items() if k != "_id"}
    conv_response["other_user"] = await get_user_brief(user_id)
    conv_response["unread_count"] = 0
    return conv_response

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conversation_id})
    if not conv or current_user["id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Mark messages as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "sender_id": {"$ne": current_user["id"]}, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return messages

@api_router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(conversation_id: str, data: MessageCreate, current_user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conversation_id})
    if not conv or current_user["id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": data.content,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message)
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": data.content, "last_message_at": message["created_at"]}}
    )
    
    if "_id" in message:
        del message["_id"]
    return message

@api_router.get("/messages/unread-count")
async def get_unread_messages_count(current_user: dict = Depends(get_current_user)):
    convs = await db.conversations.find({"participants": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
    conv_ids = [c["id"] for c in convs]
    count = await db.messages.count_documents({
        "conversation_id": {"$in": conv_ids},
        "sender_id": {"$ne": current_user["id"]},
        "is_read": False
    })
    return {"count": count}

# ============= RECOMMENDATIONS =============
@api_router.get("/recommendations/feed")
async def get_ai_recommendations(current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find(
        {"user_id": {"$ne": current_user["id"]}},
        {"_id": 0}
    ).sort("likes_count", -1).limit(10).to_list(10)

    for post in posts:
        post["user"] = await get_user_brief(post["user_id"])
        is_liked = await db.likes.find_one({
            "user_id": current_user["id"],
            "post_id": post["id"]
        })
        post["is_liked"] = bool(is_liked)

    return posts


# ============= SHARE =============

@api_router.post("/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.posts.update_one({"id": post_id}, {"$inc": {"shares_count": 1}})
    return {"message": "Shared", "share_url": f"/post/{post_id}"}

# ============= FILE UPLOAD =============

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    content = await file.read()
    base64_content = base64.b64encode(content).decode()
    
    file_type = "image" if file.content_type.startswith("image") else "video"
    data_url = f"data:{file.content_type};base64,{base64_content}"
    
    return {"url": data_url, "type": file_type}

# Include router
app.include_router(api_router)

# Health check route
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "lumina-social"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
