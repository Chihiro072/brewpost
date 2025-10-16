<div align="center">
  <img src="./public/logo.svg" alt="Brewpost Logo" width="200"/>
  
  # Brewpost
  
  **Visual Content Planning & Scheduling Platform**
  
  <p>
    <em>Your creative workspace where ideas transform into polished social media posts with the help of AI</em>
  </p>
  
  ![Powered by AWS](https://img.shields.io/badge/Powered%20by-AWS-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
  
  ### 🌐 [Try Brewpost Live](https://brewpost.duckdns.org/)
  
</div>

---

**Brewpost** is a visual content planning and scheduling platform that helps you craft, organize, and publish social media posts to X (Twitter) and LinkedIn. Think of it as your creative workspace where ideas transform into polished posts with the help of AI.

**🚀 Live Demo:** [https://brewpost.duckdns.org/](https://brewpost.duckdns.org/)

---

## 💡 What Makes Brewpost Special?

### 🎨 The Canvas Experience
At the heart of Brewpost is an **interactive visual canvas** where you can:
- Drag and drop content ideas like puzzle pieces
- See your entire content strategy at a glance
- Connect related posts and campaigns visually
- Transform abstract ideas into structured content plans

### 🤖 AI-Powered Content Creation
Brewpost isn't just a planner—it's your creative assistant:
- **Generate post copy** tailored to your brand voice
- **Create images** from text descriptions using AWS Bedrock
- **Enhance prompts** to get better AI-generated visuals
- **Get suggestions** based on trending topics and campaign types

### 📅 Smart Scheduling
- Calendar view to visualize your posting schedule
- Direct posting to X and LinkedIn with OAuth authentication
- Store and manage scheduled posts in DynamoDB
- Never miss a posting opportunity with EventBridge scheduling

### 🔒 Secure & Connected
- OAuth 2.0 integration with X and LinkedIn
- AWS Cognito for user authentication
- Encrypted token storage
- Safe handling of your social media credentials

---

## 🚀 Getting Started

### Try It Now

**Live Application:** [https://brewpost.duckdns.org/](https://brewpost.duckdns.org/)

Start planning and scheduling your social media content right away! No installation required.

---

### For Developers: Local Setup

Want to run Brewpost locally or contribute to the project? Follow these steps:

#### Prerequisites

- **Node.js** (v18 or higher)
- **AWS Account** with access to the following services:
  - Amazon Cognito (Authentication)
  - AWS Bedrock (AI Generation)
  - AWS AppSync (GraphQL API)
  - Amazon DynamoDB (Database)
  - Amazon EC2 (Hosting)
  - Amazon S3 (Storage)
  - AWS Lambda (Serverless Functions)
  - Amazon EventBridge (Scheduling)
  - AWS Secrets Manager (Credential Management)
- **Social Media API Credentials**:
  - X (Twitter) Developer Account
  - LinkedIn Developer Account

#### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SherlocksHolmesc/brewpost-canvas-plan.git
   cd brewpost-canvas-plan
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory with the following:
   ```env
   # AWS Configuration
   ACCESS_KEY_ID=your_aws_access_key
   SECRET_ACCESS_KEY=your_aws_secret_key
   REGION=us-east-1
   
   # AWS Services
   S3_BUCKET=your-s3-bucket
   SCHEDULES_TABLE=Schedules
   TEXT_MODEL=your-bedrock-text-model
   IMAGE_MODEL=your-bedrock-image-model
   
   # Cognito
   COGNITO_CLIENT_ID=your_cognito_client_id
   COGNITO_CLIENT_SECRET=your_cognito_client_secret
   COGNITO_DOMAIN=your_cognito_domain
   
   # X (Twitter) API
   VITE_X_CLIENT_ID=your_x_client_id
   VITE_X_CLIENT_SECRET=your_x_client_secret
   VITE_X_REDIRECT_URI=http://localhost:8080/x-callback
   
   # LinkedIn API
   LINKEDIN_CLIENT_ID=your_linkedin_client_id
   LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
   LINKEDIN_REDIRECT_URI=http://localhost:8080/Callback
   
   # Server Configuration
   PORT=8081
   FRONTEND_URL=http://localhost:8080
   SESSION_SECRET=your_session_secret
   ```

4. **Set up AWS resources**
   
   Create a DynamoDB table named `Schedules` with the following schema:
   - Primary Key: `id` (String)
   - Add any additional indexes as needed

5. **Run the application**
   ```bash
   npm run dev:full
   ```
   
   This starts both the frontend (port 8080) and backend server (port 8081).

---

## 📖 How to Use Brewpost

### 1. **Plan Your Content**
   - Open the canvas and start adding content nodes
   - Each node represents a post idea with title, content, and optional image
   - Drag nodes around to organize your campaigns visually

### 2. **Generate AI Content**
   - Click on any node to open the details panel
   - Use "Generate Enhanced Prompt" to improve your image descriptions
   - Click "Generate Image" to create visuals using AWS Bedrock
   - Edit the AI-generated copy to match your voice

### 3. **Schedule & Post**
   - Open the calendar view to see your content timeline
   - Pick a date and time for each post
   - Connect your X and LinkedIn accounts
   - Post immediately or schedule for later

### 4. **Manage Your Social Accounts**
   - Navigate to test pages to authenticate with X and LinkedIn
   - Your tokens are securely stored and refreshed automatically
   - Post to multiple platforms from one interface

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing-fast development
- **TailwindCSS** + **shadcn/ui** for beautiful, accessible components
- **React Router** for navigation
- **TanStack Query** for state management and data fetching

### Backend
- **Node.js** + **Express** server
- **AWS SDK** for cloud integrations
- **OAuth 2.0** for social media authentication
- Session management with `express-session`

### AWS Services (Cloud Infrastructure)

Brewpost is built on **Amazon Web Services (AWS)** for scalable, secure, and reliable cloud infrastructure:

- **Amazon Cognito**: User authentication, authorization, and user management
- **AWS Bedrock**: AI-powered text generation and image creation for content
- **AWS AppSync**: GraphQL API for real-time data synchronization
- **Amazon DynamoDB**: NoSQL database for posts, schedules, and user data
- **Amazon EC2**: Application hosting and server infrastructure
- **Amazon S3**: Secure image storage and static asset hosting
- **AWS Lambda**: Serverless functions for background processing and automated tasks
- **Amazon EventBridge**: Intelligent scheduling for automated post publishing
- **AWS Secrets Manager**: Secure storage and management of API keys and credentials

<img width="1890" height="1064" alt="image" src="https://github.com/user-attachments/assets/f11f9d80-dc10-47fb-aff7-8711d7b710bc" />

---

## 🎯 Key Features Breakdown

| Feature | Description | AWS Service |
|---------|-------------|-------------|
| **Visual Canvas** | Drag-and-drop interface for planning content campaigns | AppSync + DynamoDB |
| **AI Generation** | Create post copy and images using AI | AWS Bedrock |
| **Multi-Platform** | Post to X and LinkedIn from one dashboard | Lambda + EventBridge |
| **Smart Scheduling** | Calendar-based scheduling with automation | EventBridge + DynamoDB |
| **Secure Authentication** | OAuth and user management | Amazon Cognito |
| **Real-time Sync** | Instant data synchronization across devices | AWS AppSync |
| **Cloud Storage** | Secure image and asset storage | Amazon S3 |
| **Secrets Management** | Secure API key and credential storage | AWS Secrets Manager |
| **Scalable Hosting** | Reliable application hosting | Amazon EC2 |

---


**Built with ❤️ for content creators who think visually.**
