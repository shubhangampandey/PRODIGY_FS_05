# Lumina – Full Stack Social Media Application

Lumina is a full stack social media platform built to simulate a modern real world social networking system with dynamic feeds, secure authentication, and real time user interactions.

The application is fully database driven. All posts, users, likes, comments, followers, and profile updates are stored and fetched directly from MongoDB with no hardcoded data.

---

## Overview

Lumina provides a complete social media experience where users can create content, interact with posts, explore trending hashtags, and manage personal profiles. The platform demonstrates production style architecture using a React frontend and FastAPI backend connected through secure JWT authentication.

---

## Features

### Authentication and Security
- JWT based authentication system
- Secure Sign Up and Sign In workflow
- Protected API routes
- Persistent login sessions
- Environment based configuration

### Social Media Functionality
- Real time post creation
- Edit and delete posts
- Like and comment system
- Hashtag based posting
- Trending hashtag discovery
- Following and For You feed system
- Fully database driven content rendering

### Profile System
- Dynamic user profiles
- Edit profile functionality
- Real time followers and following counters
- User post history
- Instant profile updates across platform

### Search and Discovery
- Global search functionality
- Hashtag exploration pages
- Content discovery system

### User Interface
- Modern multi column social media layout
- Modal based interactions
- Responsive design
- Component driven frontend architecture

---

## Tech Stack

### Frontend
- React
- CRACO configuration
- Component based architecture
- Custom UI components

### Backend
- FastAPI (Python)
- REST API architecture
- JWT Authentication

### Database
- MongoDB

---

## Project Structure

```
social_media_app/
│
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PostCard.js
│   │   │   ├── CreatePostModal.js
│   │   │   ├── EditProfileModal.js
│   │   │   └── layout/
│   │   ├── App.js
│   │   └── styles/
│   ├── package.json
│   └── .env
│
└── design_guidelines.json
```

---

## Environment Variables

### Frontend `.env`

```
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
ENABLE_HEALTH_CHECK=false
```

### Backend `.env`

```
MONGO_URL=
DB_NAME=social_media_app
CORS_ORIGINS=*
JWT_SECRET=your_secret_key
```

Important: Never commit real `.env` files to version control.

---

## Installation and Setup

### 1. Clone Repository

```
git clone <repository-url>
cd <project-folder>
```

### 2. Backend Setup (FastAPI)

```
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Run backend server:

```
uvicorn server:app --reload
```

Backend runs at:

```
http://127.0.0.1:8000
```

API Documentation:

```
http://127.0.0.1:8000/docs
```

---

### 3. Frontend Setup

```
cd frontend
npm install
npm start
```

Frontend runs at:

```
http://localhost:3000
```

---

## Key Learnings

- Designing scalable social media architecture
- Implementing secure JWT authentication
- Managing user relationships in MongoDB
- Building dynamic feed systems
- Synchronizing frontend state with backend APIs
- Structuring full stack applications with clean separation

---

## Future Improvements

- Real time notifications using WebSockets
- Media upload optimization
- Direct messaging system
- Infinite scrolling feeds
- Deployment with Docker and CI/CD pipelines

---

## Author

Shubhangam Pandey

---

## Support

If you like this project, consider giving it a star.cache refresh
