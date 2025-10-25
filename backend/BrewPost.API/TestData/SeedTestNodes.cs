using BrewPost.Core.Entities;
using BrewPost.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace BrewPost.API.TestData
{
    public static class SeedTestNodes
    {
        public static async Task SeedAsync(BrewPostDbContext context)
        {
            // Clear existing nodes to reseed with fixed IDs
            var existingNodes = await context.Nodes.ToListAsync();
            if (existingNodes.Any())
            {
                context.Nodes.RemoveRange(existingNodes);
                await context.SaveChangesAsync();
            }

            // Check if test user already exists
            var testUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "test@brewpost.com");
            if (testUser == null)
            {
                testUser = new User
                {
                    Id = Guid.NewGuid(),
                    Email = "test@brewpost.com",
                    FirstName = "Test",
                    LastName = "User",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                context.Users.Add(testUser);
                await context.SaveChangesAsync();
            }

            var testNodes = new List<Node>
            {
                // Node with image and good content
                new Node
                {
                    Id = new Guid("11111111-1111-1111-1111-111111111111"),
                    UserId = testUser.Id,
                    Title = "Premium Wine Tasting Experience",
                    Content = "Join us for an exclusive wine tasting featuring rare vintages from our private collection. Experience the perfect blend of tradition and innovation. #WineTasting #PremiumWine #Exclusive",
                    ImageUrl = "https://example.com/wine-tasting.jpg",
                    ImageUrls = JsonDocument.Parse(JsonSerializer.Serialize(new[] { "https://example.com/wine-tasting.jpg", "https://example.com/vineyard.jpg" })),
                    ImagePrompt = "A sophisticated wine tasting setup with premium wine glasses, elegant lighting, and vintage bottles",
                    Type = "post",
                    Status = "draft",
                    X = 100,
                    Y = 100,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                
                // Node with no image but good caption
                new Node
                {
                    Id = new Guid("22222222-2222-2222-2222-222222222222"),
                    UserId = testUser.Id,
                    Title = "Craft Beer Revolution",
                    Content = "Discover the art of craft brewing! Our master brewers have created something truly special. What's your favorite beer style? Tell us in the comments! #CraftBeer #Brewing #LocalBeer",
                    ImageUrl = null,
                    ImageUrls = null,
                    ImagePrompt = null,
                    Type = "post",
                    Status = "draft",
                    X = 200,
                    Y = 150,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                
                // Node with image but poor content
                new Node
                {
                    Id = new Guid("33333333-3333-3333-3333-333333333333"),
                    UserId = testUser.Id,
                    Title = "Wine",
                    Content = "Wine is good.",
                    ImageUrl = "https://example.com/wine-bottle.jpg",
                    ImageUrls = JsonDocument.Parse(JsonSerializer.Serialize(new[] { "https://example.com/wine-bottle.jpg" })),
                    ImagePrompt = "Simple wine bottle photo",
                    Type = "post",
                    Status = "draft",
                    X = 300,
                    Y = 200,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                
                // Node with no image and poor content
                new Node
                {
                    Id = new Guid("44444444-4444-4444-4444-444444444444"),
                    UserId = testUser.Id,
                    Title = "Post",
                    Content = "Text",
                    ImageUrl = null,
                    ImageUrls = null,
                    ImagePrompt = null,
                    Type = "post",
                    Status = "draft",
                    X = 400,
                    Y = 250,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                
                // Node with multiple images and excellent content
                new Node
                {
                    Id = new Guid("55555555-5555-5555-5555-555555555555"),
                    UserId = testUser.Id,
                    Title = "Vineyard Harvest Festival 2024",
                    Content = "Experience the magic of harvest season at our annual festival! Join us for wine tastings, live music, gourmet food pairings, and exclusive tours of our historic cellars. Book your tickets now for this unforgettable celebration of wine culture! #HarvestFestival #WineLovers #VineyardLife #WineTasting #LocalEvents",
                    ImageUrl = "https://example.com/harvest-festival.jpg",
                    ImageUrls = JsonDocument.Parse(JsonSerializer.Serialize(new[] { 
                        "https://example.com/harvest-festival.jpg", 
                        "https://example.com/vineyard-sunset.jpg",
                        "https://example.com/wine-barrels.jpg",
                        "https://example.com/grape-harvest.jpg"
                    })),
                    ImagePrompt = "Vibrant harvest festival scene with people enjoying wine, beautiful vineyard backdrop, golden hour lighting, festive atmosphere",
                    Type = "post",
                    Status = "published",
                    X = 500,
                    Y = 300,
                    CreatedAt = DateTime.UtcNow.AddDays(-5),
                    UpdatedAt = DateTime.UtcNow,
                    PostedAt = DateTime.UtcNow.AddDays(-3)
                }
            };

            context.Nodes.AddRange(testNodes);
            await context.SaveChangesAsync();
        }
    }
}