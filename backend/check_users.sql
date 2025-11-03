-- Check current users in the database
SELECT 
    id,
    email,
    "FirstName" as first_name,
    "LastName" as last_name,
    "AvatarUrl" as avatar_url,
    "CreatedAt" as created_at
FROM users 
ORDER BY "CreatedAt" DESC;

-- Check social accounts
SELECT 
    sa.id,
    sa."UserId" as user_id,
    sa."Provider" as provider,
    sa."ProviderId" as provider_id,
    u.email as user_email
FROM "SocialAccounts" sa
JOIN users u ON sa."UserId" = u.id
ORDER BY sa."CreatedAt" DESC;

-- Count total users
SELECT COUNT(*) as total_users FROM users;